"use client"
import { useEffect, useMemo, useState } from 'react'
import { Search, Download, UserPlus, Crown, ChevronRight, X, MapPin, Sparkles, MessageSquare, Phone, Info } from 'lucide-react'
import { TENANTS, getTenant } from '@/lib/tenants'
import { fetchClientes } from '@/lib/db/queries'

function ClienteDrawer({ cliente, onClose, brand }: any) {
  return (
    <>
      <div className="drawer-overlay" onClick={onClose}></div>
      <aside className="drawer">
        <header className="drawer-head">
          <span className="cv-avatar" style={{
            background: cliente.status === 'vip' ? brand.brandPrimary : '#cbd5e1',
            width: 48, height: 48, fontSize: 16,
          }}>{cliente.name.split(' ').map((p: string) => p[0]).slice(0, 2).join('')}</span>
          <div className="drawer-head-text">
            <div className="drawer-name">{cliente.name}</div>
            <div className="drawer-sub">{cliente.phone}</div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </header>

        <div className="drawer-stats">
          <div><span className="drawer-stat-v">{cliente.orders}</span><span className="drawer-stat-l">pedidos</span></div>
          <div><span className="drawer-stat-v">R$ {cliente.ticket.toFixed(2).replace('.', ',')}</span><span className="drawer-stat-l">ticket médio</span></div>
          <div><span className="drawer-stat-v">R$ {cliente.total.toFixed(0)}</span><span className="drawer-stat-l">LTV</span></div>
        </div>

        <div className="drawer-section">
          <div className="drawer-section-title">Endereços</div>
          <div className="drawer-addr">
            <MapPin size={14} />
            <div>
              <div className="muted">Aguardando integração com endereços salvos</div>
            </div>
          </div>
        </div>

        <footer className="drawer-foot">
          <button className="btn btn-soft"><MessageSquare size={14} />Abrir conversa</button>
          <button className="btn btn-primary" style={{ background: brand.brandPrimary }}>
            <Phone size={14} />Ligar
          </button>
        </footer>
      </aside>
    </>
  )
}

export default function ClientesPage() {
  const [tenantSlug, setTenantSlug] = useState('acai-da-barra')
  useEffect(() => {
    try { const s = localStorage.getItem('acai_tenant'); if (s && TENANTS[s]) setTenantSlug(s) } catch {}
  }, [])
  const brand = getTenant(tenantSlug)

  const [all, setAll] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'vip' | 'new'>('all')
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => {
    fetchClientes().then(setAll).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => all.filter(c => {
    if (filter === 'vip' && c.status !== 'vip') return false
    if (filter === 'new' && c.status !== 'new') return false
    if (q && !c.name.toLowerCase().includes(q.toLowerCase()) && !c.phone.includes(q)) return false
    return true
  }), [q, filter, all])

  const stats = {
    total: all.length,
    vip: all.filter(c => c.status === 'vip').length,
    new: all.filter(c => c.status === 'new').length,
    ticketMedio: all.length ? (all.reduce((s, c) => s + c.ticket, 0) / all.length).toFixed(2) : '0,00',
  }

  return (
    <div className="cli-page">
      <div className="page-head">
        <div>
          <h2>Clientes</h2>
          <p><b>{stats.total}</b> clientes · <b>{stats.vip}</b> VIPs · ticket médio <b>R$ {stats.ticketMedio.replace('.', ',')}</b></p>
        </div>
        <div className="page-head-right">
          <button className="btn btn-soft"><Download size={14} />Exportar CSV</button>
          <button className="btn btn-primary" style={{ background: brand.brandPrimary }}>
            <UserPlus size={14} />Novo cliente
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, color: '#94a3b8' }}>Carregando…</div>
      ) : all.length === 0 ? (
        <div className="banner banner-info">
          <Info size={15} />
          <span>Nenhum cliente ainda. Clientes aparecem automaticamente após primeiro pedido.</span>
        </div>
      ) : (
        <>
          <div className="cli-toolbar">
            <div className="cli-search">
              <Search size={14} />
              <input placeholder="Buscar por nome ou telefone..." value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div className="cli-tabs">
              {[
                { id: 'all' as const, label: `Todos · ${stats.total}` },
                { id: 'vip' as const, label: `VIPs · ${stats.vip}` },
                { id: 'new' as const, label: `Novos · ${stats.new}` },
              ].map(t => (
                <button key={t.id} className="cli-tab"
                  data-active={filter === t.id || undefined}
                  onClick={() => setFilter(t.id)}
                  style={filter === t.id ? { color: brand.brandPrimary, borderColor: brand.brandPrimary } : {}}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cli-table">
            <div className="cli-thead">
              <span>Cliente</span><span>Telefone</span>
              <span className="ta-r">Pedidos</span><span className="ta-r">Ticket</span>
              <span>Último</span><span>Status</span><span></span>
            </div>
            {filtered.map(c => (
              <div key={c.phone} className="cli-row" onClick={() => setSelected(c)}>
                <div className="cli-cell-name">
                  <span className="cv-avatar" style={{
                    background: c.status === 'vip' ? brand.brandPrimary : '#cbd5e1',
                    width: 32, height: 32, fontSize: 11,
                  }}>{c.name.split(' ').map((p: string) => p[0]).slice(0, 2).join('')}</span>
                  <div>
                    <div className="cli-name">{c.name}</div>
                    {c.status === 'vip' && <div className="cli-vip"><Crown size={10} />VIP</div>}
                    {c.status === 'new' && <div className="cli-new">Novo</div>}
                  </div>
                </div>
                <span className="cli-cell-phone">{c.phone}</span>
                <span className="ta-r"><b>{c.orders}</b></span>
                <span className="ta-r">R$ {c.ticket.toFixed(2).replace('.', ',')}</span>
                <span className="cli-cell-last">{new Date(c.last).toLocaleDateString('pt-BR')}</span>
                <span className="cli-cell-tags"><span className="cli-chip">{c.status}</span></span>
                <span className="cli-cell-arrow"><ChevronRight size={14} /></span>
              </div>
            ))}
          </div>
        </>
      )}

      {selected && <ClienteDrawer cliente={selected} onClose={() => setSelected(null)} brand={brand} />}
    </div>
  )
}
