/**
 * Orchestrate v3 — multi-tenant + DB-driven prompts/config + dryRun mode.
 */
import { supabaseService } from '@/lib/db/supabase'
import { checkBudget } from '@/lib/billing/budget'
import { runRouter } from './router'
import { pickAndRunSpecialist } from './specialists'
import { runAuditor } from './auditors/response-auditor'
import { runGuardrails } from '@/lib/guardrails'
import { retrieveHybrid } from '@/lib/rag/retrieve'
import { isCancelIntent } from './order-collector'
import type { AgentContext, PipelineResult, CardapioSnapshot, ConversaState, HistoryMsg } from './types'

const BUDGET_EXHAUSTED_MSG = 'Estamos com muita demanda no momento. Vou chamar um atendente humano pra te ajudar 💜'

async function resolveTenantId(opts: { telefone?: string; channel?: string; tenant_id_override?: string }): Promise<string | null> {
  if (opts.tenant_id_override) return opts.tenant_id_override
  // Resolve via WA channel — phone tenant pode ter sido pareado antes
  const sb = supabaseService()
  const { data: ch } = await sb.from('ai_wa_channels').select('tenant_id').limit(1).maybeSingle()
  if (ch?.tenant_id) return ch.tenant_id
  // Fallback: primeiro tenant ativo
  const { data: t } = await sb.from('tenants').select('id').eq('status', 'active').order('created_at').limit(1).maybeSingle()
  return t?.id || null
}

async function buildSnapshot(tenant_id: string): Promise<CardapioSnapshot> {
  const sb = supabaseService()
  const [produtos, tamanhos, sabores, complementos, taxas] = await Promise.all([
    sb.from('produtos').select('*').eq('tenant_id', tenant_id).eq('ativo', true),
    sb.from('tamanhos').select('*').eq('tenant_id', tenant_id).eq('ativo', true),
    sb.from('sabores').select('*').eq('tenant_id', tenant_id).eq('ativo', true),
    sb.from('complementos').select('*').eq('tenant_id', tenant_id).eq('ativo', true),
    sb.from('taxas_entrega').select('*').eq('tenant_id', tenant_id).eq('ativo', true),
  ])
  // Whitelist de preços: tamanhos + taxas de entrega + somas comuns (tamanho+taxa)
  const tamanhoPrecos = (tamanhos.data || []).map(t => Math.round(Number(t.preco) * 100))
  const taxaPrecos = (taxas.data || []).map(t => Math.round(Number(t.taxa) * 100))
  const sumPrecos: number[] = []
  for (const tp of tamanhoPrecos) {
    for (const tx of taxaPrecos) sumPrecos.push(tp + tx)
    // Múltiplos do mesmo tamanho (1-5 unidades)
    for (let n = 2; n <= 5; n++) sumPrecos.push(tp * n)
  }
  // Combos quantidade × tamanho + taxa
  for (const tp of tamanhoPrecos) {
    for (const tx of taxaPrecos) {
      for (let n = 1; n <= 5; n++) sumPrecos.push(tp * n + tx)
    }
  }
  const precos = Array.from(new Set([...tamanhoPrecos, ...taxaPrecos, ...sumPrecos]))
  const itensNomes = new Set<string>()
  for (const p of (produtos.data || [])) itensNomes.add(p.nome.toLowerCase())
  for (const s of (sabores.data || [])) itensNomes.add(s.nome.toLowerCase())
  for (const c of (complementos.data || [])) itensNomes.add(c.nome.toLowerCase())
  const bairrosAtivos = new Set<string>((taxas.data || []).map(t => t.bairro.toLowerCase()))
  return {
    produtos: produtos.data || [], tamanhos: tamanhos.data || [],
    sabores: sabores.data || [], complementos: complementos.data || [],
    taxas: taxas.data || [],
    precos, itensNomes, bairrosAtivos,
  }
}

