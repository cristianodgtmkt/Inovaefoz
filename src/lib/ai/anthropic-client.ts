import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/config/env'

let _client: Anthropic | null = null

export function anthropic(): Anthropic {
  if (!_client) {
    const k = env().ANTHROPIC_API_KEY
    if (!k) throw new Error('[anthropic] ANTHROPIC_API_KEY missing')
    _client = new Anthropic({ apiKey: k })
  }
  return _client
}

export function anthropicAvailable(): boolean {
  return !!env().ANTHROPIC_API_KEY
}
