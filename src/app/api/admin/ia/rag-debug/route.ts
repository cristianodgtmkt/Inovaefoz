import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminCtx } from '@/lib/auth/admin'
import { rateLimit } from '@/lib/security/rate-limit'
import { retrieveHybrid } from '@/lib/rag/retrieve'
import { supabaseService } from '@/lib/db/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req)
  if (!isAdminCtx(ctx)) return ctx
  const rl = rateLimit(`rag-debug:${ctx.user.id}`, { windowSec: 60, max: 30 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limit' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const query = (body.query || '').toString().trim()
  if (!query) return NextResponse.json({ error: 'query_required' }, { status: 400 })

  try {
    const { chunks, ids } = await retrieveHybrid(query, 6)
    // KB stats
    const sb = supabaseService()
    const { count } = await sb.from('ai_kb_chunks').select('*', { count: 'exact', head: true }).eq('tenant_id', ctx.tenant_id)
    const { data: latest } = await sb.from('ai_kb_chunks').select('embedded_at').eq('tenant_id', ctx.tenant_id).order('embedded_at', { ascending: false }).limit(1).maybeSingle()
    return NextResponse.json({
      ok: true,
      query,
      chunks: chunks.map((c, i) => ({ rank: i + 1, ...c })),
      retrieved_ids: ids,
      kb_stats: { total_chunks: count || 0, last_embedded_at: latest?.embedded_at },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
