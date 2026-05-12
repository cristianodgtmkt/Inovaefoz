/**
 * Audit log middleware — grava ações admin em ai_admin_audit_log.
 * Best-effort, nunca bloqueia.
 */
import { supabaseService } from '@/lib/db/supabase'
import type { AdminContext } from '@/lib/auth/admin'

export async function logAdminAction(
  ctx: AdminContext,
  action: string,
  resource_type: string,
  resource_id: string | null,
  diff: any = null,
) {
  try {
    const sb = supabaseService()
    await sb.from('ai_admin_audit_log').insert({
      tenant_id: ctx.tenant_id,
      user_id: ctx.user.id,
      user_email: ctx.user.email,
      action,
      resource_type,
      resource_id,
      diff,
      ip_address: ctx.ip,
      user_agent: ctx.user_agent.slice(0, 500),
    })
  } catch (e: any) {
    console.warn('[audit-log] err:', e?.message)
  }
}
