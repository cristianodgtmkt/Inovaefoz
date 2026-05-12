/**
 * Order Collector v2 — state machine pura, multi-item.
 *
 * Suporta:
 * - Vários items diferentes no mesmo pedido (1 açaí + 1 sorvete + 2 vitaminas)
 * - Quantidade por item
 * - Loop "quer adicionar mais um?"
 * - Detecção de produto diferente mid-fluxo (reset opcional)
 * - Comando "cancelar" zera state
 *
 * Não fala com cliente. Não chama LLM. Pura lógica.
 */
import { supabaseService } from '@/lib/db/supabase'

export type StepType =
  | 'choice'
  | 'choice_produto'
  | 'choice_tamanho'
  | 'multi_choice_sabor'
  | 'multi_choice_complemento'
  | 'quantity'
  | 'add_more_items'
  | 'address'
  | 'currency'
  | 'text'
  | 'phone'
  | 'confirm'

export type StepScope = 'item' | 'order'

export interface OrderStep {
  id: string
  label: string
  prompt: string
  type: StepType
  scope: StepScope          // 'item' = roda por item; 'order' = 1× no fim
  required: boolean
  order: number
  options?: string[]
  min?: number
  max?: number
  only_if?: string
}

export interface PedidoItem {
  produto_id?: string
  produto_nome?: string
  tamanho_id?: string
  tamanho_nome?: string
  preco_unit?: number
  sabores?: string[]
  complementos?: string[]
  quantidade?: number
  has_tamanhos?: boolean
  has_sabores?: boolean
  has_complementos?: boolean
  collected_item_steps?: string[]  // etapas item-específicas completadas pra esse item
}

export interface PedidoState {
  items: PedidoItem[]
  current_item_index?: number       // qual item está sendo configurado agora
  tipo_entrega?: 'entrega' | 'retirada'
  endereco?: { bairro?: string; rua?: string; numero?: string; complemento?: string }
  pagamento?: string
  troco_para?: number | null
  total?: number
  taxa?: number
  collected_steps: string[]         // etapas globais (não item-específicas) completadas
  fase?: 'em_construcao' | 'aguardando_confirmacao' | 'finalizado' | 'cancelado'
  pedido_id?: string | null
  summary_shown_count?: number      // qtas vezes summary completo foi enviado (gate pra confirmação)
  last_bot_reply?: string           // última resposta do bot (loop detector)
  loop_count?: number               // qtas vezes msm resposta repetiu
}

export interface CardapioRefs {
  produtos: any[]
  tamanhos: any[]
  sabores: any[]
  complementos: any[]
  taxas: any[]
  bairrosAtivos: Set<string>
}

export const DEFAULT_BLUEPRINT: OrderStep[] = [
  // Por item (loop)
  { id: 'item', label: 'Produto', type: 'choice_produto', scope: 'item', prompt: 'Qual produto?', required: true, order: 1 },
  { id: 'tamanho', label: 'Tamanho', type: 'choice_tamanho', scope: 'item', prompt: 'Qual tamanho?', required: true, order: 2, only_if: 'item.has_tamanhos' },
  { id: 'sabores', label: 'Sabores', type: 'multi_choice_sabor', scope: 'item', prompt: 'Qual sabor?', required: true, min: 1, max: 3, order: 3, only_if: 'item.has_sabores' },
  { id: 'complementos', label: 'Complementos', type: 'multi_choice_complemento', scope: 'item', prompt: 'Quer complementos?', required: false, min: 0, max: 5, order: 4, only_if: 'item.has_complementos' },
  { id: 'quantidade', label: 'Quantidade', type: 'quantity', scope: 'item', prompt: 'Quantos?', required: true, min: 1, max: 99, order: 5 },
  { id: 'adicionar_mais', label: 'Mais um item?', type: 'add_more_items', scope: 'item', prompt: 'Quer adicionar outro item ou pode fechar?', required: true, options: ['adicionar', 'fechar'], order: 6 },
  // Por pedido (1×)
  { id: 'tipo_entrega', label: 'Entrega ou retirada', type: 'choice', scope: 'order', prompt: 'É entrega ou retirada?', required: true, options: ['entrega', 'retirada'], order: 10 },
  { id: 'endereco', label: 'Endereço', type: 'address', scope: 'order', prompt: 'Bairro, rua e número?', required: true, only_if: 'tipo_entrega=entrega', order: 11 },
  { id: 'pagamento', label: 'Pagamento', type: 'choice', scope: 'order', prompt: 'PIX, cartão ou dinheiro?', required: true, options: ['pix', 'cartao', 'dinheiro'], order: 12 },
  { id: 'troco', label: 'Troco', type: 'currency', scope: 'order', prompt: 'Troco pra quanto?', required: true, only_if: 'pagamento=dinheiro', order: 13 },
]

