import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminCtx } from '@/lib/auth/admin'
import { rebuildKb } from '@/lib/rag/kb-builder'
import { rateLimit } from '@/lib/security/rate-limit'
import { logAdminAction } from '@/lib/security/audit-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req); if (!isAdminCtx(ctx)) return ctx
  const rl = rateLimit(`rebuild-kb:${ctx.user.id}`, { windowSec: 60, max: 3 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limit' }, { status: 429 })
  try {
    const result = await rebuildKb()
    void logAdminAction(ctx, 'rebuild_kb', 'ai_kb_chunks', null, result)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
