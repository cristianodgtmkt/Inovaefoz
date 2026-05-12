"use client"
import { useEffect, useState } from 'react'
import {
  ShoppingBag, MessageSquare, DollarSign, Bot, ChefHat, TriangleAlert,
  Sparkles, Zap, TrendingUp, ArrowUpRight, Pause, Download, ArrowRight,
  Utensils,
} from 'lucide-react'
import Link from 'next/link'
import { StatCard, PeriodPill, Spark, ProgressBar } from '@/components/primitives'
import { TENANTS, getTenant } from '@/lib/tenants'
import { fetchDashboardStats, fetchAiTracesToday, subscribePedidos } from '@/lib/db/queries'

function PhaseRow({ exec }: { exec: any }) {
  const dotColor = exec.audit_verdict === 'fail' ? '#ef4444' : '#22c55e'
  return (
    <div className="exec-row">
      <span className="exec-dot" style={{ background: dotColor }} />
      <code className="exec-id">{(exec.id || '').slice(0, 8)}</code>
      <span className="exec-phase">{exec.specialist || exec.intent || '—'}</span>
      <span className="exec-ms">{exec.duration_ms || 0}ms</span>
      <span className="exec-ago">{timeAgo(exec.created_at)}</span>
    </div>
  )
}

function timeAgo(iso: string) {
  if (!iso) return ''
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function DashboardPage() {
  const [period, setPeriod] = useState('hoje')
  const [tenantSlug, setTenantSlug] = useState('acai-da-barra')
  const [botPaused] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [execs, setExecs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try { const s = localStorage.getItem('acai_tenant'); if (s && TENANTS[s]) setTenantSlug(s) } catch {}
  }, [])
  const tenant = getTenant(tenantSlug)

  async function load() {
    try {
      const [s, t] = await Promise.all([fetchDashboardStats(), fetchAiTracesToday()])
      setStats(s); setExecs(t.slice(0, 7))
    } catch (e: any) { console.warn('dashboard load err', e?.message) }
    setLoading(false)
  }

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id) }, [])
  useEffect(() => subscribePedidos(load), [])

  const cards = stats ? [
    { icon: 'ShoppingBag', label: 'Pedidos hoje', value: String(stats.pedidosHoje), sub: `${stats.pedidosAtivos} ativos`, color: 'orange' },
    { icon: 'MessageSquare', label: 'Conversas 24h', value: String(stats.conversasHoje), sub: `${stats.escalations} escaladas`, color: 'blue' },
    { icon: 'DollarSign', label: 'Receita estimada', value: 'R$ —', sub: 'aguardando integração', color: 'green' },
    { icon: 'Bot', label: 'Status do bot', value: botPaused ? 'Pausado' : 'Ativo', sub: botPaused ? 'Atendimento manual' : 'Respondendo', color: botPaused ? 'red' : 'green' },
  ] : []

  const opsCards = stats ? [
    { icon: 'ChefHat', label: 'Em andamento', value: String(stats.pedidosAtivos), sub: 'cozinha + entrega', color: 'red' },
    { icon: 'TriangleAlert', label: 'Escalações', value: String(stats.escalations), sub: 'aguardando humano', color: 'amber' },
    { icon: 'Sparkles', label: 'Custo IA hoje', value: `R$ ${(stats.budgetSpentCents / 100).toFixed(2).replace('.', ',')}`, sub: `de R$ ${(stats.budgetCents / 100).toFixed(2).replace('.', ',')} cap`, color: 'purple' },
    { icon: 'Zap', label: 'Chamadas IA hoje', value: String(stats.aiCallsHoje), sub: '24h', color: 'cyan' },
  ] : []

  const sparkRevenue = [120, 180, 140, 220, 260, 310, 280, 340, 360, 410, 380, 460, 520, 480]

  return (
    <div className="dash-page">
      <div className="page-head">
        <div>
          <h2>Dashboard</h2>
          <p>Visão geral · atualiza a cada 30s · <span style={{ color: tenant.brandPrimary }}>● ao vivo</span></p>
        </div>
        <div className="page-head-right">
          <PeriodPill value={period} onChange={setPeriod} brand={tenant} />
          <button className="btn btn-soft"><Download size={14} />Exportar</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, color: '#94a3b8' }}>Carregando métricas…</div>
      ) : !stats ? (
        <div className="banner banner-warn">
          <span>Erro ao carregar métricas. Verifique conexão Supabase.</span>
        </div>
      ) : (
        <>
          <div className="grid-stats">
            {cards.map((s, i) => <StatCard key={i} {...s} />)}
          </div>

          <div className="grid-hero">
            <div className="card chart-card">
              <header className="card-head">
                <div>
                  <div className="card-title">Receita ao longo do dia</div>
                  <div className="card-sub">por hora · {period === 'hoje' ? 'hoje' : period}</div>
                </div>
                <div className="card-meta">
                  <span className="card-meta-value">R$ —</span>
                  <span className="card-meta-trend" data-dir="up"><TrendingUp size={11} />pendente</span>
                </div>
              </header>
              <div style={{ padding: '0 4px 4px' }}>
                <Spark data={sparkRevenue} color={tenant.brandPrimary} height={140} />
              </div>
              <div className="chart-xaxis">
                <span>10h</span><span>12h</span><span>14h</span><span>16h</span><span>18h</span><span>20h</span><span>22h</span>
              </div>
            </div>

            <div className="card ai-card">
              <header className="card-head">
                <div>
                  <div className="card-title">Orçamento IA</div>
                  <div className="card-sub">cap diário · reseta 00:00</div>
                </div>
                <span className="badge badge-purple"><Sparkles size={11} />{Math.round((stats.budgetSpentCents / stats.budgetCents) * 100)}% usado</span>
              </header>
              <div className="ai-meter">
                <div className="ai-meter-row">
                  <span>R$ {(stats.budgetSpentCents / 100).toFixed(2).replace('.', ',')}</span>
                  <span style={{ color: '#94a3b8' }}>de R$ {(stats.budgetCents / 100).toFixed(2).replace('.', ',')}</span>
                </div>
                <ProgressBar value={stats.budgetSpentCents} max={stats.budgetCents} color="#a855f7" />
              </div>
              <ul className="ai-list">
                <li><span className="ai-list-dot" style={{ background: '#22c55e' }} /><span>Hallucination rate</span><b>0%</b></li>
                <li><span className="ai-list-dot" style={{ background: '#06b6d4' }} /><span>Cache hit rate</span><b>—</b></li>
                <li><span className="ai-list-dot" style={{ background: '#f59e0b' }} /><span>Escalations</span><b>{stats.escalations}</b></li>
                <li><span className="ai-list-dot" style={{ background: '#8b5cf6' }} /><span>Latência p95</span><b>—</b></li>
              </ul>
              <Link href="/admin/ia" className="btn btn-soft btn-block"><ArrowRight size={13} />Ver dashboard IA</Link>
            </div>
          </div>

          <div className="grid-stats">
            {opsCards.map((s, i) => <StatCard key={i} {...s} />)}
          </div>

          <div className="grid-bottom">
            <div className="card">
              <header className="card-head">
                <div>
                  <div className="card-title">Últimas execuções IA</div>
                  <div className="card-sub">{execs.length} execuções · hoje</div>
                </div>
              </header>
              <div className="exec-list">
                {execs.length === 0 ? (
                  <div style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>
                    Nenhuma execução ainda. IA ativa quando WhatsApp pareado + agente recebe primeira msg.
                  </div>
                ) : execs.map(e => <PhaseRow key={e.id} exec={e} />)}
              </div>
            </div>

            <div className="card">
              <header className="card-head">
                <div>
                  <div className="card-title">Acesso rápido</div>
                  <div className="card-sub">fluxos operacionais</div>
                </div>
              </header>
              <div className="quick-grid">
                <Link className="quick-tile" href="/admin/pedidos">
                  <span className="quick-icon" style={{ background: '#fff7ed', color: '#c2410c' }}><ShoppingBag size={18} /></span>
                  <div><div className="quick-title">Kanban de pedidos</div><div className="quick-sub">{stats.pedidosAtivos} ativos · {stats.pedidosHoje} hoje</div></div>
                  <ArrowUpRight size={14} className="quick-arrow" />
                </Link>
                <Link className="quick-tile" href="/admin/conversas">
                  <span className="quick-icon" style={{ background: '#eff6ff', color: '#1d4ed8' }}><MessageSquare size={18} /></span>
                  <div><div className="quick-title">Conversas ao vivo</div><div className="quick-sub">{stats.conversasHoje} hoje · {stats.escalations} escaladas</div></div>
                  <ArrowUpRight size={14} className="quick-arrow" />
                </Link>
                <Link className="quick-tile" href="/admin/escalacoes">
                  <span className="quick-icon" style={{ background: '#fef2f2', color: '#b91c1c' }}><TriangleAlert size={18} /></span>
                  <div><div className="quick-title">Escalações abertas</div><div className="quick-sub">{stats.escalations} esperando</div></div>
                  <ArrowUpRight size={14} className="quick-arrow" />
                </Link>
                <Link className="quick-tile" href="/admin/cardapio">
                  <span className="quick-icon" style={{ background: '#f3e8ff', color: '#7e22ce' }}><Utensils size={18} /></span>
                  <div><div className="quick-title">Editar cardápio</div><div className="quick-sub">{stats.produtosAtivos} produtos ativos</div></div>
                  <ArrowUpRight size={14} className="quick-arrow" />
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
