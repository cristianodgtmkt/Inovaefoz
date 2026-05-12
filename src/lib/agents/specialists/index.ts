// Specialists registry — todos handlers num arquivo pra simplificar
import Anthropic from '@anthropic-ai/sdk'
import { openai } from '@/lib/ai/openai-client'
import { env } from '@/lib/config/env'
import { calcCostCents } from '@/lib/billing/pricing'
import type { AgentContext, SpecialistReply, Intent } from '../types'
import { listMenuTool, getPriceTool, calcTaxaTool, saveOrderTool } from '../tools/order-tools'
import { supabaseService } from '@/lib/db/supabase'
import { loadPrompt } from '../prompts'
import { OrderCollector, loadBlueprint, isCancelIntent, isConfusedIntent, type CardapioRefs, type PedidoState, type OrderStep } from '../order-collector'
import { runConversationManager } from '../v2/conversation-manager'
import { findProduct } from '../v2/finders/product-finder'
import { matchFlavors } from '../v2/finders/flavor-matcher'
import { matchComplements } from '../v2/finders/complement-matcher'
import { matchSize } from '../v2/finders/size-matcher'
import { parseAddress } from '../v2/finders/address-parser'

// ============================================================
// HELPERS
// ============================================================
function dynamicContext(ctx: AgentContext): string {
  const now = new Date()
  const dias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
  const dia = dias[now.getDay()]
  const hora = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
  const lojaAberta = ctx.configs.loja_aberta !== false
  return `\nAGORA: ${dia} ${hora} BRT. Loja: ${lojaAberta ? 'ABERTA' : 'FECHADA'}.`
}

function brandPersona(): string {
  return `Tom: caloroso, próximo, brasileiro do Sul. Use 💜 com moderação. Mensagens curtas (max 4 frases).`
}

function ragChunksContext(chunks: any[]): string {
  if (!chunks || chunks.length === 0) return ''
  return '\n\n=== INFO RECUPERADA DO CARDÁPIO ===\n' + chunks.map(c => c.content).join('\n---\n')
}

// Lê model do tenant_config (column dinâmica), com fallback env
async function modelFromConfig(tenant_id: string | undefined, column: string, fallback: string): Promise<string> {
  if (!tenant_id) return fallback
  try {
    const sb = supabaseService()
    const { data } = await sb.from('ai_tenant_config').select(column).eq('tenant_id', tenant_id).maybeSingle()
    const v = (data as any)?.[column]
    return (typeof v === 'string' && v.length > 0) ? v : fallback
  } catch {
    return fallback
  }
}

// Fallback prompts (quando DB falha)
const FALLBACK_MENU = `Você é o atendente do delivery via WhatsApp.
Cliente perguntou sobre cardápio/preços. Responda de forma curta e clara, USANDO APENAS as informações do cardápio recuperado.
NUNCA invente preços. Se a info não estiver no cardápio, diga "não tenho essa info, vou chamar um atendente".`

const FALLBACK_ORDER = `Você coleta pedidos via WhatsApp. SIGA ETAPAS sem pular:
1. Item escolhido → tamanho (com preço) → sabores → complementos
2. Entrega ou retirada
3. Se entrega: bairro + endereço + complemento
4. Forma pagamento (PIX/cartão/dinheiro)
5. Se dinheiro: troco
6. RESUMO completo + "confirma?"
7. Após confirmação: "Pedido recebido! Em preparo agora 🔥"

REGRAS:
- NUNCA invente preço/item/bairro fora do cardápio.
- 1 pergunta por mensagem.
- Use tools quando precisa: list_menu, get_price, calc_taxa.
- Quando cliente CONFIRMAR pedido completo, devolva JSON na ÚLTIMA linha:
  {"action":"save_order","items":[{"nome":"X","quantidade":1,"preco_total":24.90}],"endereco":"...","bairro":"...","complemento":"...","forma_pagamento":"pix","troco_para":null,"total":24.90,"taxa":6}`

const FALLBACK_OBJECTION = `Cliente teve objeção (preço, atraso, qualidade). Responda com empatia + solução prática.
Se for atraso: peça desculpas + prometa avisar status.
Se for preço: explique valor (qualidade, ingredientes).
Se for problema sério: ESCALONE pra humano.

NUNCA prometa desconto/brinde sem ESCALAR.`

// ============================================================
// SAUDACAO (deterministic)
// ============================================================
export async function greetingHandler(ctx: AgentContext): Promise<SpecialistReply> {
  const t0 = Date.now()
  // Tenta carregar template customizado; se vazio, usa default
  let template = ''
  if (ctx.tenant_id) {
    try { template = await loadPrompt(ctx.tenant_id, 'greeting') } catch {}
  }
  const produtos = ctx.cardapioSnapshot.produtos.map(p => `- ${p.nome}`).join('\n')
  let text: string
  if (template && template.includes('{PRODUTOS}')) {
    text = template.replace('{PRODUTOS}', produtos)
  } else {
    text = `Oi! Seja bem-vindo 💜\n\nHoje temos:\n${produtos}\n\nO que você vai querer?`
  }
  return {
    text, specialistName: 'greeting', tokens_in: 0, tokens_out: 0, cost_cents: 0,
    duration_ms: Date.now() - t0,
  }
}

