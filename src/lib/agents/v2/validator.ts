/**
 * Pre-response Validator — regras puras, sem LLM.
 * Valida resposta antes de mandar pro cliente.
 */
import type { CardapioRefs, PedidoState } from '../order-collector'

export interface ValidationResult {
  valid: boolean
  issues: string[]
  reply: string  // resposta possivelmente sanitizada
}

export function validateResponse(
  reply: string,
  state: PedidoState,
  cardapio: CardapioRefs,
): ValidationResult {
  const issues: string[] = []
  let sanitized = reply

  // 1. Remove markdown bold (não funciona no WhatsApp web e quebra audit)
  sanitized = sanitized.replace(/\*\*(.+?)\*\*/g, '$1')

  // 2. Remove markdown italic (manter _italic_ se for aceito)
  // sanitized = sanitized.replace(/__(.+?)__/g, '$1')

  // 3. Limita tamanho (WhatsApp acima de 4096 chars quebra)
  if (sanitized.length > 4000) {
    sanitized = sanitized.slice(0, 3900) + '\n\n[…]'
    issues.push('truncated')
  }

  // 4. Valida preços mencionados
  const priceMatches = sanitized.match(/R\$\s*(\d+(?:[.,]\d{1,2})?)/gi) || []
  const validPrices = new Set<number>()
  // Tamanhos individuais
  for (const t of cardapio.tamanhos) validPrices.add(Math.round(Number(t.preco) * 100))
  // Taxas
  for (const tx of cardapio.taxas) validPrices.add(Math.round(Number(tx.taxa) * 100))
  // Total atual do pedido
  if (state.total) validPrices.add(Math.round(state.total * 100))
  if (state.taxa) validPrices.add(Math.round(state.taxa * 100))
  // Subtotais por item (preco_unit × qty)
  for (const item of state.items) {
    const sub = (Number(item.preco_unit) || 0) * (Number(item.quantidade) || 1)
    validPrices.add(Math.round(sub * 100))
    validPrices.add(Math.round((Number(item.preco_unit) || 0) * 100))
  }
  // Combinações tamanho × N (1-50)
  for (const t of cardapio.tamanhos) {
    for (let n = 1; n <= 50; n++) validPrices.add(Math.round(Number(t.preco) * n * 100))
  }
  // Tamanho×N + taxa
  for (const t of cardapio.tamanhos) {
    for (const tx of cardapio.taxas) {
      for (let n = 1; n <= 50; n++) validPrices.add(Math.round((Number(t.preco) * n + Number(tx.taxa)) * 100))
    }
  }

  for (const m of priceMatches) {
    const num = m.replace(/R\$\s*/i, '').replace(',', '.')
    const cents = Math.round(parseFloat(num) * 100)
    if (!validPrices.has(cents)) {
      issues.push(`price_invalid: R$ ${num}`)
    }
  }

  // 5. Items mencionados existem? (heurística simples)
  const itemNomes = new Set<string>()
  for (const p of cardapio.produtos) itemNomes.add(p.nome.toLowerCase())
  for (const s of cardapio.sabores) itemNomes.add(s.nome.toLowerCase())
  for (const c of cardapio.complementos) itemNomes.add(c.nome.toLowerCase())
  // (Não bloqueia, só warning — itens aparecem em frases normais)

  return {
    valid: issues.length === 0 || issues.every(i => i === 'truncated'),
    issues,
    reply: sanitized,
  }
}
