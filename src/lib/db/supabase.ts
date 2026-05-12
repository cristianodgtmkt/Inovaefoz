/**
 * Supabase clients (anon + service).
 * Anon: leitura segura (RLS-respecting).
 * Service: writes em ai_traces, ai_conversa_state, etc (bypass RLS).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/config/env'

let _anon: SupabaseClient | null = null
let _service: SupabaseClient | null = null

export function supabase(): SupabaseClient {
  if (!_anon) {
    const e = env()
    _anon = createClient(e.SUPABASE_URL, e.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _anon
}

export function supabaseService(): SupabaseClient {
  if (!_service) {
    const e = env()
    if (!e.SUPABASE_SERVICE_KEY) {
      throw new Error('[supabase] SUPABASE_SERVICE_KEY required for service client')
    }
    _service = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'public' },
    })
  }
  return _service
}
