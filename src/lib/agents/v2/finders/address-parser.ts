/**
 * AddressParser — extract endereço estruturado.
 * Regex pre-extract + fuzzy match bairro + Haiku fallback.
 */
import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/config/env'

export interface AddressMatch {
  matched: boolean
  endereco?: { bairro: string; rua: string; numero: string; complemento?: string }
  bairro_invalido?: string  // se bairro extraído não está na área
  partial?: { bairro?: string; rua?: string; numero?: string; complemento?: string }
  candidates_bairros?: string[]  // sugestões similares ao input
  cost_cents: number
}

function fuzzyBairro(input: string, bairros: string[]): string | null {
  const a = input.toLowerCase().trim()
  const exact = bairros.find(b => b.toLowerCase() === a)
  if (exact) return exact
  // Contém
  const contains = bairros.find(b => b.toLowerCase().includes(a) || a.includes(b.toLowerCase()))
  if (contains) return contains
  return null
}

export async function parseAddress(query: string, bairrosAtivos: Set<string>): Promise<AddressMatch> {
  const bairrosArr = Array.from(bairrosAtivos)

  // Extract estruturado via Haiku (poderoso mas barato)
  try {
    const client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY })
    const sysCacheable = `Você é um extrator de ENDEREÇO de msgs de delivery WhatsApp.

REGRAS:
- Retorna APENAS JSON {bairro, rua, numero, complemento}
- Campo ausente = string vazia ""
- Rua pode incluir tipo (rua/av/avenida/travessa/alameda/praça)
- Numero é só dígito
- Detecta endereço em qualquer ordem
- Aceita variações ("av." = "avenida", "n°" = "numero")

BAIRROS ATENDIDOS NESTA REGIÃO:
${bairrosArr.map(b => `- ${b}`).join('\n')}`
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 200,
      system: [{ type: 'text', text: sysCacheable, cache_control: { type: 'ephemeral' } }] as any,
      messages: [{ role: 'user', content: query }],
    })
    const txt = res.content.filter(c => c.type === 'text').map(c => (c as any).text).join('').trim()
    const cost = ((res.usage?.input_tokens || 0) * 0.0001 + (res.usage?.output_tokens || 0) * 0.0005) / 100

    let parsed: any = {}
    try { parsed = JSON.parse(txt.match(/\{[\s\S]*\}/)?.[0] || '{}') } catch {}

    const bairroExt = (parsed.bairro || '').trim()
    const rua = (parsed.rua || '').trim()
    const numero = (parsed.numero || '').trim()
    const complemento = (parsed.complemento || '').trim()

    // Valida bairro
    let bairroValid: string | null = null
    if (bairroExt) {
      bairroValid = fuzzyBairro(bairroExt, bairrosArr)
    }

    if (bairroValid && rua && numero) {
      return {
        matched: true,
        endereco: { bairro: bairroValid, rua, numero, complemento: complemento || undefined },
        cost_cents: cost,
      }
    }

    // Bairro extraído mas não atende
    if (bairroExt && !bairroValid) {
      // Sugere similares (3+ chars match)
      const sims = bairrosArr.filter(b => {
        const bl = b.toLowerCase()
        return bl.includes(bairroExt.toLowerCase().slice(0, 3)) || bairroExt.toLowerCase().includes(bl.slice(0, 3))
      }).slice(0, 5)
      return {
        matched: false,
        bairro_invalido: bairroExt,
        candidates_bairros: sims,
        partial: { bairro: bairroExt, rua, numero, complemento },
        cost_cents: cost,
      }
    }

    // Partial: faltam campos
    return {
      matched: false,
      partial: {
        bairro: bairroValid || undefined,
        rua: rua || undefined,
        numero: numero || undefined,
        complemento: complemento || undefined,
      },
      cost_cents: cost,
    }
  } catch {
    return { matched: false, cost_cents: 0 }
  }
}
