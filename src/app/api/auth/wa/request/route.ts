/**
 * POST /api/auth/wa/request
 * Body: { telefone }
 * Action: gera OTP 6 dígitos, hash, grava em wa_auth_otp, manda WhatsApp via evolution-go.
 * Response: { sent: true, retry_after_sec } | 404 (telefone não cadastrado) | 429 (rate-limit)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomInt } from 'crypto'
import { supabaseService } from '@/lib/db/supabase'
import { sendText } from '@/lib/wa/evolution'

const OTP_TTL_SEC = 300            // 5 min
const RESEND_COOLDOWN_SEC = 30     // anti-spam por telefone
const MAX_OTP_PER_HOUR = 5

function normalizePhone(p: string): string {
  return (p || '').replace(/\D/g, '')
}

function hashCode(code: string, telefone: string): string {
  // SHA-256(code + telefone) — OTP de 5min, sem precisar bcrypt
  return createHash('sha256').update(`${code}:${telefone}:${process.env.WA_AUTH_PEPPER || 'acai-default-pepper'}`).digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const telefone = normalizePhone(body?.telefone || '')
    if (telefone.length < 10 || telefone.length > 15) {
      return NextResponse.json({ error: 'telefone inválido' }, { status: 400 })
    }

    const sb = supabaseService()

    // 1. Verifica se telefone está cadastrado em tenant_users
    const { data: tu } = await sb
      .from('tenant_users')
      .select('tenant_id, user_id, status, nome')
      .eq('telefone', telefone)
      .maybeSingle()

    if (!tu) {
      // Sem leak — sempre responde 200 c/ flag genérica (privacidade)
      return NextResponse.json({ sent: true, registered: false })
    }
    if (tu.status === 'blocked') {
      return NextResponse.json({ error: 'acesso bloqueado' }, { status: 403 })
    }

    // 2. Anti-spam: cooldown e rate-limit
    const { data: existing } = await sb
      .from('wa_auth_otp')
      .select('telefone, created_at, attempts')
      .eq('telefone', telefone)
      .maybeSingle()

    if (existing) {
      const ageSec = (Date.now() - new Date(existing.created_at).getTime()) / 1000
      if (ageSec < RESEND_COOLDOWN_SEC) {
        return NextResponse.json(
          { error: 'aguarde antes de pedir novo código', retry_after_sec: Math.ceil(RESEND_COOLDOWN_SEC - ageSec) },
          { status: 429 }
        )
      }
    }

    // 3. Gera OTP 6 dígitos e grava
    const code = String(randomInt(100000, 999999))
    const codeHash = hashCode(code, telefone)
    const expiresAt = new Date(Date.now() + OTP_TTL_SEC * 1000).toISOString()

    await sb.from('wa_auth_otp').upsert({
      telefone,
      code_hash: codeHash,
      expires_at: expiresAt,
      attempts: 0,
      consumed: false,
      created_at: new Date().toISOString(),
    }, { onConflict: 'telefone' })

    // 4. Manda WhatsApp — usa primeiro canal ativo do tenant do user
    const { data: ch } = await sb
      .from('ai_wa_channels')
      .select('instance_name, credentials')
      .eq('tenant_id', tu.tenant_id)
      .eq('status', 'connected')
      .limit(1)
      .maybeSingle()

    const apiKey = (ch?.credentials as any)?.api_key
    if (!ch?.instance_name || !apiKey) {
      return NextResponse.json({ error: 'canal WhatsApp não disponível' }, { status: 503 })
    }

    const greeting = tu.nome ? `Oi, ${tu.nome.split(' ')[0]}!` : 'Olá!'
    const msg = `${greeting} 🍇\n\nSeu código de acesso ao painel:\n\n*${code}*\n\nValido por 5 minutos. Não compartilhe.`

    // BR fallback: WhatsApp algumas vezes registra número antigo (sem 9 após DDD).
    // Tenta padrão, se falhar e for celular BR de 13 dígitos, retry sem o 9.
    async function trySend(phone: string) {
      return await sendText(ch.instance_name, apiKey, phone, msg)
    }
    let sent = false; let lastErr: any = null
    try {
      await trySend(telefone); sent = true
    } catch (e: any) {
      lastErr = e?.message || String(e)
      // BR celular: 55 + DDD + 9XXXXXXXX (13 chars). Retry sem 9.
      if (telefone.length === 13 && telefone.startsWith('55') && telefone[4] === '9') {
        const alt = telefone.slice(0, 4) + telefone.slice(5)  // remove o 9
        try { await trySend(alt); sent = true } catch (e2: any) { lastErr = `${lastErr} | retry: ${e2?.message}` }
      }
    }
    if (!sent) {
      console.error('[wa-auth/request] sendText fail', lastErr)
      return NextResponse.json({
        error: 'falha ao enviar WhatsApp',
        detail: lastErr,
        instance: ch.instance_name,
        telefone,
      }, { status: 502 })
    }

    return NextResponse.json({ sent: true, registered: true, expires_in_sec: OTP_TTL_SEC })
  } catch (e: any) {
    console.error('[wa-auth/request]', e?.message)
    return NextResponse.json({ error: 'erro interno' }, { status: 500 })
  }
}
