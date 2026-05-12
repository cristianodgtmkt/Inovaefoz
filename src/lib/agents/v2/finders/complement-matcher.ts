/**
 * ComplementMatcher — match input cliente com complementos.
 * Cliente pode pedir múltiplos complementos.
 */
import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/config/env'

export interface ComplementMatch {
  matched: boolean
  complements?: Array<{ id: string; nome: string; tipo?: string }>
  ambiguous?: boolean
  candidates?: Array<{ id: string; nome: string; score: number }>
  declined?: boolean // cliente disse "não quero"
  cost_cents: number
}

function fuzzyScore(input: string, target: string): number {
  const a = input.toLowerCase().trim()
  const b = target.toLowerCase().trim()
  if (a === b) return 1.0
  if (b.includes(a) || a.includes(b)) return 0.85
  return 0
}

const DECLINE_RE = /\b(n[aã]o|sem|nada|nenhum|s[oó] (o |o pr[oó]prio)|jeito|nao quero)\b/i

export async function matchComplements(query: string, complementos: any[], produto_id: string, max: number = 5): Promise<ComplementMatch> {
  const ativos = complementos.filter(c => c.produto_id === produto_id && c.ativo)
  if (ativos.length === 0) return { matched: true, complements: [], cost_cents: 0 }

  // Cliente declinou?
  if (DECLINE_RE.test(query.toLowerCase()) && query.length < 30) {
    return { matched: true, complements: [], declined: true, cost_cents: 0 }
  }

  // Sanitiza input: remove asteriscos/bullets (cliente pode copiar lista)
  query = query.replace(/^\s*[\*•\-]\s*/gm, '').replace(/[\*•]/g, ' ').trim()

  // STEP 0: Multi-line / virgula = lista de complementos
  const lines = query.split(/[\n,;]/).map(l => l.trim()).filter(l => l.length >= 3)
  if (lines.length > 1) {
    const collected: Array<{ id: string; nome: string; tipo?: string }> = []
    for (const line of lines) {
      const lineLow = line.toLowerCase()
      let found = ativos.find(c => c.nome.toLowerCase() === lineLow)
      if (!found) {
        found = ativos.find(c => {
          const cl = c.nome.toLowerCase()
          return (lineLow.length >= 4 && (cl.includes(lineLow) || lineLow.includes(cl)))
        })
      }
      if (found && !collected.find(c => c.id === found!.id)) {
        collected.push({ id: found.id, nome: found.nome, tipo: found.tipo })
      }
    }
    if (collected.length > 0) {
      return { matched: true, complements: collected.slice(0, max), cost_cents: 0 }
    }
  }

  // STEP 1: Match exato INTEIRO contra cada complemento.
  // CONSERVADOR: NÃO match palavra única ambígua (ex: "morango" pode ser sabor OU complemento)
  // Só aceita: (a) match exato string completa = nome OR (b) query inclui nome inteiro com 2+ palavras
  const fullQueryLow = query.toLowerCase().trim()
  const queryWordCount = fullQueryLow.split(/\s+/).length
  const exactMatches: Array<{ id: string; nome: string; tipo?: string }> = []
  for (const c of ativos) {
    const nomeLow = c.nome.toLowerCase()
    const nomeWordCount = nomeLow.split(/\s+/).length
    // Match exato string completa
    if (fullQueryLow === nomeLow) {
      exactMatches.push({ id: c.id, nome: c.nome, tipo: c.tipo })
      continue
    }
    // Query maior CONTÉM nome inteiro (ex: "leite condensado e nutella" inclui "leite condensado")
    // E nome do complemento tem >= 2 palavras (evita match único ambíguo tipo "morango")
    if (nomeWordCount >= 2 && queryWordCount > nomeWordCount && fullQueryLow.includes(nomeLow)) {
      exactMatches.push({ id: c.id, nome: c.nome, tipo: c.tipo })
    }
  }
  if (exactMatches.length > 0) {
    const best = exactMatches.find(m => fullQueryLow === m.nome.toLowerCase())
      || (exactMatches.length === 1 ? exactMatches[0] : null)
    if (best) return { matched: true, complements: [best], cost_cents: 0 }
  }

  // STEP 2: Cliente pode ter falado vários ("nutella e morango") → tokenize
  const tokens = query.toLowerCase()
    .replace(/[,;]/g, ' ')
    .replace(/\b(e|com|mais|junto|tambem|também)\b/gi, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3)

  if (tokens.length === 0) return { matched: false, cost_cents: 0 }

  const matched: Array<{ id: string; nome: string; tipo?: string }> = []
  const allCandidates: Array<{ id: string; nome: string; score: number }> = []

  for (const token of tokens) {
    const scored = ativos
      .map(c => ({ id: c.id, nome: c.nome, tipo: c.tipo, score: fuzzyScore(token, c.nome) }))
      .filter(s => s.score > 0.4)
      .sort((a, b) => b.score - a.score)

    if (scored.length === 0) continue

    if (scored[0].score >= 0.95 && (scored.length === 1 || scored[0].score - scored[1].score >= 0.15)) {
      if (!matched.find(m => m.id === scored[0].id)) matched.push(scored[0])
    } else if (scored.length === 1) {
      if (!matched.find(m => m.id === scored[0].id)) matched.push(scored[0])
    } else {
      for (const c of scored.slice(0, 4)) {
        if (!allCandidates.find(x => x.id === c.id)) allCandidates.push(c)
      }
    }
  }

  if (matched.length > 0 && allCandidates.length === 0) {
    return { matched: true, complements: matched.slice(0, max), cost_cents: 0 }
  }
  if (allCandidates.length > 0) {
    return {
      matched: false, ambiguous: true,
      candidates: allCandidates.slice(0, 6),
      complements: matched, cost_cents: 0,
    }
  }

  // Haiku fallback
  try {
    const client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY })
    const sysCacheable = `Você é um extrator de COMPLEMENTOS de cardápio de loja de delivery.

REGRAS:
- Retorna APENAS lista separada por vírgula com nomes EXATOS do cardápio (ou "NENHUM")
- NÃO inventa complemento que não está no cardápio
- Aceita variações (typos, abreviações)
- Reconhece "não quero/sem complemento" → "NENHUM"
- Match case-insensitive

CARDÁPIO DE COMPLEMENTOS DESTE PRODUTO:
${ativos.map(c => `- ${c.nome}${c.tipo ? ` (${c.tipo})` : ''}`).join('\n')}`
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 100,
      system: [{ type: 'text', text: sysCacheable, cache_control: { type: 'ephemeral' } }] as any,
      messages: [{ role: 'user', content: `Cliente disse: "${query}". Quais complementos casam?` }],
    })
    const txt = res.content.filter(c => c.type === 'text').map(c => (c as any).text).join('').trim()
    const cost = ((res.usage?.input_tokens || 0) * 0.0001 + (res.usage?.output_tokens || 0) * 0.0005) / 100
    if (txt.toUpperCase().includes('NENHUM')) return { matched: true, complements: [], cost_cents: cost }
    const names = txt.split(/[,;]/).map(n => n.trim()).filter(Boolean)
    const found: Array<{ id: string; nome: string; tipo?: string }> = []
    for (const name of names) {
      const c = ativos.find(x => x.nome.toLowerCase() === name.toLowerCase())
      if (c && !found.find(f => f.id === c.id)) found.push({ id: c.id, nome: c.nome, tipo: c.tipo })
    }
    return found.length >= 0 ? { matched: true, complements: found.slice(0, max), cost_cents: cost } : { matched: false, cost_cents: cost }
  } catch {
    return { matched: false, cost_cents: 0 }
  }
}
