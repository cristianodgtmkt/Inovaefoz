"use client"
import { useEffect, useState } from 'react'
import { Calendar, Download, Info } from 'lucide-react'
import { TENANTS, getTenant } from '@/lib/tenants'
import { fetchPedidos, type PedidoRow } from '@/lib/db/queries'

function aggregateByDay(pedidos: PedidoRow[]) {
  const m = new Map<string, { d: string; pedidos: number; receita: number }>()
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  for (const p of pedidos) {
    const d = new Date(p.created_at)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const dayLabel = dias[d.getDay()]
    if (!m.has(key)) m.set(key, { d: dayLabel, pedidos: 0, receita: 0 })
    const e = m.get(key)!
    e.pedidos++
    e.receita += (p.total || 0) + (p.taxa_entrega || 0)
  }
  return Array.from(m.values()).slice(-7)
}

function aggregateByBairro(pedidos: PedidoRow[]) {
  const m = new Map<string, number>()
  for (const p of pedidos) {
    const b = p.bairro || '—'
    m.set(b, (m.get(b) || 0) + 1)
  }
  return Array.from(m.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
}

export default function RelatoriosPage() {
  const [tenantSlug, setTenantSlug] = useState('acai-da-barra')
  useEffect(() => {
    try { const s = localStorage.getItem('acai_tenant'); if (s && TENANTS[s]) setTenantSlug(s) } catch {}
  }, [])
  const brand = getTenant(tenantSlug)

  const [pedidos, setPedidos] = useState<PedidoRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPedidos(500).then(setPedidos).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const days = aggregateByDay(pedidos)
  const bairros = aggregateByBairro(pedidos)
  const total = pedidos.reduce((s, p) => s + (p.total || 0) + (p.taxa_entrega || 0), 0)
  const ticket = pedidos.length > 0 ? total / pedidos.length : 0
  const maxBarReceita = Math.max(1, ...days.map(d => d.receita))

  return (
    <div className="rel-page">
      <div className="page-head">
        <div>
          <h2>Relatórios</h2>
          <p>
            <b>{pedidos.length}</b> pedidos no período · <b>R$ {total.toFixed(2).replace('.', ',')}</b> em vendas · ticket médio <b>R$ {ticket.toFixed(2).replace('.', ',')}</b>
          </p>
        </div>
        <div className="page-head-right">
          <button className="btn btn-soft"><Calendar size={14} />Período</button>
          <button className="btn btn-soft"><Download size={14} />Exportar PDF</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, color: '#94a3b8' }}>Carregando…</div>
      ) : pedidos.length === 0 ? (
        <div className="banner banner-info">
          <Info size={15} />
          <span>Sem dados ainda. Relatórios aparecem quando começarem a chegar pedidos via WhatsApp.</span>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head"><div className="card-h">Pedidos e receita por dia (últimos 7)</div></div>
            <div className="rel-bars">
              {days.map((d, i) => (
                <div key={i} className="rel-bar-col">
                  <div className="rel-bar-stack">
                    <div className="rel-bar rel-bar-receita" style={{ height: (d.receita / maxBarReceita * 100) + '%', background: brand.brandPrimary }}>
                      <span className="rel-bar-val">R$ {d.receita.toFixed(0)}</span>
                    </div>
                  </div>
                  <div className="rel-bar-l">{d.d}</div>
                  <div className="rel-bar-sub">{d.pedidos} ped.</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><div className="card-h">Top bairros</div></div>
            <div className="rel-bairros">
              {bairros.map((b, i) => {
                const pct = (b.value / bairros[0].value) * 100
                return (
                  <div key={b.name} className="rel-bairro-row">
                    <span className="rel-bairro-rank">#{i + 1}</span>
                    <span className="rel-bairro-name">{b.name}</span>
                    <div className="rel-bairro-bar">
                      <div className="rel-bairro-fill" style={{ width: pct + '%', background: brand.brandPrimary }}></div>
                    </div>
                    <span className="rel-bairro-v"><b>{b.value}</b> pedidos</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
