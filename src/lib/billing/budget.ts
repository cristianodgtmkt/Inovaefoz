// Budget gate diário (cache 60s) por tenant
import { supabaseService } from '@/lib/db/supabase'
import { env } from '@/lib/config/env'

let _cache = new Map<string, { spent: number; budget: number; until: number }>()
const TTL = 60_000

export interface BudgetCheck { ok: boolean; spent_cents: number; budget_cents: number; reason?: string }

export async function checkBudget(tenant_id: string): Promise<BudgetCheck> {
  if (env().BUDGET_ENFORCEMENT === 'disabled') {
    return { ok: true, spent_cents: 0, budget_cents: 0, reason: 'disabled' }
  }
  const now = Date.now()
  const cached = _cache.get(tenant_id)
  if (cached && cached.until > now) {
    return { ok: cached.spent < cached.budget, spent_cents: cached.spent, budget_cents: cached.budget }
  }
  try {
    const sb = supabaseService()
    const { data: cfg } = await sb.from('ai_tenant_config').select('budget_cents_per_day').eq('tenant_id', tenant_id).maybeSingle()
    const budget = (cfg?.budget_cents_per_day as number) || 1000
    const today = new Date().toISOString().slice(0, 10) + 'T00:00:00'
    const { data: traces } = await sb
      .from('ai_traces')
      .select('cost_cents')
      .eq('tenant_id', tenant_id)
      .gte('created_at', today)
    const spent = (traces || []).reduce((s, r: any) => s + Number(r.cost_cents || 0), 0)
    _cache.set(tenant_id, { spent: Math.round(spent), budget, until: now + TTL })
    return { ok: spent < budget, spent_cents: Math.round(spent), budget_cents: budget }
  } catch (e: any) {
    return { ok: true, spent_cents: 0, budget_cents: 0, reason: 'check_error' }
  }
}

export function invalidateBudgetCache(tenant_id?: string) {
  if (tenant_id) _cache.delete(tenant_id)
  else _cache.clear()
}
