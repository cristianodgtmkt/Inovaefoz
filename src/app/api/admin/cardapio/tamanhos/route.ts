import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminCtx } from '@/lib/auth/admin'
import { supabaseService } from '@/lib/db/supabase'
import { logAdminAction } from '@/lib/security/audit-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req)
  if (!isAdminCtx(ctx)) return ctx
  const body = await req.json().catch(() => ({}))
  if (!body.produto_id || !body.nome || body.preco == null) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  const sb = supabaseService()
  const { data, error } = await sb.from('tamanhos').insert({
    tenant_id: ctx.tenant_id, produto_id: body.produto_id,
    nome: String(body.nome).trim(), preco: Number(body.preco), ativo: body.ativo !== false,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  void logAdminAction(ctx, 'create_tamanho', 'tamanhos', data.id, body)
  return NextResponse.json({ ok: true, tamanho: data })
}
