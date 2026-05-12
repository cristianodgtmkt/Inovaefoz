/**
 * ConversationManager v2 — Sonnet 4.5 com tool calling.
 *
 * Recebe:
 * - msg do cliente
 * - estado pedido (canônico, persistido)
 * - histórico (últimas 10 trocas — bot E user)
 * - cardápio refs
 *
 * Decide:
 * - Quais tools chamar (find_product, find_flavor, etc)
 * - Aplica ações ao state via Collector
 * - Compõe resposta natural pro cliente
 *
 * Garante: nunca inventa preço/item — sempre via tool result.
 */
import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/config/env'
import { calcCostCents } from '@/lib/billing/pricing'
import { supabaseService } from '@/lib/db/supabase'
import { OrderCollector, loadBlueprint, isCancelIntent, type CardapioRefs, type PedidoState } from '../order-collector'
import { saveOrderTool } from '../tools/order-tools'
import { findProduct } from './finders/product-finder'
import { matchFlavors } from './finders/flavor-matcher'
import { matchComplements } from './finders/complement-matcher'
import { matchSize } from './finders/size-matcher'
import { parseAddress } from './finders/address-parser'
import { parsePayment } from './finders/payment-parser'
import { validateResponse } from './validator'
import type { AgentContext, SpecialistReply } from '../types'

// === Tool definitions (Anthropic format) ===
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'find_product',
    description: 'Identifica qual produto do cardápio o cliente quer. Use quando cliente menciona nome de produto.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Texto literal do cliente' } },
      required: ['query'],
    },
  },
  {
    name: 'find_size',
    description: 'Identifica tamanho. Cliente já deve ter escolhido produto.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'find_flavors',
    description: 'Identifica sabores escolhidos. Pode retornar 1+ sabores ou pedir desambiguação.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'find_complements',
    description: 'Identifica complementos escolhidos.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'set_quantity',
    description: 'Define quantidade do item atual (1-99).',
    input_schema: {
      type: 'object',
      properties: { quantity: { type: 'number' } },
      required: ['quantity'],
    },
  },
  {
    name: 'set_delivery',
    description: 'Define entrega ou retirada.',
    input_schema: {
      type: 'object',
      properties: { type: { type: 'string', enum: ['entrega', 'retirada'] } },
      required: ['type'],
    },
  },
  {
    name: 'set_address',
    description: 'Define endereço de entrega. Valida bairro automaticamente.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Texto literal do cliente com endereço' } },
      required: ['query'],
    },
  },
  {
    name: 'set_payment',
    description: 'Define forma de pagamento (e troco se dinheiro).',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Texto literal sobre pagamento' } },
      required: ['query'],
    },
  },
  {
    name: 'add_more_item',
    description: 'Adiciona um novo item ao pedido (cliente quer mais um produto).',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'finish_order',
    description: 'Marca pedido como pronto pra confirmação. Mostra resumo ao cliente.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'confirm_and_save',
    description: 'Cliente confirmou. Salva pedido no banco. Use SOMENTE quando cliente disse "sim/confirmo/pode fechar" depois de ver o resumo.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'cancel_order',
    description: 'Cancela pedido em construção.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
]

interface ToolResult {
  ok: boolean
  data?: any
  error?: string
  state_after?: PedidoState
}

