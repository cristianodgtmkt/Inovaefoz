import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminCtx } from '@/lib/auth/admin'
import { supabaseService } from '@/lib/db/supabase'
import { rateLimit } from '@/lib/security/rate-limit'
import { logAdminAction } from '@/lib/security/audit-log'
import { invalidatePromptCache } from '@/lib/agents/prompts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID = new Set(['router', 'menu', 'order', 'objection', 'auditor', 'greeting'])

export async function PATCH(req: NextRequest, { params }: { params: { specialist: string } }) {
  const ctx = await requireAdmin(req)
  if (!isAdminCtx(ctx)) return ctx
  const specialist = params.specialist
  if (!VALID.has(specialist)) return NextResponse.json({ error: 'invalid_specialist' }, { status: 400 })

  const rl = rateLimit(`prompt-patch:${ctx.user.id}`, { windowSec: 60, max: 20 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limit' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const content = (body.content || '').toString()
  if (!content || content.length < 10) return NextResponse.json({ error: 'content_required' }, { status: 400 })
  if (content.length > 8000) return NextResponse.json({ error: 'content_too_long' }, { status: 400 })

  const sb = supabaseService()
  const { data, error } = await sb.from('ai_prompts').upsert({
    tenant_id: ctx.tenant_id, specialist, content,
    updated_by: ctx.user.id, updated_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id,specialist' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidatePromptCache(ctx.tenant_id, specialist)
  void logAdminAction(ctx, 'update_prompt', 'ai_prompts', specialist, { specialist, len: content.length })
  return NextResponse.json({ ok: true, prompt: data })
}
