/**
 * PaymentParser — extract pagamento + troco. Determinístico (regex).
 */
export interface PaymentMatch {
  matched: boolean
  pagamento?: 'pix' | 'cartao' | 'cartao_credito' | 'cartao_debito' | 'dinheiro'
  troco_para?: number | null  // null = sem troco
  cost_cents: number
}

export function parsePayment(query: string, total: number): PaymentMatch {
  const t = query.toLowerCase().trim()
  let pagamento: PaymentMatch['pagamento'] | undefined
  let troco: number | null | undefined

  if (/\bpix\b/i.test(t)) pagamento = 'pix'
  else if (/\b(cr[eé]dito)\b/i.test(t)) pagamento = 'cartao_credito'
  else if (/\b(d[eé]bito)\b/i.test(t)) pagamento = 'cartao_debito'
  else if (/\b(cart[aã]o|maquininha|maquina)\b/i.test(t)) pagamento = 'cartao'
  else if (/\b(dinheiro|cash|esp[eé]cie)\b/i.test(t)) pagamento = 'dinheiro'

  // Troco
  if (pagamento === 'dinheiro') {
    // "sem troco" / "exato" / "não preciso"
    if (/\b(sem troco|exato|certinho|n[aã]o (precisa|preciso|tem|vou (precisar|querer))|nao preciso|sem)\b/i.test(t)) {
      troco = 0
    } else {
      // Detecta valor R$ X
      const m = t.match(/r?\$?\s*(\d+(?:[.,]\d{1,2})?)/i)
      if (m) {
        const val = parseFloat(m[1].replace(',', '.'))
        if (val >= total) troco = val
        else if (val === 0) troco = 0
      }
    }
  } else if (pagamento) {
    troco = null // não aplicável (pix, cartao, etc)
  }

  if (pagamento) {
    return { matched: true, pagamento, troco_para: troco !== undefined ? troco : null, cost_cents: 0 }
  }
  return { matched: false, cost_cents: 0 }
}
