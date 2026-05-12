/**
 * Proxy de envio WhatsApp pra ser chamado pelo admin-v2 Vercel.
 *
 * Substitui Z-API direto pelo Evolution. Body: { phone, message, instanceName? }
 * Se instanceName não passado, usa default channel (is_default=true).
 *
 * Auth: Bearer INTERNAL_TEST_TOKEN (admin-v2 envia esse token)
 */
import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/config/env'
import { supabaseService } from '@/lib/db/supabase'
import { sendText } from '@/lib/wa/evolution'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const expected = env().INTERNAL_TEST_TOKEN
  if (!expected) return false
  const header = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return header === expected
}

// Pra ser usado direto do front: tb aceita CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}

export async function POST(req: NextRequest) {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  const body = await req.json().catch(() => ({}))
  const phone = (body.phone || '').toString().replace(/[^0-9]/g, '')
  const message = (body.message || '').toString()
  const instanceNameOverride = (body.instanceName || '').toString()

  if (!phone || !message) {
    return NextResponse.json({ error: 'phone and message required' }, { status: 400, headers: corsHeaders })
  }

  try {
    const sb = supabaseService()
    let instanceName = instanceNameOverride
    let apiKey: string | undefined

    if (!instanceName) {
      const { data: ch, error } = await sb
        .from('ai_wa_channels')
        .select('instance_name, credentials')
        .eq('status', 'connected')
        .eq('is_default', true)
        .limit(1)
        .maybeSingle()
      if (error || !ch) {
        // Fallback: qualquer instance connected
        const { data: any_ch } = await sb
          .from('ai_wa_channels')
          .select('instance_name, credentials')
          .eq('status', 'connected')
          .limit(1)
          .maybeSingle()
        if (!any_ch) {
          return NextResponse.json(
            { error: 'no_connected_channel', detail: 'Nenhum canal WhatsApp conectado. Pareie via /api/admin/wa-channels' },
            { status: 503, headers: corsHeaders }
          )
        }
        instanceName = any_ch.instance_name
        apiKey = (any_ch.credentials as any)?.api_key
      } else {
        instanceName = ch.instance_name
        apiKey = (ch.credentials as any)?.api_key
      }
    } else {
      const { data: ch } = await sb
        .from('ai_wa_channels')
        .select('credentials')
        .eq('instance_name', instanceName)
        .maybeSingle()
      apiKey = (ch?.credentials as any)?.api_key
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'channel_credentials_missing', instanceName },
        { status: 500, headers: corsHeaders }
      )
    }

    const result = await sendText(instanceName, apiKey, phone, message)

    // Persiste mensagem outbound em conversas (compatível admin)
    try {
      await sb.from('conversas').insert({
        telefone: phone,
        role: 'admin',
        message,
        channel: 'whatsapp',
        agent_used: 'admin_panel',
      })
    } catch (e: any) {
      console.warn('[proxy/wa] conversas insert err:', e?.message)
    }

    return NextResponse.json(
      { ok: true, instanceName, evolutionResult: result },
      { headers: corsHeaders }
    )
  } catch (e: any) {
    console.error('[proxy/wa] err:', e?.message)
    return NextResponse.json(
      { error: e?.message || 'send_failed' },
      { status: 502, headers: corsHeaders }
    )
  }
}
