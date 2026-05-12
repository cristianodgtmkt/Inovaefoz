/**
 * Acai-AI env validation (Zod-style minimal).
 * Falha fast se faltar var crítica.
 */
function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (!v) throw new Error(`[env] missing required var: ${name}`)
  return v
}
function opt(name: string, fallback = ''): string {
  return process.env[name] ?? fallback
}

let _cached: ReturnType<typeof build> | null = null

function build() {
  return {
    NODE_ENV: opt('NODE_ENV', 'production'),

    // Supabase Acai (cardápio + pedidos + ai_*)
    SUPABASE_URL: req('SUPABASE_URL', 'https://wrcjemcmpwemjrkwuitc.supabase.co'),
    SUPABASE_ANON_KEY: req('SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_KEY: opt('SUPABASE_SERVICE_KEY'), // pra writes em ai_traces, etc

    // LLM
    OPENAI_API_KEY: opt('OPENAI_API_KEY'),
    ANTHROPIC_API_KEY: opt('ANTHROPIC_API_KEY'),

    // Modelos por agente
    ROUTER_MODEL: opt('ROUTER_MODEL', 'gpt-4o-mini'),
    INFO_MODEL: opt('INFO_MODEL', 'gpt-4o-mini'),
    ORDER_MODEL: opt('ORDER_MODEL', 'claude-sonnet-4-5-20250929'),
    OBJECTION_MODEL: opt('OBJECTION_MODEL', 'claude-sonnet-4-5-20250929'),
    COMPLEX_MODEL: opt('COMPLEX_MODEL', 'claude-sonnet-4-5-20250929'),
    AUDITOR_MODEL: opt('AUDITOR_MODEL', 'claude-haiku-4-5-20251001'),
    SUMMARIZER_MODEL: opt('SUMMARIZER_MODEL', 'claude-haiku-4-5-20251001'),
    FOLLOWUP_MODEL: opt('FOLLOWUP_MODEL', 'gpt-4o-mini'),
    EMBED_MODEL: opt('EMBED_MODEL', 'text-embedding-3-small'),

    // Evolution (mesmo evolution-go do Inovaefoz)
    EVOLUTION_GO_URL: opt('EVOLUTION_GO_URL', 'http://evolution-go:4000'),
    EVOLUTION_GO_GLOBAL_KEY: opt('EVOLUTION_GO_GLOBAL_KEY'),

    // Meta IG/FB (graph)
    META_ACCESS_TOKEN: opt('META_ACCESS_TOKEN'),
    META_INSTAGRAM_ID: opt('META_INSTAGRAM_ID'),
    META_FACEBOOK_PAGE_ID: opt('META_FACEBOOK_PAGE_ID'),
    META_VERIFY_TOKEN: opt('META_VERIFY_TOKEN', 'acai-webhook-verify-2026'),

    // Admin contact (do JSON original n8n)
    ADMIN_PHONE: opt('ADMIN_PHONE', '554591065390'),

    // Auth interno
    INTERNAL_TEST_TOKEN: opt('INTERNAL_TEST_TOKEN'),
    CRON_TOKEN_EMBED: opt('CRON_TOKEN_EMBED'),
    CRON_TOKEN_FOLLOWUP: opt('CRON_TOKEN_FOLLOWUP'),
    CRON_TOKEN_OUTBOUND: opt('CRON_TOKEN_OUTBOUND'),
    CRON_TOKEN_REPORT: opt('CRON_TOKEN_REPORT'),

    // Public URL (pra magiclink redirect)
    PUBLIC_BASE_URL: opt('PUBLIC_BASE_URL', 'https://acai.inovaefoz.com.br'),

    // WhatsApp OTP auth
    WA_AUTH_PEPPER: opt('WA_AUTH_PEPPER', 'acai-default-pepper'),

    // Feature flags
    SHADOW_MODE: opt('SHADOW_MODE', 'false') === 'true',
    BUDGET_ENFORCEMENT: opt('BUDGET_ENFORCEMENT', 'enabled'),
    AUDIT_MODE: opt('AUDIT_MODE', 'log_only'), // log_only | block
    GUARDRAIL_ENFORCE_MODE: opt('GUARDRAIL_ENFORCE_MODE', 'soft'), // soft | strict
  }
}

export function env() {
  if (!_cached) _cached = build()
  return _cached
}
