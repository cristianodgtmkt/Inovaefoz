"use client"
import { useEffect, useState } from 'react'
import { Filter, Clock, AlertOctagon, TriangleAlert, MessageSquare, Headphones, Info } from 'lucide-react'
import Link from 'next/link'
import { TENANTS, getTenant } from '@/lib/tenants'
import { fetchConversasList } from '@/lib/db/queries'

function timeAgo(iso: string) {
  if (!iso) return ''
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${m}min`
  return `${Math.floor(m / 60)}h ${m % 60}min`
}

export default function EscalacoesPage() {
  const [tenantSlug, setTenantSlug] = useState('acai-da-barra')
  useEffect(() => {
    try { const s = localStorage.getItem('acai_tenant'); if (s && TENANTS[s]) setTenantSlug(s) } catch {}
  }, [])
  const brand = getTenant(tenantSlug)

  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConversasList()
      .then(list => setItems(list.filter(c => c.intent === 'escalacao')))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="esc-page">
      <div className="page-head">
        <div>
          <h2>Escalações</h2>
          <p><b>{items.length}</b> aguardando atendimento humano</p>
        </div>
        <div className="page-head-right">
          <button className="btn btn-soft"><Filter size={14} />Por motivo</button>
          <button className="btn btn-soft"><Clock size={14} />Por idade</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, color: '#94a3b8' }}>Carregando…</div>
      ) : items.length === 0 ? (
        <div className="banner banner-info">
          <Info size={15} />
          <span>Nenhuma escalação aberta. Quando IA encontrar caso fora do escopo, aparece aqui.</span>
        </div>
      ) : (
        <div className="esc-list">
          {items.map(e => (
            <article key={e.telefone} className="esc-card" data-priority="normal">
              <div className="esc-card-l">
                <div className="esc-meta">
                  <span className="esc-prio esc-prio-normal"><TriangleAlert size={11} />Normal</span>
                  <span className="esc-motivo">Escalação IA → humano</span>
                  <span className="esc-aberta">aberta há <b>{timeAgo(e.lastTs)}</b></span>
                </div>
                <div className="esc-customer">
                  <span className="cv-avatar" style={{ background: '#cbd5e1', width: 28, height: 28, fontSize: 10 }}>
                    {(e.nome_cliente || e.telefone).slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <div className="esc-name">{e.nome_cliente || 'Sem nome'}</div>
                    <div className="esc-phone">{e.telefone}</div>
                  </div>
                </div>
                <p className="esc-preview">"{e.lastMsg}"</p>
              </div>
              <div className="esc-actions">
                <Link href={`/admin/conversas`} className="btn btn-soft btn-sm">
                  <MessageSquare size={13} />Abrir conversa
                </Link>
                <button className="btn btn-primary btn-sm" style={{ background: brand.brandPrimary }}>
                  <Headphones size={13} />Atender agora
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
