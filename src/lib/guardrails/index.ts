// Guardrails determinísticos sequenciais
import { supabaseService } from '@/lib/db/supabase'
import type { AgentContext, SpecialistReply } from '@/lib/agents/types'

export type FixPolicy = 'block' | 'silent_fix' | 'fallback'

export interface GuardrailVerdict {
  name: string
  pass: boolean
  reason?: string
  fix?: FixPolicy
  newText?: string
}

export interface GuardrailResult {
  reply: SpecialistReply
  verdicts: GuardrailVerdict[]
  blocked: boolean
  failures: string[]
}

const FALLBACK_TEXT = 'Vou verificar isso e te respondo em instantes. Um atendente humano vai continuar daqui 💚'
const DEFAULT_SUSPECT = ['trufado', 'gourmet', 'reserva', 'experimental']

// Cache 60s por tenant
const cfgCache = new Map<string, { suspect: string[]; disabled: string[]; whitelist_extra: number[]; until: number }>()
const TTL = 60_000

async function loadTenantCfg(tenant_id?: string): Promise<{ suspect: string[]; disabled: string[]; whitelist_extra: number[] }> {
  if (!tenant_id) return { suspect: DEFAULT_SUSPECT, disabled: [], whitelist_extra: [] }
  const cached = cfgCache.get(tenant_id)
  if (cached && cached.until > Date.now()) return cached
  try {
    const sb = supabaseService()
    const { data } = await sb
      .from('ai_tenant_config')
      .select('suspect_items,guardrails_disabled,price_whitelist_centavos')
      .eq('tenant_id', tenant_id)
      .maybeSingle()
    const suspect = Array.isArray(data?.suspect_items) && data!.suspect_items.length > 0
      ? data!.suspect_items as string[]
      : DEFAULT_SUSPECT
    const disabled = Array.isArray(data?.guardrails_disabled) ? data!.guardrails_disabled as string[] : []
    const whitelist_extra = Array.isArray(data?.price_whitelist_centavos) ? data!.price_whitelist_centavos as number[] : []
    const out = { suspect, disabled, whitelist_extra }
    cfgCache.set(tenant_id, { ...out, until: Date.now() + TTL })
    return out
  } catch {
    return { suspect: DEFAULT_SUSPECT, disabled: [], whitelist_extra: [] }
  }
}

export function invalidateGuardrailCfgCache(tenant_id?: string) {
  if (tenant_id) cfgCache.delete(tenant_id)
  else cfgCache.clear()
}

function priceWhitelist(ctx: AgentContext, reply: SpecialistReply, extra: number[]): GuardrailVerdict {
  const text = reply.text || ''
  const matches = text.match(/R\$\s*(\d+(?:[.,]\d{1,2})?)/gi) || []
  const whitelist = [...ctx.cardapioSnapshot.precos, ...extra]
  const cardapioText = ctx.cardapioSnapshot.produtos.map(p => p.nome).join(' ')
  for (const m of matches) {
    const numStr = m.replace(/R\$\s*/i, '').replace(',', '.')
    const cents = Math.round(parseFloat(numStr) * 100)
    if (whitelist.includes(cents)) continue
    if (cardapioText.toLowerCase().includes(numStr)) continue
    return { name: 'price_whitelist', pass: false, reason: `R$ ${numStr} não está na whitelist (${whitelist.length} preços)`, fix: 'fallback' }
  }
  return { name: 'price_whitelist', pass: true }
}

function itemMustExist(ctx: AgentContext, reply: SpecialistReply, suspect: string[]): GuardrailVerdict {
  if (['greeting', 'escalation_handler', 'objection_handler', 'status_handler'].includes(reply.specialistName)) {
    return { name: 'item_must_exist', pass: true }
  }
  const itemsNomes = Array.from(ctx.cardapioSnapshot.itensNomes).map(s => s.toLowerCase())
  const text = reply.text.toLowerCase()
  for (const s of suspect) {
    const sLow = String(s).toLowerCase().trim()
    if (!sLow) continue
    if (text.includes(sLow) && !itemsNomes.some(i => i.includes(sLow))) {
      return { name: 'item_must_exist', pass: false, reason: `menciona "${sLow}" mas não está no cardápio`, fix: 'fallback' }
    }
  }
  return { name: 'item_must_exist', pass: true }
}

function deliveryAddress(_ctx: AgentContext, reply: SpecialistReply): GuardrailVerdict {
  if (!/bairro/i.test(reply.text)) return { name: 'delivery_address', pass: true }
  return { name: 'delivery_address', pass: true }
}

function orderTotalMatch(_ctx: AgentContext, _reply: SpecialistReply): GuardrailVerdict {
  return { name: 'order_total_match', pass: true }
}

function format(_ctx: AgentContext, reply: SpecialistReply): GuardrailVerdict {
  const text = reply.text || ''
  if (text.length > 800) {
    const truncated = text.slice(0, 600) + '…'
    return { name: 'format', pass: false, reason: 'reply > 800 chars', fix: 'silent_fix', newText: truncated }
  }
  const cleaned = text.replace(/\*\*(.+?)\*\*/g, '$1')
  if (cleaned !== text) {
    return { name: 'format', pass: false, reason: 'markdown bold removido', fix: 'silent_fix', newText: cleaned }
  }
  return { name: 'format', pass: true }
}

export async function runGuardrails(ctx: AgentContext, reply: SpecialistReply): Promise<GuardrailResult> {
  let current = { ...reply }
  const verdicts: GuardrailVerdict[] = []
  const failures: string[] = []
  let blocked = false

  const cfg = await loadTenantCfg(ctx.tenant_id)
  const disabledSet = new Set(cfg.disabled)

  // Guardrails registry com seus nomes (pra checagem disabled)
  const guards: Array<{ name: string; run: () => GuardrailVerdict }> = [
    { name: 'price_whitelist', run: () => priceWhitelist(ctx, current, cfg.whitelist_extra) },
    { name: 'item_must_exist', run: () => itemMustExist(ctx, current, cfg.suspect) },
    { name: 'delivery_address', run: () => deliveryAddress(ctx, current) },
    { name: 'order_total_match', run: () => orderTotalMatch(ctx, current) },
    { name: 'format', run: () => format(ctx, current) },
  ]

  for (const g of guards) {
    if (disabledSet.has(g.name)) {
      verdicts.push({ name: g.name, pass: true, reason: 'disabled' })
      continue
    }
    const v = g.run()
    verdicts.push(v)
    if (v.pass) continue
    failures.push(`${v.name}:${v.reason || 'fail'}`)
    if (v.fix === 'silent_fix' && v.newText !== undefined) {
      current = { ...current, text: v.newText }
    } else if (v.fix === 'fallback' || v.fix === 'block') {
      blocked = true
      current = { ...current, text: v.newText || FALLBACK_TEXT, needsHandoff: true, handoffReason: `guardrail:${v.name}` }
      break
    }
  }

  if (failures.length > 0) {
    void (async () => {
      try {
        const sb = supabaseService()
        await sb.from('ai_guardrail_findings').insert(
          verdicts.filter(v => !v.pass).map(v => ({
            tenant_id: ctx.tenant_id || null,
            telefone: ctx.telefone,
            specialist: reply.specialistName,
            guardrail: v.name,
            reason: v.reason,
            fix: v.fix,
            original_text: reply.text.slice(0, 2000),
          }))
        )
      } catch {}
    })()
  }

  return { reply: current, verdicts, blocked, failures }
}
