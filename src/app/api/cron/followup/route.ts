// Cron */30min — followup carrinho abandonado
// Para cada conversa com pedido em aberto sem msg >18h: planner Haiku decide SEND/SKIP/CLOSURE
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/config/env'
import { supabaseService } from '@/lib/db/supabase'
import { sendText } from '@/lib/wa/evolution'
import { calcCostCents } from '@/lib/billing/pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const expected = env().CRON_TOKEN_FOLLOWUP
  if (!expected) return false
  return req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') === expected
}

const PLANNER_SYS = `Você decide se mandar followup pra cliente que parou no meio de pedido.
Recebe: histórico recente + tempo desde última msg.
Decida:
- SEND: mande mensagem amigável retomando ("Oi! Vi que parou no meio do pedido. Quer continuar?")
- SKIP: deixa quieto (cliente provavelmente desistiu/pediu noutro lugar)
- CLOSURE: encerre conversa amigável ("Sem problemas! Quando quiser estamos aqui 💜")
- DISABLE: cliente não responde há muito tempo, marca pra não receber mais followup

Responda JSON: {"decision":"SEND|SKIP|CLOSURE|DISABLE", "message":"texto se SEND/CLOSURE", "reason":"..."}`

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const e = env()
  const sb = supabaseService()
  // Acha conversas com pedido aberto + ultima msg >18h
  const cutoff = new Date(Date.now() - 18 * 3600_000).toISOString()
  const { data: states } = await sb
    .from('ai_conversa_state')
    .select('*')
    .lt('last_message_at', cutoff)
    .neq('status', 'encerrada')
    .eq('ia_paused', false)
    .limit(20)

  const results: any[] = []
  const client = new Anthropic({ apiKey: e.ANTHROPIC_API_KEY })

  for (const s of (states || [])) {
    const { data: histRows } = await sb.from('conversas')
      .select('role,message,created_at')
      .eq('telefone', s.telefone)
      .order('created_at', { ascending: false }).limit(10)
    const hist = (histRows || []).reverse().map((m: any) => `[${m.role}]: ${m.message}`).join('\n')
    const ageH = Math.round((Date.now() - new Date(s.last_message_at).getTime()) / 3600_000)
    try {
      const res = await client.messages.create({
        model: e.FOLLOWUP_MODEL.startsWith('claude') ? e.FOLLOWUP_MODEL : 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: PLANNER_SYS,
        messages: [{ role: 'user', content: `HISTÓRICO:\n${hist}\n\nÚltima msg há ${ageH}h.` }],
      })
      const text = res.content.filter(c => c.type === 'text').map(c => (c as any).text).join('').trim()
      let parsed: any = {}
      try { const m = text.match(/\{[\s\S]*\}/); parsed = JSON.parse(m ? m[0] : '{}') } catch {}
      const decision = parsed.decision || 'SKIP'
      const tokens_in = res.usage?.input_tokens || 0
      const tokens_out = res.usage?.output_tokens || 0
      const cost_cents = calcCostCents('claude-haiku-4-5-20251001', tokens_in, tokens_out)

      let sent: string | null = null
      if (decision === 'SEND' || decision === 'CLOSURE') {
        sent = parsed.message
        try {
          const { data: ch } = await sb.from('ai_wa_channels').select('instance_name,credentials').eq('status', 'connected').limit(1).maybeSingle()
          if (ch?.instance_name && (ch.credentials as any)?.api_key && sent) {
            await sendText(ch.instance_name, (ch.credentials as any).api_key, s.telefone, sent)
            await sb.from('conversas').insert({
              telefone: s.telefone, role: 'assistant', message: sent,
              agent_used: 'followup_planner', channel: 'whatsapp',
              tokens_in, tokens_out, cost_cents,
            })
          }
        } catch (err: any) { console.warn('[followup] send err', err?.message) }
      }

      if (decision === 'DISABLE') {
        await sb.from('ai_conversa_state').update({ status: 'encerrada' }).eq('telefone', s.telefone)
      }

      await sb.from('ai_followup_log').insert({
        telefone: s.telefone, attempt_no: 1,
        decision, reason: parsed.reason,
        message_sent: sent,
        tokens_in, tokens_out,
      })

      results.push({ telefone: s.telefone, decision, sent: !!sent })
    } catch (err: any) {
      results.push({ telefone: s.telefone, error: err?.message })
    }
  }

  return NextResponse.json({ ok: true, processed: states?.length || 0, results })
}