// ============================================================
// MENU RESPONDER (gpt-4o-mini + RAG)
// ============================================================
export async function menuResponder(ctx: AgentContext, ragChunks: any[]): Promise<SpecialistReply> {
  const t0 = Date.now()
  const e = env()
  const model = await modelFromConfig(ctx.tenant_id, 'model_menu', e.INFO_MODEL)
  const basePrompt = ctx.tenant_id
    ? await loadPrompt(ctx.tenant_id, 'menu')
    : FALLBACK_MENU
  const sys = `${basePrompt}

${brandPersona()}
${dynamicContext(ctx)}
${ragChunksContext(ragChunks)}`
  try {
    const res = await openai().chat.completions.create({
      model,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: ctx.message }],
      max_tokens: 250,
      temperature: 0.4,
    })
    const tokens_in = res.usage?.prompt_tokens || 0
    const tokens_out = res.usage?.completion_tokens || 0
    return {
      text: res.choices[0].message.content?.trim() || 'Não consegui responder.',
      specialistName: 'menu_responder',
      tokens_in, tokens_out,
      cost_cents: calcCostCents(model, tokens_in, tokens_out),
      duration_ms: Date.now() - t0,
    }
  } catch (e: any) {
    return { text: 'Vou chamar um atendente pra te responder 💜', specialistName: 'menu_responder', tokens_in: 0, tokens_out: 0, cost_cents: 0, duration_ms: Date.now() - t0, needsHandoff: true, handoffReason: 'menu_error' }
  }
}

// ============================================================
// ORDER HANDLER — Collector pattern (state machine + LLM extractor)
// ============================================================
//
// Fluxo:
// 1. Carrega blueprint + estado atual do pedido
// 2. Pergunta ao Collector: qual a próxima etapa pendente?
// 3a. Se completo → save_order + responde confirmação
// 3b. Se confirmação aguardando → checa se cliente confirmou → salva
// 3c. Senão → LLM extrai valor da msg pra etapa atual + LLM gera próxima pergunta
// 4. Aplica valor ao Collector → grava state → loop
// ============================================================

