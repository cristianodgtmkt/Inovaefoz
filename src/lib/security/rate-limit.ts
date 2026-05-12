/**
 * Sliding window rate limit (in-memory).
 * Suficiente pra single-instance Next.js. Se escalar pra N instances, trocar por Upstash.
 */
type Hit = { ts: number }
const buckets = new Map<string, Hit[]>()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  reset_in_sec: number
}

export function rateLimit(key: string, opts: { windowSec: number; max: number }): RateLimitResult {
  const now = Date.now()
  const cutoff = now - opts.windowSec * 1000
  const arr = buckets.get(key) || []
  const fresh = arr.filter(h => h.ts > cutoff)
  if (fresh.length >= opts.max) {
    const oldest = fresh[0]?.ts || now
    return { ok: false, remaining: 0, reset_in_sec: Math.ceil((oldest + opts.windowSec * 1000 - now) / 1000) }
  }
  fresh.push({ ts: now })
  buckets.set(key, fresh)
  // Garbage collect: a cada 100 hits, limpa keys vazias
  if (Math.random() < 0.01) {
    for (const [k, v] of buckets.entries()) {
      const f = v.filter(h => h.ts > cutoff)
      if (f.length === 0) buckets.delete(k)
      else buckets.set(k, f)
    }
  }
  return { ok: true, remaining: opts.max - fresh.length, reset_in_sec: opts.windowSec }
}
