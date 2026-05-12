-- ============================================================
-- Acai-AI F1 — Multi-tenant + RLS + Audit log + Prompts editáveis
-- Aplica no Supabase self-host.
-- IDEMPOTENTE: pode rodar várias vezes sem quebrar.
-- ============================================================

-- ─────────────────── 1. Tabela tenants ───────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT DEFAULT 'Painel Administrativo',
  brand JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'active',
  cnpj TEXT, telefone TEXT, email TEXT, instagram TEXT,
  endereco_cep TEXT, endereco_rua TEXT, endereco_numero TEXT,
  endereco_bairro TEXT, endereco_cidade TEXT, endereco_uf TEXT,
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  locale TEXT DEFAULT 'pt-BR',
  ai_paused_global BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO tenants (slug, name, brand) VALUES (
  'acai-da-barra', 'Açaí da Barra',
  '{"primary":"#7e22ce","primaryHover":"#6b21a8","soft":"#f3e8ff","border":"#e9d5ff","text":"#581c87","icon":"Grape"}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

-- ─────────────────── 2. tenant_users ───────────────────
CREATE TABLE IF NOT EXISTS tenant_users (
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

-- Associa o admin existente ao Acai
INSERT INTO tenant_users (tenant_id, user_id, role)
SELECT
  (SELECT id FROM tenants WHERE slug='acai-da-barra'),
  u.id,
  'owner'
FROM auth.users u
WHERE u.email = 'cristiano@inovaefoz.com.br'
ON CONFLICT DO NOTHING;

-- ─────────────────── 3. tenant_id em tabelas existentes ───────────────────
DO $$
DECLARE
  acai_id UUID;
  tbl TEXT;
  tabelas TEXT[] := ARRAY[
    'produtos','tamanhos','sabores','complementos','taxas_entrega','configuracoes',
    'pedidos','conversas','ai_traces','ai_audit_findings','ai_guardrail_findings',
    'ai_kb_chunks','ai_wa_channels','ai_conversa_state','ai_outbound_queue','ai_followup_log','ai_embedding_cache'
  ];
BEGIN
  SELECT id INTO acai_id FROM tenants WHERE slug='acai-da-barra';

  FOREACH tbl IN ARRAY tabelas LOOP
    -- Adiciona coluna se não existir
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id)', tbl);
      -- Backfill linhas órfãs com Acai
      EXECUTE format('UPDATE %I SET tenant_id = $1 WHERE tenant_id IS NULL', tbl) USING acai_id;
      -- Index
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id)', tbl||'_tenant_idx', tbl);
    END IF;
  END LOOP;
END $$;

-- ─────────────────── 4. ai_tenant_config — migrar id=1 → tenant_id ───────────────────
DO $$
DECLARE
  acai_id UUID;
BEGIN
  SELECT id INTO acai_id FROM tenants WHERE slug='acai-da-barra';

  -- Adiciona tenant_id se não existir
  ALTER TABLE ai_tenant_config ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
  -- Backfill row id=1
  UPDATE ai_tenant_config SET tenant_id = acai_id WHERE tenant_id IS NULL;
END $$;

-- Adiciona campos novos pra config IA editável (idempotente)
ALTER TABLE ai_tenant_config
  ADD COLUMN IF NOT EXISTS suspect_items JSONB DEFAULT '["trufado","gourmet","reserva","experimental"]'::jsonb,
  ADD COLUMN IF NOT EXISTS guardrails_disabled JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS model_router TEXT DEFAULT 'gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS model_menu TEXT DEFAULT 'gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS model_order TEXT DEFAULT 'claude-sonnet-4-5-20250929',
  ADD COLUMN IF NOT EXISTS model_objection TEXT DEFAULT 'claude-sonnet-4-5-20250929',
  ADD COLUMN IF NOT EXISTS model_auditor TEXT DEFAULT 'claude-haiku-4-5-20251001',
  ADD COLUMN IF NOT EXISTS metodos_pagamento JSONB DEFAULT '["pix","credit","debit","cash"]'::jsonb;

-- ─────────────────── 5. ai_prompts ───────────────────
CREATE TABLE IF NOT EXISTS ai_prompts (
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  specialist TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (tenant_id, specialist)
);