export async function orderHandler(ctx: AgentContext, ragChunks: any[]): Promise<SpecialistReply> {
  // V2 ativo por padrão — Conversation Manager com tool calling + micro-agents RAG-backed
  // Pra desativar: set USE_V2_ORDER_HANDLER=false em env
  if (process.env.USE_V2_ORDER_HANDLER !== 'false') {
    return runConversationManager(ctx)
  }
  // === Legacy v1 fallback ===
  const t0 = Date.now()
  const e = env()
  const model = await modelFromConfig(ctx.tenant_id, 'model_order', e.ORDER_MODEL)
  const tools_called: string[] = []
  let totalTokensIn = 0, totalTokensOut = 0

  const cardapio: CardapioRefs = {
    produtos: ctx.cardapioSnapshot.produtos,
    tamanhos: ctx.cardapioSnapshot.tamanhos,
    sabores: ctx.cardapioSnapshot.sabores,
    complementos: ctx.cardapioSnapshot.complementos,
    taxas: ctx.cardapioSnapshot.taxas,
    bairrosAtivos: ctx.cardapioSnapshot.bairrosAtivos,
  }

  const blueprint = await loadBlueprint(ctx.tenant_id)
  const initialState: PedidoState = (ctx.state.pedido as any)?.collected_steps
    ? (ctx.state.pedido as unknown as PedidoState)
    : { items: [], collected_steps: [], fase: 'em_construcao', current_item_index: 0 }

  let collector = new OrderCollector(initialState, blueprint, cardapio)

  // === Cancelar / reset ===
  if (isCancelIntent(ctx.message)) {
    const empty: PedidoState = { items: [], collected_steps: [], fase: 'cancelado', current_item_index: 0 }
    return {
      text: 'Pedido cancelado. Quando quiser, é só falar! 💜',
      specialistName: 'order_handler',
      tokens_in: 0, tokens_out: 0, cost_cents: 0,
      duration_ms: Date.now() - t0,
      newState: empty as any,
    }
  }

  // Cliente confuso ("não entendi") — re-mostra último step mais claro, NÃO reseta
  if (isConfusedIntent(ctx.message) && initialState.items.length > 0) {
    const lastStep = collector.nextStep()
    if (lastStep) {
      const reExplain = await generateQuestion(new (Anthropic as any)({ apiKey: e.ANTHROPIC_API_KEY }), model, lastStep, collector, ctx)
      return {
        text: `Sem problema, vou explicar de novo:\n\n${reExplain.text}`,
        specialistName: 'order_handler',
        tokens_in: 0, tokens_out: 0, cost_cents: 0,
        duration_ms: Date.now() - t0,
        newState: collector.state as any,
      }
    }
  }

  try {
    const client = new Anthropic({ apiKey: e.ANTHROPIC_API_KEY })

    // === STEP A: Se aguardando confirmação ===
    if (collector.state.fase === 'aguardando_confirmacao') {
      // FIX 3: Confirmation gate — se summary nunca foi mostrado pro cliente, mostra primeiro
      if (!collector.state.summary_shown_count || collector.state.summary_shown_count === 0) {
        const newState = { ...collector.state, summary_shown_count: 1 }
        return {
          text: `Vou confirmar o pedido com você 💜\n\n${collector.summary()}\n\nTá certo? (responde "sim" pra fechar ou diz o que mudar)`,
          specialistName: 'order_handler',
          tokens_in: totalTokensIn, tokens_out: totalTokensOut,
          cost_cents: calcCostCents(model, totalTokensIn, totalTokensOut),
          duration_ms: Date.now() - t0,
          newState: newState as any,
        }
      }

      const isYes = await checkConfirmation(client, model, ctx.message)
      totalTokensIn += isYes.tokens_in; totalTokensOut += isYes.tokens_out

      if (isYes.value) {
        const saved = await saveOrderTool({
          tenant_id: ctx.tenant_id || null,
          telefone: ctx.telefone,
          nome_cliente: ctx.nome_cliente,
          items: collector.state.items.map(i => ({
            nome: [i.produto_nome, i.tamanho_nome].filter(Boolean).join(' '),
            quantidade: 1,
            preco_total: i.preco_unit || 0,
            sabores: i.sabores, complementos: i.complementos,
          })),
          endereco: collector.state.endereco?.rua ? `${collector.state.endereco.rua}, ${collector.state.endereco.numero || 's/n'}` : null,
          bairro: collector.state.endereco?.bairro || null,
          complemento: collector.state.endereco?.complemento || null,
          forma_pagamento: collector.state.pagamento || 'pix',
          // Mantém 0 explicito (= "sem troco" confirmado) vs null (= não respondeu)
          troco_para: collector.state.troco_para === undefined ? null : collector.state.troco_para,
          total: collector.state.total || 0,
          taxa: collector.state.taxa || 0,
        })
        tools_called.push('save_order')
        const newId = (saved.result as any)?.id
        const code = newId ? newId.slice(0, 6) : 'novo'
        return {
          text: `Pedido recebido! Código #${code} 🔥\n\n${collector.summary()}\n\nEm preparo agora. Tempo médio 30-40 min.`,
          specialistName: 'order_handler',
          tokens_in: totalTokensIn, tokens_out: totalTokensOut,
          cost_cents: calcCostCents(model, totalTokensIn, totalTokensOut),
          duration_ms: Date.now() - t0,
          newState: { ...collector.state, pedido_id: newId, fase: 'finalizado' } as any,
          toolCalls: tools_called.map(name => ({ name, args: {} })),
        }
      }
      // Não confirmou — tenta detectar correção (cliente quer mudar algo)
      const correction = await detectCorrection(client, ctx.message, collector.state, cardapio)
      totalTokensIn += correction.tokens_in; totalTokensOut += correction.tokens_out

      if (correction.field) {
        // Aplica correção no state
        if (correction.field === 'quantidade' && typeof correction.value === 'number') {
          if (collector.state.items[0]) {
            collector.state.items[0].quantidade = Math.max(1, Math.floor(correction.value))
          }
        } else if (correction.field === 'tipo_entrega') {
          collector.state.tipo_entrega = correction.value
          if (correction.value === 'retirada') {
            collector.state.endereco = undefined
            collector.state.collected_steps = collector.state.collected_steps.filter(s => s !== 'endereco')
          }
        } else if (correction.field === 'pagamento') {
          collector.state.pagamento = correction.value
          if (correction.value !== 'dinheiro') {
            collector.state.troco_para = null
            collector.state.collected_steps = collector.state.collected_steps.filter(s => s !== 'troco')
          }
        } else if (correction.field === 'troco') {
          collector.state.troco_para = correction.value
        } else if (correction.field === 'endereco') {
          collector.state.endereco = correction.value
        } else if (correction.field === 'sabores' && Array.isArray(correction.value)) {
          if (collector.state.items[0]) collector.state.items[0].sabores = correction.value
        } else if (correction.field === 'complementos' && Array.isArray(correction.value)) {
          if (collector.state.items[0]) collector.state.items[0].complementos = correction.value
        }

        // Recalcula total após correção
        const item = collector.state.items[0]
        if (item) {
          let sum = (Number(item.preco_unit) || 0) * (Number(item.quantidade) || 1)
          if (collector.state.tipo_entrega === 'entrega') sum += Number(collector.state.taxa || 0)
          collector.state.total = Math.round(sum * 100) / 100
        }

        // Re-mostra resumo atualizado
        return {
          text: `Ajustei: ${correction.confirm}\n\n${collector.summary()}\n\nTá certo agora? (responde "sim" pra fechar)`,
          specialistName: 'order_handler',
          tokens_in: totalTokensIn, tokens_out: totalTokensOut,
          cost_cents: calcCostCents(model, totalTokensIn, totalTokensOut),
          duration_ms: Date.now() - t0,
          newState: collector.state as any,
        }
      }

      // Não detectou correção — re-mostra resumo + pergunta clarificada
      return {
        text: `Não entendi se confirmou ou quer mudar algo. Manda "sim" pra fechar OU me diz o que mudar (ex: "muda pra 1 unidade", "troca pra retirada", "muda pagamento pra pix"):\n\n${collector.summary()}`,
        specialistName: 'order_handler',
        tokens_in: totalTokensIn, tokens_out: totalTokensOut,
        cost_cents: calcCostCents(model, totalTokensIn, totalTokensOut),
        duration_ms: Date.now() - t0,
        newState: collector.state as any,
      }
    }

    // === STEP B: Próxima etapa pendente ===
    const next = collector.nextStep()

    // === STEP C: Extract — APENAS 1 iteration. Cada step espera resposta própria ===
    // Exceção: pagamento dinheiro extrai troco junto via parsePayment (handled inside)
    let iterations = 0
    let curStep = next
    while (curStep && iterations < 1) {
      iterations++
      const extracted = await extractValue(client, model, ctx.message, curStep, cardapio, collector.state)
      totalTokensIn += extracted.tokens_in; totalTokensOut += extracted.tokens_out

      // === MULTI-ITEM batch — só na primeira iteração e só pra step item ===
      if (iterations === 1 && extracted.multiItems && extracted.multiItems.length > 1 && curStep.type === 'choice_produto') {
        const v0 = collector.validate(curStep, extracted.multiItems[0].produto)
        if (v0.ok) {
          collector = collector.apply(curStep, extracted.multiItems[0].produto)
          const qtdStep = blueprint.find(s => s.id === 'quantidade' && s.scope === 'item')
          const qtd0 = extracted.multiItems[0].quantidade || 1
          if (qtdStep) collector = collector.apply(qtdStep, qtd0)
          const newState = JSON.parse(JSON.stringify(collector.state))
          for (let i = 1; i < extracted.multiItems.length; i++) {
            const m = extracted.multiItems[i]
            const found = cardapio.produtos.find(p => p.nome.toLowerCase() === String(m.produto).toLowerCase() && p.ativo)
            if (!found) continue
            const tamanhos = cardapio.tamanhos.filter(t => t.produto_id === found.id && t.ativo)
            const sabores = cardapio.sabores.filter(s => s.produto_id === found.id && s.ativo)
            const complementos = cardapio.complementos.filter(c => c.produto_id === found.id && c.ativo)
            newState.items.push({
              produto_id: found.id, produto_nome: found.nome,
              quantidade: m.quantidade || 1,
              has_tamanhos: tamanhos.length > 0,
              has_sabores: sabores.length > 0,
              has_complementos: complementos.length > 0,
              collected_item_steps: tamanhos.length === 0 && sabores.length === 0 && complementos.length === 0 ? ['item', 'quantidade'] : ['item'],
            })
          }
          collector = new (collector.constructor as any)(newState, blueprint, cardapio)
        }
        break // multi-item case sai do loop pra processar items pendentes
      }

      // Apply normal
      if (extracted.value !== null && extracted.value !== undefined) {
        const v = collector.validate(curStep, extracted.value)
        if (v.ok) {
          collector = collector.apply(curStep, extracted.value)
        } else {
          // valor inválido, sai do loop e volta a perguntar
          break
        }
      } else {
        // não extraiu nada pro step atual, sai
        break
      }

      // Tenta próximo step com a mesma msg
      const nxt = collector.nextStep()
      if (!nxt || nxt.id === curStep.id) break // não avançou ou completou
      curStep = nxt
    }

    // === STEP D: Após apply, recheck próxima ===
    const afterStep = collector.nextStep()

    // Se completou todas → mostra resumo e marca aguardando confirmação
    if (!afterStep) {
      collector.state.fase = 'aguardando_confirmacao'
      collector.state.summary_shown_count = (collector.state.summary_shown_count || 0) + 1
      const text = `Vou confirmar o pedido com você 💜\n\n${collector.summary()}\n\nTá certo? (responde "sim" pra fechar ou diz o que mudar)`
      return {
        text,
        specialistName: 'order_handler',
        tokens_in: totalTokensIn, tokens_out: totalTokensOut,
        cost_cents: calcCostCents(model, totalTokensIn, totalTokensOut),
        duration_ms: Date.now() - t0,
        newState: collector.state as any,
        toolCalls: tools_called.map(name => ({ name, args: {} })),
      }
    }

    // === STEP E: Gera pergunta pra próxima etapa ===
    const question = await generateQuestion(client, model, afterStep, collector, ctx)
    totalTokensIn += question.tokens_in; totalTokensOut += question.tokens_out

    // FIX 1: Loop detector — se essa msg é igual à anterior, varia
    let finalText = question.text
    const lastReply = (collector.state.last_bot_reply || '').slice(0, 80)
    const newReplyHead = finalText.slice(0, 80)
    const isLoop = lastReply === newReplyHead
    const loopCount = isLoop ? ((collector.state.loop_count || 0) + 1) : 0
    if (isLoop && loopCount >= 1) {
      finalText = `Acho que não entendi sua resposta 🤔 Vou tentar de outro jeito:\n\n${finalText}\n\n_Se preferir falar com atendente humano, é só dizer "atendente"._`
    }

    return {
      text: finalText,
      specialistName: 'order_handler',
      tokens_in: totalTokensIn, tokens_out: totalTokensOut,
      cost_cents: calcCostCents(model, totalTokensIn, totalTokensOut),
      duration_ms: Date.now() - t0,
      newState: { ...collector.state, last_bot_reply: newReplyHead, loop_count: loopCount } as any,
      toolCalls: tools_called.map(name => ({ name, args: {} })),
    }
  } catch (e: any) {
    console.warn('[orderHandler] err', e?.message)
    return { text: 'Tive um problema técnico. Vou chamar um atendente 💜', specialistName: 'order_handler', tokens_in: totalTokensIn, tokens_out: totalTokensOut, cost_cents: 0, duration_ms: Date.now() - t0, needsHandoff: true, handoffReason: 'order_error' }
  }
}

