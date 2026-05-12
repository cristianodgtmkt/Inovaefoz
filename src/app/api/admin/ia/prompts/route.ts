import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminCtx } from '@/lib/auth/admin'
import { supabaseService } from '@/lib/db/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req)
  if (!isAdminCtx(ctx)) return ctx
  const sb = supabaseService()
  const { data, error } = await sb.from('ai_prompts').select('*').eq('tenant_id', ctx.tenant_id).order('specialist')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ prompts: data || [] })
}