export async function loadBlueprint(tenant_id?: string): Promise<OrderStep[]> {
  if (!tenant_id) return DEFAULT_BLUEPRINT
  try {
    const sb = supabaseService()
    const { data } = await sb.from('ai_tenant_config').select('order_blueprint').eq('tenant_id', tenant_id).maybeSingle()
    const bp = data?.order_blueprint
    if (Array.isArray(bp) && bp.length > 0) {
      // Backward compat: se step antigo sem `scope`, infere
      return (bp as OrderStep[]).map(s => ({
        ...s,
        scope: s.scope || (['item', 'tamanho', 'sabores', 'complementos', 'quantidade', 'adicionar_mais'].includes(s.id) ? 'item' : 'order'),
      })).sort((a, b) => a.order - b.order)
    }
  } catch {}
  return DEFAULT_BLUEPRINT
}

// === "Não entendi" detection (cliente confuso, NÃO resetar — re-explicar) ===
const CONFUSED_PATTERNS = [
  /\bn[aã]o entend(i|o|eu|emos)\b/i,
  /\bque\??$/i,
  /\bcomo assim\b/i,
  /\boi\?\s*$/i,
  /^h[ãa]?\??$/i,
  /^h[mn]+\??$/i,
  /\brepetir?\b/i,
  /\bn[aã]o sei\b/i,
  /\bperdid[oa]\b/i,
]
export function isConfusedIntent(msg: string): boolean {
  const t = msg.trim().toLowerCase()
  if (t.length > 50) return false // mensagens longas raramente são "não entendi"
  return CONFUSED_PATTERNS.some(p => p.test(t))
}

// === Cancelar / reset detection (pré-LLM, regex) ===
const CANCEL_PATTERNS = [
  /\bcancela(r|me|do)?\b/i,
  /\bcancelar (o |meu )?pedido\b/i,
  /\bzer(a|ar) (o )?pedido\b/i,
  /\bremov(e|er) (o |meu )?pedido\b/i,
  /\besquec(e|er) (o |meu |esse )?pedido\b/i,
  /\bdesist(o|i|ir)\b/i,
  /\bcomeçar de novo\b/i,
  /\bcomeca de novo\b/i,
  /\bvamos do zero\b/i,
]
export function isCancelIntent(msg: string): boolean {
  const t = msg.trim().toLowerCase()
  return CANCEL_PATTERNS.some(p => p.test(t))
}

// === Core collector ===

export class OrderCollector {
  constructor(
    public state: PedidoState,
    public blueprint: OrderStep[],
    public cardapio: CardapioRefs
  ) {
    if (this.state.current_item_index === undefined && this.state.items.length > 0) {
      this.state.current_item_index = 0
    }
  }

  static empty(blueprint: OrderStep[], cardapio: CardapioRefs): OrderCollector {
    return new OrderCollector(
      { items: [], collected_steps: [], fase: 'em_construcao', current_item_index: 0 },
      blueprint, cardapio
    )
  }

  /** Item sendo configurado agora */
  currentItem(): PedidoItem | null {
    const idx = this.state.current_item_index ?? 0
    return this.state.items[idx] || null
  }

  /** Próxima etapa pendente. Considera item atual + globais. null se completo. */
  nextStep(): OrderStep | null {
    // Se não tem nenhum item ainda, retorna primeira step de item
    if (this.state.items.length === 0) {
      const first = this.blueprint.find(s => s.scope === 'item')
      return first || null
    }

    // Etapas item-específicas pra item ATUAL
    const cur = this.currentItem()
    if (cur) {
      const itemSteps = this.blueprint.filter(s => s.scope === 'item').sort((a, b) => a.order - b.order)
      const collected = cur.collected_item_steps || []
      for (const step of itemSteps) {
        if (collected.includes(step.id)) continue
        if (!this.shouldRunForItem(step, cur)) continue
        return step
      }
    }

    // Todas item-steps do item atual completas → tenta avançar pra próximo item se pendente
    // OU vai pras global steps
    const orderSteps = this.blueprint.filter(s => s.scope === 'order').sort((a, b) => a.order - b.order)
    for (const step of orderSteps) {
      if (this.state.collected_steps.includes(step.id)) continue
      if (!this.shouldRunForOrder(step)) continue
      return step
    }
    return null
  }

