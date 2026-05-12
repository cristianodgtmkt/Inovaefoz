import { NextResponse } from 'next/server'
import { env } from '@/lib/config/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const e = env()
  return NextResponse.json({
    service: 'acai-ai',
    version: '0.1.0',
    ts: new Date().toISOString(),
    env: e.NODE_ENV,
    supabase: !!e.SUPABASE_ANON_KEY,
    openai: !!e.OPENAI_API_KEY,
    anthropic: !!e.ANTHROPIC_API_KEY,
    evolution_url: e.EVOLUTION_GO_URL,
    meta_token_set: !!e.META_ACCESS_TOKEN,
    shadow_mode: e.SHADOW_MODE,
    audit_mode: e.AUDIT_MODE,
  })
}
