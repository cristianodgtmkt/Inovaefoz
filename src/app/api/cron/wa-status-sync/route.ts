/**
 * Cron a cada 1min — sincroniza status de cada wa_channel com Evolution.
 * GET /api/cron/wa-status-sync (Bearer CRON_TOKEN_OUTBOUND ou interno)
 */
import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/config/env'
import { supabaseService } from '@/lib/db/supabase'
import { getStatus } from '@/lib/wa/evolution'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const expected = env().CRON_TOKEN_OUTBOUND
  if (!expected) return false
  return req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') === expected
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sb = supabaseService()
  const { data: chs, error: selErr } = await sb.from('ai_wa_channels').select('id,instance_name,credentials,status,phone')
  const results: any[] = []
  const debug: any = { selErr: selErr?.message, total_rows: chs?.length || 0, processed: 0, skipped: 0 }
  for (const ch of (chs || [])) {
    const apiKey = (ch.credentials as any)?.api_key
    if (!ch.instance_name || !apiKey) {
      debug.skipped++
      results.push({ id: ch.id, skipped: true, reason: !ch.instance_name ? 'no_instance' : 'no_api_key' })
      continue
    }
    debug.processed++
    try {
      const s = await getStatus(ch.instance_name, apiKey)
      const newStatus = s.loggedIn
        ? 'connected'
        : (s.raw?.data?.Connected ? 'qr_required' : 'disconnected')
      const newPhone = s.raw?.data?.Phone || s.raw?.data?.phone || s.raw?.data?.Number || ch.phone
      const updates: any = { last_status_check: new Date().toISOString() }
      if (newStatus !== ch.status) updates.status = newStatus
      if (newPhone && newPhone !== ch.phone) updates.phone = newPhone
      const { error: upErr } = await sb.from('ai_wa_channels').update(updates).eq('id', ch.id)
      results.push({ id: ch.id, old: ch.status, new: newStatus, phone: newPhone, upErr: upErr?.message })
    } catch (e: any) {
      results.push({ id: ch.id, error: e?.message })
    }
  }
  return NextResponse.json({ ok: true, debug, results })
}