  shouldRunForItem(step: OrderStep, item: PedidoItem): boolean {
    if (!step.only_if) return true
    if (step.only_if.startsWith('item.')) {
      const prop = step.only_if.slice(5)
      return !!(item as any)[prop]
    }
    return true
  }

  shouldRunForOrder(step: OrderStep): boolean {
    if (!step.only_if) return true
    if (step.only_if.includes('=')) {
      const [field, val] = step.only_if.split('=').map(s => s.trim())
      return (this.state as any)[field] === val
    }
    return true
  }

  /** Valida valor pra step. */
  validate(step: OrderStep, value: any): { ok: boolean; error?: string } {
    if (step.required && (value === null || value === undefined || value === '')) {
      return { ok: false, error: 'Campo obrigatório' }
    }

    switch (step.type) {
      case 'choice':
        if (step.options && !step.options.includes(String(value).toLowerCase())) {
          return { ok: false, error: `Opções: ${step.options.join(', ')}` }
        }
        break

      case 'choice_produto': {
        const found = this.cardapio.produtos.find(p =>
          p.nome.toLowerCase() === String(value).toLowerCase() && p.ativo
        )
        if (!found) return { ok: false, error: `"${value}" não está no cardápio` }
        break
      }

      case 'choice_tamanho': {
        const item = this.currentItem()
        if (!item?.produto_id) return { ok: false, error: 'Escolha o produto antes' }
        const tam = this.cardapio.tamanhos.find(t =>
          t.produto_id === item.produto_id &&
          t.nome.toLowerCase() === String(value).toLowerCase() && t.ativo
        )
        if (!tam) return { ok: false, error: `Tamanho "${value}" não disponível` }
        break
      }

      case 'multi_choice_sabor': {
        const arr = Array.isArray(value) ? value : [value]
        if (step.min !== undefined && arr.length < step.min) return { ok: false, error: `Mínimo ${step.min}` }
        if (step.max !== undefined && arr.length > step.max) return { ok: false, error: `Máximo ${step.max}` }
        const item = this.currentItem()
        for (const s of arr) {
          const sabor = this.cardapio.sabores.find(x =>
            x.produto_id === item?.produto_id &&
            x.nome.toLowerCase() === String(s).toLowerCase() && x.ativo
          )
          if (!sabor) return { ok: false, error: `Sabor "${s}" não disponível` }
        }
        break
      }

      case 'multi_choice_complemento': {
        const arr = Array.isArray(value) ? value : [value]
        if (step.max !== undefined && arr.length > step.max) return { ok: false, error: `Máximo ${step.max}` }
        const item = this.currentItem()
        for (const c of arr) {
          const comp = this.cardapio.complementos.find(x =>
            x.produto_id === item?.produto_id &&
            x.nome.toLowerCase() === String(c).toLowerCase() && x.ativo
          )
          if (!comp) return { ok: false, error: `Complemento "${c}" não disponível` }
        }
        break
      }

      case 'quantity': {
        const n = Number(value)
        if (isNaN(n) || n < 1) return { ok: false, error: 'Quantidade inválida' }
        if (step.max !== undefined && n > step.max) return { ok: false, error: `Máximo ${step.max}` }
        break
      }

      case 'add_more_items': {
        const v = String(value).toLowerCase()
        if (!['sim', 'adicionar', 'mais', 'nao', 'não', 'fechar', 'só isso', 'so isso', 'pronto'].some(k => v.includes(k))) {
          return { ok: false, error: 'Diga: adicionar / fechar' }
        }
        break
      }

      case 'address': {
        // Validate é permissivo: aceita partial — apply faz merge + re-pergunta o que falta
        const a = value as any
        if (!a || typeof a !== 'object') return { ok: false, error: 'Endereço inválido' }
        // Pelo menos UM campo deve estar presente pra processar
        if (!a.bairro && !a.rua && !a.numero) return { ok: false, error: 'Endereço vazio' }
        break
      }

      case 'currency': {
        const n = Number(value)
        if (isNaN(n) || n < 0) return { ok: false, error: 'Valor inválido' }
        break
      }
    }

    return { ok: true }
  }

