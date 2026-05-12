-- ============================================================
-- Acai-AI F1 — pgvector + observability schema (v2 alinhado com admin existente)
-- Aplicar em: Supabase wrcjemcmpwemjrkwuitc (Acai da Barra)
-- ============================================================
-- IMPORTANTE: usa a tabela `conversas` existente do admin Vercel.
-- Apenas ADICIONA colunas que faltam, sem quebrar funcionalidade.
-- Adiciona tabelas novas pra IA: kb_chunks, embedding_cache, traces,
-- audit, guardrails, outbound, followup, tenant_config, wa_channels.

-- ----------- pgvector ext -----------
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- Estender `conversas` existente (não recria, só adiciona)
-- Schema atual: telefone, role, message, created_at, nome_cliente, intent
-- Adiciona: agent_used, tokens_in, tokens_out, cost_cents, channel, provider_message_id, media_type, media_url
-- ============================================================
ALTER TABLE conversas
  ADD COLUMN IF NOT EXISTS agent_used TEXT,
  ADD COLUMN IF NOT EXISTS tokens_in INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_out INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_cents NUMERIC(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT,
  ADD COLUMN IF NOT EXISTS media_url TEXT;

CREATE INDEX IF NOT EXISTS conversas_telefone_created
  ON conversas (telefone, created_at DESC);
CREATE INDEX IF NOT EXISTS conversas_intent_created
  ON conversas (intent, created_at DESC) WHERE intent IS NOT NULL;
CREATE INDEX IF NOT EXISTS conversas_provider_msg
  ON conversas (provider_message_id) WHERE provider_message_id IS NOT NULL;

-- ============================================================
-- Tabela ai_conversa_state (estado por cliente, equivalente Redis pedido_state)
-- Separada de `conversas` (que é histórico de mensagens) — esta é estado atual
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_conversa_state (
  telefone TEXT PRIMARY KEY,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  client_name TEXT,
  status TEXT NOT NULL DEFAULT 'ativa',         -- ativa | aguardando_humano | encerrada
  etapa_funil TEXT DEFAULT 'descoberta',         -- descoberta | encantamento | fechamento
  pedido_state JSONB DEFAULT '{}',               -- items, endereco, bairro, forma_pagamento, troco_para, total
  chat_resumo TEXT,
  chat_resumo_at TIMESTAMPTZ,
  handoff_briefing TEXT,
  ia_paused BOOLEAN DEFAULT false,
  pause_reason TEXT,
  paused_by TEXT,
  paused_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_conversa_state_status
  ON ai_conversa_state (status, last_message_at DESC);

-- ============================================================
-- KB unificada de cardápio (RAG sobre produtos+sabores+complementos+taxas+config)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_kb_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,             -- 'produto' | 'tamanho' | 'sabor' | 'complemento' | 'taxa' | 'config'
  source_id TEXT,                         -- id stringificado da row original
  source_table TEXT,                      -- 'produtos' | 'tamanhos' | etc
  title TEXT,
  content TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  embedding vector(1536),
  embedding_model TEXT,
  embedded_at TIMESTAMPTZ,
  content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(title,'') || ' ' || coalesce(content,''))) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_kb_chunks_embedding_hnsw
  ON ai_kb_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS ai_kb_chunks_tsv ON ai_kb_chunks USING gin (content_tsv);
