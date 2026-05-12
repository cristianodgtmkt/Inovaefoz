/**
 * Queries Supabase reais — substituem mocks de mock.ts/mock2.ts
 * Todas funcoes browser-side via supabaseBrowser (anon key + RLS).
 * Pra writes admin (ai_traces, etc), usar API routes server-side com service key.
 */
import { supabaseBrowser } from './supabase-browser'

// ============================================================
// PEDIDOS
// ============================================================
export interface PedidoRow {
  id: string
  status: string
  telefone_cliente: string | null
  nome_cliente: string | null
  items: any[] | string
  endereco: string | null
  bairro: string | null
  complemento_endereco: string | null
  forma_pagamento: string | null
  troco_para: number | null
  taxa_entrega: number
  total: number
  created_at: string
  updated_at: string
}

export async function fetchPedidos(limit = 200): Promise<PedidoRow[]> {
  const sb = supabaseBrowser()
  const { data, error } = await sb
    .from('pedidos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []).map(p => ({ ...p, items: typeof p.items === 'string' ? JSON.parse(p.items || '[]') : p.items }))
}

export async function updatePedidoStatus(id: string, status: string): Promise<{ ok: boolean; notified?: boolean; notify_error?: string | null }> {
  // Usa endpoint admin que update + notifica cliente automaticamente
  const sb = supabaseBrowser()
  const { data: { session } } = await sb.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('not_authenticated')

  const res = await fetch(`/api/admin/pedidos/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`)
  return j
}

export function subscribePedidos(onChange: () => void) {
  const sb = supabaseBrowser()
  const ch = sb.channel('pedidos-rt')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, onChange)
    .subscribe()
  return () => { sb.removeChannel(ch) }
}

// ============================================================
// CONVERSAS
// ============================================================
export interface ConversaRow {
  id: number | string
  telefone: string
  role: string                    // user | assistant | admin | system
  message: string
  nome_cliente: string | null
  intent: string | null
  agent_used: string | null
  channel: string | null
  created_at: string
}

