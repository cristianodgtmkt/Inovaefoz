/**
 * POST /api/auth/wa/verify
 * Body: { telefone, code }
 * Action: valida OTP, gera magiclink Supabase, retorna action_link.
 * Cliente faz window.location = action_link → Supabase consome → cria session.
 * Response: { action_link } | 401 (código inválido) | 410 (expirado)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { supabaseService } from '@/lib/db/supabase'
import { env } from '@/lib/config/env'

const MAX_ATTEMPTS = 5

function normalizePhone(p: string): string {
  return (p || '').replace(/\D/g, '')
}

function hashCode(code: string, telefone: string): string {
  return createHash('sha256').update(`${code}:${telefone}:${process.env.WA_AUTH_PEPPER || 'acai-default-pepper'}`).digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const telefone = normalizePhone(body?.telefone || '')
    const code = (body?.code || '').toString().trim()

    if (!telefone || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'telefone ou código inválido' }, { status: 400 })
    }

    const sb = supabaseService()

    // 1. Carrega OTP
    const { data: otp } = await sb
      .from('wa_auth_otp')
      .select('telefone, code_hash, expires_at, attempts, consumed')
      .eq('telefone', telefone)
      .maybeSingle()

    if (!otp) {
      return NextResponse.json({ error: 'código não solicitado' }, { status: 401 })
    }
    if (otp.consumed) {
      return NextResponse.json({ error: 'código já usado' }, { status: 401 })
    }
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'código expirado' }, { status: 410 })
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: 'muitas tentativas; peça novo código' }, { status: 429 })
    }

    // 2. Valida hash
    const expected = hashCode(code, telefone)
    if (expected !== otp.code_hash) {
      await sb.from('wa_auth_otp').update({ attempts: otp.attempts + 1 }).eq('telefone', telefone)
      return NextResponse.json({ error: 'código incorreto', attempts_left: MAX_ATTEMPTS - otp.attempts - 1 }, { status: 401 })
    }

    // 3. Marca consumed
    await sb.from('wa_auth_otp').update({ consumed: true }).eq('telefone', telefone)

    // 4. Acha user_id em tenant_users
    const { data: tu } = await sb
      .from('tenant_users')
      .select('tenant_id, user_id')
      .eq('telefone', telefone)
      .maybeSingle()

    if (!tu) {
      return NextResponse.json({ error: 'usuário sem tenant associado' }, { status: 403 })
    }

    // 5. Pega email do auth.users pra gerar magiclink
    const { data: au } = await sb.auth.admin.getUserById(tu.user_id)
    if (!au?.user?.email) {
      return NextResponse.json({ error: 'usuário sem email no Supabase Auth' }, { status: 500 })
    }

    // 6. Gera magiclink Supabase
    const { data: link, error: linkErr } = await sb.auth.admin.generateLink({
      type: 'magiclink',
      email: au.user.email,
      options: {
        redirectTo: `${env().PUBLIC_BASE_URL || 'https://acai.inovaefoz.com.br'}/admin`,
      },
    })

    if (linkErr || !link?.properties?.action_link) {
      console.error('[wa-auth/verify] generateLink fail', linkErr)
      return NextResponse.json({ error: 'falha ao gerar sessão' }, { status: 500 })
    }

    return NextResponse.json({
      action_link: link.properties.action_link,
      tenant_id: tu.tenant_id,
    })
  } catch (e: any) {
    console.error('[wa-auth/verify]', e?.message)
    return NextResponse.json({ error: 'erro interno' }, { status: 500 })
  }
}
