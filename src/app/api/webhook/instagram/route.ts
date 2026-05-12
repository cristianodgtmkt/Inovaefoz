import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/db/supabase'
import { sendInstagram, verifyMetaWebhook } from '@/lib/meta'
import { orchestrate } from '@/lib/agents/orchestrate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const v = verifyMetaWebhook({ searchParams })
  if (!v.verified) return new NextResponse('forbidden', { status: 403 })
  return new NextResponse(v.challenge)
}

export async function POST(req: NextRequest) {
  let body: any = {}
  try { body = await req.json() } catch {}
  const entries = body.entry || []
  for (const entry of entries) {
    const igUserId = entry.id
    for (const messaging of (entry.messaging || [])) {
      const senderId = messaging.sender?.id
      const text = messaging.message?.text
      if (!senderId || !text) continue
      try {
        const sb = supabaseService()
        await sb.from('conversas').insert({
          telefone: senderId, role: 'user', message: text,
          provider_message_id: messaging.message?.mid,
          channel: 'instagram',
        })
        const result = await orchestrate({
          telefone: senderId, message: text, channel: 'instagram',
          provider_message_id: messaging.message?.mid,
        })
        await sb.from('conversas').insert({
          telefone: senderId, role: 'assistant', message: result.reply,
          intent: result.shouldEscalate ? 'escalacao' : null,
          agent_used: result.specialist,
          tokens_in: result.tokens_in, tokens_out: result.tokens_out, cost_cents: result.cost_cents,
          channel: 'instagram',
        })
        await sb.from('ai_traces').insert({
          telefone: senderId, intent: result.intent, specialist: result.specialist,
          tokens_in: result.tokens_in, tokens_out: result.tokens_out, cost_cents: result.cost_cents,
          duration_ms: result.duration_ms, reply_text: result.reply,
          audit_verdict: result.audit_verdict, guardrail_failures: result.guardrail_failures,
        })
        try { await sendInstagram(igUserId, senderId, result.reply) }
        catch (e: any) { console.warn('[ig] send err', e?.message) }
      } catch (e: any) { console.error('[ig] err', e?.message) }
    }
  }
  return NextResponse.json({ ok: true })
}
