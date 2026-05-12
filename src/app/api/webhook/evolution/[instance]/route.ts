/**
 * Webhook Evolution v2 — usa orchestrate v2 com pipeline completo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/db/supabase'
import { sendText, humanizedSend, type HumanizeOpts } from '@/lib/wa/evolution'
import { orchestrate } from '@/lib/agents/orchestrate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { instance: string } }) {
  const instance = decodeURIComponent(params.instance || '')
  let body: any = {}
  try { body = await req.json() } catch {}

  const event = (body.event || body.Event || body.type || '').toString().toLowerCase()
  const data = body.data || body.Data || {}

  // DEBUG TEMP — log payload pra debug do bug no_phone
  console.log('[webhook-evolution]', JSON.stringify({ instance, event, body_keys: Object.keys(body), data_keys: Object.keys(data) }).slice(0, 800))
  if (event.includes('message') || event.includes('messages')) {
    console.log('[webhook-evolution-msg]', JSON.stringify(body).slice(0, 2000))
  }

  // ═══════════ QRCODE event — salvar QR no DB pra UI mostrar ═══════════
  if (event.includes('qrcode') || event.includes('qr_code')) {
    try {
      const sb = supabaseService()
      const qrBase64 = data.base64 || data.qrcode?.base64 || data.qr || data.QRCode
      const qrCode = data.code || data.qrcode?.code
      if (qrBase64) {
        await sb.from('ai_wa_channels').update({
          status: 'qr_required',
          qr_code_data: qrBase64,
          qr_code_expires_at: new Date(Date.now() + 60_000).toISOString(),
          last_status_check: new Date().toISOString(),
        }).eq('instance_name', instance)
      }
      return NextResponse.json({ ok: true, captured: 'qrcode' })
    } catch (e: any) {
      console.warn('[webhook qrcode] err', e?.message)
      return NextResponse.json({ ok: true, error: e?.message })
    }
  }

  // ═══════════ CONNECTION event — atualiza status ═══════════
  if (event.includes('connection') || event.includes('connection_update')) {
    try {
      const sb = supabaseService()
      const state = (data.state || data.status || '').toString().toLowerCase()
      // Só "connected" se sessão WA realmente aberta (loggedIn). TCP sem login fica qr_required.
      const loggedIn = !!(data.LoggedIn || data.loggedIn || data.user || data.jid)
      const phone = (data.jid || data.user || '').toString().replace(/@.*/, '').replace(/[^0-9]/g, '') || null

      let newStatus: string
      if (loggedIn || state === 'open') {
        newStatus = 'connected'
      } else if (state === 'connecting') {
        newStatus = 'qr_required'
      } else {
        newStatus = 'disconnected'
      }

      const updates: any = { status: newStatus, last_status_check: new Date().toISOString() }
      if (newStatus === 'connected') {
        updates.qr_code_data = null
        updates.qr_code_expires_at = null
        if (phone) updates.phone = phone
      }
      await sb.from('ai_wa_channels').update(updates).eq('instance_name', instance)
      return NextResponse.json({ ok: true, captured: 'connection', status: newStatus })
    } catch (e: any) { return NextResponse.json({ ok: true, error: e?.message }) }
  }

  // ═══════════ MESSAGE event — pipeline IA ═══════════
  if (!event.includes('message') && !event.includes('messages.upsert') && !event.includes('messages_upsert')) {
    return NextResponse.json({ ok: true, ignored: event })
  }

  // Suporta DOIS formatos:
  //   1. evolution-api v2: data.key.remoteJid, data.message.conversation, data.pushName
  //   2. evolution-go (whatsmeow): data.Info.Sender, data.Message.conversation, data.Info.PushName
  const key = data.key || {}
  const info = data.Info || {}
  const msg = data.message || data.Message || {}

  // From me?
  const isFromMe = !!(key.fromMe || info.IsFromMe)
  if (isFromMe) return NextResponse.json({ ok: true, ignored: 'fromMe' })

  // Group?
  const remoteJid = (key.remoteJid || info.Chat || info.Sender || '').toString()
  const isGroup = remoteJid.endsWith('@g.us') || info.IsGroup === true
  if (isGroup) return NextResponse.json({ ok: true, ignored: 'group' })

  // Phone (telefone do cliente)
  const phoneRaw = (key.remoteJid || info.Sender || info.Chat || '').toString()
  const phone = phoneRaw.replace(/@.*/, '').replace(/:.*$/, '').replace(/[^0-9]/g, '')
  if (!phone || phone.length < 10) return NextResponse.json({ ok: true, ignored: 'no_phone', debug: { phoneRaw, key, info: { Sender: info.Sender, Chat: info.Chat } } })

  // Text content
  const text = msg.conversation || msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption || msg.videoMessage?.caption ||
    msg.ExtendedTextMessage?.text || msg.Conversation || ''
  if (!text) return NextResponse.json({ ok: true, ignored: 'no_text' })

  const provider_msg_id = key.id || info.ID || null
  const nome_cliente = data.pushName || info.PushName || null

  try {
    const sb = supabaseService()

    // Resolve tenant_id do canal pra setar em conversas/traces
    const { data: chRow } = await sb.from('ai_wa_channels').select('tenant_id').eq('instance_name', instance).maybeSingle()
    const channelTenantId = (chRow as any)?.tenant_id || null

    if (provider_msg_id) {
      const { data: existing } = await sb.from('conversas').select('id').eq('provider_message_id', provider_msg_id).limit(1)
      if (existing && existing.length > 0) return NextResponse.json({ ok: true, ignored: 'duplicate' })
    }

    await sb.from('conversas').insert({
      tenant_id: channelTenantId,
      telefone: phone, role: 'user', message: text,
      nome_cliente, provider_message_id: provider_msg_id, channel: 'whatsapp',
    })

    const { data: stateRow } = await sb.from('ai_conversa_state').select('ia_paused').eq('telefone', phone).maybeSingle()
    if (stateRow?.ia_paused) return NextResponse.json({ ok: true, ignored: 'paused' })

    const result = await orchestrate({
      telefone: phone, message: text, channel: 'whatsapp',
      nome_cliente, provider_message_id: provider_msg_id,
      tenant_id_override: channelTenantId,
    } as any)

    await sb.from('conversas').insert({
      tenant_id: channelTenantId,
      telefone: phone, role: 'assistant', message: result.reply,
      nome_cliente,
      intent: result.shouldEscalate ? 'escalacao' : null,
      agent_used: result.specialist,
      tokens_in: result.tokens_in, tokens_out: result.tokens_out, cost_cents: result.cost_cents,
      channel: 'whatsapp',
    })

    await sb.from('ai_traces').insert({
      tenant_id: channelTenantId,
      telefone: phone, intent: result.intent,
      specialist: result.specialist,
      tokens_in: result.tokens_in, tokens_out: result.tokens_out, cost_cents: result.cost_cents,
      duration_ms: result.duration_ms, reply_text: result.reply,
      audit_verdict: result.audit_verdict,
      guardrail_failures: result.guardrail_failures,
      retrieved_chunk_ids: result.retrieved_chunk_ids,
      tools_called: result.tools_called,
    })

    if (result.shouldEscalate) {
      await sb.from('ai_conversa_state').upsert({
        telefone: phone, channel: 'whatsapp', client_name: nome_cliente,
        status: 'aguardando_humano', ia_paused: true,
        pause_reason: 'auto_escalation',
        last_message_at: new Date().toISOString(),
      }, { onConflict: 'telefone' })
    }

    const { data: ch } = await sb.from('ai_wa_channels').select('credentials,tenant_id').eq('instance_name', instance).maybeSingle()
    const apiKey = (ch?.credentials as any)?.api_key
    const chTenantId = (ch as any)?.tenant_id
    if (apiKey) {
      // Carrega config humanização do tenant
      let humanize: HumanizeOpts = {}
      if (chTenantId) {
        try {
          const { data: cfg } = await sb.from('ai_tenant_config')
            .select('humanize_enabled,humanize_min_delay_ms,humanize_max_delay_ms,humanize_chars_per_second,humanize_typing_indicator,humanize_read_receipt,humanize_split_long_at')
            .eq('tenant_id', chTenantId).maybeSingle()
          if (cfg) {
            humanize = {
              enabled: cfg.humanize_enabled !== false,
              minDelayMs: cfg.humanize_min_delay_ms || undefined,
              maxDelayMs: cfg.humanize_max_delay_ms || undefined,
              charsPerSecond: cfg.humanize_chars_per_second || undefined,
              typingIndicator: cfg.humanize_typing_indicator !== false,
              readReceipt: cfg.humanize_read_receipt !== false,
              splitLongAt: cfg.humanize_split_long_at || undefined,
            }
          }
        } catch {}
      }

      try {
        await humanizedSend(instance, apiKey, phone, result.reply, humanize, provider_msg_id || undefined)
      } catch (e: any) {
        console.warn('[webhook/evolution] humanizedSend err:', e?.message)
        try { await sendText(instance, apiKey, phone, result.reply) } catch {}
      }
    }

    return NextResponse.json({ ok: true, sent: true, intent: result.intent, specialist: result.specialist })
  } catch (e: any) {
    console.error('[webhook/evolution] erro:', e?.message)
    return NextResponse.json({ error: e?.message || 'internal' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true })
}
