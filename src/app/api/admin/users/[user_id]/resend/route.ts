/**
 * POST /api/admin/users/[user_id]/resend
 * Reenvia mensagem de convite via WhatsApp.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminCtx } from '@/lib/auth/admin'
import { supabaseService } from '@/lib/db/supabase'
import { sendText } from '@/lib/wa/evolution'
import { env } from '@/lib/config/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { user_id: string } }) {
  const ctx = await requireAdmin(req); if (!isAdminCtx(ctx)) return ctx
  const sb = supabaseService()

  const { data: tu } = await sb.from('tenant_users')
    .select('telefone, nome')
    .eq('tenant_id', ctx.tenant_id)
    .eq('user_id', params.user_id)
    .maybeSingle()

  if (!tu?.telefone) return NextResponse.json({ error: 'user sem telefone' }, { status: 400 })

  const { data: ch } = await sb.from('ai_wa_channels')
    .select('instance_name, credentials')
    .eq('tenant_id', ctx.tenant_id).eq('status', 'connected')
    .limit(1).maybeSingle()
  const apiKey = (ch?.credentials as any)?.api_key
  if (!ch?.instance_name || !apiKey) return NextResponse.json({ error: 'canal WhatsApp não conectado' }, { status: 503 })

  const url = env().PUBLIC_BASE_URL || 'https://acai.inovaefoz.com.br'
  const nome = tu.nome || 'Olá'
  const msg = `Olá ${nome.split(' ')[0]}! 🍇\n\nReenviando seu acesso ao painel:\n\n${url}/login\n\nDigite ${tu.telefone} e peça o código. Vai chegar no WhatsApp.`

  async function trySend(p: string) { return await sendText(ch!.instance_name, apiKey, p, msg) }
  try {
    await trySend(tu.telefone)
    return NextResponse.json({ ok: true, wa_notified: true })
  } catch (e: any) {
    if (tu.telefone.length === 13 && tu.telefone.startsWith('55') && tu.telefone[4] === '9') {
      const alt = tu.telefone.slice(0, 4) + tu.telefone.slice(5)
      try { await trySend(alt); return NextResponse.json({ ok: true, wa_notified: true, note: 'enviado sem 9' }) }
      catch (e2: any) { return NextResponse.json({ error: 'falha ao enviar', detail: e2?.message }, { status: 502 }) }
    }
    return NextResponse.json({ error: 'falha ao enviar', detail: e?.message }, { status: 502 })
  }
}
