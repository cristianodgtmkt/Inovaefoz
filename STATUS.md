# Acai-AI — Status

**Última atualização:** 2026-05-11

## Status atual: 🚧 F0 SCAFFOLD

URL alvo: https://acai.inovaefoz.com.br
Container: `acai_ai_app` (network isolada `acai_ai_net`)

## Spec consolidada

| Item | Decisão |
|------|---------|
| Hospedagem | VPS Inovaefoz, container isolado |
| URL | acai.inovaefoz.com.br |
| WhatsApp | Evolution API (mesmo evolution-go) + UI pareamento QR |
| IG/FB | Meta Graph API (multi-canal) |
| DB | Supabase Acai `wrcjemcmpwemjrkwuitc` (cardápio source-of-truth + ai_*) |
| LLM | OpenAI gpt-4o-mini (router/info) + Claude Sonnet (order/objection/complex) + Haiku (auditor) |
| Embeddings | OpenAI text-embedding-3-small (1536d) |
| Pedido | Auto-confirma + notifica admin (554591065390) |
| Budget | R$ 10/dia |
| Extras | followup carrinho, dashboard real-time, relatório diário 09:00 |

## Roadmap

- [ ] F0 — Scaffold + container + DNS + SSL (4h)
- [ ] F1 — Schema migrations + Evolution pair UI (1.5d)
- [ ] F2 — Pipeline 18 agentes (5d)
- [ ] F3 — Webhooks IG + FB (1d)
- [ ] F4 — Followup + dashboard + relatório (3d)
- [ ] F5 — Sentry + smoke E2E + runbook (2d)

## Bloqueadores ativos

1. `OPENAI_API_KEY` — reusar do Wandscheer (já tenho)
2. `ANTHROPIC_API_KEY` — reusar do Wandscheer
3. `SUPABASE_SERVICE_KEY` — preciso pegar no painel Supabase do cliente
4. DNS `acai.inovaefoz.com.br` — adicionar A record no provedor
5. `META_ACCESS_TOKEN` — só pra F3 (IG/FB), não bloqueia F0/F1/F2
