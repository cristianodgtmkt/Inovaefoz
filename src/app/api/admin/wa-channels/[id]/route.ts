/**
 * Admin endpoint per-channel: GET (refresh QR), PATCH (rename/default), DELETE.
 */
import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/config/env'
import { supabaseService } from '@/lib/db/supabase'
import { connectInstance, getStatus, getQR, deleteInstance } from '@/lib/wa/evolution'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function authorized(req: NextRequest): Promise<boolean> {
  const header = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!header) return false
  const e = env()
  if (e.INTERNAL_TEST_TOKEN && header === e.INTERNAL_TEST_TOKEN) return true
  try {
    const sb = createClient(e.SUPABASE_URL, e.SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const { data: { user }, error } = await sb.auth.getUser(header)
    return !!user && !error
  } catch { return false }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = supabaseService()
  const { data: ch } = await sb.from('ai_wa_channels').select('*').eq('id', params.id).maybeSingle()
  if (!ch) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const apiKey = (ch.credentials as any)?.api_key
  if (!apiKey || !ch.instance_name) return NextResponse.json({ error: 'no_credentials' }, { status: 400 })

  // Refresh QR + status (loggedIn = conexão WA real)
  let qr: { base64?: string; code?: string } = {}
  let status = ch.status
  try {
    const s = await getStatus(ch.instance_name, apiKey)
    status = s.loggedIn ? 'connected' : 'qr_required'
  } catch {}
  if (status !== 'connected') {
    // Garante webhook setado
    const webhookUrl = `https://acai.inovaefoz.com.br/api/webhook/evolution/${encodeURIComponent(ch.instance_name)}`
    try { await connectInstance(ch.instance_name, apiKey, webhookUrl) } catch {}
    // Busca QR via endpoint dedicado
    try { qr = await getQR(ch.instance_name, apiKey) } catch (e: any) { console.warn('[wa-channel/get] getQR err', e?.message) }
  }

  const expiresAt = qr.base64 ? new Date(Date.now() + 60_000).toISOString() : null
  await sb.from('ai_wa_channels').update({
    status,
    qr_code_data: qr.base64 || null,
    qr_code_expires_at: expiresAt,
    last_status_check: new Date().toISOString(),
  }).eq('id', params.id)

  return NextResponse.json({ ok: true, status, qr_code_base64: qr.base64 || null, qr_expires_at: expiresAt })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const updates: any = { updated_at: new Date().toISOString() }
  if (typeof body.label === 'string') updates.label = body.label.trim()
  if (typeof body.is_default === 'boolean') updates.is_default = body.is_default

  const sb = supabaseService()
  // Se setando default=true, desmarca outros
  if (updates.is_default === true) {
    await sb.from('ai_wa_channels').update({ is_default: false }).neq('id', params.id)
  }
  const { error } = await sb.from('ai_wa_channels').update(updates).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = supabaseService()
  const { data: ch } = await sb.from('ai_wa_channels').select('instance_name').eq('id', params.id).maybeSingle()
  if (ch?.instance_name) {
    try { await deleteInstance(ch.instance_name) }
    catch (e: any) { console.warn('[wa-channels DELETE] evo err:', e?.message) }
  }
  await sb.from('ai_wa_channels').delete().eq('id', params.id)
  return NextResponse.json({ ok: true })
}
