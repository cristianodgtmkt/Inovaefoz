/**
 * Prompts loader — lê system prompts editáveis de ai_prompts.
 * Cache process-wide 60s.
 */
import { supabaseService } from '@/lib/db/supabase'

const cache = new Map<string, { content: string; until: number }>()
const TTL = 60_000

const FALLBACKS: Record<string, string> = {
  router: 'Classifique a mensagem do cliente. Responda JSON {"intent":"...","confidence":0.5,"needs_rag":false}',
  menu: 'Você é o atendente. Use SOMENTE info do cardápio fornecido. Tom caloroso, max 4 frases.',
  order: 'Você coleta pedidos. SIGA etapas. NUNCA invente preço/item/bairro. JSON save_order na última linha quando confirmar.',
  objection: 'Cliente teve objeção. Empatia + solução. NUNCA prometa desconto. Escale se grave.',
  auditor: 'Audite resposta. JSON: {"verdict":"pass|fail|warn","issue":"...","reason":"...","severity":"low|medium|high|critical"}',
  greeting: 'Oi! Bem-vindo. Hoje temos: {PRODUTOS}. O que vai querer?',
}

export async function loadPrompt(tenant_id: string, specialist: string): Promise<string> {
  const key = `${tenant_id}:${specialist}`
  const cached = cache.get(key)
  if (cached && cached.until > Date.now()) return cached.content

  try {
    const sb = supabaseService()
    const { data } = await sb
      .from('ai_prompts')
      .select('content')
      .eq('tenant_id', tenant_id)
      .eq('specialist', specialist)
      .maybeSingle()
    const content = data?.content || FALLBACKS[specialist] || ''
    cache.set(key, { content, until: Date.now() + TTL })
    return content
  } catch (e: any) {
    console.warn('[loadPrompt] err', e?.message)
    return FALLBACKS[specialist] || ''
  }
}

export function invalidatePromptCache(tenant_id?: string, specialist?: string) {
  if (tenant_id && specialist) cache.delete(`${tenant_id}:${specialist}`)
  else if (tenant_id) {
    for (const k of cache.keys()) if (k.startsWith(`${tenant_id}:`)) cache.delete(k)
  } else cache.clear()
}
