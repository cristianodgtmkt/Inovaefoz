/**
 * Upload logo do tenant. Multipart form-data, campo 'file'.
 * Salva como base64 em tenants.brand.logo_url (data URL inline).
 * (Sem Storage bucket por agora — quando precisar otimizar, troca.)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminCtx } from '@/lib/auth/admin'
import { supabaseService } from '@/lib/db/supabase'
import { logAdminAction } from '@/lib/security/audit-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_SIZE = 1024 * 1024 // 1 MB

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req); if (!isAdminCtx(ctx)) return ctx
  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'multipart_required' }, { status: 400 })
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file_required' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'file_too_large', max_kb: MAX_SIZE / 1024 }, { status: 413 })
  const ct = file.type || 'image/png'
  if (!/^image\//.test(ct)) return NextResponse.json({ error: 'must_be_image' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  const dataUrl = `data:${ct};base64,${buf.toString('base64')}`

  const sb = supabaseService()
  const { data: t } = await sb.from('tenants').select('brand').eq('id', ctx.tenant_id).single()
  const newBrand = { ...(t?.brand as object || {}), logo_url: dataUrl }
  const { error } = await sb.from('tenants').update({ brand: newBrand, updated_at: new Date().toISOString() }).eq('id', ctx.tenant_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  void logAdminAction(ctx, 'upload_logo', 'tenant', ctx.tenant_id, { size: file.size, type: ct })
  return NextResponse.json({ ok: true, logo_url: dataUrl })
}
