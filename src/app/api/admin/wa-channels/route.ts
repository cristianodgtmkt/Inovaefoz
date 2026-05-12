/**
 * Admin endpoint pra listar/criar instances WhatsApp via Evolution.
 * GET → lista wa_channels
 * POST → cria nova instance + retorna QR (com fallback /instance/connect)
 */
import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/config/env'
import { supabaseService } from '@/lib/db/supabase'
import { createInstance, connectInstance, getQR } from '@/lib/wa/evolution'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function authorize(req: NextRequest): Promise<{ ok: boolean; user_id?: string | null; tenant_id?: string | null }> {
  const header = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!header) return { ok: false }
  const e = env()
  if (e.INTERNAL_TEST_TOKEN && header === e.INTERNAL_TEST_TOKEN) {
    // Internal token: pega primeiro tenant ativo
    const sb = supabaseService()
    const { data: t } = await sb.from('tenants').select('id').limit(1).maybeSingle()
    return { ok: true, user_id: null, tenant_id: t?.id || null }
  }
  try {
    const sb = createClient(e.SUPABASE_URL, e.SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const { data: { user }, error } = await sb.auth.getUser(header)
    if (!user || error) return { ok: false }
    // Resolve tenant_id do user
    const svc = supabaseService()
    const { data: tu } = await svc
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    return { ok: true, user_id: user.id, tenant_id: tu?.tenant_id || null }
  } catch { return { ok: false } }
}

export async function GET(req: NextRequest) {
  const auth = await authorize(req)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = supabaseService()
  let q = sb
    .from('ai_wa_channels')
    .select('id, label, instance_name, phone, status, qr_code_data, qr_code_expires_at, last_status_check, disconnect_reason, is_default, created_at, tenant_id')
    .order('created_at', { ascending: false })
  if (auth.tenant_id) q = q.eq('tenant_id', auth.tenant_id)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ channels: data || [] })
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.tenant_id) return NextResponse.json({ error: 'usuário sem tenant associado' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const label = (body.label || '').toString().trim()
  if (!label) return NextResponse.json({ error: 'label obrigatorio' }, { status: 400 })

  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const instanceName = `acai-${slug}-${Math.random().toString(36).slice(2, 8)}`

  try {
    // 1. Cria instance (global key) — só registra, não conecta
    const inst = await createInstance(instanceName)

    // 2. Connect (seta webhook + subscribe eventos no evolution-go)
    const webhookUrl = `https://acai.inovaefoz.com.br/api/webhook/evolution/${encodeURIComponent(instanceName)}`
    try { await connectInstance(instanceName, inst.apikey, webhookUrl) }
    catch (e: any) { console.warn('[wa-channels] connect err', e?.message) }

    // 3. Busca QR via endpoint dedicado /instance/qr
    let qrBase64: string | null = null
    try {
      // Pequeno delay pra Evolution gerar QR
      await new Promise(r => setTimeout(r, 1000))
      const q = await getQR(instanceName, inst.apikey)
      qrBase64 = q.base64 || null
    } catch (e: any) { console.warn('[wa-channels] getQR err', e?.message) }

    // Persiste
    const sb = supabaseService()
    const expiresAt = new Date(Date.now() + 60_000).toISOString()
    const { data, error } = await sb.from('ai_wa_channels').insert({
      tenant_id: auth.tenant_id,
      label, provider: 'evolution', instance_name: instanceName,
      status: qrBase64 ? 'qr_required' : 'connecting',
      qr_code_data: qrBase64,
      qr_code_expires_at: qrBase64 ? expiresAt : null,
      credentials: { api_key: inst.apikey, instance_id: inst.instanceId || null },
    }).select().single()

    if (error) return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      channel_id: data.id,
      instance_name: instanceName,
      status: data.status,
      qr_code_base64: qrBase64,
      qr_expires_at: expiresAt,
    })
  } catch (e: any) {
    console.error('[wa-channels] err:', e?.message)
    return NextResponse.json({ error: e?.message || 'evolution_error' }, { status: 500 })
  }
}
