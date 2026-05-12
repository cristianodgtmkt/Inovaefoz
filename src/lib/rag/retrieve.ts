// Hybrid retrieve: pgvector cosine + BM25 ts_rank + RRF fuse → top-K
import { supabaseService } from '@/lib/db/supabase'
import { embedWithCache } from './embed'

export interface Chunk {
  id: string
  source_type: string
  title: string | null
  content: string
}

const RRF_K = 60

export async function retrieveHybrid(query: string, k = 6): Promise<{ chunks: Chunk[]; ids: string[] }> {
  const sb = supabaseService()
  const { embedding } = await embedWithCache(query)
  const [vRes, bRes] = await Promise.all([
    sb.rpc('acai_kb_vector_search', { query_embedding: embedding, match_count: 20 }),
    sb.rpc('acai_kb_bm25_search', { query_text: query, match_count: 20 }),
  ])
  const vec = vRes.data || []
  const bm = bRes.data || []
  // RRF fuse
  const scores = new Map<string, number>()
  vec.forEach((r: any, i: number) => scores.set(r.id, (scores.get(r.id) || 0) + 1 / (RRF_K + i + 1)))
  bm.forEach((r: any, i: number) => scores.set(r.id, (scores.get(r.id) || 0) + 1 / (RRF_K + i + 1)))
  const allRows = new Map<string, any>()
  vec.forEach((r: any) => allRows.set(r.id, r))
  bm.forEach((r: any) => allRows.set(r.id, r))
  const ranked = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([id]) => allRows.get(id))
    .filter(Boolean) as Chunk[]
  return { chunks: ranked, ids: ranked.map(c => c.id) }
}
