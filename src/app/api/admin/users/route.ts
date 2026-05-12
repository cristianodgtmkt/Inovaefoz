/**
 * Lista users do tenant + invite.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminCtx } from '@/lib/auth/admin'
import { supabaseService } from '@/lib/db/supabase'
import { logAdminAction } from '@/lib/security/audit-log'
import { sendText } from '@/lib/wa/evolution'
import { env } from '@/lib/config/env'

function normalizePhone(p: string): string { return (p || '').replace(/\D/g, '') }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req); if (!isAdminCtx(ctx)) return ctx
  const sb = supabaseService()
  const { data: tu } = await sb.from('tenant_users')
    .select('user_id, role, created_at, telefone, nome, status')
    .eq('tenant_id', ctx.tenant_id)
  // Hidrata via auth admin API
  const users: any[] = []
  for (const r of (tu || [])) {
    try {
      const { data } = await sb.auth.admin.getUserById(r.user_id)
      if (data.user) {
        users.push({
          id: r.user_id, email: data.user.email,
          role: r.role,
          telefone: r.telefone,
          nome: r.nome,
          status: r.status || 'active',
          last_sign_in_at: data.user.last_sign_in_at,
          created_at: r.created_at,
        })
      }
    } catch {}
  }
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req); if (!isAdminCtx(ctx)) return ctx
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const telefone = normalizePhone(body.telefone || '')
  const nome = (body.nome || '').toString().trim()
  const role = (body.role || 'admin').toString()
  if (telefone.length < 10) return NextResponse.json({ error: 'telefone inválido' }, { status: 400 })
  if (!nome) return NextResponse.json({ error: 'nome obrigatório' }, { status: 400 })

  const sb = supabaseService()

  // Telefone já cadastrado neste tenant?
  const { data: existing } = await sb.from('tenant_users')
    .select('user_id, tenant_id, telefone')
    .eq('telefone', telefone)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'telefone já cadastrado' }, { status: 409 })
  }

  // Cria Supabase Auth user com email-fake (necessário pra magiclink no login WA)
  const fakeEmail = `wa-${telefone}@acai.local`
  let userId: string | null = null

  // Cria user (se já existir, captura erro de duplicate e segue)
  const created: any = await sb.auth.admin.createUser({
    email: fakeEmail,
    email_confirm: true,
    user_metadata: { telefone, nome, source: 'wa_invite' },
  })
  if (created?.error) {
    // Tenta achar via listUsers se duplicate
    const list: any = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const found = (list?.data?.users || []).find((u: any) => u.email === fakeEmail)
    if (found) userId = found.id
    else return NextResponse.json({ error: created.error.message }, { status: 500 })
  } else if (created?.data?.user) {
    userId = created.data.user.id
  } else {
    return NextResponse.json({ error: 'falha ao criar user' }, { status: 500 })
  }

  // Associa ao tenant
  const { error: tuErr } = await sb.from('tenant_users').insert({
    tenant_id: ctx.tenant_id, user_id: userId, role,
    telefone, nome, status: 'active',
  })
  if (tuErr) return NextResponse.json({ error: tuErr.message }, { status: 500 })

  void logAdminAction(ctx, 'invite_user', 'tenant_users', userId, { telefone, nome, role })

  // Notifica novo user via WhatsApp
  let waNotified = false
  try {
    const { data: ch } = await sb.from('ai_wa_channels')
      .select('instance_name, credentials')
      .eq('tenant_id', ctx.tenant_id).eq('status', 'connected')
      .limit(1).maybeSingle()
    const apiKey = (ch?.credentials as any)?.api_key
    if (ch?.instance_name && apiKey) {
      const url = env().PUBLIC_BASE_URL || 'https://acai.inovaefoz.com.br'
      const msg = `Olá ${nome.split(' ')[0]}! 🍇\n\nVocê foi convidado(a) para o painel administrativo.\n\nAcesse:\n${url}/login\n\nDigite este telefone (${telefone}) e peça o código de acesso. Vai chegar aqui no WhatsApp.`
      try {
        await sendText(ch.instance_name, apiKey, telefone, msg)
        waNotified = true
      } catch (e: any) {
        // BR fallback: retry sem o 9
        if (telefone.length === 13 && telefone.startsWith('55') && telefone[4] === '9') {
          const alt = telefone.slice(0, 4) + telefone.slice(5)
          try { await sendText(ch.instance_name, apiKey, alt, msg); waNotified = true } catch {}
        }
      }
    }
  } catch (e: any) {
    console.warn('[users/invite] notify fail', e?.message)
  }

  return NextResponse.json({ ok: true, user_id: userId, telefone, nome, role, wa_notified: waNotified })
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireAdmin(req); if (!isAdminCtx(ctx)) return ctx
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const user_id = searchParams.get('user_id')
  if (!user_id) return NextResponse.json({ error: 'user_id_required' }, { status: 400 })
  if (user_id === ctx.user.id) return NextResponse.json({ error: 'cannot_remove_self' }, { status: 400 })

  const sb = supabaseService()
  await sb.from('tenant_users').delete().eq('tenant_id', ctx.tenant_id).eq('user_id', user_id)
  void logAdminAction(ctx, 'remove_user', 'tenant_users', user_id, null)
  return NextResponse.json({ ok: true })
}