CREATE INDEX IF NOT EXISTS ai_kb_chunks_source ON ai_kb_chunks (source_type, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS ai_kb_chunks_sha ON ai_kb_chunks (content_sha256);

-- ============================================================
-- Embedding cache (dedup por SHA256)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_embedding_cache (
  content_sha256 TEXT NOT NULL,
  model TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (content_sha256, model)
);

-- ============================================================
-- ai_traces (log toda chamada de pipeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone TEXT,                       -- linka via telefone (não via FK pra evitar cascade issues)
  conversa_msg_id BIGINT,              -- conversas.id se existir (depende do tipo da PK)
  intent TEXT,
  router_confidence NUMERIC(3,2),
  specialist TEXT,
  needs_rag BOOLEAN DEFAULT false,
  retrieved_chunk_ids UUID[],
  tools_called TEXT[],
  tokens_in INT DEFAULT 0,
  tokens_out INT DEFAULT 0,
  cost_cents NUMERIC(10,4) DEFAULT 0,
  duration_ms INT,
  guardrail_failures TEXT[],
  audit_verdict TEXT,
  cache_hit BOOLEAN DEFAULT false,
  reply_text TEXT,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_traces_telefone ON ai_traces (telefone, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_traces_created ON ai_traces (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_traces_intent ON ai_traces (intent, created_at DESC);

-- ============================================================
-- ai_audit_findings (auditor LLM Haiku)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_audit_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone TEXT,
  trace_id UUID,
  specialist TEXT NOT NULL,
  verdict TEXT NOT NULL,             -- pass | fail | warn
  issue TEXT,
  reason TEXT,
  severity TEXT,
  mode TEXT NOT NULL,
  original_reply TEXT,
  audit_tokens_in INT DEFAULT 0,
  audit_tokens_out INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_audit_findings_created ON ai_audit_findings (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_audit_findings_issue ON ai_audit_findings (issue) WHERE verdict='fail';

-- ============================================================
-- guardrail_findings
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_guardrail_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone TEXT,
  trace_id UUID,
  specialist TEXT NOT NULL,
  guardrail TEXT NOT NULL,
  reason TEXT,
  fix TEXT,
  original_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_guardrail_findings_created ON ai_guardrail_findings (created_at DESC);

-- ============================================================
-- outbound_queue (retry)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_outbound_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone TEXT NOT NULL,
  channel TEXT NOT NULL,
  payload JSONB NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_outbound_queue_pending
  ON ai_outbound_queue (next_attempt_at)
  WHERE processed_at IS NULL AND failed_at IS NULL;

-- ============================================================
-- followup_log
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_followup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone TEXT NOT NULL,
  attempt_no INT NOT NULL,
  decision TEXT NOT NULL,                -- SEND | SKIP | CLOSURE | DISABLE
  reason TEXT,
  message_sent TEXT,
  next_followup_at TIMESTAMPTZ,
  tokens_in INT DEFAULT 0,
  tokens_out INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_followup_log_telefone ON ai_followup_log (telefone, created_at DESC);

-- ============================================================
-- tenant_config (single row)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_tenant_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  budget_cents_per_day INT NOT NULL DEFAULT 1000,
  price_whitelist_centavos INT[] NOT NULL DEFAULT '{}',
  guardrail_enforce_mode TEXT NOT NULL DEFAULT 'soft',
  audit_mode TEXT NOT NULL DEFAULT 'log_only',
  citation_mode TEXT NOT NULL DEFAULT 'soft',
  allow_contact_disclosure BOOLEAN NOT NULL DEFAULT false,
  business_hours JSONB DEFAULT '{}',
  admin_phones TEXT[] DEFAULT ARRAY['554591065390'],
  followup_enabled BOOLEAN DEFAULT true,
  daily_report_enabled BOOLEAN DEFAULT true,
  daily_report_hour INT DEFAULT 9,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO ai_tenant_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============================================================
-- ai_wa_channels (Evolution instances pareadas)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_wa_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'evolution',
  instance_name TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  qr_code_data TEXT,
  qr_code_expires_at TIMESTAMPTZ,
  credentials JSONB DEFAULT '{}',
  last_status_check TIMESTAMPTZ,
  disconnect_reason TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_wa_channels_status ON ai_wa_channels (status);

-- ============================================================
-- VIEWS observability
-- ============================================================
CREATE OR REPLACE VIEW v_ai_usage_daily AS
SELECT
  date_trunc('day', created_at)::date AS day,
  count(*) AS calls,
  sum(tokens_in) AS tokens_in,
  sum(tokens_out) AS tokens_out,
  sum(cost_cents) AS cost_cents,
  round(avg(duration_ms)) AS avg_duration_ms,
  count(*) FILTER (WHERE cache_hit) AS cache_hits,
  round(100.0 * count(*) FILTER (WHERE cache_hit)::numeric / nullif(count(*),0), 1) AS cache_hit_rate_pct
FROM ai_traces
GROUP BY 1 ORDER BY 1 DESC;

CREATE OR REPLACE VIEW v_ai_specialists_daily AS
SELECT
  date_trunc('day', created_at)::date AS day,
  specialist, count(*) AS calls,
  sum(tokens_in) AS tokens_in, sum(tokens_out) AS tokens_out, sum(cost_cents) AS cost_cents
FROM ai_traces WHERE specialist IS NOT NULL
GROUP BY 1, 2 ORDER BY 1 DESC, 4 DESC;

CREATE OR REPLACE VIEW v_audit_findings_daily AS
SELECT date_trunc('day', created_at)::date AS day, issue, verdict, count(*) AS occurrences
FROM ai_audit_findings GROUP BY 1, 2, 3 ORDER BY 1 DESC, 4 DESC;

CREATE OR REPLACE VIEW v_guardrail_findings_daily AS
SELECT date_trunc('day', created_at)::date AS day, guardrail, fix, count(*) AS occurrences
FROM ai_guardrail_findings GROUP BY 1, 2, 3 ORDER BY 1 DESC, 4 DESC;

CREATE OR REPLACE VIEW v_followup_outcomes_daily AS
SELECT date_trunc('day', created_at)::date AS day, decision, count(*) AS calls
FROM ai_followup_log GROUP BY 1, 2 ORDER BY 1 DESC;

CREATE OR REPLACE VIEW v_tenant_budget AS
WITH today_spend AS (
  SELECT coalesce(sum(cost_cents), 0)::int AS spent_cents
  FROM ai_traces WHERE created_at >= date_trunc('day', now())
)
SELECT c.budget_cents_per_day AS budget_cents, s.spent_cents,
  greatest(c.budget_cents_per_day - s.spent_cents, 0) AS headroom_cents,
  round(100.0 * s.spent_cents / nullif(c.budget_cents_per_day,0), 1) AS used_pct
FROM ai_tenant_config c CROSS JOIN today_spend s WHERE c.id = 1;

-- ============================================================
-- RPC functions pra hybrid retrieve (RAG)
-- ============================================================
CREATE OR REPLACE FUNCTION acai_kb_vector_search(
  query_embedding vector(1536), match_count INT DEFAULT 20
)
RETURNS TABLE (id UUID, source_type TEXT, title TEXT, content TEXT, similarity FLOAT)
LANGUAGE sql STABLE AS $$
  SELECT id, source_type, title, content, 1 - (embedding <=> query_embedding) AS similarity
  FROM ai_kb_chunks WHERE embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION acai_kb_bm25_search(
  query_text TEXT, match_count INT DEFAULT 20
)
RETURNS TABLE (id UUID, source_type TEXT, title TEXT, content TEXT, rank FLOAT)
LANGUAGE sql STABLE AS $$
  SELECT id, source_type, title, content,
    ts_rank_cd(content_tsv, plainto_tsquery('portuguese', query_text)) AS rank
  FROM ai_kb_chunks WHERE content_tsv @@ plainto_tsquery('portuguese', query_text)
  ORDER BY rank DESC LIMIT match_count;
$$;

-- ============================================================
-- DONE
-- ============================================================