-- Seed prompts iniciais (extraídos do código hardcoded)
INSERT INTO ai_prompts (tenant_id, specialist, content) VALUES
((SELECT id FROM tenants WHERE slug='acai-da-barra'), 'router',
'Você é um router de intent pra atendimento WhatsApp de delivery.
Classifique a mensagem do cliente em UMA das intents abaixo.

INTENTS:
- saudacao: "oi", "olá", "boa noite", primeira mensagem sem contexto
- pedido_inicio: cliente menciona produto que quer (açaí, sorvete, milkshake)
- pedido_continua: cliente já tem pedido em curso (history mostra coleta de items)
- cardapio_query: pergunta preço, sabores, complementos disponíveis
- status_pedido: "cadê meu pedido", "saiu pra entrega?"
- objection: reclamação, "tá caro", "demorou demais"
- escalation: pede humano, atendente, gerente, troco maior R$50, cancelar pedido
- smalltalk: conversa fora do escopo (clima, política)
- media_only: só áudio/imagem sem texto

Responda APENAS JSON: {"intent": "...", "confidence": 0.0-1.0, "needs_rag": true|false, "reasoning": "..."}
needs_rag=true se precisa consultar cardápio/preços/taxas.'),

((SELECT id FROM tenants WHERE slug='acai-da-barra'), 'menu',
'Você é o atendente do delivery via WhatsApp.
Cliente perguntou sobre cardápio/preços. Responda de forma curta e clara, USANDO APENAS as informações do cardápio recuperado.
NUNCA invente preços. Se a info não estiver no cardápio, diga "não tenho essa info, vou chamar um atendente".

Tom: caloroso, próximo, brasileiro do Sul. Use 💜 com moderação. Mensagens curtas (max 4 frases).'),

((SELECT id FROM tenants WHERE slug='acai-da-barra'), 'order',
'Você coleta pedidos via WhatsApp. SIGA ETAPAS sem pular:
1. Item escolhido → tamanho (com preço) → sabores → complementos
2. Entrega ou retirada
3. Se entrega: bairro + endereço + complemento
4. Forma pagamento (PIX/cartão/dinheiro)
5. Se dinheiro: troco
6. RESUMO completo + "confirma?"
7. Após confirmação: "Pedido recebido! Em preparo agora 🔥"

REGRAS:
- NUNCA invente preço/item/bairro fora do cardápio.
- 1 pergunta por mensagem.
- Use tools quando precisa: list_menu, get_price, calc_taxa.
- Quando cliente CONFIRMAR pedido completo, devolva JSON na ÚLTIMA linha:
  {"action":"save_order","items":[{"nome":"X","quantidade":1,"preco_total":24.90}],"endereco":"...","bairro":"...","complemento":"...","forma_pagamento":"pix","troco_para":null,"total":24.90,"taxa":6}

Tom: caloroso, próximo, brasileiro do Sul. Use 💜 com moderação. Mensagens curtas (max 4 frases).'),

((SELECT id FROM tenants WHERE slug='acai-da-barra'), 'objection',
'Cliente teve objeção (preço, atraso, qualidade). Responda com empatia + solução prática.
Se for atraso: peça desculpas + prometa avisar status.
Se for preço: explique valor (qualidade, ingredientes).
Se for problema sério: ESCALONE pra humano.

NUNCA prometa desconto/brinde sem ESCALAR.

Tom: caloroso, próximo, brasileiro do Sul. Use 💜 com moderação. Mensagens curtas (max 4 frases).'),

((SELECT id FROM tenants WHERE slug='acai-da-barra'), 'auditor',
'Você é o auditor de qualidade do agente de atendimento.
Recebe a RESPOSTA do agente + a MENSAGEM do cliente + o CARDÁPIO.
Decide se a resposta está OK ou tem problema.

ISSUES POSSÍVEIS:
- price_hallucination: cita preço que não está no cardápio
- item_inexistente: menciona item que não está no cardápio
- inventory_claim_no_tool: afirma "temos disponível" sem ter consultado tool
- promise_no_data: promete prazo/entrega sem ter calculado
- scope_out: responde sobre tema fora do delivery (política, esporte, etc)
- data_leak: revela dados de outro cliente
- pii_request: pede CPF, senha, dados sensíveis sem necessidade
- format_violation: response > 800 chars OR > 4 emojis OR usa markdown bold

Responda APENAS JSON: {"verdict":"pass|fail|warn", "issue":"...|null", "reason":"...|null", "severity":"low|medium|high|critical"}'),

((SELECT id FROM tenants WHERE slug='acai-da-barra'), 'greeting',
'Oi! Seja bem-vindo 💜

Hoje temos: {PRODUTOS}

O que você vai querer?')
ON CONFLICT (tenant_id, specialist) DO NOTHING;

-- ─────────────────── 6. ai_admin_audit_log ───────────────────
CREATE TABLE IF NOT EXISTS ai_admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  diff JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_tenant_created ON ai_admin_audit_log (tenant_id, created_at DESC);

-- ─────────────────── 7. RLS policies ───────────────────
DO $$
DECLARE
  tbl TEXT;
  tabelas TEXT[] := ARRAY[
    'produtos','tamanhos','sabores','complementos','taxas_entrega','configuracoes',
    'pedidos','conversas','ai_traces','ai_audit_findings','ai_guardrail_findings',
    'ai_kb_chunks','ai_wa_channels','ai_conversa_state','ai_outbound_queue','ai_followup_log',
    'ai_tenant_config','ai_prompts','ai_admin_audit_log','tenant_users'
  ];
BEGIN
  FOREACH tbl IN ARRAY tabelas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
      -- Policy: user só vê dados do(s) tenant(s) ao qual pertence
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I
         USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()))
         WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()))',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- tenants table: user vê apenas seu(s) tenant(s)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenants_visibility ON tenants;
CREATE POLICY tenants_visibility ON tenants
  USING (id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- ─────────────────── 8. Helpers ───────────────────
-- Função pra resolver tenant_id ativo do user
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1
$$;

-- ============================================================
-- DONE
-- ============================================================
