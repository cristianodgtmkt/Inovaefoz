import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminCtx } from '@/lib/auth/admin'
import { rateLimit } from '@/lib/security/rate-limit'
import { orchestrate } from '@/lib/agents/orchestrate'
import { supabaseService } from '@/lib/db/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req)
  if (!isAdminCtx(ctx)) return ctx
  const rl = rateLimit(`testbed:${ctx.user.id}`, { windowSec: 60, max: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limit' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const message = (body.message || '').toString().trim()
  if (!message) return NextResponse.json({ error: 'message_required' }, { status: 400 })

  // session_id permite multi-turn com state real (mas isolado de produção via prefixo "testbed:")
  const sessionId = (body.session_id || '').toString().trim() || `${ctx.user.id}-default`
  const phoneTest = `testbed:${sessionId}`
  const persist = !!body.persist // se true, usa state real (multi-turn). Default: dryRun

  // Reset opcional
  if (body.reset === true) {
    try {
      const sb = supabaseService()
      await sb.from('ai_conversa_state').delete().eq('telefone', phoneTest)
    } catch {}
    return NextResponse.json({ ok: true, reset: true })
  }

  try {
    const result = await orchestrate({
      telefone: phoneTest, message, channel: 'whatsapp',
      nome_cliente: 'Testbed',
      provider_message_id: null,
      tenant_id_override: ctx.tenant_id,
      dryRun: !persist,
    } as any)

    // Se persist, retorna estado também
    let pedido_state = null
    if (persist) {
      try {
        const sb = supabaseService()
        const { data } = await sb.from('ai_conversa_state').select('pedido_state').eq('telefone', phoneTest).maybeSingle()
        pedido_state = data?.pedido_state || null
      } catch {}
    }

    return NextResponse.json({ ok: true, result, pedido_state, session_id: sessionId })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