// === Helpers (LLM micro-tasks) ===

async function detectCorrection(client: Anthropic, msg: string, state: PedidoState, cardapio: CardapioRefs):
  Promise<{ field: string | null; value: any; confirm: string; tokens_in: number; tokens_out: number }> {
  const lowMsg = msg.toLowerCase().trim()

  // Regex pre-detect (rápido + grátis)
  // Quantidade: "era só 1", "muda pra 2", "1 unidade", "só 1"
  const qtyMatch = lowMsg.match(/\b(?:era|s[oó]|apenas|muda pra|coloca|tinha|queria)?\s*(\d+)\s*(?:unidad|sorvet|item|produto|por favor|mesmo|só|sim)?/i)
  if (qtyMatch && /\b(era|s[oó]|apenas|muda|tinha|queria|errad|engan|um sorvete|um sorbete|um açai)\b/i.test(lowMsg)) {
    const n = parseInt(qtyMatch[1], 10)
    if (!isNaN(n) && n >= 1 && n <= 99) {
      return { field: 'quantidade', value: n, confirm: `quantidade pra ${n}`, tokens_in: 0, tokens_out: 0 }
    }
  }

  // Tipo entrega
  if (/\b(muda|troca|prefiro|na verdade|melhor)\b.*\b(retirad|buscar|pegar)\b/i.test(lowMsg) || /^retirad/i.test(lowMsg)) {
    return { field: 'tipo_entrega', value: 'retirada', confirm: 'pra retirada na loja', tokens_in: 0, tokens_out: 0 }
  }
  if (/\b(muda|troca|prefiro|na verdade|melhor)\b.*\b(entreg|deliver)\b/i.test(lowMsg) || /^entreg/i.test(lowMsg)) {
    return { field: 'tipo_entrega', value: 'entrega', confirm: 'pra entrega', tokens_in: 0, tokens_out: 0 }
  }

  // Pagamento
  if (/\b(muda|troca|na verdade|melhor)\b.*\bpix\b/i.test(lowMsg) || /^pix\b/i.test(lowMsg)) {
    return { field: 'pagamento', value: 'pix', confirm: 'pagamento pra PIX', tokens_in: 0, tokens_out: 0 }
  }
  if (/\b(muda|troca|na verdade|melhor)\b.*\b(cart[aã]o|cr[eé]dito|d[eé]bito)\b/i.test(lowMsg)) {
    return { field: 'pagamento', value: 'cartao', confirm: 'pagamento pra cartão', tokens_in: 0, tokens_out: 0 }
  }
  if (/\b(muda|troca|na verdade|melhor)\b.*\bdinheiro\b/i.test(lowMsg)) {
    return { field: 'pagamento', value: 'dinheiro', confirm: 'pagamento pra dinheiro', tokens_in: 0, tokens_out: 0 }
  }

  // Endereço — palavras "muda endereço" + nome de bairro
  if (/\b(muda|troca|na verdade|outro)\b.*\b(endere[çc]o|bairro|rua)\b/i.test(lowMsg)) {
    return { field: null, value: null, confirm: '', tokens_in: 0, tokens_out: 0 } // re-mostra summary, cliente vai fornecer
  }

  return { field: null, value: null, confirm: '', tokens_in: 0, tokens_out: 0 }
}

