/**
 * PATCH /api/admin/users/[user_id]
 * Body: { nome?, telefone?, role?, status? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminCtx } from '@/lib/auth/admin'
import { supabaseService } from '@/lib/db/supabase'
import { logAdminAction } from '@/lib/security/audit-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normPhone(p: string): string { return (p || '').replace(/\D/g, '') }

export async function PATCH(req: NextRequest, { params }: { params: { user_id: string } }) {
  const ctx = await requireAdmin(req); if (!isAdminCtx(ctx)) return ctx
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const patch: any = {}
  if (typeof body.nome === 'string') patch.nome = body.nome.trim()
  if (typeof body.telefone === 'string') patch.telefone = normPhone(body.telefone)
  if (typeof body.role === 'string') patch.role = body.role
  if (typeof body.status === 'string') patch.status = body.status

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nada pra atualizar' }, { status: 400 })

  const sb = supabaseService()
  const { error } = await sb.from('tenant_users')
    .update(patch)
    .eq('tenant_id', ctx.tenant_id)
    .eq('user_id', params.user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  void logAdminAction(ctx, 'update_user', 'tenant_users', params.user_id, patch)
  return NextResponse.json({ ok: true })
}
