// Cron */5 — rebuilda KB chunks + embeddings (cardapio do Supabase)
import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/config/env'
import { rebuildKb } from '@/lib/rag/kb-builder'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function authorized(req: NextRequest): boolean {
  const expected = env().CRON_TOKEN_EMBED
  if (!expected) return false
  return req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') === expected
}

export async function POST(req: NextRequest) { return GET(req) }
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const result = await rebuildKb()
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