  /** Aplica valor a step (no item atual ou state global). Retorna novo collector. */
  apply(step: OrderStep, value: any): OrderCollector {
    const next: PedidoState = JSON.parse(JSON.stringify(this.state))

    if (step.scope === 'item') {
      // Garante que tem pelo menos 1 item
      if (next.items.length === 0) next.items.push({ collected_item_steps: [] })
      const idx = next.current_item_index ?? 0
      if (!next.items[idx]) next.items[idx] = { collected_item_steps: [] }
      const item = next.items[idx]
      if (!item.collected_item_steps) item.collected_item_steps = []

      switch (step.type) {
        case 'choice_produto': {
          const found = this.cardapio.produtos.find(p => p.nome.toLowerCase() === String(value).toLowerCase())
          if (found) {
            const tamanhos = this.cardapio.tamanhos.filter(t => t.produto_id === found.id && t.ativo)
            const sabores = this.cardapio.sabores.filter(s => s.produto_id === found.id && s.ativo)
            const complementos = this.cardapio.complementos.filter(c => c.produto_id === found.id && c.ativo)
            item.produto_id = found.id
            item.produto_nome = found.nome
            item.has_tamanhos = tamanhos.length > 0
            item.has_sabores = sabores.length > 0
            item.has_complementos = complementos.length > 0
            // Se produto NÃO tem tamanho, infere preço base (se houver) — fallback 0
            if (!item.has_tamanhos && tamanhos.length === 0) item.preco_unit = 0
          }
          break
        }
        case 'choice_tamanho': {
          const tam = this.cardapio.tamanhos.find(t =>
            t.produto_id === item.produto_id && t.nome.toLowerCase() === String(value).toLowerCase()
          )
          if (tam) {
            item.tamanho_id = tam.id
            item.tamanho_nome = tam.nome
            item.preco_unit = Number(tam.preco)
          }
          break
        }
        case 'multi_choice_sabor':
          item.sabores = (Array.isArray(value) ? value : [value]).map(String)
          break
        case 'multi_choice_complemento':
          item.complementos = (Array.isArray(value) ? value : [value]).map(String)
          break
        case 'quantity':
          item.quantidade = Math.max(1, Math.floor(Number(value) || 1))
          break
        case 'add_more_items': {
          const v = String(value).toLowerCase()
          const wantsMore = ['sim', 'adicionar', 'mais', 'outro', 'mais um'].some(k => v.includes(k))
          if (wantsMore) {
            // push novo item, avança index, NÃO marca esse step (vai precisar perguntar de novo no próximo item? não — só 1× no final)
            item.collected_item_steps!.push(step.id)
            next.items.push({ collected_item_steps: [] })
            next.current_item_index = next.items.length - 1
          } else {
            // marca esse step do item atual + sinal pra avançar pra ordem global
            item.collected_item_steps!.push(step.id)
          }
          break
        }
      }

      // Marca step como completo no item (exceto add_more_items que já marcou)
      if (step.type !== 'add_more_items' && !item.collected_item_steps.includes(step.id)) {
        item.collected_item_steps.push(step.id)
      }
    } else {
      // Step global
      if (!next.collected_steps.includes(step.id)) next.collected_steps.push(step.id)
      switch (step.type) {
        case 'choice':
          if (step.id === 'tipo_entrega') {
            next.tipo_entrega = value
            if (value === 'retirada') {
              next.collected_steps = next.collected_steps.filter(s => s !== 'endereco')
              next.endereco = undefined
            }
          } else if (step.id === 'pagamento') {
            next.pagamento = value
            if (value !== 'dinheiro') {
              next.collected_steps = next.collected_steps.filter(s => s !== 'troco')
              next.troco_para = null
            }
          } else (next as any)[step.id] = value
          break
        case 'address': {
          // Merge: cliente pode mandar partial info em msgs separadas
          const cur = next.endereco || {}
          const v = value || {}
          next.endereco = {
            bairro: v.bairro || cur.bairro,
            rua: v.rua || cur.rua,
            numero: v.numero || cur.numero,
            complemento: v.complemento || cur.complemento,
          }
          // Validação de bairro: se NÃO está atendido, limpa pra forçar re-pergunta
          if (next.endereco.bairro && !this.cardapio.bairrosAtivos.has(next.endereco.bairro.toLowerCase())) {
            next.endereco.bairro = undefined
          }
          // Só marca step completo se TODOS os campos required OK
          const complete = !!(next.endereco.bairro && next.endereco.rua && next.endereco.numero)
          if (!complete) {
            // remove de collected_steps pra perguntar de novo na próxima
            next.collected_steps = next.collected_steps.filter(s => s !== step.id)
          }
          break
        }
        case 'currency':
          if (step.id === 'troco') next.troco_para = Number(value)
          else (next as any)[step.id] = Number(value)
          break
        case 'confirm':
          next.fase = 'aguardando_confirmacao'
          break
        case 'text':
        case 'phone':
          (next as any)[step.id] = value
          break
      }
    }

    // Recalcula totais
    next.taxa = computeTaxa(next, this.cardapio)
    next.total = computeTotal(next)

    return new OrderCollector(next, this.blueprint, this.cardapio)
  }

