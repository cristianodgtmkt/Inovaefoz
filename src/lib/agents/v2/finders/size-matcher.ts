/**
 * SizeMatcher — match tamanho. Determinístico (lista pequena).
 */
export interface SizeMatch {
  matched: boolean
  tamanho_id?: string
  tamanho_nome?: string
  preco?: number
  candidates?: Array<{ id: string; nome: string; preco: number }>
  cost_cents: number
}

function fuzzyScore(input: string, target: string): number {
  const a = input.toLowerCase().trim().replace(/\s/g, '')
  const b = target.toLowerCase().trim().replace(/\s/g, '')
  if (a === b) return 1.0
  // Detecta números: "300" vs "300ml"
  const aNum = a.match(/\d+/)?.[0]
  const bNum = b.match(/\d+/)?.[0]
  if (aNum && bNum && aNum === bNum) return 0.95
  if (b.includes(a) || a.includes(b)) return 0.85
  return 0
}

export function matchSize(query: string, tamanhos: any[], produto_id: string): SizeMatch {
  const ativos = tamanhos.filter(t => t.produto_id === produto_id && t.ativo)
  if (ativos.length === 0) return { matched: false, cost_cents: 0 }

  const scored = ativos
    .map(t => ({ id: t.id, nome: t.nome, preco: Number(t.preco), score: fuzzyScore(query, t.nome) }))
    .filter(s => s.score > 0.4)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return { matched: false, cost_cents: 0 }
  if (scored[0].score >= 0.85) {
    return { matched: true, tamanho_id: scored[0].id, tamanho_nome: scored[0].nome, preco: scored[0].preco, cost_cents: 0 }
  }
  return { matched: false, candidates: scored.slice(0, 3), cost_cents: 0 }
}
