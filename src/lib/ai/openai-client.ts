import OpenAI from 'openai'
import { env } from '@/lib/config/env'

let _client: OpenAI | null = null

export function openai(): OpenAI {
  if (!_client) {
    const k = env().OPENAI_API_KEY
    if (!k) throw new Error('[openai] OPENAI_API_KEY missing')
    _client = new OpenAI({ apiKey: k })
  }
  return _client
}

export function openaiAvailable(): boolean {
  return !!env().OPENAI_API_KEY
}