  /** Detecta produto novo na msg quando JÁ tem items. Retorna 'reset' se sugere começar de novo. */
  detectNewProductIntent(extractedValue: any): 'append' | 'reset' | 'none' {
    if (!extractedValue) return 'none'
    if (this.state.items.length === 0) return 'none'
    // Se cliente extraiu produto novo no meio do pedido (durante etapas item)
    // E o item atual não está finalizado → considera reset
    const cur = this.currentItem()
    if (!cur || !cur.produto_nome) return 'append'
    return 'append' // safe default — adiciona como novo item ao invés de resetar
  }

  isComplete(): boolean {
    return this.nextStep() === null
  }

  /** Lista resumo human-readable */
  summary(): string {
    const lines: string[] = []
    let subtotalTotal = 0
    this.state.items.forEach((item, i) => {
      if (!item.produto_nome) return
      const qtd = item.quantidade || 1
      const subtotal = (item.preco_unit || 0) * qtd
      subtotalTotal += subtotal
      let line = `• ${qtd}× ${item.produto_nome}`
      if (item.tamanho_nome) line += ` ${item.tamanho_nome}`
      if (item.sabores?.length) line += ` (${item.sabores.join(', ')})`
      if (item.complementos?.length) line += ` + ${item.complementos.join(' + ')}`
      if (item.preco_unit) line += ` — R$ ${subtotal.toFixed(2).replace('.', ',')}`
      lines.push(line)
    })
    if (this.state.tipo_entrega === 'entrega' && this.state.endereco) {
      const e = this.state.endereco
      lines.push(`• Entrega: ${e.rua}, ${e.numero}${e.complemento ? ' (' + e.complemento + ')' : ''}, ${e.bairro}`)
      if (this.state.taxa) lines.push(`• Taxa entrega: R$ ${this.state.taxa.toFixed(2).replace('.', ',')}`)
    } else if (this.state.tipo_entrega === 'retirada') {
      lines.push('• Retirada na loja')
    }
    if (this.state.pagamento) {
      let pg = `• Pagamento: ${this.state.pagamento}`
      if (this.state.pagamento === 'dinheiro' && this.state.troco_para) pg += ` (troco pra R$ ${this.state.troco_para.toFixed(2).replace('.', ',')})`
      lines.push(pg)
    }
    if (this.state.total) lines.push(`• *Total: R$ ${this.state.total.toFixed(2).replace('.', ',')}*`)
    return lines.join('\n')
  }

  /** Reminder curto pra mostrar quando cliente desviou pra outro assunto */
  shortReminder(): string | null {
    const itemsValid = this.state.items.filter(i => i.produto_nome)
    if (itemsValid.length === 0) return null
    if (this.state.fase === 'finalizado' || this.state.fase === 'cancelado') return null
    const itemsBrief = itemsValid.map(i => {
      const q = i.quantidade || 1
      return `${q}× ${i.produto_nome}${i.tamanho_nome ? ' ' + i.tamanho_nome : ''}`
    }).join(', ')
    return `\n\n_Lembrando: você está montando ${itemsBrief}. Quer continuar o pedido?_`
  }
}

function computeTotal(state: PedidoState): number {
  let sum = 0
  for (const item of state.items) sum += (Number(item.preco_unit) || 0) * (Number(item.quantidade) || 1)
  if (state.tipo_entrega === 'entrega') sum += Number(state.taxa || 0)
  return Math.round(sum * 100) / 100
}

function computeTaxa(state: PedidoState, cardapio: CardapioRefs): number {
  if (state.tipo_entrega !== 'entrega' || !state.endereco?.bairro) return 0
  const tx = cardapio.taxas.find(t =>
    t.bairro.toLowerCase() === state.endereco!.bairro!.toLowerCase() && t.ativo
  )
  return tx ? Number(tx.taxa) : 0
}
