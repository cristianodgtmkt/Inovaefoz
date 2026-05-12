// Embed via OpenAI text-embedding-3-small + cache SHA256
import crypto from 'crypto'
import { openai } from '@/lib/ai/openai-client'
import { supabaseService } from '@/lib/db/supabase'
import { env } from '@/lib/config/env'

export function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex')
}

export async function embedWithCache(text: string): Promise<{ embedding: number[]; cached: boolean }> {
  const model = env().EMBED_MODEL
  const hash = sha256(text)
  const sb = supabaseService()
  const { data: cached } = await sb
    .from('ai_embedding_cache')
    .select('embedding')
    .eq('content_sha256', hash)
    .eq('model', model)
    .maybeSingle()
  if (cached?.embedding) {
    const emb = typeof cached.embedding === 'string' ? JSON.parse(cached.embedding) : cached.embedding
    return { embedding: emb as number[], cached: true }
  }
  const res = await openai().embeddings.create({ model, input: text })
  const embedding = res.data[0].embedding
  await sb.from('ai_embedding_cache').upsert({ content_sha256: hash, model, embedding }, { onConflict: 'content_sha256,model' })
  return { embedding, cached: false }
}
