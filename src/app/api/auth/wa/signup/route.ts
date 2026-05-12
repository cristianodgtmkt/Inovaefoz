/**
 * POST /api/auth/wa/signup
 * Body: { telefone, nome, loja_solicitada? }
 * Action: cria solicitação pendente em wa_auth_signup_requests + notifica admin via WhatsApp.
 * Response: { received: true } | 409 (já existe) | 400
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/db/supabase'
import { sendText } from '@/lib/wa/evolution'
import { env } from '@/lib/config/env'

function normalizePhone(p: string): string {
  return (p || '').replace(/\D/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const telefone = normalizePhone(body?.telefone || '')
    const nome = (body?.nome || '').trim()
    const loja = (body?.loja_solicitada || '').trim() || null

    if (telefone.length < 10 || !nome) {
      return NextResponse.json({ error: 'telefone e nome obrigatórios' }, { status: 400 })
    }

    const sb = supabaseService()

    // Já existe tenant_user com esse telefone?
    const { data: tu } = await sb
      .from('tenant_users')
      .select('telefone')
      .eq('telefone', telefone)
      .maybeSingle()
    if (tu) {
      return NextResponse.json({ error: 'telefone já cadastrado — use login' }, { status: 409 })
    }

    // Já tem signup pendente?
    const { data: pend } = await sb
      .from('wa_auth_signup_requests')
      .select('id, status')
      .eq('telefone', telefone)
      .eq('status', 'pending')
      .maybeSingle()
    if (pend) {
      return NextResponse.json({ received: true, already_pending: true })
    }

    // Cria registro
    await sb.from('wa_auth_signup_requests').insert({
      telefone, nome, loja_solicitada: loja, status: 'pending',
    })

    // Notifica admin (canal padrão = primeiro tenant ativo)
    const { data: ch } = await sb
      .from('ai_wa_channels')
      .select('instance_name, credentials')
      .eq('status', 'connected')
      .limit(1)
      .maybeSingle()
    const adminPhone = env().ADMIN_PHONE
    const apiKey = (ch?.credentials as any)?.api_key
    if (ch?.instance_name && apiKey && adminPhone) {
      const lojaTxt = loja ? ` (loja: ${loja})` : ''
      const msg = `🆕 Nova solicitação de acesso ao painel\n\nNome: ${nome}\nTelefone: ${telefone}${lojaTxt}\n\nAprove em: ${env().PUBLIC_BASE_URL}/admin/configuracoes`
      try { await sendText(ch.instance_name, apiKey, adminPhone, msg) } catch {}
    }

    return NextResponse.json({ received: true })
  } catch (e: any) {
    console.error('[wa-auth/signup]', e?.message)
    return NextResponse.json({ error: 'erro interno' }, { status: 500 })
  }
}
