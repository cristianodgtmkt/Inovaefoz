// Router agent — gpt-4o-mini classifica intent
import { openai } from '@/lib/ai/openai-client'
import { env } from '@/lib/config/env'
import { calcCostCents } from '@/lib/billing/pricing'
import { supabaseService } from '@/lib/db/supabase'
import { loadPrompt } from './prompts'
import type { AgentContext, RouterOutput, Intent } from './types'

const FALLBACK_SYS = `Você é um router de intent pra atendimento WhatsApp de delivery. Classifique a mensagem em UMA intent e responda APENAS JSON: {"intent":"saudacao|pedido_inicio|pedido_continua|cardapio_query|status_pedido|objection|escalation|smalltalk|media_only","confidence":0.0-1.0,"needs_rag":true|false,"reasoning":"..."}`

export async function runRouter(ctx: AgentContext): Promise<{ out: RouterOutput; tokens_in: number; tokens_out: number; cost_cents: number; duration_ms: number }> {
  const t0 = Date.now()
  const e = env()
  // Carrega modelo do tenant_config
  let model = e.ROUTER_MODEL
  if (ctx.tenant_id) {
    try {
      const sb = supabaseService()
      const { data } = await sb.from('ai_tenant_config').select('model_router').eq('tenant_id', ctx.tenant_id).maybeSingle()
      if (data?.model_router) model = data.model_router
    } catch {}
  }
  const sys = ctx.tenant_id ? await loadPrompt(ctx.tenant_id, 'router') : FALLBACK_SYS

  const lastHist = ctx.history.slice(-3).map(m => `[${m.role}]: ${m.message}`).join('\n')
  const userMsg = `HISTÓRICO:\n${lastHist || '(vazia)'}\n\nMENSAGEM ATUAL: "${ctx.message}"`
  try {
    const res = await openai().chat.completions.create({
      model,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: userMsg }],
      response_format: { type: 'json_object' },
      max_tokens: 200,
      temperature: 0,
    })
    const tokens_in = res.usage?.prompt_tokens || 0
    const tokens_out = res.usage?.completion_tokens || 0
    const cost_cents = calcCostCents(model, tokens_in, tokens_out)
    let parsed: any = {}
    try { parsed = JSON.parse(res.choices[0].message.content || '{}') } catch {}
    const intent: Intent = parsed.intent || 'smalltalk'
    return {
      out: { intent, confidence: Number(parsed.confidence) || 0.5, needs_rag: !!parsed.needs_rag, reasoning: parsed.reasoning },
      tokens_in, tokens_out, cost_cents,
      duration_ms: Date.now() - t0,
    }
  } catch (e: any) {
    return {
      out: { intent: 'smalltalk', confidence: 0.3, needs_rag: false, reasoning: 'router_error' },
      tokens_in: 0, tokens_out: 0, cost_cents: 0,
      duration_ms: Date.now() - t0,
    }
  }
}
