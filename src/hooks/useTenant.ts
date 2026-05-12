"use client"
import { useEffect, useState, useCallback } from 'react'
import { adminFetch } from '@/lib/api/admin-client'
import { tenantFromDb, FALLBACK_TENANT, type Tenant } from '@/lib/tenants'
import { supabaseBrowser } from '@/lib/db/supabase-browser'

export function useTenant() {
  const [tenant, setTenant] = useState<Tenant>(FALLBACK_TENANT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await adminFetch<any>('/api/admin/tenant/me')
      setTenant(tenantFromDb(r.tenant))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  // Realtime: re-fetch quando tenants linha mudar
  useEffect(() => {
    if (!tenant.id) return
    const sb = supabaseBrowser()
    // Channel name único por instância (layout + page usam useTenant separado)
    const channelName = `tenant-${tenant.id}-${Math.random().toString(36).slice(2, 8)}`
    const ch = sb.channel(channelName)
    ch.on('postgres_changes' as any,
      { event: 'UPDATE', schema: 'public', table: 'tenants', filter: `id=eq.${tenant.id}` },
      () => reload())
    ch.subscribe()
    return () => { sb.removeChannel(ch) }
  }, [tenant.id, reload])

  const setAiPaused = useCallback(async (paused: boolean) => {
    setTenant(t => ({ ...t, ai_paused_global: paused }))
    try {
      await adminFetch('/api/admin/tenant/me', { method: 'PATCH', body: JSON.stringify({ ai_paused_global: paused }) })
    } catch (e: any) {
      setTenant(t => ({ ...t, ai_paused_global: !paused })) // rollback
      throw e
    }
  }, [])

  return { tenant, loading, error, reload, setAiPaused }
}
