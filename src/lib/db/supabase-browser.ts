"use client"
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function supabaseBrowser(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.inovaefoz.com.br'
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    _client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    })
  }
  return _client
}