async function loadHistory(tenant_id: string, telefone: string): Promise<HistoryMsg[]> {
  const sb = supabaseService()
  const { data } = await sb
    .from('conversas')
    .select('role,message,created_at')
    .eq('tenant_id', tenant_id)
    .eq('telefone', telefone)
    .order('created_at', { ascending: false })
    .limit(20)
  return (data || []).reverse() as HistoryMsg[]
}

async function loadConversaState(tenant_id: string, telefone: string): Promise<ConversaState> {
  const sb = supabaseService()
  const { data } = await sb
    .from('ai_conversa_state')
    .select('pedido_state,etapa_funil')
    .eq('tenant_id', tenant_id)
    .eq('telefone', telefone)
    .maybeSingle()
  return {
    pedido: (data?.pedido_state as any) || { items: [] },
    etapa: (data?.etapa_funil as any) || 'descoberta',
  }
}

async function loadConfigs(tenant_id: string): Promise<Record<string, any>> {
  const sb = supabaseService()
  const { data } = await sb.from('configuracoes').select('chave,valor').eq('tenant_id', tenant_id)
  const out: Record<string, any> = {}
  for (const r of (data || [])) out[r.chave] = r.valor
  return out
}

async function loadTenantConfig(tenant_id: string): Promise<{
  ai_paused_global: boolean
  audit_mode: string
  guardrail_enforce_mode: string
}> {
  const sb = supabaseService()
  const [tenantRes, cfgRes] = await Promise.all([
    sb.from('tenants').select('ai_paused_global').eq('id', tenant_id).maybeSingle(),
    sb.from('ai_tenant_config').select('audit_mode,guardrail_enforce_mode').eq('tenant_id', tenant_id).maybeSingle(),
  ])
  return {
    ai_paused_global: !!tenantRes.data?.ai_paused_global,
    audit_mode: cfgRes.data?.audit_mode || 'log_only',
    guardrail_enforce_mode: cfgRes.data?.guardrail_enforce_mode || 'soft',
  }
}

export interface OrchestrateInput {
  telefone: string
  message: string
  channel?: 'whatsapp' | 'instagram' | 'facebook'
  nome_cliente?: string | null
  provider_message_id?: string | null
  tenant_id_override?: string
  dryRun?: boolean
}

