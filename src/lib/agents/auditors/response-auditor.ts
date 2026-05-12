// Response auditor — claude-haiku valida resposta antes de enviar
import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/config/env'
import { calcCostCents } from '@/lib/billing/pricing'
import { supabaseService } from '@/lib/db/supabase'
import type { AgentContext, SpecialistReply } from '../types'
import { loadPrompt } from '../prompts'

export type AuditVerdict = 'pass' | 'fail' | 'warn'

export interface AuditResult {
  verdict: AuditVerdict
  issue: string | null
  reason: string | null
  severity: 'low' | 'medium' | 'high' | 'critical'
  tokens_in: number
  tokens_out: number
  cost_cents: number
  duration_ms: number
}

const FALLBACK_AUDITOR_SYS = `Você é o auditor de qualidade do agente de atendimento.
Recebe a RESPOSTA do agente + a MENSAGEM do cliente + o CARDÁPIO.
Decide se a resposta está OK ou tem problema.

ISSUES POSSÍVEIS:
- price_hallucination: cita preço que não está no cardápio
- item_inexistente: menciona item que não está no cardápio
- inventory_claim_no_tool: afirma "temos disponível" sem ter consultado tool
- promise_no_data: promete prazo/entrega sem ter calculado
- scope_out: responde sobre tema fora do delivery (política, esporte, etc)
- data_leak: revela dados de outro cliente
- pii_request: pede CPF, senha, dados sensíveis sem necessidade
- format_violation: response > 800 chars OR > 4 emojis OR usa markdown bold

Responda APENAS JSON: {"verdict":"pass|fail|warn", "issue":"...|null", "reason":"...|null", "severity":"low|medium|high|critical"}`

async function modelFromConfig(tenant_id: string | undefined, fallback: string): Promise<string> {
  if (!tenant_id) return fallback
  try {
    const sb = supabaseService()
    const { data } = await sb.from('ai_tenant_config').select('model_auditor').eq('tenant_id', tenant_id).maybeSingle()
    const v = (data as any)?.model_auditor
    return (typeof v === 'string' && v.length > 0) ? v : fallback
  } catch {
    return fallback
  }
}

export async function runAuditor(ctx: AgentContext, reply: SpecialistReply): Promise<AuditResult> {
  const t0 = Date.now()
  const e = env()
  const model = await modelFromConfig(ctx.tenant_id, e.AUDITOR_MODEL)
  const sys = ctx.tenant_id ? await loadPrompt(ctx.tenant_id, 'auditor') : FALLBACK_AUDITOR_SYS
  const cardapioBrief = ctx.cardapioSnapshot.produtos.map(p => p.nome).join(', ')
  const userMsg = `MENSAGEM CLIENTE: "${ctx.message}"
RESPOSTA AGENTE (${reply.specialistName}): "${reply.text}"
ITENS NO CARDÁPIO: ${cardapioBrief}
PRECOS WHITELIST (centavos): ${ctx.cardapioSnapshot.precos.join(', ')}

Audite a resposta.`

  try {
    const client = new Anthropic({ apiKey: e.ANTHROPIC_API_KEY })
    const res = await client.messages.create({
      model, max_tokens: 200, system: sys,
      messages: [{ role: 'user', content: userMsg }],
    })
    const tokens_in = res.usage?.input_tokens || 0
    const tokens_out = res.usage?.output_tokens || 0
    const text = res.content.filter(c => c.type === 'text').map(c => (c as any).text).join('').trim()
    let parsed: any = {}
    try {
      const m = text.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(m ? m[0] : '{}')
    } catch {}
    const result: AuditResult = {
      verdict: parsed.verdict || 'pass',
      issue: parsed.issue || null,
      reason: parsed.reason || null,
      severity: parsed.severity || 'low',
      tokens_in, tokens_out,
      cost_cents: calcCostCents(model, tokens_in, tokens_out),
      duration_ms: Date.now() - t0,
    }
    // Log finding se !pass
    if (result.verdict !== 'pass') {
      try {
        await supabaseService().from('ai_audit_findings').insert({
          tenant_id: ctx.tenant_id || null,
          telefone: ctx.telefone,
          specialist: reply.specialistName,
          verdict: result.verdict,
          issue: result.issue,
          reason: result.reason,
          severity: result.severity,
          mode: env().AUDIT_MODE,
          original_reply: reply.text,
          audit_tokens_in: tokens_in,
          audit_tokens_out: tokens_out,
        })
      } catch {}
    }
    return result
  } catch (e: any) {
    return { verdict: 'pass', issue: null, reason: 'auditor_error', severity: 'low', tokens_in: 0, tokens_out: 0, cost_cents: 0, duration_ms: Date.now() - t0 }
  }
}
