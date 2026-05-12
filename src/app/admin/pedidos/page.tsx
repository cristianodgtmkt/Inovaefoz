"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Package, QrCode, CreditCard, Banknote, Wallet, Bot, ChevronUp, ChevronDown,
  MapPin, StickyNote, Printer, MessageSquare, ArrowRight, Filter, RefreshCw, Plus,
  Inbox, BellRing, X, CheckCircle2, AlertTriangle, Info, MessageCircle,
} from 'lucide-react'
import { TENANTS, getTenant } from '@/lib/tenants'
import { fetchPedidos, updatePedidoStatus, subscribePedidos, fetchConversa, type PedidoRow, type ConversaRow } from '@/lib/db/queries'
import { printCoupon } from '@/lib/utils/print-coupon'

// Cards UI: Bot section + Cozinha section, status REAL do admin Vercel
const COLS_BOT = [
  { id: 'coletando', label: 'Coletando', hex: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
  { id: 'aguardando', label: 'Aguardando', hex: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
]

const COLS_KITCHEN = [
  { id: 'novo_pedido', label: 'Novo pedido', hex: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'em_preparo', label: 'Em preparo', hex: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  { id: 'pronto_retirar', label: 'Pronto', hex: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  { id: 'saiu_entrega', label: 'Saiu entrega', hex: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
  { id: 'entregue', label: 'Entregue', hex: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
]

const COLS_ALL = [...COLS_BOT, ...COLS_KITCHEN]

function paymentMeta(p: string | null) {
  switch ((p || '').toLowerCase()) {
    case 'pix': return { Icon: QrCode, label: 'PIX' }
    case 'cartao': case 'cartão': return { Icon: CreditCard, label: 'Cartão' }
    case 'dinheiro': return { Icon: Banknote, label: 'Dinheiro' }
    default: return { Icon: Wallet, label: '—' }
  }
}

function fmtBRL(n: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0) }
function timeAgo(iso: string) {
  if (!iso) return ''
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  return `há ${h}h ${min % 60}min`
}

function OrderCard({ order, col, expanded, onToggle, brand, dragging, onDragStart, onDragEnd, onOpenChat }: any) {
  const pm = paymentMeta(order.forma_pagamento)
  const PMIcon = pm.Icon
  const items = Array.isArray(order.items) ? order.items : []
  const itemCount = items.reduce((a: number, b: any) => a + (b.quantidade || b.qty || 1), 0)
  const isBot = col.id === 'coletando' || col.id === 'aguardando'

  return (
    <article
      className="ocard"
      data-expanded={expanded || undefined}
      data-dragging={dragging || undefined}
      draggable={!expanded}
      onDragStart={(e: React.DragEvent) => { if (expanded) return e.preventDefault(); onDragStart(order, e) }}
      onDragEnd={onDragEnd}
      style={expanded ? { borderColor: brand.brandBorder, boxShadow: `0 0 0 1px ${brand.brandBorder}, 0 4px 12px -2px rgba(15,23,42,0.08)` } : {}}
    >
      <header className="ocard-head" onClick={() => onToggle(order.id)}>
        <div className="ocard-customer">
          <div className="ocard-name">{order.nome_cliente || order.telefone_cliente || 'Cliente'}</div>
          <div className="ocard-phone">{order.telefone_cliente}</div>
        </div>
        <div className="ocard-meta">
          <div className="ocard-id" style={{ color: brand.brandPrimary }}>#{(order.id || '').slice(0, 6)}</div>
          {expanded ? <ChevronUp size={14} className="ocard-chev" /> : <ChevronDown size={14} className="ocard-chev" />}
        </div>
      </header>
      <div className="ocard-row">
        <span className="ocard-pill"><Package size={11} />{itemCount} {itemCount > 1 ? 'itens' : 'item'}</span>
        {!isBot && order.total > 0 && <span className="ocard-pill ocard-pill-money">{fmtBRL(order.total)}</span>}
        {!isBot && <span className="ocard-pill"><PMIcon size={11} />{pm.label}</span>}
        {isBot && <span className="ocard-pill ocard-pill-bot"><Bot size={11} />IA</span>}
        <span className="ocard-time">{timeAgo(order.created_at)}</span>
      </div>

      {expanded && (
        <div className="ocard-body">
          <section className="ocard-section">
            <div className="ocard-section-title">Itens</div>
            <ul className="ocard-items">
              {items.map((it: any, i: number) => {
                const sabores = Array.isArray(it.sabores) ? it.sabores.filter(Boolean) : []
                const complementos = Array.isArray(it.complementos) ? it.complementos.filter(Boolean) : []
                return (
                  <li key={i} className="ocard-item">
                    <div className="ocard-item-line">
                      <span className="ocard-item-qty">{it.quantidade || it.qty || 1}×</span>
                      <span className="ocard-item-name">{it.nome || it.name || JSON.stringify(it)}</span>
                      <span className="ocard-item-price">{fmtBRL(it.preco_total || it.preco || it.price || 0)}</span>
                    </div>
                    {sabores.length > 0 && (
                      <div className="ocard-item-sub"><b>Sabores:</b> {sabores.join(', ')}</div>
                    )}
                    {complementos.length > 0 && (
                      <div className="ocard-item-sub"><b>Complementos:</b> {complementos.join(', ')}</div>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="ocard-totals">
              <div><span>Subtotal</span><span>{fmtBRL(order.total)}</span></div>
              <div><span>Taxa de entrega</span><span>{fmtBRL(order.taxa_entrega || 0)}</span></div>
              <div className="ocard-totals-grand"><span>Total</span><span>{fmtBRL((order.total || 0) + (order.taxa_entrega || 0))}</span></div>
            </div>
          </section>

          <section className="ocard-section">
            <div className="ocard-section-title">Entrega</div>
            <div className="ocard-addr">
              <MapPin size={13} />
              <div>
                <div>{order.endereco || '—'}{order.complemento_endereco ? ` · ${order.complemento_endereco}` : ''}</div>
                <div className="ocard-addr-bairro">{order.bairro || '—'}</div>
              </div>
            </div>
          </section>

          <section className="ocard-section">
            <div className="ocard-section-title">Pagamento</div>
            <div className="ocard-payment">
              <PMIcon size={13} />
              <span>{pm.label}</span>
              {(order.forma_pagamento || '').toLowerCase() === 'dinheiro' && (
                order.troco_para && Number(order.troco_para) > 0
                  ? <span className="ocard-troco">· troco para {fmtBRL(order.troco_para)}</span>
                  : <span className="ocard-troco">· sem troco (valor exato)</span>
              )}
            </div>
          </section>

          <div className="ocard-actions">
            <button className="btn btn-soft" onClick={() => printCoupon(order, brand.name)}><Printer size={13} />Imprimir</button>
            <button className="btn btn-soft" onClick={() => onOpenChat(order)}><MessageSquare size={13} />Conversa</button>
          </div>
        </div>
      )}
    </article>
  )
}

function ChatDrawer({ open, order, onClose }: { open: boolean; order: PedidoRow | null; onClose: () => void }) {
  const [msgs, setMsgs] = useState<ConversaRow[]>([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open || !order?.telefone_cliente) return
    setLoading(true)
    fetchConversa(order.telefone_cliente, 200)
      .then(d => {
        // fetchConversa retorna DESC. Inverter pra ASC (oldest top, newest bottom).
        const sorted = d.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        setMsgs(sorted)
      })
      .catch(() => setMsgs([]))
      .finally(() => setLoading(false))
  }, [open, order?.telefone_cliente])
  useEffect(() => {
    if (msgs.length > 0) bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [msgs.length])
  if (!open || !order) return null
  return (
    <div className="chat-drawer-overlay" onClick={onClose}>
      <aside className="chat-drawer" onClick={e => e.stopPropagation()}>
        <header className="chat-drawer-head">
          <div>
            <div className="chat-drawer-name">{order.nome_cliente || 'Cliente'}</div>
            <div className="chat-drawer-phone">{order.telefone_cliente}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="chat-drawer-body">
          {loading ? (
            <div className="chat-drawer-empty">Carregando…</div>
          ) : msgs.length === 0 ? (
            <div className="chat-drawer-empty">Sem mensagens</div>
          ) : (
            <>
              {msgs.map(m => (
                <div key={m.id} className={`chat-bubble chat-${m.role || (m.agent_used ? 'assistant' : 'user')}`}>
                  <div className="chat-bubble-text">{m.message}</div>
                  <div className="chat-bubble-ts">
                    {new Date(m.created_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

function KanbanColumn({ col, orders, expandedId, onToggle, brand, dragOver, onDragOver, onDragLeave, onDrop, onDragStart, onDragEnd, dragId, onOpenChat }: any) {
  return (
    <div className="kcol" data-dragover={dragOver || undefined}
      onDragOver={(e: React.DragEvent) => { e.preventDefault(); onDragOver(col.id) }}
      onDragLeave={() => onDragLeave(col.id)}
      onDrop={(e: React.DragEvent) => { e.preventDefault(); onDrop(col.id) }}
    >
      <header className="kcol-head" style={{ background: col.bg, borderColor: col.border }}>
        <span className="kcol-dot" style={{ background: col.hex }} />
        <span className="kcol-label" style={{ color: col.hex }}>{col.label}</span>
        <span className="kcol-count" style={{ background: 'white', color: col.hex, borderColor: col.border }}>{orders.length}</span>
      </header>
      <div className="kcol-body">
        {orders.length === 0 ? (
          <div className="kcol-empty"><Inbox size={20} /><span>Arraste aqui</span></div>
        ) : orders.map((o: PedidoRow) => (
          <OrderCard key={o.id} order={o} col={col}
            expanded={expandedId === o.id} onToggle={onToggle} brand={brand}
            dragging={dragId === o.id} onDragStart={onDragStart} onDragEnd={onDragEnd}
            onOpenChat={onOpenChat}
          />
        ))}
      </div>
    </div>
  )
}

function KanbanToast({ toast }: { toast: any }) {
  if (!toast) return null
  const Comp = toast.kind === 'success' ? CheckCircle2 : toast.kind === 'warn' ? AlertTriangle : Info
  return <div className="toast" data-kind={toast.kind}><Comp size={16} /><span>{toast.text}</span></div>
}

export default function PedidosPage() {
  const [tenantSlug, setTenantSlug] = useState('acai-da-barra')
  useEffect(() => {
    try { const s = localStorage.getItem('acai_tenant'); if (s && TENANTS[s]) setTenantSlug(s) } catch {}
  }, [])
  const brand = getTenant(tenantSlug)

  const [orders, setOrders] = useState<PedidoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [toast, setToast] = useState<any>(null)
  const [chatOrder, setChatOrder] = useState<PedidoRow | null>(null)

  async function load() {
    try { setOrders(await fetchPedidos(200)) }
    catch (e: any) { console.warn('pedidos load err', e?.message) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => subscribePedidos(load), [])

  const cols = COLS_ALL
  const byCol = useMemo(() => {
    const m: Record<string, PedidoRow[]> = {}
    cols.forEach(c => m[c.id] = [])
    orders.forEach(o => { if (m[o.status]) m[o.status].push(o) })
    return m
  }, [orders])

  const inKitchen = orders.filter(o => ['novo_pedido', 'em_preparo', 'pronto_retirar', 'saiu_entrega'].includes(o.status)).length
  const revenueToday = orders
    .filter(o => !['cancelado', 'coletando', 'aguardando'].includes(o.status))
    .reduce((s, o) => s + (o.total || 0) + (o.taxa_entrega || 0), 0)

  function onDragStart(order: PedidoRow, e: React.DragEvent) {
    setDragId(order.id)
    if (e?.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      try { e.dataTransfer.setData('text/plain', order.id) } catch {}
    }
  }
  function onDragEnd() { setDragId(null); setDragOverCol(null) }
  function onDragOver(colId: string) { setDragOverCol(colId) }
  function onDragLeave(colId: string) { setDragOverCol(c => c === colId ? null : c) }
  async function onDrop(colId: string) {
    if (!dragId) return
    const order = orders.find(o => o.id === dragId)
    if (!order || order.status === colId) { setDragId(null); setDragOverCol(null); return }
    // optimistic
    setOrders(prev => prev.map(o => o.id === dragId ? { ...o, status: colId } : o))
    setDragId(null); setDragOverCol(null)
    try {
      await updatePedidoStatus(order.id, colId)
      const col = cols.find(c => c.id === colId)
      const auto = ['em_preparo', 'saiu_entrega', 'entregue'].includes(colId)
      setToast({
        kind: auto ? 'success' : 'info',
        text: auto ? `Movido para "${col?.label}" · mensagem enviada via WhatsApp` : `Movido para "${col?.label}"`,
      })
    } catch (e: any) {
      // revert
      setOrders(prev => prev.map(o => o.id === order.id ? order : o))
      setToast({ kind: 'warn', text: `Falha ao mover: ${e?.message || 'erro'}` })
    }
    setTimeout(() => setToast(null), 4000)
  }
  function onToggle(id: string) { setExpandedId(prev => prev === id ? null : id) }

  return (
    <div className="pedidos-page">
      <div className="page-head">
        <div>
          <h2>Pedidos</h2>
          <p>
            <b>{inKitchen}</b> na cozinha · Receita estimada <b>{fmtBRL(revenueToday)}</b> ·{' '}
            <MessageCircle size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            Ao mover, envia mensagem automática
          </p>
        </div>
        <div className="page-head-right">
          <button className="btn btn-ghost"><Filter size={14} />Filtros</button>
          <button className="btn btn-ghost" onClick={load}><RefreshCw size={14} />Atualizar</button>
          <button className="btn btn-primary" style={{ background: brand.brandPrimary }}>
            <Plus size={14} />Novo pedido manual
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, color: '#94a3b8' }}>Carregando pedidos…</div>
      ) : orders.length === 0 ? (
        <div className="banner banner-info">
          <Info size={15} />
          <span>Nenhum pedido ainda. Pareie WhatsApp + ative IA para começar a receber pedidos automaticamente.</span>
        </div>
      ) : (
        <div className="kanban">
          <section className="ksection ksection-bot">
            <div className="ksection-head">
              <div className="ksection-title">
                <span className="ksection-emoji">🤖</span>
                <span>Bot · Pré-pedido</span>
              </div>
              <div className="ksection-meta">{(byCol.coletando.length + byCol.aguardando.length)} em fluxo</div>
            </div>
            <div className="kcols">
              {COLS_BOT.map(col => (
                <KanbanColumn key={col.id} col={col} orders={byCol[col.id]} expandedId={expandedId}
                  onToggle={onToggle} brand={brand}
                  dragOver={dragOverCol === col.id}
                  onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                  onDragStart={onDragStart} onDragEnd={onDragEnd} dragId={dragId}
                  onOpenChat={setChatOrder}
                />
              ))}
            </div>
          </section>

          <div className="ksection-divider" aria-hidden="true" />

          <section className="ksection ksection-kitchen">
            <div className="ksection-head">
              <div className="ksection-title">
                <span className="ksection-emoji">👨‍🍳</span>
                <span>Cozinha · Operação</span>
              </div>
              <div className="ksection-meta">{inKitchen} ativos · {byCol.entregue.length} entregues hoje</div>
            </div>
            <div className="kcols kcols-kitchen">
              {COLS_KITCHEN.map(col => (
                <KanbanColumn key={col.id} col={col} orders={byCol[col.id]} expandedId={expandedId}
                  onToggle={onToggle} brand={brand}
                  dragOver={dragOverCol === col.id}
                  onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                  onDragStart={onDragStart} onDragEnd={onDragEnd} dragId={dragId}
                  onOpenChat={setChatOrder}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      <KanbanToast toast={toast} />
      <ChatDrawer open={!!chatOrder} order={chatOrder} onClose={() => setChatOrder(null)} />
    </div>
  )
}
