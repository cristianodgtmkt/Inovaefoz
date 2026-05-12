"use client"
/**
 * Admin API client — wrap fetch() pra adicionar Bearer JWT do Supabase Auth.
 */
import { supabaseBrowser } from '@/lib/db/supabase-browser'

async function getToken(): Promise<string | null> {
  const sb = supabaseBrowser()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token || null
}

export async function adminFetch<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(path, { ...opts, headers })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(errBody.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function adminUpload<T = any>(path: string, formData: FormData): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(path, { method: 'POST', headers, body: formData })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(errBody.error || `HTTP ${res.status}`)
  }
  return res.json()
}
