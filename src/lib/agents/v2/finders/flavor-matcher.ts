/**
 * FlavorMatcher — match input cliente com sabores do cardápio.
 * Cliente pode dizer "morango" e ter 3 sabores com morango → retorna candidatos.
 */
import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/config/env'

export interface FlavorMatch {
  matched: boolean
  flavors?: Array<{ id: string; nome: string }>     // 1+ sabores casados
  ambiguous?: boolean
  candidates?: Array<{ id: string; nome: string; score: number }>
  cost_cents: number
}

function fuzzyScore(input: string, target: string): number {
  const a = input.toLowerCase().trim()
  const b = target.toLowerCase().trim()
  if (a === b) return 1.0
  if (b === a) return 1.0
  if (b.includes(a) || a.includes(b)) return 0.8
  return 0
}

/**
 * Cliente pode pedir vários sabores ("morango, chocolate e creme")
 * Retorna lista resolvida + ambiguidades a desambiguar.
 */
export async function matchFlavors(query: string, sabores: any[], produto_id: string, max: number = 3): Promise<FlavorMatch> {
  const ativos = sabores.filter(s => s.produto_id === produto_id && s.ativo)
  if (ativos.length === 0) return { matched: false, cost_cents: 0 }

  // Sanitiza input: remove asteriscos/bullets/marcadores (cliente pode copiar lista do bot)
  query = query.replace(/^\s*[\*•\-]\s*/gm, '').replace(/[\*•]/g, ' ').trim()

  // STEP 0: Cliente mandou multi-line OU separado por vírgula = lista de sabores
  // Cada linha/item vai ser tratado individualmente
  const lines = query.split(/[\n,;]/).map(l => l.trim()).filter(l => l.length >= 3)
  if (lines.length > 1) {
    const collected: Array<{ id: string; nome: string }> = []
    for (const line of lines) {
      const lineLow = line.toLowerCase()
      // Match exato linha = sabor
      let found = ativos.find(s => s.nome.toLowerCase() === lineLow)
      if (!found) {
        // Substring: sabor contém linha OU linha contém sabor
        found = ativos.find(s => {
          const sl = s.nome.toLowerCase()
          return (lineLow.length >= 4 && (sl.includes(lineLow) || lineLow.includes(sl)))
        })
      }
      if (!found) {
        // Fuzzy partial: linha começa com nome do sabor
        found = ativos.find(s => lineLow.startsWith(s.nome.toLowerCase().slice(0, Math.max(4, s.nome.length - 2))))
      }
      if (found && !collected.find(c => c.id === found.id)) {
        collected.push({ id: found.id, nome: found.nome })
      }
    }
    if (collected.length > 0) {
      return { matched: true, flavors: collected.slice(0, max), cost_cents: 0 }
    }
  }

  // STEP 1: Match exato OU substring de nome inteiro
  const fullQueryLow = query.toLowerCase().trim()
  const exactMatches: Array<{ id: string; nome: string }> = []
  for (const s of ativos) {
    const nomeLow = s.nome.toLowerCase()
    if (fullQueryLow === nomeLow) {
      exactMatches.push({ id: s.id, nome: s.nome })
      continue
    }
    if (fullQueryLow.includes(nomeLow) && nomeLow.length >= 5) {
      exactMatches.push({ id: s.id, nome: s.nome })
    }
    if (nomeLow.includes(fullQueryLow) && fullQueryLow.length >= 4) {
      exactMatches.push({ id: s.id, nome: s.nome })
    }
  }
  if (exactMatches.length > 0) {
    const best = exactMatches.find(m => fullQueryLow === m.nome.toLowerCase())
      || (exactMatches.length === 1 ? exactMatches[0] : null)
    if (best) return { matched: true, flavors: [best], cost_cents: 0 }
    if (exactMatches.length > 1) {
      return { matched: false, ambiguous: true, candidates: exactMatches.map(m => ({ ...m, score: 0.9 })), cost_cents: 0 }
    }
  }

  // STEP 2: Split input em palavras-candidatas (separadores comuns) — pra "morango, chocolate"
  const tokens = query.toLowerCase()
    .replace(/[,;]/g, ' ')
    .replace(/\b(e|com|mais|junto)\b/gi, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3) // ignora "de", "do", etc

  if (tokens.length === 0) return { matched: false, cost_cents: 0 }

  const matched: Array<{ id: string; nome: string }> = []
  const allCandidates: Array<{ id: string; nome: string; score: number }> = []

  for (const token of tokens) {
    const scored = ativos.map(s => ({ id: s.id, nome: s.nome, score: fuzzyScore(token, s.nome) }))
      .filter(s => s.score > 0.4)
      .sort((a, b) => b.score - a.score)

    if (scored.length === 0) continue

    // Match perfeito ou claramente único?
    if (scored[0].score >= 0.95 && (scored.length === 1 || scored[0].score - scored[1].score >= 0.15)) {
      if (!matched.find(m => m.id === scored[0].id)) {
        matched.push({ id: scored[0].id, nome: scored[0].nome })
      }
    } else if (scored.length === 1) {
      // Único match parcial
      if (!matched.find(m => m.id === scored[0].id)) {
        matched.push({ id: scored[0].id, nome: scored[0].nome })
      }
    } else {
      // Ambíguo — múltiplos sabores contém esse token
      const top = scored.slice(0, 4)
      for (const c of top) {
        if (!allCandidates.find(x => x.id === c.id)) allCandidates.push(c)
      }
    }
  }

  if (matched.length > 0 && allCandidates.length === 0) {
    return { matched: true, flavors: matched.slice(0, max), cost_cents: 0 }
  }

  if (allCandidates.length > 0) {
    return {
      matched: false,
      ambiguous: true,
      candidates: allCandidates.slice(0, 6),
      flavors: matched, // o que conseguiu casar
      cost_cents: 0,
    }
  }

  // Última tentativa: Haiku LLM extrator
  try {
    const client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY })
    // System prompt grande + cache_control pra reuso entre chamadas (5min TTL)
    const sysCacheable = `Você é um extrator de SABORES de cardápio de loja de delivery.

REGRAS:
- Sempre retorna APENAS lista separada por vírgula com nomes EXATOS do cardápio (ou "NENHUM")
- NÃO inventa sabor que não está no cardápio
- Aceita variações (typos, abreviações)
- Reconhece quando cliente lista vários separados por vírgula, "e", linha nova
- Match case-insensitive

CARDÁPIO COMPLETO DE SABORES DESTE PRODUTO:
${ativos.map(s => `- ${s.nome}`).join('\n')}`
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      system: [{ type: 'text', text: sysCacheable, cache_control: { type: 'ephemeral' } }] as any,
      messages: [{ role: 'user', content: `Cliente disse: "${query}". Quais sabores casam?` }],
    })
    const txt = res.content.filter(c => c.type === 'text').map(c => (c as any).text).join('').trim()
    const cost = ((res.usage?.input_tokens || 0) * 0.0001 + (res.usage?.output_tokens || 0) * 0.0005) / 100
    if (txt.toUpperCase().includes('NENHUM')) return { matched: false, cost_cents: cost }
    const names = txt.split(/[,;]/).map(n => n.trim()).filter(Boolean)
    const found: Array<{ id: string; nome: string }> = []
    for (const name of names) {
      const sabor = ativos.find(s => s.nome.toLowerCase() === name.toLowerCase())
      if (sabor && !found.find(f => f.id === sabor.id)) found.push({ id: sabor.id, nome: sabor.nome })
    }
    return found.length > 0
      ? { matched: true, flavors: found.slice(0, max), cost_cents: cost }
      : { matched: false, cost_cents: cost }
  } catch {
    return { matched: false, cost_cents: 0 }
  }
}
