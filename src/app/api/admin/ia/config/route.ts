import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminCtx } from '@/lib/auth/admin'
import { supabaseService } from '@/lib/db/supabase'
import { rateLimit } from '@/lib/security/rate-limit'
import { logAdminAction } from '@/lib/security/audit-log'
import { invalidateBudgetCache } from '@/lib/billing/budget'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req)
  if (!isAdminCtx(ctx)) return ctx
  const rl = rateLimit(`ia-config-get:${ctx.user.id}`, { windowSec: 60, max: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limit' }, { status: 429 })

  const sb = supabaseService()
  const { data } = await sb.from('ai_tenant_config').select('*').eq('tenant_id', ctx.tenant_id).maybeSingle()
  if (!data) {
    // Cria default se não existir
    const { data: created } = await sb.from('ai_tenant_config').insert({ tenant_id: ctx.tenant_id }).select().single()
    return NextResponse.json({ config: created })
  }
  return NextResponse.json({ config: data })
}

const ALLOWED = [
  'budget_cents_per_day', 'audit_mode', 'guardrail_enforce_mode', 'citation_mode',
  'allow_contact_disclosure', 'followup_enabled', 'daily_report_enabled', 'daily_report_hour',
  'price_whitelist_centavos', 'suspect_items', 'guardrails_disabled',
  'model_router', 'model_menu', 'model_order', 'model_objection', 'model_auditor',
  'metodos_pagamento', 'admin_phones', 'business_hours',
  'persona_tom', 'persona_reclamacao', 'persona_item_sem', 'persona_velocidade', 'persona_contato',
  'order_blueprint',
  'humanize_enabled', 'humanize_min_delay_ms', 'humanize_max_delay_ms', 'humanize_chars_per_second',
  'humanize_typing_indicator', 'humanize_read_receipt', 'humanize_split_long_at',
]

export async function PATCH(req: NextRequest) {
  const ctx = await requireAdmin(req)
  if (!isAdminCtx(ctx)) return ctx
  const rl = rateLimit(`ia-config-patch:${ctx.user.id}`, { windowSec: 60, max: 30 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limit' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const updates: any = { updated_at: new Date().toISOString() }
  for (const k of ALLOWED) if (body[k] !== undefined) updates[k] = body[k]
  if (Object.keys(updates).length === 1) return NextResponse.json({ error: 'no_fields' }, { status: 400 })

  const sb = supabaseService()
  // Upsert (já que tenant_id é PK)
  const { data, error } = await sb
    .from('ai_tenant_config')
    .upsert({ tenant_id: ctx.tenant_id, ...updates }, { onConflict: 'tenant_id' })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateBudgetCache()
  void logAdminAction(ctx, 'update_ia_config', 'ai_tenant_config', ctx.tenant_id, updates)
  return NextResponse.json({ ok: true, config: data })
}
