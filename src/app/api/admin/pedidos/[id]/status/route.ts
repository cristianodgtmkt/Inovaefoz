import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminCtx } from '@/lib/auth/admin'
import { supabaseService } from '@/lib/db/supabase'
import { humanizedSend } from '@/lib/wa/evolution'
import { logAdminAction } from '@/lib/security/audit-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUS_MESSAGES: Record<string, string> = {
  novo_pedido: '🔔 Recebemos seu pedido! Já vai entrar em preparo.',
  em_preparo: '🔥 Seu pedido tá em preparo agora! Logo logo fica pronto.',
  pronto_retirar: '🏁 Seu pedido tá pronto pra retirada! Pode vir buscar 💜',
  saiu_entrega: '🛵 Seu pedido saiu pra entrega! Tempo médio 25 min até chegar.',
  entregue: '✅ Pedido entregue! Esperamos que tenha gostado 💜 Se quiser fazer outro pedido, é só chamar!',
  cancelado: '⚠️ Seu pedido foi cancelado. Se foi engano, me avisa que reabro 💜',
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin(req); if (!isAdminCtx(ctx)) return ctx
  const body = await req.json().catch(() => ({}))
  const newStatus = (body.status || '').toString()
  if (!newStatus || !STATUS_MESSAGES[newStatus]) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
  }

  const sb = supabaseService()
  const { data: pedido, error: getErr } = await sb.from('pedidos').select('*').eq('id', params.id).maybeSingle()
  if (getErr || !pedido) return NextResponse.json({ error: 'pedido_not_found' }, { status: 404 })
  if (pedido.tenant_id !== ctx.tenant_id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (pedido.status === newStatus) return NextResponse.json({ ok: true, no_change: true })

  // Update status
  const { error: upErr } = await sb.from('pedidos').update({
    status: newStatus, updated_at: new Date().toISOString(),
  }).eq('id', params.id)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  void logAdminAction(ctx, 'update_pedido_status', 'pedido', params.id, { from: pedido.status, to: newStatus })

  // Notifica cliente via WhatsApp
  let notified = false
  let notify_error: string | null = null
  if (pedido.telefone_cliente) {
    try {
      // Pega canal default do tenant pra mandar
      const { data: ch } = await sb.from('ai_wa_channels')
        .select('instance_name,credentials')
        .eq('tenant_id', ctx.tenant_id)
        .eq('status', 'connected')
        .order('is_default', { ascending: false })
        .limit(1).maybeSingle()
      const apiKey = (ch?.credentials as any)?.api_key
      if (ch?.instance_name && apiKey) {
        const msgBase = STATUS_MESSAGES[newStatus]
        const code = `#${(pedido.id || '').slice(0, 6)}`
        const fullMsg = `${msgBase}\n\nPedido ${code}`
        await humanizedSend(ch.instance_name, apiKey, pedido.telefone_cliente, fullMsg, {
          minDelayMs: 800, maxDelayMs: 3000, charsPerSecond: 30,
        })
        notified = true

        // Grava no histórico de conversa
        await sb.from('conversas').insert({
          tenant_id: ctx.tenant_id,
          telefone: pedido.telefone_cliente,
          role: 'system', message: fullMsg,
          channel: 'whatsapp',
          intent: 'status_update',
        })
      } else {
        notify_error = 'no_active_channel'
      }
    } catch (e: any) {
      notify_error = e?.message || 'send_failed'
    }
  } else {
    notify_error = 'no_phone'
  }

  return NextResponse.json({ ok: true, status: newStatus, notified, notify_error })
}
