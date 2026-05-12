"use client"
import { useEffect, useRef, useState } from 'react'
import {
  Search, ShoppingBag, TriangleAlert, Bot, Pause, Play, MoreVertical, Paperclip,
  Sparkles, Send, Filter, Archive, UserPlus, User as UserIcon,
  CheckCircle2, AlertTriangle, Info,
} from 'lucide-react'
import { TENANTS, getTenant } from '@/lib/tenants'
import { fetchConversasList, fetchConversa, subscribeConversas, type ConversaRow } from '@/lib/db/queries'
import { supabaseBrowser } from '@/lib/db/supabase-browser'

function avatar(s: string) { return (s || '?').slice(0, 2).toUpperCase() }
function colorFor(s: string) {
  const palette = ['#7e22ce', '#dc2626', '#0891b2', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899']
  let h = 0
  for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}
function timeAgo(iso: string) {
  if (!iso) return ''
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
function fmtTs(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function ConvCard({ conv, selected, onClick, brand }: any) {
  return (
    <button className="cv-item" data-selected={selected || undefined}
      onClick={() => onClick(conv.telefone)}
      style={selected ? { borderLeftColor: brand.brandPrimary } : {}}
    >
      <span className="cv-avatar" style={{ background: colorFor(conv.telefone) }}>
        {avatar(conv.nome_cliente || conv.telefone)}
      </span>
      <span className="cv-text">
        <span className="cv-top">
          <span className="cv-name">{conv.nome_cliente || conv.telefone}</span>
          <span className="cv-time">{timeAgo(conv.lastTs)}</span>
        </span>
        <span className="cv-bottom">
          <span className="cv-preview">{conv.lastMsg}</span>
        </span>
        <span className="cv-tags">
          {conv.intent === 'escalacao' && <span className="cv-tag cv-tag-esc"><TriangleAlert size={10} />Escalada</span>}
        </span>
      </span>
    </button>
  )
}

function Bubble({ msg, brand }: { msg: ConversaRow; brand: any }) {
  const isCustomer = msg.role === 'user' || msg.role === 'customer'
  const isAdmin = msg.role === 'admin'
  const isAi = msg.role === 'assistant' || msg.role === 'ai'
  const fromKey = isCustomer ? 'customer' : (isAdmin ? 'admin' : 'ai')
  return (
    <div className={`bbl bbl-${fromKey}`}>
      <div className="bbl-body" style={isCustomer ? { background: brand.brandPrimary, color: 'white' } : {}}>
        {msg.message}
      </div>
      <div className="bbl-meta">
        {isAi && <span className="bbl-iatag"><Bot size={10} />IA{msg.agent_used ? ` · ${msg.agent_used}` : ''}</span>}
        {isAdmin && <span className="bbl-iatag" style={{ background: '#fef3c7', color: '#92400e' }}><UserIcon size={10} />Você</span>}
        <span className="bbl-ts">{fmtTs(msg.created_at)}</span>
      </div>
    </div>
  )
}

function KanbanToast({ toast }: { toast: any }) {
  if (!toast) return null
  const Comp = toast.kind === 'success' ? CheckCircle2 : toast.kind === 'warn' ? AlertTriangle : Info
  return <div className="toast" data-kind={toast.kind}><Comp size={16} /><span>{toast.text}</span></div>
}

export default function ConversasPage() {
  const [tenantSlug, setTenantSlug] = useState('acai-da-barra')
  useEffect(() => {
    try { const s = localStorage.getItem('acai_tenant'); if (s && TENANTS[s]) setTenantSlug(s) } catch {}
  }, [])
  const brand = getTenant(tenantSlug)

  const [convs, setConvs] = useState<any[]>([])
  const [selectedTel, setSelectedTel] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<ConversaRow[]>([])
  const [filter, setFilter] = useState<'all' | 'unread' | 'escalated'>('all')
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [paused, setPaused] = useState(false)
  const [toast, setToast] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)

  async function loadList() {
    try {
      const list = await fetchConversasList()
      setConvs(list)
      if (!selectedTel && list.length > 0) setSelectedTel(list[0].telefone)
    } catch (e: any) { console.warn('conv list err', e?.message) }
    setLoading(false)
  }

  async function loadChat(tel: string) {
    try { setMsgs(await fetchConversa(tel, 200)) }
    catch (e: any) { console.warn('chat err', e?.message) }
  }

  useEffect(() => { loadList() }, [])
  useEffect(() => subscribeConversas(() => { loadList(); if (selectedTel) loadChat(selectedTel) }), [selectedTel])
  useEffect(() => { if (selectedTel) loadChat(selectedTel) }, [selectedTel])
  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [msgs.length])

  const filtered = convs.filter(c => {
    if (filter === 'escalated' && c.intent !== 'escalacao') return false
    if (search && !(c.nome_cliente || '').toLowerCase().includes(search.toLowerCase()) && !(c.telefone || '').includes(search)) return false
    return true
  })

  async function send() {
    if (!draft.trim() || !selectedTel) return
    setSending(true)
    try {
      const sb = supabaseBrowser()
      const { data: { session } } = await sb.auth.getSession()
      const r = await fetch('/api/proxy/wa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ phone: selectedTel, message: draft }),
      })
      const j = await r.json()
      if (!r.ok) {
        setToast({ kind: 'warn', text: j?.error || 'Falha ao enviar' })
      } else {
        setDraft('')
        setToast({ kind: 'success', text: `Enviada via WhatsApp` })
        await loadChat(selectedTel)
      }
    } catch (e: any) {
      setToast({ kind: 'warn', text: e?.message || 'Erro' })
    } finally {
      setSending(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  function togglePause() { setPaused(p => !p) }

  const conv = convs.find(c => c.telefone === selectedTel)

  return (
    <div className="conv-page">
      <div className="page-head">
        <div>
          <h2>Conversas</h2>
          <p>
            <b>{filtered.length}</b> conversas · <b>{convs.filter(c => c.intent === 'escalacao').length}</b> escaladas
          </p>
        </div>
        <div className="page-head-right">
          <button className="btn btn-soft"><Filter size={14} />Filtros</button>
          <button className="btn btn-soft"><Archive size={14} />Arquivadas</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, color: '#94a3b8' }}>Carregando conversas…</div>
      ) : convs.length === 0 ? (
        <div className="banner banner-info">
          <Info size={15} />
          <span>Nenhuma conversa ainda. Pareie WhatsApp + ative IA para começar.</span>
        </div>
      ) : (
        <div className="conv-shell">
          <aside className="conv-list">
            <div className="conv-search">
              <Search size={14} />
              <input placeholder="Buscar nome, telefone..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="conv-filters">
              {[
                { id: 'all' as const, label: `Todas (${convs.length})` },
                { id: 'escalated' as const, label: `Escaladas (${convs.filter(c => c.intent === 'escalacao').length})` },
              ].map(f => (
                <button key={f.id} className="conv-filter-pill"
                  data-active={filter === f.id || undefined}
                  onClick={() => setFilter(f.id)}
                  style={filter === f.id ? { background: brand.brandPrimary, color: 'white', borderColor: brand.brandPrimary } : {}}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="conv-list-body">
              {filtered.map(c => (
                <ConvCard key={c.telefone} conv={c} selected={c.telefone === selectedTel} onClick={setSelectedTel} brand={brand} />
              ))}
            </div>
          </aside>

          <section className="conv-chat">
            {!conv ? (
              <div style={{ padding: 32, color: '#94a3b8' }}>Selecione uma conversa</div>
            ) : (
              <>
                <header className="conv-chat-head">
                  <span className="cv-avatar" style={{ background: colorFor(conv.telefone) }}>
                    {avatar(conv.nome_cliente || conv.telefone)}
                  </span>
                  <div className="conv-chat-text">
                    <div className="conv-chat-name">{conv.nome_cliente || conv.telefone}</div>
                    <div className="conv-chat-sub">{conv.telefone}</div>
                  </div>
                  <div className="conv-chat-actions">
                    <button className="btn btn-soft btn-sm"><UserPlus size={13} />Atribuir</button>
                    <button className="btn btn-soft btn-sm" onClick={togglePause}>
                      {paused ? <Play size={13} /> : <Pause size={13} />}
                      {paused ? 'Devolver IA' : 'Pausar bot'}
                    </button>
                    <button className="btn-icon"><MoreVertical size={15} /></button>
                  </div>
                </header>

                <div className="conv-messages" ref={messagesRef}>
                  {msgs.map(m => <Bubble key={String(m.id)} msg={m} brand={brand} />)}
                  {paused && (
                    <div className="conv-banner-inline">
                      <Pause size={13} />
                      <span>Bot pausado. Sua resposta vai direto via WhatsApp.</span>
                    </div>
                  )}
                </div>

                <footer className="conv-composer">
                  <button className="btn-icon"><Paperclip size={16} /></button>
                  <input className="conv-input"
                    placeholder={paused ? 'Sua resposta (manual)…' : 'Reply manual (pausa o bot)…'}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  />
                  <button className="btn-icon"><Sparkles size={16} /></button>
                  <button className="btn btn-primary btn-sm" style={{ background: brand.brandPrimary }}
                    onClick={send} disabled={!draft.trim() || sending}>
                    <Send size={13} />{sending ? 'Enviando…' : 'Enviar'}
                  </button>
                </footer>
              </>
            )}
          </section>
        </div>
      )}

      {toast && <KanbanToast toast={toast} />}
    </div>
  )
}
