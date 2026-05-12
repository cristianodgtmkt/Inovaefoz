import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminCtx } from '@/lib/auth/admin'
import { supabaseService } from '@/lib/db/supabase'
import { rateLimit } from '@/lib/security/rate-limit'
import { logAdminAction } from '@/lib/security/audit-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req)
  if (!isAdminCtx(ctx)) return ctx
  const sb = supabaseService()
  const { data, error } = await sb.from('produtos').select('*').eq('tenant_id', ctx.tenant_id).order('nome')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ produtos: data || [] })
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req)
  if (!isAdminCtx(ctx)) return ctx
  const rl = rateLimit(`cardapio-write:${ctx.user.id}`, { windowSec: 60, max: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limit' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const nome = (body.nome || '').toString().trim()
  if (!nome) return NextResponse.json({ error: 'nome_required' }, { status: 400 })

  const sb = supabaseService()
  const { data, error } = await sb.from('produtos').insert({
    tenant_id: ctx.tenant_id, nome, ativo: body.ativo !== false,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  void logAdminAction(ctx, 'create_produto', 'produtos', data.id, { nome })
  return NextResponse.json({ ok: true, produto: data })
}
