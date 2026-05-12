// Preços por modelo (cents por 1k tokens)
const PRICES: Record<string, { in: number; out: number }> = {
  // Anthropic
  'claude-haiku-4-5-20251001': { in: 0.0001 * 1000, out: 0.0005 * 1000 },  // $0.10/M, $0.50/M (cents/1k tokens)
  'claude-sonnet-4-5-20250929': { in: 0.0015 * 1000, out: 0.0075 * 1000 },  // $1.50/M, $7.50/M
  // OpenAI
  'gpt-4o-mini': { in: 0.00015 * 1000, out: 0.0006 * 1000 },                // $0.15/M, $0.60/M
  'gpt-4o': { in: 0.0025 * 1000, out: 0.010 * 1000 },                       // $2.50/M, $10/M
  'gpt-4.1-mini': { in: 0.0004 * 1000, out: 0.0016 * 1000 },
  'text-embedding-3-small': { in: 0.00002 * 1000, out: 0 },                 // $0.02/M
}

export function calcCostCents(model: string, tokens_in: number, tokens_out: number): number {
  const p = PRICES[model] || PRICES['gpt-4o-mini']
  const cents = (tokens_in / 1000) * p.in + (tokens_out / 1000) * p.out
  return Math.round(cents * 10000) / 10000
}
