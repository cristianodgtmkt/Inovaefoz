/**
 * POST /api/_setup/migrate?token=INTERNAL_TEST_TOKEN&name=wa_auth
 * One-shot migration runner. Reads migration SQL inline + executes via pg.
 * Tries DATABASE_URL first, fallback monta a partir de SUPABASE_DB_PASSWORD.
 *
 * Auto-bind admin Cristiano se ?bind_admin=1
 */
import { NextRequest, NextResponse } from 'next/server'
import { Client } from 'pg'
import { env } from '@/lib/config/env'

// Fallback: executa SQL via Supabase pg-meta REST (self-host expõe via Kong)
async function execViaPgMeta(sql: string): Promise<{ ok: boolean; rows?: any[]; error?: string }> {
  const e = env()
  if (!e.SUPABASE_SERVICE_KEY) return { ok: false, error: 'no service key' }
  // Tenta endpoints comuns: pg-meta direto OU via Kong /pg/
  const candidates = [
    `${e.SUPABASE_URL}/pg/query`,
    'http://supabase-pg-meta:8080/query',
    'http://pg-meta:8080/query',
  ]
  let lastErr = ''
  for (const url of candidates) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'apikey': e.SUPABASE_SERVICE_KEY,
          'authorization': `Bearer ${e.SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ query: sql }),
      })
      if (r.ok) {
        const j = await r.json().catch(() => ({}))
        return { ok: true, rows: Array.isArray(j) ? j : [j] }
      }
      lastErr = `${url} → ${r.status}`
    } catch (e: any) {
      lastErr = `${url} → ${e?.message}`
    }
  }
  return { ok: false, error: `pg-meta fallback fail: ${lastErr}` }
}

const MIGRATIONS: Record<string, string> = {
  wa_auth: `
    -- 1. OTP table
    CREATE TABLE IF NOT EXISTS wa_auth_otp (
      telefone TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      consumed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS wa_auth_otp_expires_idx ON wa_auth_otp (expires_at);

    -- 2. Cols extras em tenant_users
    ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS telefone TEXT;
    ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS nome TEXT;
    ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
    CREATE UNIQUE INDEX IF NOT EXISTS tenant_users_telefone_uniq
      ON tenant_users (telefone) WHERE telefone IS NOT NULL;

    -- 3. Signup requests
    CREATE TABLE IF NOT EXISTS wa_auth_signup_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      telefone TEXT NOT NULL,
      nome TEXT NOT NULL,
      loja_solicitada TEXT,
      tenant_id UUID REFERENCES tenants(id),
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by UUID,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS wa_signup_status_idx
      ON wa_auth_signup_requests (status, created_at DESC);
  `,
  fix_orphan_channels: `
    -- Atribui canais sem tenant_id ao tenant Acai (backfill)
    UPDATE ai_wa_channels
    SET tenant_id = (SELECT id FROM tenants WHERE slug = 'acai-da-barra' LIMIT 1)
    WHERE tenant_id IS NULL;
  `,
}

function buildDbUrl(override?: { host?: string; port?: string; pw?: string }): string | null {
  if (process.env.DATABASE_URL && !override?.host) return process.env.DATABASE_URL
  const pw = override?.pw || process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD
  const host = override?.host || process.env.SUPABASE_DB_HOST || 'supabase-db'
  const port = override?.port || process.env.SUPABASE_DB_PORT || '5432'
  const db = process.env.SUPABASE_DB_NAME || 'postgres'
  const user = process.env.SUPABASE_DB_USER || 'postgres'
  if (!pw) return null
  return `postgresql://${user}:${encodeURIComponent(pw)}@${host}:${port}/${db}`
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const name = url.searchParams.get('name') || 'wa_auth'
  const bindAdmin = url.searchParams.get('bind_admin') === '1'
  const adminPhone = url.searchParams.get('phone') || ''
  const adminEmail = url.searchParams.get('email') || 'cristiano@inovaefoz.com.br'
  const adminNome = url.searchParams.get('nome') || 'Cristiano'
  const dbHost = url.searchParams.get('db_host') || undefined
  const dbPort = url.searchParams.get('db_port') || undefined
  const dbPw = url.searchParams.get('db_pw') || undefined
  const override = (dbHost || dbPort || dbPw) ? { host: dbHost, port: dbPort, pw: dbPw } : undefined

  // Auth: aceita INTERNAL_TEST_TOKEN OU rodar sem token se for primeira vez (tabela alvo não existe)
  let authedByToken = false
  if (env().INTERNAL_TEST_TOKEN && token === env().INTERNAL_TEST_TOKEN) authedByToken = true

  if (!authedByToken) {
    // Permite uso sem token APENAS se tabelas alvo ainda não existem (single-use bootstrap)
    const dbUrlCheck = buildDbUrl(override)
    if (!dbUrlCheck) return NextResponse.json({ error: 'no DATABASE_URL nor SUPABASE_DB_PASSWORD' }, { status: 500 })
    const c = new Client({ connectionString: dbUrlCheck })
    try {
      await c.connect()
      // Pra wa_auth: bloqueia se wa_auth_otp já existe
      // Pra fix_orphan_channels: sempre permite (idempotente)
      if (name === 'wa_auth') {
        const r = await c.query(`SELECT to_regclass('public.wa_auth_otp') AS t`)
        if (r.rows[0]?.t) {
          await c.end()
          return NextResponse.json({ error: 'unauthorized — token requerido (tabelas já existem)' }, { status: 401 })
        }
      }
      await c.end()
    } catch (e: any) {
      await c.end().catch(() => {})
      return NextResponse.json({ error: `db connect fail: ${e?.message}` }, { status: 500 })
    }
  }

  const sql = MIGRATIONS[name]
  if (!sql) return NextResponse.json({ error: `migration '${name}' not found` }, { status: 404 })

  const out: any = { migration: name, steps: [] }
  const dbUrl = buildDbUrl(override)

  // Caminho 1: pg client direto se DB url disponível
  if (dbUrl) {
    const client = new Client({ connectionString: dbUrl, connectionTimeoutMillis: 5000 })
    try {
      await client.connect()
      await client.query(sql)
      out.steps.push({ step: 'migration', ok: true, via: 'pg' })

      if (bindAdmin && adminPhone) {
        const r = await client.query(
          `UPDATE tenant_users
           SET telefone = $1, nome = $2, status = 'active'
           WHERE user_id = (SELECT id FROM auth.users WHERE email = $3)
           RETURNING tenant_id, user_id`,
          [adminPhone.replace(/\D/g, ''), adminNome, adminEmail]
        )
        out.steps.push({ step: 'bind_admin', rows: r.rowCount, sample: r.rows[0] || null })
      }

      const v = await client.query(
        `SELECT u.email, tu.telefone, tu.nome, tu.role, t.slug AS tenant
         FROM tenant_users tu
         JOIN auth.users u ON u.id = tu.user_id
         JOIN tenants t ON t.id = tu.tenant_id`
      )
      out.users = v.rows
      return NextResponse.json({ ok: true, ...out })
    } catch (e: any) {
      out.steps.push({ step: 'pg_attempt', ok: false, error: e?.message })
      // fallthrough pra pg-meta
    } finally {
      await client.end().catch(() => {})
    }
  } else {
    out.steps.push({ step: 'pg_skip', reason: 'no db url' })
  }

  // Caminho 2: pg-meta via REST
  const meta = await execViaPgMeta(sql)
  out.steps.push({ step: 'pg_meta', ok: meta.ok, error: meta.error })
  if (!meta.ok) {
    return NextResponse.json({ ok: false, ...out }, { status: 500 })
  }

  if (bindAdmin && adminPhone) {
    const bindSql = `UPDATE tenant_users
       SET telefone = '${adminPhone.replace(/\D/g, '')}', nome = '${adminNome.replace(/'/g, "''")}', status = 'active'
       WHERE user_id = (SELECT id FROM auth.users WHERE email = '${adminEmail.replace(/'/g, "''")}')
       RETURNING tenant_id, user_id`
    const b = await execViaPgMeta(bindSql)
    out.steps.push({ step: 'bind_admin_meta', ok: b.ok, error: b.error, rows: b.rows })
  }

  return NextResponse.json({ ok: true, ...out })
}
