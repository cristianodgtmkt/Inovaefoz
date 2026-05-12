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
  const rl = rateLimit(`tenant-get:${ctx.user.id}`, { windowSec: 60, max: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limit' }, { status: 429, headers: { 'Retry-After': String(rl.reset_in_sec) } })

  const sb = supabaseService()
  const { data, error } = await sb.from('tenants').select('*').eq('id', ctx.tenant_id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tenant: data, role: ctx.role, user: ctx.user })
}

const ALLOWED_FIELDS = [
  'name', 'tagline', 'brand', 'cnpj', 'telefone', 'email', 'instagram',
  'endereco_cep', 'endereco_rua', 'endereco_numero', 'endereco_bairro',
  'endereco_cidade', 'endereco_uf', 'ai_paused_global',
]

export async function PATCH(req: NextRequest) {
  const ctx = await requireAdmin(req)
  if (!isAdminCtx(ctx)) return ctx
  const rl = rateLimit(`tenant-patch:${ctx.user.id}`, { windowSec: 60, max: 30 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limit' }, { status: 429, headers: { 'Retry-After': String(rl.reset_in_sec) } })

  const body = await req.json().catch(() => ({}))
  const updates: any = { updated_at: new Date().toISOString() }
  for (const k of ALLOWED_FIELDS) if (body[k] !== undefined) updates[k] = body[k]
  if (Object.keys(updates).length === 1) return NextResponse.json({ error: 'no_fields' }, { status: 400 })

  const sb = supabaseService()
  const { data, error } = await sb.from('tenants').update(updates).eq('id', ctx.tenant_id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  void logAdminAction(ctx, 'update_tenant', 'tenant', ctx.tenant_id, updates)
  return NextResponse.json({ ok: true, tenant: data })
}
