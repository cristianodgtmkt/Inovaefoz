/**
 * ProductFinder — match input cliente com produto do cardápio.
 * Estratégia híbrida: regex + fuzzy + Haiku LLM se ambíguo.
 */
import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/config/env'

export interface ProductMatch {
  matched: boolean
  produto_id?: string
  produto_nome?: string
  ambiguous?: boolean
  candidates?: Array<{ id: string; nome: string; score: number }>
  cost_cents: number
}

function fuzzyScore(input: string, target: string): number {
  const a = input.toLowerCase().trim()
  const b = target.toLowerCase().trim()
  if (a === b) return 1.0
  if (b.includes(a) || a.includes(b)) return 0.85
  // Levenshtein distance simplificado
  const aWords = a.split(/\s+/)
  const bWords = b.split(/\s+/)
  let common = 0
  for (const w of aWords) if (bWords.some(bw => bw.includes(w) || w.includes(bw))) common++
  return common / Math.max(aWords.length, bWords.length)
}

export async function findProduct(query: string, produtos: any[]): Promise<ProductMatch> {
  const ativos = produtos.filter(p => p.ativo)
  if (ativos.length === 0) return { matched: false, cost_cents: 0 }

  // Step 1: fuzzy score em todos
  const scored = ativos
    .map(p => ({ id: p.id, nome: p.nome, score: fuzzyScore(query, p.nome) }))
    .filter(s => s.score > 0.4)
    .sort((a, b) => b.score - a.score)

  // Match perfeito ou near-perfect: aceita
  if (scored.length > 0 && scored[0].score >= 0.85) {
    // Se top1 muito acima do top2, single match
    if (scored.length === 1 || scored[0].score - (scored[1]?.score || 0) >= 0.15) {
      return {
        matched: true,
        produto_id: scored[0].id,
        produto_nome: scored[0].nome,
        cost_cents: 0,
      }
    }
  }

  // Step 2: nada acima do threshold OU múltiplos próximos → Haiku decide
  if (scored.length === 0) return { matched: false, cost_cents: 0 }

  if (scored.length >= 2 && scored[0].score < 0.85) {
    // Ambíguo: top candidatos
    return {
      matched: false,
      ambiguous: true,
      candidates: scored.slice(0, 3),
      cost_cents: 0,
    }
  }

  // Step 3: Haiku como tie-breaker
  try {
    const client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY })
    const sysCacheable = `Você é um extrator de PRODUTOS de cardápio de loja de delivery.

REGRAS:
- Retorna APENAS o nome EXATO do cardápio, ou "NENHUM"
- NÃO inventa produto fora do cardápio
- Match case-insensitive, aceita typos comuns

CARDÁPIO DE PRODUTOS:
${ativos.map(p => `- ${p.nome}`).join('\n')}`
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 30,
      system: [{ type: 'text', text: sysCacheable, cache_control: { type: 'ephemeral' } }] as any,
      messages: [{ role: 'user', content: `Cliente disse: "${query}". Qual produto?` }],
    })
    const txt = res.content.filter(c => c.type === 'text').map(c => (c as any).text).join('').trim()
    const found = ativos.find(p => p.nome.toLowerCase() === txt.toLowerCase())
    const cost = ((res.usage?.input_tokens || 0) * 0.0001 + (res.usage?.output_tokens || 0) * 0.0005) / 100
    if (found) {
      return { matched: true, produto_id: found.id, produto_nome: found.nome, cost_cents: cost }
    }
    return { matched: false, cost_cents: cost }
  } catch {
    return { matched: false, cost_cents: 0 }
  }
}