export async function runConversationManager(ctx: AgentContext): Promise<SpecialistReply> {
  const t0 = Date.now()
  const e = env()
  let totalTokensIn = 0, totalTokensOut = 0, totalToolCost = 0
  const tools_called: string[] = []

  // Build cardapio refs
  const cardapio: CardapioRefs = {
    produtos: ctx.cardapioSnapshot.produtos,
    tamanhos: ctx.cardapioSnapshot.tamanhos,
    sabores: ctx.cardapioSnapshot.sabores,
    complementos: ctx.cardapioSnapshot.complementos,
    taxas: ctx.cardapioSnapshot.taxas,
    bairrosAtivos: ctx.cardapioSnapshot.bairrosAtivos,
  }

  const blueprint = await loadBlueprint(ctx.tenant_id)
  let state: PedidoState = (ctx.state.pedido as any)?.collected_steps !== undefined
    ? (ctx.state.pedido as unknown as PedidoState)
    : { items: [], collected_steps: [], fase: 'em_construcao', current_item_index: 0 }
  let collector = new OrderCollector(state, blueprint, cardapio)

  // Cancel detection (regex pre-LLM)
  if (isCancelIntent(ctx.message)) {
    return {
      text: 'Pedido cancelado. Quando quiser, é só falar! 💜',
      specialistName: 'order_handler_v2',
      tokens_in: 0, tokens_out: 0, cost_cents: 0,
      duration_ms: Date.now() - t0,
      newState: { items: [], collected_steps: [], fase: 'cancelado', current_item_index: 0 } as any,
    }
  }

  // Persona
  let tomHint = 'Tom amigável, próximo, brasileiro do Sul. Use 💜 com moderação.'
  try {
    if (ctx.tenant_id) {
      const sb = supabaseService()
      const { data: cfg } = await sb.from('ai_tenant_config').select('persona_tom').eq('tenant_id', ctx.tenant_id).maybeSingle()
      const tom = cfg?.persona_tom
      if (tom === 'profissional') tomHint = 'Tom direto, profissional. Sem emojis.'
      else if (tom === 'brincalhao') tomHint = 'Tom descontraído, brincalhão. Use 1-2 emojis por msg.'
    }
  } catch {}

  // === MULTI-ITEM PRE-DETECT ===
  // Se cliente menciona 2+ produtos numa msg, pre-processa antes do Manager iniciar
  // Detecta padrão "N produto1 e M produto2" via regex
  if (state.items.length === 0 || (state.items.length === 1 && !state.items[0].produto_nome)) {
    const productNames = cardapio.produtos.filter(p => p.ativo).map(p => p.nome.toLowerCase())
    const lowMsg = ctx.message.toLowerCase()
    const detected: Array<{ name: string; qty: number }> = []
    for (const name of productNames) {
      // Match "N produto" ou "produto"
      const re = new RegExp(`\\b(?:(\\d+)\\s+)?${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      let m
      while ((m = re.exec(lowMsg)) !== null) {
        const qty = m[1] ? parseInt(m[1], 10) : 1
        if (!detected.find(d => d.name === name)) {
          detected.push({ name, qty: Math.min(99, qty) })
        }
      }
    }
    if (detected.length > 1) {
      // Multi-item! Pre-popula state
      const newState: PedidoState = { items: [], collected_steps: [], fase: 'em_construcao', current_item_index: 0 }
      for (const d of detected) {
        const found = cardapio.produtos.find(p => p.nome.toLowerCase() === d.name && p.ativo)
        if (!found) continue
        const tamanhos = cardapio.tamanhos.filter(t => t.produto_id === found.id && t.ativo)
        const sabores = cardapio.sabores.filter(s => s.produto_id === found.id && s.ativo)
        const complementos = cardapio.complementos.filter(c => c.produto_id === found.id && c.ativo)
        newState.items.push({
          produto_id: found.id,
          produto_nome: found.nome,
          quantidade: d.qty,
          has_tamanhos: tamanhos.length > 0,
          has_sabores: sabores.length > 0,
          has_complementos: complementos.length > 0,
          collected_item_steps: ['item', 'quantidade'],
        })
      }
      newState.current_item_index = 0
      state = newState
      collector = new OrderCollector(state, blueprint, cardapio)
    }
  }

  // Histórico (últimas 8 trocas)
  const history = ctx.history.slice(-8).map(h => `[${h.role === 'assistant' ? 'BOT' : 'CLIENTE'}]: ${h.message}`).join('\n')

  // Cardápio summary (counts) pra Manager saber o que tem
  const cardapioSummary = `Cardápio:
- ${cardapio.produtos.filter(p => p.ativo).length} produtos: ${cardapio.produtos.filter(p => p.ativo).map(p => p.nome).join(', ')}
- ${cardapio.bairrosAtivos.size} bairros atendidos`

  // Estado pedido pra Manager
  const stateInfo = describeState(state)

  const systemPrompt = `Você é a atendente WhatsApp de uma loja de delivery. ${tomHint}

REGRAS RÍGIDAS — SIGA EM ORDEM:
1. ⚠️ SIGA "PRÓXIMA AÇÃO ESPERADA" abaixo SEM PULAR. Se diz "OBRIGATÓRIO", você TEM que executar.
2. NUNCA invente preço, item ou bairro. SEMPRE use tool.
3. NUNCA assuma quantidade = 1 por padrão. SEMPRE pergunte ao cliente "quantos?" e use set_quantity.
4. NUNCA pule etapas obrigatórias do blueprint (tamanho/sabor/quantidade).
5. Se cliente respondeu UMA coisa (ex: "morango"), processe ESSA uma — não pule pra próxima sem perguntar.
6. NUNCA prometa prazo exato. NUNCA invente telefone/endereço da loja.
7. Mensagens curtas (max 3 linhas). Português BR coloquial.
8. Quando tool retorna {ambiguous, candidates}, pergunte ao cliente qual das opções.
9. Quando tool retorna {not_found, available}, mostre opções disponíveis.
10. Antes de salvar (confirm_and_save), CHAME finish_order primeiro. Cliente PRECISA ver resumo e dizer "sim".
11. Se cliente disse "sim/confirmo/pode/manda" depois do resumo → confirm_and_save.
12. Quando confirm_and_save retornar pedido_id, responda EXATAMENTE: "Pedido recebido! Código #XXXX 🔥" + breve agradecimento.
13. Multi-item já pre-detectado pelo sistema — apenas continue configurando cada item em sequência.

${cardapioSummary}

ESTADO ATUAL DO PEDIDO:
${stateInfo}

HISTÓRICO ÚLTIMAS 8 MENSAGENS:
${history || '(início da conversa)'}

PRÓXIMA AÇÃO ESPERADA:
${nextActionHint(state, cardapio)}`

  // Loop de tool calling (max 5 iterations)
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: ctx.message },
  ]

  let finalText = ''
  let iter = 0

  try {
    const client = new Anthropic({ apiKey: e.ANTHROPIC_API_KEY })
    while (iter < 5) {
      iter++
      const res = await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1500,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      })
      totalTokensIn += res.usage?.input_tokens || 0
      totalTokensOut += res.usage?.output_tokens || 0

      // Coleta tool uses + texts
      const toolUses = res.content.filter(c => c.type === 'tool_use') as Anthropic.ToolUseBlock[]
      const texts = res.content.filter(c => c.type === 'text').map(c => (c as any).text).join('\n').trim()

      if (toolUses.length === 0) {
        // Manager só falou texto — resposta final
        finalText = texts
        break
      }

      // Adiciona resposta do Manager (com tool_use) ao histórico
      messages.push({ role: 'assistant', content: res.content })

      // Executa tools em paralelo
      const toolResults = await Promise.all(toolUses.map(async (tu) => {
        const result = await executeTool(tu.name, tu.input as any, collector, cardapio, ctx)
        if (result.state_after) {
          state = result.state_after
          collector = new OrderCollector(state, blueprint, cardapio)
        }
        if (result.data?.cost_cents) totalToolCost += result.data.cost_cents
        tools_called.push(tu.name)
        return {
          type: 'tool_result' as const,
          tool_use_id: tu.id,
          content: JSON.stringify({
            ok: result.ok,
            ...(result.data || {}),
            ...(result.error ? { error: result.error } : {}),
          }),
        }
      }))

      messages.push({ role: 'user', content: toolResults })

      // Se confirm_and_save foi chamado com sucesso, finaliza
      if (toolUses.some(t => t.name === 'confirm_and_save')) {
        const saveResult = toolResults.find(r => {
          try { return JSON.parse(r.content as string).ok && JSON.parse(r.content as string).pedido_id }
          catch { return false }
        })
        if (saveResult) {
          // Continua loop pra Manager gerar msg final
          continue
        }
      }

      // Se cancel, retorna direto
      if (toolUses.some(t => t.name === 'cancel_order')) {
        return {
          text: 'Pedido cancelado. Quando quiser, é só falar! 💜',
          specialistName: 'order_handler_v2',
          tokens_in: totalTokensIn, tokens_out: totalTokensOut,
          cost_cents: calcCostCents('claude-sonnet-4-5-20250929', totalTokensIn, totalTokensOut) + totalToolCost,
          duration_ms: Date.now() - t0,
          newState: { items: [], collected_steps: [], fase: 'cancelado', current_item_index: 0 } as any,
          toolCalls: tools_called.map(n => ({ name: n, args: {} })),
        }
      }
    }

    // Validate response (pre-send)
    const validation = validateResponse(finalText || 'Vou continuar seu pedido.', state, cardapio)
    finalText = validation.reply

    return {
      text: finalText,
      specialistName: 'order_handler_v2',
      tokens_in: totalTokensIn, tokens_out: totalTokensOut,
      cost_cents: calcCostCents('claude-sonnet-4-5-20250929', totalTokensIn, totalTokensOut) + totalToolCost,
      duration_ms: Date.now() - t0,
      newState: state as any,
      toolCalls: tools_called.map(n => ({ name: n, args: {} })),
    }
  } catch (err: any) {
    console.warn('[ConversationManager] err', err?.message)
    return {
      text: 'Tive um problema técnico, vou chamar um atendente 💜',
      specialistName: 'order_handler_v2',
      tokens_in: totalTokensIn, tokens_out: totalTokensOut, cost_cents: 0,
      duration_ms: Date.now() - t0,
      needsHandoff: true,
      handoffReason: 'manager_error',
    }
  }
}

// === Helpers ===

function describeState(state: PedidoState): string {
  const lines: string[] = []
  lines.push(`fase: ${state.fase || 'em_construcao'}`)
  lines.push(`items: ${state.items.length}`)
  state.items.forEach((it, i) => {
    if (!it.produto_nome) {
      lines.push(`  [${i}] (vazio, sendo configurado)`)
      return
    }
    let line = `  [${i}] ${it.quantidade || 1}× ${it.produto_nome}`
    if (it.tamanho_nome) line += ` ${it.tamanho_nome}`
    if (it.sabores?.length) line += ` sabores: ${it.sabores.join(', ')}`
    if (it.complementos?.length) line += ` comp: ${it.complementos.join(', ')}`
    if (it.preco_unit) line += ` — R$ ${it.preco_unit.toFixed(2)}`
    lines.push(line)
  })
  if (state.tipo_entrega) lines.push(`entrega: ${state.tipo_entrega}`)
  if (state.endereco) lines.push(`endereco: ${state.endereco.bairro || '?'}, ${state.endereco.rua || '?'} ${state.endereco.numero || '?'}`)
  if (state.pagamento) lines.push(`pagamento: ${state.pagamento}`)
  if (state.troco_para !== undefined && state.troco_para !== null) lines.push(`troco_para: R$ ${state.troco_para}`)
  if (state.taxa) lines.push(`taxa: R$ ${state.taxa.toFixed(2)}`)
  if (state.total) lines.push(`total: R$ ${state.total.toFixed(2)}`)
  return lines.join('\n')
}

function nextActionHint(state: PedidoState, cardapio: CardapioRefs): string {
  // Itera por TODOS os items pra ver se algum tem etapa pendente
  for (let i = 0; i < state.items.length; i++) {
    const it = state.items[i]
    if (!it.produto_nome) {
      return `OBRIGATÓRIO: Configure produto do item ${i + 1}. Use find_product. Não pule.`
    }
    if (it.has_tamanhos && !it.tamanho_nome) {
      return `OBRIGATÓRIO: Item ${i + 1} (${it.produto_nome}) precisa de TAMANHO. Use find_size. Pergunte ao cliente. Não invente. Não pule.`
    }
    if (it.has_sabores && (!it.sabores || it.sabores.length === 0)) {
      return `OBRIGATÓRIO: Item ${i + 1} (${it.produto_nome}) precisa de SABOR. Use find_flavors. Não pule.`
    }
    if (it.has_complementos && it.complementos === undefined) {
      return `Pergunte se quer complementos pro item ${i + 1}. Use find_complements quando cliente responder (mesmo se cliente declinar).`
    }
    if (!it.quantidade) {
      return `OBRIGATÓRIO: Item ${i + 1} (${it.produto_nome}) precisa de QUANTIDADE (quantos?). Use set_quantity. Pergunte ao cliente. NÃO assuma 1 por padrão.`
    }
  }

  // Todos items completos → checa se cliente quer mais
  const lastItemHasAdded = state.items[state.items.length - 1]?.collected_item_steps?.includes('adicionar_mais')
  if (!lastItemHasAdded && state.items.length > 0) {
    return 'Todos items configurados. Pergunte ao cliente: quer adicionar mais um item OU pode fechar? Se quer mais → add_more_item depois find_product. Se fechar → segue pra entrega.'
  }

  // Etapas globais
  if (!state.tipo_entrega) return 'OBRIGATÓRIO: pergunte entrega ou retirada. Use set_delivery.'
  if (state.tipo_entrega === 'entrega' && (!state.endereco?.bairro || !state.endereco?.rua || !state.endereco?.numero)) {
    return 'OBRIGATÓRIO: peça endereço completo (bairro + rua + número). Use set_address.'
  }
  if (!state.pagamento) return 'OBRIGATÓRIO: pergunte forma de pagamento (PIX, cartão, dinheiro). Use set_payment.'
  if (state.pagamento === 'dinheiro' && (state.troco_para === undefined || state.troco_para === null)) {
    return `OBRIGATÓRIO: cliente vai pagar dinheiro. Pergunte se precisa de troco e pra quanto. Total atual: R$ ${(state.total || 0).toFixed(2)}. Use set_payment.`
  }
  if (state.fase !== 'aguardando_confirmacao') return 'Tudo coletado. CHAME finish_order pra mostrar resumo ao cliente.'
  return 'Aguardando confirmação. Se cliente disse "sim/confirmo/pode fechar/manda", chame confirm_and_save AGORA.'
}

async function executeTool(
  name: string,
  input: any,
  collector: OrderCollector,
  cardapio: CardapioRefs,
  ctx: AgentContext,
): Promise<ToolResult> {
  switch (name) {
    case 'find_product': {
      const r = await findProduct(input.query, cardapio.produtos)
      if (r.matched && r.produto_id) {
        // Apply
        const found = cardapio.produtos.find(p => p.id === r.produto_id)
        if (found) {
          const newState = JSON.parse(JSON.stringify(collector.state))
          if (newState.items.length === 0) newState.items.push({ collected_item_steps: [] })
          const idx = newState.current_item_index ?? 0
          if (!newState.items[idx]) newState.items[idx] = { collected_item_steps: [] }
          const item = newState.items[idx]
          const tamanhos = cardapio.tamanhos.filter(t => t.produto_id === found.id && t.ativo)
          const sabores = cardapio.sabores.filter(s => s.produto_id === found.id && s.ativo)
          const complementos = cardapio.complementos.filter(c => c.produto_id === found.id && c.ativo)
          item.produto_id = found.id
          item.produto_nome = found.nome
          item.has_tamanhos = tamanhos.length > 0
          item.has_sabores = sabores.length > 0
          item.has_complementos = complementos.length > 0
          if (!item.collected_item_steps) item.collected_item_steps = []
          if (!item.collected_item_steps.includes('item')) item.collected_item_steps.push('item')
          return {
            ok: true,
            data: { produto: r.produto_nome, has_tamanhos: item.has_tamanhos, has_sabores: item.has_sabores, has_complementos: item.has_complementos, cost_cents: r.cost_cents },
            state_after: newState,
          }
        }
      }
      if (r.ambiguous && r.candidates) {
        return { ok: false, data: { ambiguous: true, candidates: r.candidates.map(c => c.nome), cost_cents: r.cost_cents } }
      }
      return { ok: false, data: { not_found: true, available: cardapio.produtos.filter(p => p.ativo).map(p => p.nome), cost_cents: r.cost_cents } }
    }

    case 'find_size': {
      const cur = collector.currentItem()
      if (!cur?.produto_id) return { ok: false, error: 'Escolha o produto antes' }
      const r = matchSize(input.query, cardapio.tamanhos, cur.produto_id)
      if (r.matched && r.tamanho_id) {
        const newState = JSON.parse(JSON.stringify(collector.state))
        const idx = newState.current_item_index ?? 0
        const item = newState.items[idx]
        item.tamanho_id = r.tamanho_id
        item.tamanho_nome = r.tamanho_nome
        item.preco_unit = r.preco
        if (!item.collected_item_steps.includes('tamanho')) item.collected_item_steps.push('tamanho')
        return { ok: true, data: { tamanho: r.tamanho_nome, preco: r.preco, cost_cents: r.cost_cents }, state_after: newState }
      }
      const tams = cardapio.tamanhos.filter(t => t.produto_id === cur.produto_id && t.ativo).map(t => `${t.nome} (R$ ${Number(t.preco).toFixed(2)})`)
      return { ok: false, data: { not_found: true, available: tams, cost_cents: r.cost_cents } }
    }

    case 'find_flavors': {
      const cur = collector.currentItem()
      if (!cur?.produto_id) return { ok: false, error: 'Escolha o produto antes' }
      const r = await matchFlavors(input.query, cardapio.sabores, cur.produto_id, 3)
      if (r.matched && r.flavors?.length) {
        const newState = JSON.parse(JSON.stringify(collector.state))
        const idx = newState.current_item_index ?? 0
        const item = newState.items[idx]
        item.sabores = r.flavors.map(f => f.nome)
        if (!item.collected_item_steps.includes('sabores')) item.collected_item_steps.push('sabores')
        return { ok: true, data: { sabores: item.sabores, cost_cents: r.cost_cents }, state_after: newState }
      }
      if (r.ambiguous && r.candidates) {
        return { ok: false, data: { ambiguous: true, candidates: r.candidates.map(c => c.nome), partial_matched: r.flavors?.map(f => f.nome) || [], cost_cents: r.cost_cents } }
      }
      return { ok: false, data: { not_found: true, cost_cents: r.cost_cents } }
    }

    case 'find_complements': {
      const cur = collector.currentItem()
      if (!cur?.produto_id) return { ok: false, error: 'Escolha o produto antes' }
      const r = await matchComplements(input.query, cardapio.complementos, cur.produto_id, 5)
      if (r.matched) {
        const newState = JSON.parse(JSON.stringify(collector.state))
        const idx = newState.current_item_index ?? 0
        const item = newState.items[idx]
        item.complementos = (r.complements || []).map(c => c.nome)
        if (!item.collected_item_steps.includes('complementos')) item.collected_item_steps.push('complementos')
        return { ok: true, data: { complementos: item.complementos, declined: r.declined, cost_cents: r.cost_cents }, state_after: newState }
      }
      if (r.ambiguous && r.candidates) {
        return { ok: false, data: { ambiguous: true, candidates: r.candidates.map(c => c.nome), cost_cents: r.cost_cents } }
      }
      return { ok: false, data: { not_found: true, cost_cents: r.cost_cents } }
    }

    case 'set_quantity': {
      const newState = JSON.parse(JSON.stringify(collector.state))
      const idx = newState.current_item_index ?? 0
      const item = newState.items[idx]
      if (!item) return { ok: false, error: 'Sem item ativo' }
      const qty = Math.max(1, Math.floor(Number(input.quantity) || 1))
      item.quantidade = qty
      if (!item.collected_item_steps.includes('quantidade')) item.collected_item_steps.push('quantidade')
      // Recalcula total
      let sum = 0
      for (const it of newState.items) sum += (Number(it.preco_unit) || 0) * (Number(it.quantidade) || 1)
      if (newState.tipo_entrega === 'entrega') sum += Number(newState.taxa || 0)
      newState.total = Math.round(sum * 100) / 100
      return { ok: true, data: { quantidade: qty }, state_after: newState }
    }

    case 'set_delivery': {
      const newState = JSON.parse(JSON.stringify(collector.state))
      newState.tipo_entrega = input.type === 'retirada' ? 'retirada' : 'entrega'
      if (newState.tipo_entrega === 'retirada') {
        newState.endereco = undefined
        newState.taxa = 0
      }
      if (!newState.collected_steps.includes('tipo_entrega')) newState.collected_steps.push('tipo_entrega')
      // Recalc total
      let sum = 0
      for (const it of newState.items) sum += (Number(it.preco_unit) || 0) * (Number(it.quantidade) || 1)
      if (newState.tipo_entrega === 'entrega') sum += Number(newState.taxa || 0)
      newState.total = Math.round(sum * 100) / 100
      return { ok: true, data: { tipo_entrega: newState.tipo_entrega }, state_after: newState }
    }

    case 'set_address': {
      const r = await parseAddress(input.query, cardapio.bairrosAtivos)
      if (r.matched && r.endereco) {
        const newState = JSON.parse(JSON.stringify(collector.state))
        newState.endereco = r.endereco
        newState.tipo_entrega = 'entrega'
        // Calcula taxa
        const tx = cardapio.taxas.find(t => t.bairro.toLowerCase() === r.endereco!.bairro.toLowerCase())
        newState.taxa = tx ? Number(tx.taxa) : 0
        if (!newState.collected_steps.includes('endereco')) newState.collected_steps.push('endereco')
        if (!newState.collected_steps.includes('tipo_entrega')) newState.collected_steps.push('tipo_entrega')
        // Recalc total
        let sum = 0
        for (const it of newState.items) sum += (Number(it.preco_unit) || 0) * (Number(it.quantidade) || 1)
        sum += Number(newState.taxa || 0)
        newState.total = Math.round(sum * 100) / 100
        return { ok: true, data: { endereco: r.endereco, taxa: newState.taxa, cost_cents: r.cost_cents }, state_after: newState }
      }
      if (r.bairro_invalido) {
        return { ok: false, data: { bairro_invalido: r.bairro_invalido, candidates_bairros: r.candidates_bairros || [], cost_cents: r.cost_cents } }
      }
      return { ok: false, data: { partial: r.partial, cost_cents: r.cost_cents } }
    }

    case 'set_payment': {
      const total = collector.state.total || 0
      const r = parsePayment(input.query, total)
      if (r.matched && r.pagamento) {
        const newState = JSON.parse(JSON.stringify(collector.state))
        newState.pagamento = r.pagamento
        newState.troco_para = r.troco_para
        if (!newState.collected_steps.includes('pagamento')) newState.collected_steps.push('pagamento')
        if (r.pagamento === 'dinheiro' && r.troco_para !== undefined) {
          if (!newState.collected_steps.includes('troco')) newState.collected_steps.push('troco')
        }
        return { ok: true, data: { pagamento: r.pagamento, troco_para: r.troco_para }, state_after: newState }
      }
      return { ok: false, data: { not_found: true, options: ['pix', 'cartao', 'dinheiro'] } }
    }

    case 'add_more_item': {
      const newState = JSON.parse(JSON.stringify(collector.state))
      newState.items.push({ collected_item_steps: [] })
      newState.current_item_index = newState.items.length - 1
      return { ok: true, data: { item_index: newState.current_item_index }, state_after: newState }
    }

    case 'finish_order': {
      const newState = JSON.parse(JSON.stringify(collector.state))
      newState.fase = 'aguardando_confirmacao'
      newState.summary_shown_count = (newState.summary_shown_count || 0) + 1
      return { ok: true, data: { summary: collector.summary(), state: describeState(newState) }, state_after: newState }
    }

    case 'confirm_and_save': {
      // Gate: só salva se summary já foi mostrado
      if (!collector.state.summary_shown_count || collector.state.summary_shown_count === 0) {
        return { ok: false, error: 'Mostre o resumo (finish_order) antes de salvar.' }
      }
      try {
        const saved = await saveOrderTool({
          tenant_id: ctx.tenant_id || null,
          telefone: ctx.telefone,
          nome_cliente: ctx.nome_cliente,
          items: collector.state.items.map(i => ({
            nome: [i.produto_nome, i.tamanho_nome].filter(Boolean).join(' '),
            quantidade: i.quantidade || 1,
            preco_total: (i.preco_unit || 0) * (i.quantidade || 1),
            sabores: i.sabores, complementos: i.complementos,
          })),
          endereco: collector.state.endereco?.rua ? `${collector.state.endereco.rua}, ${collector.state.endereco.numero || 's/n'}` : null,
          bairro: collector.state.endereco?.bairro || null,
          complemento: collector.state.endereco?.complemento || null,
          forma_pagamento: collector.state.pagamento || 'pix',
          troco_para: collector.state.troco_para || null,
          total: collector.state.total || 0,
          taxa: collector.state.taxa || 0,
        })
        const newId = (saved.result as any)?.id
        const newState = JSON.parse(JSON.stringify(collector.state))
        newState.fase = 'finalizado'
        newState.pedido_id = newId
        return {
          ok: true,
          data: { pedido_id: newId, codigo: newId ? `#${newId.slice(0, 6)}` : '#?' },
          state_after: newState,
        }
      } catch (e: any) {
        return { ok: false, error: e?.message || 'save_failed' }
      }
    }

    case 'cancel_order':
      return { ok: true, data: { cancelled: true } }

    default:
      return { ok: false, error: `unknown_tool: ${name}` }
  }
}
