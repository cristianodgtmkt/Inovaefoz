import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminCtx } from '@/lib/auth/admin'
import { supabaseService } from '@/lib/db/supabase'
import { logAdminAction } from '@/lib/security/audit-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin(req); if (!isAdminCtx(ctx)) return ctx
  const body = await req.json().catch(() => ({}))
  const updates: any = {}
  if (typeof body.nome === 'string') updates.nome = body.nome.trim()
  if (typeof body.tipo === 'string') updates.tipo = body.tipo
  if (body.preco_extra != null) updates.preco_extra = Number(body.preco_extra)
  if (typeof body.ativo === 'boolean') updates.ativo = body.ativo
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'no_fields' }, { status: 400 })
  const sb = supabaseService()
  const { data, error } = await sb.from('complementos').update(updates).eq('id', params.id).eq('tenant_id', ctx.tenant_id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  void logAdminAction(ctx, 'update_complemento', 'complementos', params.id, updates)
  return NextResponse.json({ ok: true, complemento: data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin(req); if (!isAdminCtx(ctx)) return ctx
  const sb = supabaseService()
  const { error } = await sb.from('complementos').delete().eq('id', params.id).eq('tenant_id', ctx.tenant_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  void logAdminAction(ctx, 'delete_complemento', 'complementos', params.id, null)
  return NextResponse.json({ ok: true })
}