export async function fetchConversasList(): Promise<{
  telefone: string; nome_cliente: string | null; lastMsg: string; lastTs: string;
  count: number; unread: number; intent: string | null;
}[]> {
  const sb = supabaseBrowser()
  // Pega last msg por telefone
  const { data, error } = await sb
    .from('conversas')
    .select('telefone, nome_cliente, message, intent, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error
  const map = new Map<string, any>()
  for (const r of (data || [])) {
    if (!map.has(r.telefone)) {
      map.set(r.telefone, {
        telefone: r.telefone,
        nome_cliente: r.nome_cliente,
        lastMsg: r.message,
        lastTs: r.created_at,
        count: 1,
        unread: 0,
        intent: r.intent,
      })
    } else {
      map.get(r.telefone).count++
    }
  }
  return Array.from(map.values())
}

export async function fetchConversa(telefone: string, limit = 200): Promise<ConversaRow[]> {
  const sb = supabaseBrowser()
  const { data, error } = await sb
    .from('conversas')
    .select('*')
    .eq('telefone', telefone)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data || []
}

export function subscribeConversas(onChange: () => void) {
  const sb = supabaseBrowser()
  const ch = sb.channel('conversas-rt')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversas' }, onChange)
    .subscribe()
  return () => { sb.removeChannel(ch) }
}

// ============================================================
// CARDÁPIO
// ============================================================
export async function fetchProdutos() {
  const sb = supabaseBrowser()
  const { data, error } = await sb.from('produtos').select('*').order('nome')
  if (error) throw error
  return data || []
}

export async function fetchTamanhos() {
  const sb = supabaseBrowser()
  const { data, error } = await sb.from('tamanhos').select('*').order('preco')
  if (error) throw error
  return data || []
}

export async function fetchSabores() {
  const sb = supabaseBrowser()
  const { data, error } = await sb.from('sabores').select('*').order('nome')
  if (error) throw error
  return data || []
}

export async function fetchComplementos() {
  const sb = supabaseBrowser()
  const { data, error } = await sb.from('complementos').select('*').order('nome')
  if (error) throw error
  return data || []
}

// ============================================================
// TAXAS DE ENTREGA (zonas)
// ============================================================
export async function fetchTaxas() {
  const sb = supabaseBrowser()
  const { data, error } = await sb.from('taxas_entrega').select('*').order('bairro')
  if (error) throw error
  return data || []
}

export async function updateTaxa(id: string, updates: Partial<{ bairro: string; taxa: number; ativo: boolean }>) {
  const sb = supabaseBrowser()
  const { error } = await sb.from('taxas_entrega').update(updates).eq('id', id)
  if (error) throw error
}

export async function createTaxa(bairro: string, taxa: number) {
  const sb = supabaseBrowser()
  const { error } = await sb.from('taxas_entrega').insert({ bairro, taxa, ativo: true })
  if (error) throw error
}

// ============================================================
// CONFIGURACOES (key-value)
// ============================================================
export async function fetchConfiguracoes(): Promise<Record<string, any>> {
  const sb = supabaseBrowser()
  const { data, error } = await sb.from('configuracoes').select('chave, valor')
  if (error) throw error
  const out: Record<string, any> = {}
  for (const r of (data || [])) out[r.chave] = r.valor
  return out
}

export async function setConfiguracao(chave: string, valor: any) {
  const sb = supabaseBrowser()
  const { error } = await sb
    .from('configuracoes')
    .upsert({ chave, valor, updated_at: new Date().toISOString() }, { onConflict: 'chave' })
  if (error) throw error
}

// ============================================================
// AI METRICS (ai_traces, ai_audit_findings, ai_guardrail_findings)
// ============================================================
export async function fetchAiTracesToday() {
  const sb = supabaseBrowser()
  const today = new Date().toISOString().slice(0, 10) + 'T00:00:00'
  const { data, error } = await sb
    .from('ai_traces')
    .select('*')
    .gte('created_at', today)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data || []
}

export async function fetchAiUsageDaily() {
  const sb = supabaseBrowser()
  const { data, error } = await sb.from('v_ai_usage_daily').select('*').limit(14)
  if (error) throw error
  return data || []
}

export async function fetchAiAudit(limit = 20) {
  const sb = supabaseBrowser()
  const { data, error } = await sb
    .from('ai_audit_findings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function fetchAiGuardrails(limit = 20) {
  const sb = supabaseBrowser()
  const { data, error } = await sb
    .from('ai_guardrail_findings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function fetchTenantBudget() {
  const sb = supabaseBrowser()
  const { data, error } = await sb.from('v_tenant_budget').select('*').limit(1).maybeSingle()
  if (error) throw error
  return data
}

// ============================================================
// CLIENTES (deduplicados de pedidos+conversas)
// ============================================================
export async function fetchClientes() {
  const sb = supabaseBrowser()
  // Agrega clientes a partir de pedidos (telefone unico)
  const { data, error } = await sb
    .from('pedidos')
    .select('telefone_cliente, nome_cliente, total, taxa_entrega, created_at, status')
    .order('created_at', { ascending: false })
  if (error) throw error
  const map = new Map<string, any>()
  for (const p of (data || [])) {
    if (!p.telefone_cliente) continue
    const phone = p.telefone_cliente
    if (!map.has(phone)) {
      map.set(phone, {
        phone,
        name: p.nome_cliente || phone,
        orders: 0,
        total: 0,
        last: p.created_at,
        status: 'active',
        tags: [] as string[],
      })
    }
    const c = map.get(phone)
    c.orders++
    c.total += (p.total || 0) + (p.taxa_entrega || 0)
  }
  return Array.from(map.values()).map(c => ({
    ...c,
    ticket: c.orders > 0 ? c.total / c.orders : 0,
    status: c.orders >= 10 ? 'vip' : c.orders <= 1 ? 'new' : 'active',
  }))
}

// ============================================================
// DASHBOARD AGGREGATES
// ============================================================
export async function fetchDashboardStats() {
  const sb = supabaseBrowser()
  const today = new Date().toISOString().slice(0, 10) + 'T00:00:00'
  const yesterday = new Date(Date.now() - 86400_000).toISOString()
  const [
    pedidosHoje, pedidosAtivos, conversasHoje, escalations,
    produtosAtivos, aiTraces, budget,
  ] = await Promise.all([
    sb.from('pedidos').select('id', { count: 'exact', head: true }).gte('created_at', today),
    sb.from('pedidos').select('id', { count: 'exact', head: true })
      .in('status', ['novo_pedido', 'em_preparo', 'pronto_retirar', 'saiu_entrega']),
    sb.from('conversas').select('id', { count: 'exact', head: true }).gte('created_at', yesterday),
    sb.from('conversas').select('id', { count: 'exact', head: true }).eq('intent', 'escalacao'),
    sb.from('produtos').select('id', { count: 'exact', head: true }).eq('ativo', true),
    sb.from('ai_traces').select('id', { count: 'exact', head: true }).gte('created_at', today),
    sb.from('v_tenant_budget').select('*').limit(1).maybeSingle(),
  ])
  return {
    pedidosHoje: pedidosHoje.count || 0,
    pedidosAtivos: pedidosAtivos.count || 0,
    conversasHoje: conversasHoje.count || 0,
    escalations: escalations.count || 0,
    produtosAtivos: produtosAtivos.count || 0,
    aiCallsHoje: aiTraces.count || 0,
    budgetSpentCents: budget.data?.spent_cents || 0,
    budgetCents: budget.data?.budget_cents || 1000,
  }
}