async function checkConfirmation(client: Anthropic, model: string, msg: string): Promise<{ value: boolean; tokens_in: number; tokens_out: number }> {
  const t = msg.toLowerCase().trim()
  // Negação explícita
  if (/\b(n[aã]o|nope|nada|cancela|errado|n[ãa]o confirmo|n[ãa]o quero)\b/i.test(t)) {
    return { value: false, tokens_in: 0, tokens_out: 0 }
  }
  // Confirmação explícita por palavra-chave (sem LLM)
  if (/^(sim|s|si|confirmo|confirma|confirmado|ok|okay|pode|manda|fechar|finalizar|finaliza|t[áa] (bom|certo|[óo]timo|joia)|isso|isso a[ií]|isso mesmo|certinho|👍|✅)\b/i.test(t)) {
    return { value: true, tokens_in: 0, tokens_out: 0 }
  }
  // Ambíguo: trata como NÃO confirmou (re-mostra resumo). Não usa LLM pra evitar falsos positivos.
  return { value: false, tokens_in: 0, tokens_out: 0 }
}

async function extractValue(client: Anthropic, model: string, msg: string, step: OrderStep, cardapio: CardapioRefs, state: PedidoState):
  Promise<{ value: any; tokens_in: number; tokens_out: number; multiItems?: Array<{produto: string; quantidade: number}>; ambiguous?: any }> {
  const lowMsg = msg.toLowerCase().trim()

  // === MICRO-AGENT ROUTING (v2 finders) ===
  // Cada step tipo usa o finder correspondente — RAG/fuzzy + LLM fallback
  const curItem = state.items[state.current_item_index ?? 0]

  if (step.type === 'choice_produto') {
    // Multi-item batch via regex (já mais robusto que LLM aqui)
    const productNames = cardapio.produtos.filter(p => p.ativo).map(p => p.nome.toLowerCase())
    const detected: Array<{ produto: string; quantidade: number }> = []
    for (const name of productNames) {
      const re = new RegExp(`\\b(?:(\\d+)\\s+)?${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      let m
      while ((m = re.exec(lowMsg)) !== null) {
        const qty = m[1] ? parseInt(m[1], 10) : 1
        if (!detected.find(d => d.produto.toLowerCase() === name)) {
          const p = cardapio.produtos.find(pp => pp.nome.toLowerCase() === name)
          if (p) detected.push({ produto: p.nome, quantidade: Math.min(99, qty) })
        }
      }
    }
    if (detected.length > 1) {
      return { value: detected[0].produto, multiItems: detected, tokens_in: 0, tokens_out: 0 }
    }
    // Single product via finder
    const r = await findProduct(msg, cardapio.produtos)
    if (r.matched) return { value: r.produto_nome, tokens_in: 0, tokens_out: 0 }
    if (r.ambiguous) return { value: null, ambiguous: { type: 'produto', candidates: r.candidates }, tokens_in: 0, tokens_out: 0 }
    return { value: null, tokens_in: 0, tokens_out: 0 }
  }

  if (step.type === 'choice_tamanho') {
    if (!curItem?.produto_id) return { value: null, tokens_in: 0, tokens_out: 0 }
    const r = matchSize(msg, cardapio.tamanhos, curItem.produto_id)
    if (r.matched) return { value: r.tamanho_nome, tokens_in: 0, tokens_out: 0 }
    return { value: null, tokens_in: 0, tokens_out: 0 }
  }

  if (step.type === 'multi_choice_sabor') {
    if (!curItem?.produto_id) return { value: null, tokens_in: 0, tokens_out: 0 }
    const r = await matchFlavors(msg, cardapio.sabores, curItem.produto_id, step.max || 3)
    if (r.matched && r.flavors) return { value: r.flavors.map(f => f.nome), tokens_in: 0, tokens_out: 0 }
    if (r.ambiguous) return { value: null, ambiguous: { type: 'sabor', candidates: r.candidates }, tokens_in: 0, tokens_out: 0 }
    return { value: null, tokens_in: 0, tokens_out: 0 }
  }

  if (step.type === 'multi_choice_complemento') {
    if (!curItem?.produto_id) return { value: null, tokens_in: 0, tokens_out: 0 }
    const r = await matchComplements(msg, cardapio.complementos, curItem.produto_id, step.max || 5)
    if (r.matched) return { value: (r.complements || []).map(c => c.nome), tokens_in: 0, tokens_out: 0 }
    if (r.ambiguous) return { value: null, ambiguous: { type: 'complemento', candidates: r.candidates }, tokens_in: 0, tokens_out: 0 }
    return { value: null, tokens_in: 0, tokens_out: 0 }
  }

  if (step.type === 'address') {
    const r = await parseAddress(msg, cardapio.bairrosAtivos)
    if (r.matched && r.endereco) return { value: r.endereco, tokens_in: 0, tokens_out: 0 }
    if (r.partial) return { value: r.partial, tokens_in: 0, tokens_out: 0 }
    return { value: null, tokens_in: 0, tokens_out: 0 }
  }


  // === Pre-extract regex pra steps simples (evita LLM e pega keywords óbvios) ===
  if ((step.type as string) === 'add_more_items') {
    // "não" sozinho = não quer mais = fechar
    if (/^(n[aã]o|nope|nada|nem)\b/i.test(lowMsg) || /\b(fechar|fechhar|finalizar|encerrar|s[oó] isso|pronto|j[aá] era|pode fech|t[aá] bom|t[aá] [oó]timo|chega|nada mais|t[aá] certo|j[aá] [eé])\b/i.test(lowMsg)) {
      return { value: 'fechar', tokens_in: 0, tokens_out: 0 }
    }
    if (/\b(sim|mais|adicionar|outro|outra|quero mais|tem mais|adicione|coloca mais|um a mais|coloca|por[eé]m)\b/i.test(lowMsg)) {
      return { value: 'adicionar', tokens_in: 0, tokens_out: 0 }
    }
    return { value: null, tokens_in: 0, tokens_out: 0 }
  }

  if ((step.type as string) === 'quantity') {
    // Tenta número direto ou palavra
    const m = lowMsg.match(/\b(\d+)\b/)
    if (m) return { value: parseInt(m[1], 10), tokens_in: 0, tokens_out: 0 }
    const wordMap: Record<string, number> = { 'um': 1, 'uma': 1, 'dois': 2, 'duas': 2, 'tres': 3, 'três': 3, 'quatro': 4, 'cinco': 5, 'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9, 'dez': 10 }
    for (const [w, n] of Object.entries(wordMap)) {
      if (new RegExp(`\\b${w}\\b`, 'i').test(lowMsg)) return { value: n, tokens_in: 0, tokens_out: 0 }
    }
    return { value: null, tokens_in: 0, tokens_out: 0 }
  }

  if (step.type === 'currency' && step.id === 'troco') {
    // Resposta curta "nao/nada/nope/zero" sozinha → sem troco
    const trimmed = lowMsg.trim()
    if (/^(n[aã]o|nope|nada|nem|zero|0)$/i.test(trimmed)) {
      return { value: 0, tokens_in: 0, tokens_out: 0 }
    }
    // "não precisa de troco" / "sem troco" / "exato" → 0
    if (/\b(n[aã]o (precisa|preciso|tem|vai|vou)|sem troco|sem necessidade|n[aã]o vou precisar|exato|certinho|t[aá] certo|valor exato|pago exato)\b/i.test(lowMsg)) {
      return { value: 0, tokens_in: 0, tokens_out: 0 }
    }
    // Detecta valor R$
    const m = lowMsg.match(/r?\$?\s*(\d+(?:[.,]\d{1,2})?)/i)
    if (m) return { value: parseFloat(m[1].replace(',', '.')), tokens_in: 0, tokens_out: 0 }
    return { value: null, tokens_in: 0, tokens_out: 0 }
  }

  if (step.type === 'choice' && step.options) {
    for (const opt of step.options) {
      if (new RegExp(`\\b${opt}\\b`, 'i').test(lowMsg)) {
        return { value: opt.toLowerCase(), tokens_in: 0, tokens_out: 0 }
      }
    }
    // Sinônimos comuns
    if (step.id === 'tipo_entrega') {
      if (/\b(entreg|deliver|trazer|trazem)\b/i.test(lowMsg)) return { value: 'entrega', tokens_in: 0, tokens_out: 0 }
      if (/\b(retirad|buscar|pegar|retirar)\b/i.test(lowMsg)) return { value: 'retirada', tokens_in: 0, tokens_out: 0 }
    }
    if (step.id === 'pagamento') {
      if (/\bpix\b/i.test(lowMsg)) return { value: 'pix', tokens_in: 0, tokens_out: 0 }
      if (/\b(cart[aã]o|credito|cr[eé]dito|debito|d[eé]bito|maquina|maquininha)\b/i.test(lowMsg)) return { value: 'cartao', tokens_in: 0, tokens_out: 0 }
      if (/\b(dinheiro|cash|esp[eé]cie)\b/i.test(lowMsg)) return { value: 'dinheiro', tokens_in: 0, tokens_out: 0 }
    }
  }

  // === Pra outros tipos, vai pro LLM extract normal ===
  let optionsHint = ''
  // Os tipos cobertos por micro-agents (choice_produto, _tamanho, multi_choice_*, address) já retornaram acima.
  // Aqui só caem: choice (não-cardápio), quantity, add_more_items, currency, text, phone, confirm
  if (step.type === 'choice' && step.options) {
    optionsHint = `Opções válidas: ${step.options.join(', ')}`
  } else if ((step.type as string) === 'quantity') {
    optionsHint = 'Número inteiro >= 1'
  } else if ((step.type as string) === 'add_more_items') {
    optionsHint = 'Cliente quer mais um item ou pode fechar pedido?'
  }

  const isProdStep = false // já tratado acima via micro-agent

  const sys = `Você extrai informação estruturada da mensagem do cliente.

CAMPO: ${step.label} (tipo ${step.type})
${optionsHint}

Responda APENAS JSON (sem texto antes ou depois):
${isProdStep ? `
REGRAS:
- Se cliente menciona 1 produto sem dizer quantidade: {"value": "<nome do produto>"}
- Se cliente menciona 1 produto COM quantidade: {"items": [{"produto": "<nome>", "quantidade": <N>}]}
- Se cliente menciona 2+ produtos OU quantidades em uma msg: {"items": [{"produto": "X", "quantidade": 2}, {"produto": "Y", "quantidade": 1}]}
- Se mensagem não tem produto: {"value": null}

Quantidade pode vir como número ("2"), palavra ("dois", "duas"), ou implícita ("um açaí" = 1).

EXEMPLOS:
Cliente: "quero açaí" → {"value": "Açaí"}
Cliente: "quero 2 açaí" → {"items": [{"produto": "Açaí", "quantidade": 2}]}
Cliente: "1 açaí e 2 sorvete" → {"items": [{"produto": "Açaí", "quantidade": 1}, {"produto": "Sorvete", "quantidade": 2}]}
Cliente: "quero 2 açaí 500ml e 1 vitamina" → {"items": [{"produto": "Açaí", "quantidade": 2}, {"produto": "Vitamina", "quantidade": 1}]}
Cliente: "quero açaí, sorvete e fondue" → {"items": [{"produto": "Açaí", "quantidade": 1}, {"produto": "Sorvete", "quantidade": 1}, {"produto": "Fondue", "quantidade": 1}]}
` : `
- Se identificou valor: {"value": <valor>}
- Se mensagem não tem essa info: {"value": null}
`}

Para multi_choice retorna array. Para address retorna {bairro, rua, numero, complemento?}. Para currency e quantity retorna número. Para choice retorna string lowercase.

NUNCA invente. Só extraia o que cliente DISSE.`

  const res = await client.messages.create({
    model, max_tokens: 250, system: sys,
    messages: [{ role: 'user', content: msg }],
  })
  const txt = res.content.filter(c => c.type === 'text').map(c => (c as any).text).join('').trim()
  let parsed: any = null
  try {
    const m = txt.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(m ? m[0] : '{}')
  } catch {}

  // Se veio "items" array (multi-item)
  if (Array.isArray(parsed?.items) && parsed.items.length > 0) {
    return {
      value: parsed.items[0]?.produto ?? null, // primeiro vai pro fluxo normal
      multiItems: parsed.items,
      tokens_in: res.usage?.input_tokens || 0,
      tokens_out: res.usage?.output_tokens || 0,
    }
  }

  return {
    value: parsed?.value ?? null,
    tokens_in: res.usage?.input_tokens || 0,
    tokens_out: res.usage?.output_tokens || 0,
  }
}

async function generateQuestion(_client: Anthropic, _model: string, step: OrderStep, collector: OrderCollector, _ctx: AgentContext):
  Promise<{ text: string; tokens_in: number; tokens_out: number }> {
  // ZERO LLM. Templates determinísticos. Garantia que NÃO inventa preço, NÃO inventa item, NÃO viola formato.
  const cur = collector.currentItem()

  switch (step.type) {
    case 'choice': {
      // Pergunta varia por step.id pra ser natural
      let prefix = step.prompt
      if (step.id === 'tipo_entrega') prefix = 'Vai ser entrega ou retirada? 🛵'
      else if (step.id === 'pagamento') prefix = 'Como vai pagar? 💳'
      const opts = (step.options || []).map(o => `• ${o}`).join('\n')
      return { text: `${prefix}\n\n${opts}`, tokens_in: 0, tokens_out: 0 }
    }

    case 'choice_produto': {
      const list = collector.cardapio.produtos.filter(p => p.ativo).map(p => `• ${p.nome}`).join('\n')
      return { text: `Qual produto você vai querer? 🍦\n\n${list}`, tokens_in: 0, tokens_out: 0 }
    }

    case 'choice_tamanho': {
      const tams = collector.cardapio.tamanhos.filter(t => t.produto_id === cur?.produto_id && t.ativo)
      const list = tams.map(t => `• ${t.nome} — R$ ${Number(t.preco).toFixed(2).replace('.', ',')}`).join('\n')
      const intro = cur?.produto_nome ? `Beleza, ${cur.produto_nome}!` : ''
      return { text: `${intro} Qual tamanho?\n\n${list}`.trim(), tokens_in: 0, tokens_out: 0 }
    }

    case 'multi_choice_sabor': {
      const sbs = collector.cardapio.sabores.filter(s => s.produto_id === cur?.produto_id && s.ativo).map(s => s.nome)
      const list = sbs.map(s => `• ${s}`).join('\n')
      const max = step.max || 3
      return { text: `Qual sabor? Pode escolher até ${max}.\n\n${list}`, tokens_in: 0, tokens_out: 0 }
    }

    case 'multi_choice_complemento': {
      const cps = collector.cardapio.complementos.filter(c => c.produto_id === cur?.produto_id && c.ativo)
      const byTipo = new Map<string, string[]>()
      for (const c of cps) {
        const t = (c.tipo || 'outros').toLowerCase()
        if (!byTipo.has(t)) byTipo.set(t, [])
        byTipo.get(t)!.push(c.nome)
      }
      const groups: string[] = []
      for (const [tipo, nomes] of byTipo) {
        groups.push(`${tipo.toUpperCase()}\n${nomes.map(n => `• ${n}`).join('\n')}`)
      }
      const list = groups.join('\n\n')
      const max = step.max || 5
      return { text: `Quer adicionar complementos? (até ${max} ou diz "não quero")\n\n${list}`, tokens_in: 0, tokens_out: 0 }
    }

    case 'quantity': {
      const desc = `${cur?.produto_nome || ''}${cur?.tamanho_nome ? ' ' + cur.tamanho_nome : ''}`.trim()
      return { text: `Quantos ${desc || 'desse item'} você quer? (ex: 1, 2, 3…)`, tokens_in: 0, tokens_out: 0 }
    }

    case 'add_more_items':
      return { text: 'Quer adicionar mais algum item ou pode fechar o pedido?', tokens_in: 0, tokens_out: 0 }

    case 'address': {
      const e = collector.state.endereco || {}
      const missing: string[] = []
      if (!e.bairro) missing.push('bairro')
      if (!e.rua) missing.push('rua')
      if (!e.numero) missing.push('número')
      if (missing.length === 3) {
        return { text: 'Me passa o endereço pra entrega: bairro, rua e número 📍', tokens_in: 0, tokens_out: 0 }
      }
      if (missing.length > 0) {
        return { text: `Faltou ${missing.join(', ')}. Me manda?`, tokens_in: 0, tokens_out: 0 }
      }
      return { text: `Esse bairro "${e.bairro}" não está na nossa área de entrega. Qual o bairro?`, tokens_in: 0, tokens_out: 0 }
    }

    case 'currency': {
      if (step.id === 'troco') {
        const total = (collector.state.total || 0).toFixed(2).replace('.', ',')
        return {
          text: `Total do pedido: R$ ${total}.\n\nVai precisar de troco? Se sim, pra quanto? (ou diz "sem troco" se vai pagar exato)`,
          tokens_in: 0, tokens_out: 0,
        }
      }
      return { text: step.prompt, tokens_in: 0, tokens_out: 0 }
    }

    default:
      return { text: step.prompt, tokens_in: 0, tokens_out: 0 }
  }
}

// ============================================================
// STATUS HANDLER (gpt-4o-mini + DB query)
// ============================================================
export async function statusHandler(ctx: AgentContext): Promise<SpecialistReply> {
  const t0 = Date.now()
  const sb = supabaseService()
  let q = sb
    .from('pedidos')
    .select('status,created_at,total,taxa_entrega,id')
    .eq('telefone_cliente', ctx.telefone)
  if (ctx.tenant_id) q = q.eq('tenant_id', ctx.tenant_id)
  const { data: ultimo } = await q
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!ultimo) {
    return { text: 'Não encontrei pedidos seus. Quer fazer um agora? 💜', specialistName: 'status_handler', tokens_in: 0, tokens_out: 0, cost_cents: 0, duration_ms: Date.now() - t0 }
  }
  const status = ultimo.status as string
  const map: Record<string, string> = {
    novo_pedido: '🔔 Recebemos seu pedido! Vai entrar em preparo já já.',
    em_preparo: '🔥 Seu pedido está sendo preparado!',
    pronto_retirar: '🏁 Pronto pra retirada!',
    saiu_entrega: '🛵 Saiu pra entrega! Chegará em ~25min.',
    entregue: '✅ Pedido entregue. Esperamos que tenha gostado 💜',
    cancelado: '⚠️ Pedido cancelado. Quer tentar de novo?',
  }
  const text = map[status] || `Status atual: ${status}`
  return { text, specialistName: 'status_handler', tokens_in: 0, tokens_out: 0, cost_cents: 0, duration_ms: Date.now() - t0 }
}

// ============================================================
// OBJECTION HANDLER (claude-sonnet)
// ============================================================
export async function objectionHandler(ctx: AgentContext): Promise<SpecialistReply> {
  const t0 = Date.now()
  const e = env()
  const model = await modelFromConfig(ctx.tenant_id, 'model_objection', e.OBJECTION_MODEL)
  const basePrompt = ctx.tenant_id
    ? await loadPrompt(ctx.tenant_id, 'objection')
    : FALLBACK_OBJECTION
  const sys = `${basePrompt}

${brandPersona()}
${dynamicContext(ctx)}`
  try {
    const client = new Anthropic({ apiKey: e.ANTHROPIC_API_KEY })
    const res = await client.messages.create({
      model, max_tokens: 300, system: sys,
      messages: [{ role: 'user', content: ctx.message }],
    })
    const tokens_in = res.usage?.input_tokens || 0
    const tokens_out = res.usage?.output_tokens || 0
    const text = res.content.filter(c => c.type === 'text').map(c => (c as any).text).join('').trim()
    return {
      text: text || 'Vou chamar um atendente pra te ajudar 💜',
      specialistName: 'objection_handler',
      tokens_in, tokens_out,
      cost_cents: calcCostCents(model, tokens_in, tokens_out),
      duration_ms: Date.now() - t0,
    }
  } catch (e: any) {
    return { text: 'Vou chamar um atendente pra resolver isso 💜', specialistName: 'objection_handler', tokens_in: 0, tokens_out: 0, cost_cents: 0, duration_ms: Date.now() - t0, needsHandoff: true, handoffReason: 'objection_error' }
  }
}

// ============================================================
// ESCALATION HANDLER (deterministic)
// ============================================================
export async function escalationHandler(ctx: AgentContext): Promise<SpecialistReply> {
  return {
    text: 'Vou chamar um atendente humano pra te atender. Aguarde só um momento 💜',
    specialistName: 'escalation_handler',
    tokens_in: 0, tokens_out: 0, cost_cents: 0, duration_ms: 0,
    needsHandoff: true,
    handoffReason: 'user_requested',
  }
}

// ============================================================
// PICK SPECIALIST + reminder de pedido pendente (FIX 1)
// ============================================================
export async function pickAndRunSpecialist(ctx: AgentContext, intent: Intent, ragChunks: any[]): Promise<SpecialistReply> {
  let reply: SpecialistReply
  switch (intent) {
    case 'saudacao': reply = await greetingHandler(ctx); break
    case 'cardapio_query': reply = await menuResponder(ctx, ragChunks); break
    case 'pedido_inicio':
    case 'pedido_continua': reply = await orderHandler(ctx, ragChunks); break
    case 'status_pedido': reply = await statusHandler(ctx); break
    case 'objection': reply = await objectionHandler(ctx); break
    case 'escalation': reply = await escalationHandler(ctx); break
    case 'media_only': reply = await greetingHandler(ctx); break
    case 'smalltalk':
    default:
      reply = await menuResponder(ctx, ragChunks)
  }

  // FIX 1: append reminder se cliente desviou pra outro assunto + tem pedido pendente
  const isOrderHandler = reply.specialistName === 'order_handler'
  const isFinalState = reply.newState && (reply.newState as any).fase === 'finalizado'
  const isCancelled = reply.newState && (reply.newState as any).fase === 'cancelado'
  if (!isOrderHandler && !isFinalState && !isCancelled) {
    const pedido = ctx.state.pedido as any
    if (pedido?.items?.length > 0 && pedido?.items?.some((i: any) => i?.produto_nome) && pedido?.fase !== 'finalizado' && pedido?.fase !== 'cancelado') {
      // monta reminder curto
      const itemsBrief = pedido.items
        .filter((i: any) => i.produto_nome)
        .map((i: any) => `${i.quantidade || 1}× ${i.produto_nome}${i.tamanho_nome ? ' ' + i.tamanho_nome : ''}`)
        .join(', ')
      if (itemsBrief) {
        reply.text = `${reply.text}\n\n_Lembrando: você está montando ${itemsBrief}. Quer continuar o pedido?_`
      }
    }
  }

  return reply
}
