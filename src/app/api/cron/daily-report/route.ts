/**
 * Cron 09:00 — envia relatório diário pro admin via WhatsApp.
 * GET /api/cron/daily-report (Bearer CRON_TOKEN_REPORT)
 */
import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/config/env'
import { supabaseService } from '@/lib/db/supabase'
import { sendText } from '@/lib/wa/evolution'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const expected = env().CRON_TOKEN_REPORT
  if (!expected) return false
  return req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') === expected
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const sb = supabaseService()
  const e = env()

  // Coleta métricas ontem
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10)
  const start = `${yesterday}T00:00:00`
  const end = `${yesterday}T23:59:59`

  const [pedidosResult, conversasResult, escalationsResult] = await Promise.all([
    sb.from('pedidos').select('total,taxa_entrega,status').gte('created_at', start).lte('created_at', end),
    sb.from('conversas').select('id', { count: 'exact', head: true }).gte('created_at', start).lte('created_at', end),
    sb.from('conversas').select('id', { count: 'exact', head: true }).eq('intent', 'escalacao').gte('created_at', start).lte('created_at', end),
  ])

  const pedidos = pedidosResult.data || []
  const totalPedidos = pedidos.length
  const totalReceita = pedidos.reduce((s, p) => s + (p.total || 0) + (p.taxa_entrega || 0), 0)
  const ticket = totalPedidos > 0 ? totalReceita / totalPedidos : 0
  const cancelados = pedidos.filter(p => p.status === 'cancelado').length

  const msg = [
    `📊 *Relatório Açaí da Barra · ${new Date(yesterday).toLocaleDateString('pt-BR')}*`,
    ``,
    `🛒 Pedidos: *${totalPedidos}* (${cancelados} cancelados)`,
    `💰 Receita: *R$ ${totalReceita.toFixed(2).replace('.', ',')}*`,
    `🎟 Ticket médio: R$ ${ticket.toFixed(2).replace('.', ',')}`,
    `💬 Conversas IA: ${conversasResult.count || 0}`,
    `🚨 Escalações: ${escalationsResult.count || 0}`,
    ``,
    `Ver detalhes: https://acai.inovaefoz.com.br/admin/relatorios`,
  ].join('\n')

  // Send to admin via default channel
  try {
    const { data: ch } = await sb
      .from('ai_wa_channels')
      .select('instance_name,credentials')
      .eq('status', 'connected')
      .limit(1)
      .maybeSingle()
    if (ch?.instance_name && (ch.credentials as any)?.api_key) {
      await sendText(ch.instance_name, (ch.credentials as any).api_key, e.ADMIN_PHONE, msg)
    }
  } catch (err: any) {
    console.warn('[daily-report] send err:', err?.message)
  }

  return NextResponse.json({ ok: true, sent_to: e.ADMIN_PHONE, summary: { pedidos: totalPedidos, receita: totalReceita } })
}