export async function orchestrate(input: OrchestrateInput): Promise<PipelineResult & { reply: string; tenant_id: string }> {
  const t0 = Date.now()
  const telefone = input.telefone
  const channel = input.channel || 'whatsapp'
  const dryRun = !!input.dryRun

  // 0. Resolver tenant
  const tenant_id = await resolveTenantId({ telefone, channel, tenant_id_override: input.tenant_id_override })
  if (!tenant_id) {
    return {
      reply: 'Erro: tenant não configurado.', intent: 'escalation', specialist: 'no_tenant',
      shouldEscalate: true, audit_verdict: 'pass', guardrail_failures: [],
      tokens_in: 0, tokens_out: 0, cost_cents: 0, duration_ms: Date.now() - t0,
      retrieved_chunk_ids: [], tools_called: [],
      tenant_id: '',
    }
  }

  // 1. Tenant-level config (ai_paused_global, audit_mode, guardrail_enforce_mode)
  const tcfg = await loadTenantConfig(tenant_id)
  if (tcfg.ai_paused_global && !dryRun) {
    return {
      reply: 'No momento estou em pausa. Um atendente humano vai te responder em breve 💜',
      intent: 'escalation', specialist: 'paused_global',
      shouldEscalate: true, audit_verdict: 'pass', guardrail_failures: [],
      tokens_in: 0, tokens_out: 0, cost_cents: 0, duration_ms: Date.now() - t0,
      retrieved_chunk_ids: [], tools_called: [], tenant_id,
    }
  }

  // 2. Budget gate
  const budget = await checkBudget(tenant_id)
  if (!budget.ok) {
    return {
      reply: BUDGET_EXHAUSTED_MSG, intent: 'escalation', specialist: 'budget_gate',
      shouldEscalate: true, audit_verdict: 'pass', guardrail_failures: [],
      tokens_in: 0, tokens_out: 0, cost_cents: 0, duration_ms: Date.now() - t0,
      retrieved_chunk_ids: [], tools_called: [], tenant_id,
    }
  }

  // 3. Build context
  const [snapshot, history, state, configs] = await Promise.all([
    buildSnapshot(tenant_id),
    dryRun ? Promise.resolve([]) : loadHistory(tenant_id, telefone),
    dryRun ? Promise.resolve({ pedido: { items: [] }, etapa: 'descoberta' as const }) : loadConversaState(tenant_id, telefone),
    loadConfigs(tenant_id),
  ])

  const ctx: AgentContext & { tenant_id: string } = {
    telefone, message: input.message, channel,
    nome_cliente: input.nome_cliente,
    provider_message_id: input.provider_message_id,
    history: history as HistoryMsg[], state, cardapioSnapshot: snapshot, configs,
    tenant_id,
  }

  let totalTokensIn = 0, totalTokensOut = 0, totalCost = 0
  const toolsCalled: string[] = []

  // 3.5. Cancel detection (pre-router) — palavra-chave "cancela/esquece/desisto" zera state e responde
  if (isCancelIntent(input.message)) {
    if (!dryRun) {
      try {
        const sb = supabaseService()
        await sb.from('ai_conversa_state').upsert({
          tenant_id, telefone, channel,
          pedido_state: { items: [], collected_steps: [], fase: 'cancelado', current_item_index: 0 },
          last_message_at: new Date().toISOString(),
        }, { onConflict: 'telefone' })
      } catch {}
    }
    return {
      reply: 'Pedido cancelado. Quando quiser, é só falar! 💜',
      intent: 'escalation', specialist: 'cancel_handler',
      shouldEscalate: false, audit_verdict: 'pass', guardrail_failures: [],
      tokens_in: 0, tokens_out: 0, cost_cents: 0,
      duration_ms: Date.now() - t0,
      retrieved_chunk_ids: [], tools_called: ['cancel'], tenant_id,
    }
  }

  // 3.6. Pedido em construção? Força intent pra pedido_continua (router não vê estado)
  const hasPedidoEmConstrucao = (state.pedido as any)?.items?.length > 0
    && (state.pedido as any)?.fase !== 'finalizado'
    && (state.pedido as any)?.fase !== 'cancelado'

  // 4. Router
  const router = await runRouter(ctx)
  totalTokensIn += router.tokens_in; totalTokensOut += router.tokens_out; totalCost += router.cost_cents

  // 4.5. Heurística forte: se msg curta E pedido em construção → quase sempre é resposta ao pedido
  // Cliente respondendo "pix", "morango", "1", "retirada" não é objection/cardapio_query
  // Upgrade override total quando msg curta (≤4 palavras), exceto status_pedido/escalation explícitos
  const wordCount = input.message.trim().split(/\s+/).length
  const isShortMsg = wordCount <= 4

  // Palavras-chave fortes que SEMPRE são resposta de pedido quando há pedido em curso
  const PEDIDO_KEYWORDS = /\b(pix|cart[aã]o|dinheiro|cr[eé]dito|d[eé]bito|entrega|retirada|sim|n[aã]o|s[oó] isso|pode fechar|fechar|adicionar mais|outro|igual|mesmo|esse mesmo|esse|pronto|fechei|finalizar)\b/i
  const matchesPedidoKeyword = PEDIDO_KEYWORDS.test(input.message)

  // Pergunta explícita (termina com ?, ou começa com "tem", "vocês", "vc", "qual", "quanto", "como")
  // mesmo durante pedido — cliente está perguntando algo, deixa router decidir
  const isQuestion = /\?\s*$/.test(input.message) ||
    /^(tem|tém|t[eé]m|voc[eê]s?|vc[s]?|qual|quais|quanto|quantos|onde|como|quando|por que|porque|cad[eê])\b/i.test(input.message.trim())

  // Escalation explícita só se cliente disser palavras-chave fortes
  const explicitEscalate = /\b(atendent[ea]|falar com (gente|pessoa|humano|algu[eé]m)|chama (algu[eé]m|atendent|gerent)|quero falar|me passa pra)\b/i.test(input.message)

  if (hasPedidoEmConstrucao && !isQuestion && router.out.intent !== 'status_pedido' && !explicitEscalate) {
    // Forçar pedido_continua mesmo se router classificou escalation/objection (falsos positivos comuns mid-pedido)
    if (isShortMsg || matchesPedidoKeyword || router.out.intent === 'saudacao' || router.out.intent === 'smalltalk' || router.out.intent === 'media_only' || router.out.intent === 'escalation' || router.out.intent === 'objection') {
      router.out.intent = 'pedido_continua'
      router.out.reasoning = 'upgrade_pedido_continua_em_construcao'
    }
  }

  // 5. RAG (se router pediu)
  let chunks: any[] = []
  let chunkIds: string[] = []
  if (router.out.needs_rag) {
    try {
      const r = await retrieveHybrid(ctx.message, 6)
      chunks = r.chunks; chunkIds = r.ids
    } catch (e: any) { console.warn('[orchestrate] RAG err', e?.message) }
  }

  // 6. Specialist
  const reply = await pickAndRunSpecialist(ctx, router.out.intent, chunks)
  totalTokensIn += reply.tokens_in; totalTokensOut += reply.tokens_out; totalCost += reply.cost_cents
  if (reply.toolCalls) toolsCalled.push(...reply.toolCalls.map(t => t.name))

  // Persiste pedido_state após specialist (se collector atualizou)
  if (reply.newState && !dryRun) {
    try {
      const sb = supabaseService()
      await sb.from('ai_conversa_state').upsert({
        tenant_id, telefone, channel,
        pedido_state: { ...ctx.state.pedido, ...reply.newState },
        etapa_funil: ctx.state.etapa,
        last_message_at: new Date().toISOString(),
      }, { onConflict: 'telefone' })
    } catch (e: any) { console.warn('[orchestrate] state save err', e?.message) }
  }

  // 7. Auditor — pula specialists determinísticos (templates puros, sem LLM = sem hallucination)
  let auditVerdict: 'pass' | 'fail' | 'warn' = 'pass'
  const skipAudit = ['greeting', 'escalation_handler', 'status_handler', 'order_handler', 'cancel_handler']
  if (!skipAudit.includes(reply.specialistName)) {
    const audit = await runAuditor(ctx, reply)
    auditVerdict = audit.verdict
    totalTokensIn += audit.tokens_in; totalTokensOut += audit.tokens_out; totalCost += audit.cost_cents
    if (tcfg.audit_mode === 'block' && audit.verdict === 'fail') {
      reply.text = BUDGET_EXHAUSTED_MSG
      reply.needsHandoff = true
      reply.handoffReason = `audit:${audit.issue}`
    }
  }

  // 8. Guardrails
  const gr = await runGuardrails(ctx, reply)
  const finalReply = gr.reply
  if (gr.blocked && !finalReply.handoffReason) finalReply.handoffReason = `guardrail:${gr.failures[0]}`

  // Em strict mode, qualquer guardrail fail bloqueia
  if (tcfg.guardrail_enforce_mode === 'strict' && gr.failures.length > 0 && !gr.blocked) {
    finalReply.text = BUDGET_EXHAUSTED_MSG
    finalReply.needsHandoff = true
  }

  return {
    reply: finalReply.text,
    intent: router.out.intent,
    specialist: finalReply.specialistName,
    shouldEscalate: !!finalReply.needsHandoff,
    audit_verdict: auditVerdict,
    guardrail_failures: gr.failures,
    tokens_in: totalTokensIn, tokens_out: totalTokensOut,
    cost_cents: Math.round(totalCost * 1000) / 1000,
    duration_ms: Date.now() - t0,
    retrieved_chunk_ids: chunkIds, tools_called: toolsCalled,
    tenant_id,
  }
}
