"use client"
import { useEffect, useMemo, useState } from 'react'
import { Search, Upload, Plus, Image as ImageIcon, X, Trash2, Check, Info, Save, Loader, Edit3, RefreshCw, GripVertical, Sparkles, Cherry, Cookie, IceCream2, Candy } from 'lucide-react'
import { useTenant } from '@/hooks/useTenant'
import { adminFetch } from '@/lib/api/admin-client'
import { fetchProdutos, fetchTamanhos, fetchSabores, fetchComplementos } from '@/lib/db/queries'

// Mapping tipo → icon (visual identification)
const TIPO_ICON: Record<string, any> = {
  fruta: Cherry,
  cobertura: IceCream2,
  creme: Candy,
  cookie: Cookie,
  default: Sparkles,
}
function tipoIcon(tipo: string | null | undefined) {
  const k = (tipo || '').toLowerCase().trim()
  for (const key of Object.keys(TIPO_ICON)) if (k.includes(key)) return TIPO_ICON[key]
  return TIPO_ICON.default
}

// === Componente: Complementos agrupados por tipo ===
function ComplementosSection({ items, brand, onUpdate, onDelete, newNome, newTipo, setNewNome, setNewTipo, onAdd }: any) {
  const [filterTipo, setFilterTipo] = useState<string>('all')
  const tipos = useMemo(() => {
    const set = new Set<string>()
    items.forEach((c: any) => set.add((c.tipo || 'sem tipo').toLowerCase()))
    return Array.from(set).sort()
  }, [items])

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>()
    items.forEach((c: any) => {
      const k = (c.tipo || 'sem tipo').toLowerCase()
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(c)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [items])

  const visible = filterTipo === 'all' ? grouped : grouped.filter(([k]) => k === filterTipo)

  return (
    <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.05em', margin: 0 }}>
          Complementos <span style={{ color: '#94a3b8', fontWeight: 500 }}>({items.length})</span>
        </h3>
        {tipos.length > 1 && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setFilterTipo('all')}
              style={{
                padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: '1px solid', borderColor: filterTipo === 'all' ? brand.brandPrimary : '#e2e8f0',
                background: filterTipo === 'all' ? brand.brandSoft : 'white',
                color: filterTipo === 'all' ? brand.brandText : '#64748b',
              }}>todos</button>
            {tipos.map(t => (
              <button key={t} onClick={() => setFilterTipo(t)}
                style={{
                  padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: '1px solid', borderColor: filterTipo === t ? brand.brandPrimary : '#e2e8f0',
                  background: filterTipo === t ? brand.brandSoft : 'white',
                  color: filterTipo === t ? brand.brandText : '#64748b',
                }}>{t}</button>
            ))}
          </div>
        )}
      </div>

      {items.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', background: '#f8fafc', borderRadius: 10, color: '#94a3b8', fontSize: 13 }}>
          Nenhum complemento ainda. Adicione o primeiro abaixo 👇
        </div>
      )}

      {visible.map(([tipo, list]) => (
        <div key={tipo} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: brand.brandText, background: brand.brandSoft,
              padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '.04em',
            }}>{tipo}</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{list.length} {list.length === 1 ? 'item' : 'itens'}</span>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            {list.map((c: any) => {
              const Icon = tipoIcon(c.tipo)
              const inactive = c.ativo === false
              return (
                <div key={c.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '24px 32px 1fr 160px 32px 28px',
                    alignItems: 'center', gap: 8, padding: '8px 10px',
                    background: inactive ? '#f8fafc' : 'white',
                    border: '1px solid #e2e8f0', borderRadius: 10,
                    opacity: inactive ? 0.55 : 1,
                  }}>
                  <GripVertical size={14} style={{ color: '#cbd5e1', cursor: 'grab' }} />
                  <span style={{
                    width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: brand.brandSoft, color: brand.brandText, borderRadius: 8,
                  }}>
                    <Icon size={15} />
                  </span>
                  <input defaultValue={c.nome} placeholder="Nome"
                    onBlur={e => e.target.value !== c.nome && e.target.value.trim() && onUpdate(c, { nome: e.target.value.trim() })}
                    style={{
                      border: 'none', outline: 'none', fontSize: 14, fontWeight: 500, color: '#0f172a',
                      background: 'transparent', padding: 4, borderRadius: 6,
                    }}
                    onFocus={e => { e.target.style.background = brand.brandSoft }}
                    onMouseLeave={e => { (e.target as HTMLInputElement).style.background = 'transparent' }} />
                  <input defaultValue={c.tipo || ''} placeholder="tipo…"
                    onBlur={e => e.target.value !== (c.tipo || '') && onUpdate(c, { tipo: e.target.value.trim() || null })}
                    style={{
                      border: '1px solid transparent', outline: 'none', fontSize: 12, color: '#64748b',
                      background: 'transparent', padding: '4px 8px', borderRadius: 6,
                    }}
                    onFocus={e => { e.target.style.background = '#f8fafc'; e.target.style.borderColor = '#e2e8f0' }} />
                  <label style={{ cursor: 'pointer', display: 'inline-flex' }}>
                    <input type="checkbox" defaultChecked={c.ativo !== false}
                      onChange={e => onUpdate(c, { ativo: e.target.checked })}
                      style={{ width: 16, height: 16, accentColor: brand.brandPrimary, cursor: 'pointer' }} />
                  </label>
                  <button onClick={() => onDelete(c)}
                    title="Remover"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
                      padding: 4, borderRadius: 6, display: 'flex',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Inline add */}
      <div style={{
        display: 'grid', gridTemplateColumns: '24px 32px 1fr 160px 32px 28px',
        alignItems: 'center', gap: 8, padding: '8px 10px',
        background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, marginTop: 8,
      }}>
        <Plus size={14} style={{ color: brand.brandPrimary }} />
        <span style={{
          width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'white', color: brand.brandPrimary, borderRadius: 8, border: '1px dashed ' + brand.brandBorder,
        }}>
          <Sparkles size={14} />
        </span>
        <input value={newNome} onChange={e => setNewNome(e.target.value)} placeholder="Nome do complemento"
          onKeyDown={e => e.key === 'Enter' && onAdd()}
          style={{
            border: 'none', outline: 'none', fontSize: 14, color: '#0f172a',
            background: 'transparent', padding: 4,
          }} />
        <input value={newTipo} onChange={e => setNewTipo(e.target.value)} placeholder="tipo (fruta, cobertura…)"
          onKeyDown={e => e.key === 'Enter' && onAdd()}
          style={{
            border: 'none', outline: 'none', fontSize: 12, color: '#64748b',
            background: 'transparent', padding: '4px 8px',
          }} />
        <span />
        <button onClick={onAdd} disabled={!newNome.trim()}
          style={{
            background: newNome.trim() ? brand.brandPrimary : '#e2e8f0', color: 'white',
            border: 'none', padding: 6, borderRadius: 6, cursor: newNome.trim() ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Adicionar (ou Enter)">
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}

// ============================================================
// MODAL: Novo/Editar produto
// ============================================================
interface ProdutoModalProps {
  open: boolean
  produto?: any
  onClose: () => void
  onSaved: () => void
  brand: any
}

function ProdutoModal({ open, produto, onClose, onSaved, brand }: ProdutoModalProps) {
  const editing = !!produto?.id
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) {
      setNome(produto?.nome || '')
      setDescricao(produto?.descricao || '')
      setAtivo(produto?.ativo !== false)
      setErr('')
    }
  }, [open, produto])

  if (!open) return null

  async function save() {
    if (!nome.trim()) { setErr('Nome obrigatório'); return }
    setSaving(true); setErr('')
    try {
      if (editing) {
        await adminFetch(`/api/admin/cardapio/produtos/${produto.id}`, { method: 'PATCH', body: JSON.stringify({ nome, descricao, ativo }) })
      } else {
        await adminFetch('/api/admin/cardapio/produtos', { method: 'POST', body: JSON.stringify({ nome, descricao, ativo }) })
      }
      onSaved()
      onClose()
    } catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 520, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{editing ? 'Editar produto' : 'Novo produto'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Nome *</div>
            <input className="input" style={{ width: '100%' }} value={nome} onChange={e => setNome(e.target.value)} placeholder="ex: Açaí" />
          </label>
          <label>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Descrição</div>
            <textarea className="input" style={{ width: '100%', minHeight: 80 }} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes do produto…" />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} />
            <span style={{ fontSize: 13 }}>Ativo (visível no cardápio)</span>
          </label>
          {err && <div style={{ color: '#dc2626', fontSize: 13 }}>{err}</div>}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-soft" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{ background: brand.brandPrimary }} onClick={save} disabled={saving}>
            {saving ? <Loader size={13} className="spin" /> : <Save size={13} />}Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// MAIN
// ============================================================
export default function CardapioPage() {
  const { tenant } = useTenant()
  const brand = tenant

  const [produtos, setProdutos] = useState<any[]>([])
  const [tamanhos, setTamanhos] = useState<any[]>([])
  const [sabores, setSabores] = useState<any[]>([])
  const [complementos, setComplementos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeProdutoId, setActiveProdutoId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'tamanhos' | 'complementos' | 'sabores'>('tamanhos')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editProduto, setEditProduto] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  // Quick add inputs
  const [newTamNome, setNewTamNome] = useState('')
  const [newTamPreco, setNewTamPreco] = useState('')
  const [newSaborNome, setNewSaborNome] = useState('')
  const [newCompNome, setNewCompNome] = useState('')
  const [newCompTipo, setNewCompTipo] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [p, t, s, c] = await Promise.all([fetchProdutos(), fetchTamanhos(), fetchSabores(), fetchComplementos()])
      setProdutos(p); setTamanhos(t); setSabores(s); setComplementos(c)
      if (p.length > 0 && !p.find(x => x.id === activeProdutoId)) setActiveProdutoId(p[0].id)
    } catch (e: any) { setMsg('Erro: ' + e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  function rebuildKbAsync() {
    adminFetch('/api/admin/cardapio/rebuild-kb', { method: 'POST' }).catch(() => {})
  }

  function showMsg(s: string) {
    setMsg(s); setTimeout(() => setMsg(''), 2000)
  }

  // Produto actions
  function newProduto() { setEditProduto(null); setShowModal(true) }
  function editProd(p: any) { setEditProduto(p); setShowModal(true) }

  async function deleteProduto(p: any) {
    if (!confirm(`Excluir produto "${p.nome}"?\nIsso remove TODOS tamanhos, sabores e complementos vinculados.`)) return
    setBusy('p:' + p.id)
    try {
      await adminFetch(`/api/admin/cardapio/produtos/${p.id}`, { method: 'DELETE' })
      showMsg('Produto removido ✓')
      rebuildKbAsync()
      await load()
    } catch (e: any) { alert('Erro: ' + e.message) }
    finally { setBusy(null) }
  }

  async function toggleProdAtivo(p: any) {
    setBusy('p:' + p.id)
    try {
      await adminFetch(`/api/admin/cardapio/produtos/${p.id}`, { method: 'PATCH', body: JSON.stringify({ ativo: !p.ativo }) })
      rebuildKbAsync()
      await load()
    } catch (e: any) { alert('Erro: ' + e.message) }
    finally { setBusy(null) }
  }

  // Tamanho actions
  async function addTamanho() {
    if (!activeProdutoId || !newTamNome.trim() || !newTamPreco.trim()) return
    const preco = parseFloat(newTamPreco.replace(',', '.'))
    if (isNaN(preco) || preco <= 0) { alert('Preço inválido'); return }
    try {
      await adminFetch('/api/admin/cardapio/tamanhos', { method: 'POST', body: JSON.stringify({ produto_id: activeProdutoId, nome: newTamNome.trim(), preco }) })
      setNewTamNome(''); setNewTamPreco('')
      rebuildKbAsync()
      await load()
    } catch (e: any) { alert('Erro: ' + e.message) }
  }

  async function updateTamanho(t: any, patch: any) {
    setBusy('t:' + t.id)
    try {
      await adminFetch(`/api/admin/cardapio/tamanhos/${t.id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      rebuildKbAsync()
      await load()
    } catch (e: any) { alert('Erro: ' + e.message) }
    finally { setBusy(null) }
  }

  async function deleteTamanho(t: any) {
    if (!confirm(`Remover tamanho "${t.nome}"?`)) return
    setBusy('t:' + t.id)
    try {
      await adminFetch(`/api/admin/cardapio/tamanhos/${t.id}`, { method: 'DELETE' })
      rebuildKbAsync()
      await load()
    } catch (e: any) { alert('Erro: ' + e.message) }
    finally { setBusy(null) }
  }

  // Sabor actions
  async function addSabor() {
    if (!activeProdutoId || !newSaborNome.trim()) return
    try {
      await adminFetch('/api/admin/cardapio/sabores', { method: 'POST', body: JSON.stringify({ produto_id: activeProdutoId, nome: newSaborNome.trim() }) })
      setNewSaborNome('')
      rebuildKbAsync()
      await load()
    } catch (e: any) { alert('Erro: ' + e.message) }
  }

  async function deleteSabor(s: any) {
    if (!confirm(`Remover sabor "${s.nome}"?`)) return
    try {
      await adminFetch(`/api/admin/cardapio/sabores/${s.id}`, { method: 'DELETE' })
      rebuildKbAsync()
      await load()
    } catch (e: any) { alert('Erro: ' + e.message) }
  }

  async function toggleSaborAtivo(s: any) {
    try {
      await adminFetch(`/api/admin/cardapio/sabores/${s.id}`, { method: 'PATCH', body: JSON.stringify({ ativo: !s.ativo }) })
      rebuildKbAsync()
      await load()
    } catch (e: any) { alert('Erro: ' + e.message) }
  }

  // Complemento actions
  async function addComplemento() {
    if (!activeProdutoId || !newCompNome.trim()) return
    try {
      await adminFetch('/api/admin/cardapio/complementos', { method: 'POST', body: JSON.stringify({ produto_id: activeProdutoId, nome: newCompNome.trim(), tipo: newCompTipo.trim() || null }) })
      setNewCompNome(''); setNewCompTipo('')
      rebuildKbAsync()
      await load()
    } catch (e: any) { alert('Erro: ' + e.message) }
  }

  async function deleteComplemento(c: any) {
    if (!confirm(`Remover "${c.nome}"?`)) return
    try {
      await adminFetch(`/api/admin/cardapio/complementos/${c.id}`, { method: 'DELETE' })
      rebuildKbAsync()
      await load()
    } catch (e: any) { alert('Erro: ' + e.message) }
  }

  async function updateComplemento(c: any, patch: any) {
    try {
      await adminFetch(`/api/admin/cardapio/complementos/${c.id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      rebuildKbAsync()
      await load()
    } catch (e: any) { alert('Erro: ' + e.message) }
  }

  async function updateSabor(s: any, patch: any) {
    try {
      await adminFetch(`/api/admin/cardapio/sabores/${s.id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      rebuildKbAsync()
      await load()
    } catch (e: any) { alert('Erro: ' + e.message) }
  }

  const tamanhosFor = (pid: string) => tamanhos.filter(t => t.produto_id === pid)
  const saboresFor = (pid: string) => sabores.filter(s => s.produto_id === pid)
  const complementosFor = (pid: string) => complementos.filter(c => c.produto_id === pid)

  const activeProduto = produtos.find(p => p.id === activeProdutoId)
  const activeTamanhos = activeProduto ? tamanhosFor(activeProduto.id) : []
  const activeSabores = activeProduto ? saboresFor(activeProduto.id) : []
  const activeComplementos = activeProduto ? complementosFor(activeProduto.id) : []
  const filteredSabores = activeSabores.filter(s => !search || s.nome.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="card-page">
      <div className="page-head">
        <div>
          <h2>Cardápio</h2>
          <p>
            <b>{produtos.filter(p => p.ativo).length}</b> produtos ativos · <b>{tamanhos.length}</b> tamanhos · <b>{sabores.length}</b> sabores · <b>{complementos.length}</b> complementos
          </p>
        </div>
        <div className="page-head-right">
          <button className="btn btn-soft" onClick={() => { adminFetch('/api/admin/cardapio/rebuild-kb', { method: 'POST' }).then(() => showMsg('KB recompilada')) }}>
            <RefreshCw size={14} />Rebuild KB
          </button>
          <button className="btn btn-primary" style={{ background: brand.brandPrimary }} onClick={newProduto}>
            <Plus size={14} />Novo produto
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: 10, marginBottom: 12, borderRadius: 10, fontSize: 13,
          background: msg.startsWith('Erro') ? '#fef2f2' : '#dcfce7',
          color: msg.startsWith('Erro') ? '#991b1b' : '#15803d',
          border: '1px solid', borderColor: msg.startsWith('Erro') ? '#fecaca' : '#bbf7d0' }}>
          {msg}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 24, color: '#94a3b8' }}>Carregando cardápio…</div>
      ) : produtos.length === 0 ? (
        <div style={{ padding: 48, background: 'white', border: '2px dashed #e2e8f0', borderRadius: 14, textAlign: 'center' }}>
          <Sparkles size={42} style={{ color: brand.brandPrimary, opacity: 0.6 }} />
          <h3 style={{ margin: '12px 0 4px', fontSize: 16, fontWeight: 600 }}>Cardápio vazio</h3>
          <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px' }}>Adicione o primeiro produto pra IA poder atender clientes.</p>
          <button onClick={newProduto}
            style={{ background: brand.brandPrimary, color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} />Criar produto
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16 }}>
          {/* Sidebar produtos */}
          <aside style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 8, height: 'fit-content', position: 'sticky', top: 16 }}>
            <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Produtos · {produtos.length}
            </div>
            {produtos.map(p => {
              const on = activeProdutoId === p.id
              return (
                <button key={p.id} onClick={() => setActiveProdutoId(p.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                    padding: '8px 10px', border: 'none', borderRadius: 8, cursor: 'pointer',
                    background: on ? brand.brandSoft : 'transparent',
                    color: on ? brand.brandText : '#0f172a',
                    opacity: p.ativo ? 1 : 0.5, marginBottom: 2,
                  }}
                  onMouseEnter={e => { if (!on) e.currentTarget.style.background = '#f8fafc' }}
                  onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: on ? 'white' : brand.brandSoft, color: brand.brandText, fontWeight: 700, fontSize: 12,
                  }}>{p.nome.slice(0, 2).toUpperCase()}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</div>
                    <div style={{ fontSize: 10, color: on ? brand.brandText : '#94a3b8', opacity: 0.8 }}>
                      {tamanhosFor(p.id).length} tam · {saboresFor(p.id).length} sab · {complementosFor(p.id).length} comp
                    </div>
                  </div>
                </button>
              )
            })}
            <button onClick={newProduto}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%',
                padding: 10, border: '1px dashed #cbd5e1', borderRadius: 8, cursor: 'pointer',
                background: 'transparent', color: brand.brandPrimary, fontSize: 12, fontWeight: 600, marginTop: 6,
              }}><Plus size={13} />Novo produto</button>
          </aside>

          {/* Conteúdo do produto */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activeProduto && (
              <>
                {/* Header denso do produto */}
                <div style={{
                  background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16,
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <span style={{
                    width: 56, height: 56, borderRadius: 12, background: brand.brandSoft, color: brand.brandText,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 22,
                  }}>{activeProduto.nome.slice(0, 2).toUpperCase()}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input defaultValue={activeProduto.nome}
                      onBlur={e => e.target.value !== activeProduto.nome && e.target.value.trim() && adminFetch(`/api/admin/cardapio/produtos/${activeProduto.id}`, { method: 'PATCH', body: JSON.stringify({ nome: e.target.value.trim() }) }).then(load)}
                      style={{ border: '1px solid transparent', outline: 'none', background: 'transparent', padding: '4px 8px', borderRadius: 6, fontSize: 18, fontWeight: 700, color: '#0f172a', width: '100%' }}
                      onFocus={e => { e.target.style.background = brand.brandSoft }}
                      onMouseLeave={e => { (e.target as HTMLInputElement).style.background = 'transparent' }} />
                    <input defaultValue={activeProduto.descricao || ''} placeholder="Descrição (opcional)"
                      onBlur={e => e.target.value !== (activeProduto.descricao || '') && adminFetch(`/api/admin/cardapio/produtos/${activeProduto.id}`, { method: 'PATCH', body: JSON.stringify({ descricao: e.target.value.trim() }) }).then(load)}
                      style={{ border: '1px solid transparent', outline: 'none', background: 'transparent', padding: '2px 8px', borderRadius: 6, fontSize: 12, color: '#64748b', width: '100%' }}
                      onFocus={e => { e.target.style.background = '#f8fafc' }} />
                  </div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#f8fafc', borderRadius: 8 }}>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{activeProduto.ativo ? 'Visível' : 'Oculto'}</span>
                    <button onClick={() => toggleProdAtivo(activeProduto)}
                      style={{ width: 36, height: 20, borderRadius: 99, border: 'none', cursor: 'pointer', background: activeProduto.ativo ? brand.brandPrimary : '#cbd5e1', position: 'relative', padding: 0 }}>
                      <span style={{ position: 'absolute', top: 2, left: activeProduto.ativo ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 160ms cubic-bezier(.16,1,.3,1)' }} />
                    </button>
                  </span>
                  <button onClick={() => deleteProduto(activeProduto)} disabled={busy === 'p:' + activeProduto.id}
                    title="Excluir produto"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 8, borderRadius: 6, display: 'flex' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8' }}>
                    {busy === 'p:' + activeProduto.id ? <Loader size={16} className="spin" /> : <Trash2 size={16} />}
                  </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 10, gap: 2 }}>
                  {([
                    { id: 'tamanhos', label: 'Tamanhos', count: activeTamanhos.length },
                    { id: 'complementos', label: 'Complementos', count: activeComplementos.length },
                    { id: 'sabores', label: 'Sabores', count: activeSabores.length },
                  ] as const).map(t => {
                    const on = activeTab === t.id
                    return (
                      <button key={t.id} onClick={() => setActiveTab(t.id)}
                        style={{
                          flex: 1, padding: '8px 14px', border: 'none', borderRadius: 7, cursor: 'pointer',
                          fontSize: 13, fontWeight: 600,
                          background: on ? 'white' : 'transparent',
                          color: on ? brand.brandText : '#64748b',
                          boxShadow: on ? '0 1px 2px rgba(15,23,42,.08)' : 'none',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}>
                        {t.label}
                        <span style={{ padding: '1px 7px', borderRadius: 99, background: on ? brand.brandSoft : '#e2e8f0', color: on ? brand.brandText : '#64748b', fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{t.count}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Tab content */}
                {activeTab === 'tamanhos' && (
                  <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                    {activeTamanhos.length === 0 && (
                      <div style={{ padding: 24, textAlign: 'center', background: '#f8fafc', borderRadius: 10, color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>
                        Nenhum tamanho. Adicione o primeiro abaixo 👇
                      </div>
                    )}
                    <div style={{ display: 'grid', gap: 6 }}>
                      {activeTamanhos.map(t => (
                        <div key={t.id} style={{
                          display: 'grid', gridTemplateColumns: '24px 1fr 140px 28px',
                          alignItems: 'center', gap: 10, padding: '8px 10px',
                          background: 'white', border: '1px solid #e2e8f0', borderRadius: 10,
                        }}>
                          <GripVertical size={14} style={{ color: '#cbd5e1', cursor: 'grab' }} />
                          <input defaultValue={t.nome} placeholder="Nome (ex: 500ml)"
                            onBlur={e => e.target.value !== t.nome && e.target.value.trim() && updateTamanho(t, { nome: e.target.value.trim() })}
                            style={{ border: '1px solid transparent', outline: 'none', background: 'transparent', padding: '4px 8px', borderRadius: 6, fontSize: 14, fontWeight: 500, color: '#0f172a' }}
                            onFocus={e => { e.target.style.background = brand.brandSoft }}
                            onMouseLeave={e => { (e.target as HTMLInputElement).style.background = 'transparent' }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>R$</span>
                            <input type="number" step="0.50" defaultValue={Number(t.preco).toFixed(2)}
                              onBlur={e => Number(e.target.value) !== Number(t.preco) && updateTamanho(t, { preco: parseFloat(e.target.value) })}
                              style={{ width: 90, border: '1px solid transparent', outline: 'none', background: 'transparent', padding: '4px 6px', borderRadius: 6, fontSize: 14, fontWeight: 700, color: brand.brandText, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                              onFocus={e => { e.target.style.background = '#f8fafc'; e.target.style.borderColor = '#e2e8f0' }} />
                          </div>
                          <button onClick={() => deleteTamanho(t)} disabled={busy === 't:' + t.id}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 6, borderRadius: 6, display: 'flex' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8' }}>
                            {busy === 't:' + t.id ? <Loader size={14} className="spin" /> : <Trash2 size={14} />}
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '24px 1fr 140px 28px',
                      alignItems: 'center', gap: 10, padding: '8px 10px', marginTop: 8,
                      background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10,
                    }}>
                      <Plus size={14} style={{ color: brand.brandPrimary }} />
                      <input value={newTamNome} onChange={e => setNewTamNome(e.target.value)} placeholder="Novo tamanho (ex: 700ml)"
                        onKeyDown={e => e.key === 'Enter' && addTamanho()}
                        style={{ border: 'none', outline: 'none', background: 'transparent', padding: '4px 8px', fontSize: 14, color: '#0f172a' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>R$</span>
                        <input type="number" step="0.50" value={newTamPreco} onChange={e => setNewTamPreco(e.target.value)} placeholder="0,00"
                          onKeyDown={e => e.key === 'Enter' && addTamanho()}
                          style={{ width: 90, border: 'none', outline: 'none', background: 'transparent', padding: '4px 6px', fontSize: 14, fontWeight: 700, textAlign: 'right' }} />
                      </div>
                      <button onClick={addTamanho} disabled={!newTamNome.trim() || !newTamPreco.trim()}
                        style={{
                          background: (newTamNome.trim() && newTamPreco.trim()) ? brand.brandPrimary : '#e2e8f0', color: 'white',
                          border: 'none', padding: 6, borderRadius: 6, cursor: 'pointer', display: 'flex',
                        }}><Plus size={14} /></button>
                    </div>
                  </div>
                )}

                {activeTab === 'complementos' && (
                  <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                    <ComplementosSection
                      items={activeComplementos}
                      brand={brand}
                      onUpdate={updateComplemento}
                      onDelete={deleteComplemento}
                      newNome={newCompNome}
                      newTipo={newCompTipo}
                      setNewNome={setNewCompNome}
                      setNewTipo={setNewCompTipo}
                      onAdd={addComplemento}
                    />
                  </div>
                )}

                {activeTab === 'sabores' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Search + add */}
                    <div style={{
                      display: 'flex', gap: 8, alignItems: 'center', padding: 10,
                      background: 'white', border: '1px solid #e2e8f0', borderRadius: 12,
                    }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#f8fafc', borderRadius: 8 }}>
                        <Search size={14} style={{ color: '#94a3b8' }} />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar sabor…"
                          style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 13 }} />
                      </div>
                      <span style={{ width: 1, height: 24, background: '#e2e8f0' }} />
                      <input value={newSaborNome} onChange={e => setNewSaborNome(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addSabor()}
                        placeholder="Novo sabor (Enter pra adicionar)"
                        style={{ flex: 1, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none' }} />
                      <button onClick={addSabor} disabled={!newSaborNome.trim()}
                        style={{
                          background: newSaborNome.trim() ? brand.brandPrimary : '#e2e8f0', color: 'white',
                          border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                          cursor: newSaborNome.trim() ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 6,
                        }}><Plus size={13} />Sabor</button>
                    </div>

                    {/* Grid sabores */}
                    {filteredSabores.length === 0 ? (
                      <div style={{ padding: 32, textAlign: 'center', background: 'white', border: '2px dashed #e2e8f0', borderRadius: 12, color: '#94a3b8', fontSize: 13 }}>
                        {search ? `Nenhum sabor com "${search}"` : 'Nenhum sabor ainda. Adicione acima 👆'}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                        {filteredSabores.map(s => (
                          <article key={s.id} style={{
                            background: 'white', borderRadius: 10, overflow: 'hidden',
                            border: '1px solid #e2e8f0', opacity: s.ativo ? 1 : 0.5,
                            display: 'flex', flexDirection: 'column',
                          }}>
                            <div style={{
                              padding: '20px 12px', background: brand.brandSoft, color: brand.brandText,
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}>
                              <ImageIcon size={22} />
                              <button onClick={() => toggleSaborAtivo(s)}
                                style={{ width: 28, height: 16, borderRadius: 99, border: 'none', cursor: 'pointer', background: s.ativo ? brand.brandPrimary : '#cbd5e1', position: 'relative', padding: 0 }}>
                                <span style={{ position: 'absolute', top: 2, left: s.ativo ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: 'white', transition: 'left 160ms cubic-bezier(.16,1,.3,1)' }} />
                              </button>
                            </div>
                            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <input defaultValue={s.nome}
                                onBlur={e => e.target.value !== s.nome && e.target.value.trim() && updateSabor(s, { nome: e.target.value.trim() })}
                                style={{ border: '1px solid transparent', outline: 'none', background: 'transparent', padding: '2px 4px', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#0f172a' }}
                                onFocus={e => { e.target.style.background = brand.brandSoft }}
                                onMouseLeave={e => { (e.target as HTMLInputElement).style.background = 'transparent' }} />
                              <button onClick={() => deleteSabor(s)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-end' }}>
                                <Trash2 size={11} /> remover
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      <ProdutoModal open={showModal} produto={editProduto} onClose={() => setShowModal(false)}
        onSaved={load} brand={brand} />
    </div>
  )
}
