"use client"
import { useEffect, useMemo, useState } from 'react'
import {
  MapPin, Plus, Search, Trash2, Loader, TrendingUp, TrendingDown,
  ChevronDown, X, Check, ArrowUpDown, LayoutGrid, List as ListIcon,
} from 'lucide-react'
import { useTenant } from '@/hooks/useTenant'
import { fetchTaxas, updateTaxa, createTaxa } from '@/lib/db/queries'

type SortKey = 'alpha' | 'alpha_desc' | 'taxa_asc' | 'taxa_desc' | 'recent'
type GroupKey = 'none' | 'alpha' | 'faixa' | 'status'
type ViewKey = 'list' | 'grid'

const SORT_LABELS: Record<SortKey, string> = {
  alpha: 'A → Z', alpha_desc: 'Z → A',
  taxa_asc: 'Taxa ↑ menor', taxa_desc: 'Taxa ↓ maior',
  recent: 'Mais recentes',
}
const GROUP_LABELS: Record<GroupKey, string> = {
  none: 'Sem agrupamento', alpha: 'Por inicial (A-Z)',
  faixa: 'Por faixa de preço', status: 'Por status',
}

export default function ZonasPage() {
  const { tenant } = useTenant()
  const brand = tenant

  const [zonas, setZonas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('alpha')
  const [group, setGroup] = useState<GroupKey>('alpha')
  const [view, setView] = useState<ViewKey>('list')
  const [showInactive, setShowInactive] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newBairro, setNewBairro] = useState('')
  const [newTaxa, setNewTaxa] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkValue, setBulkValue] = useState('')

  async function load() {
    try { setZonas(await fetchTaxas()) } catch (e: any) { console.warn(e?.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Pipeline: filter → sort → group
  const filtered = useMemo(() => {
    return zonas
      .filter(z => showInactive || z.ativo)
      .filter(z => !search || z.bairro.toLowerCase().includes(search.toLowerCase()))
  }, [zonas, search, showInactive])

  const sorted = useMemo(() => {
    const arr = filtered.slice()
    switch (sort) {
      case 'alpha': arr.sort((a, b) => a.bairro.localeCompare(b.bairro)); break
      case 'alpha_desc': arr.sort((a, b) => b.bairro.localeCompare(a.bairro)); break
      case 'taxa_asc': arr.sort((a, b) => Number(a.taxa) - Number(b.taxa)); break
      case 'taxa_desc': arr.sort((a, b) => Number(b.taxa) - Number(a.taxa)); break
      case 'recent': arr.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')); break
    }
    return arr
  }, [filtered, sort])

  const groups = useMemo(() => {
    if (group === 'none') return [['Todos', sorted]] as [string, any[]][]
    const map = new Map<string, any[]>()
    for (const z of sorted) {
      let k: string
      if (group === 'alpha') k = (z.bairro[0] || '#').toUpperCase()
      else if (group === 'status') k = z.ativo ? '✓ Ativos' : '⊘ Inativos'
      else { // faixa
        const t = Number(z.taxa)
        if (t < 5) k = 'Até R$ 5'
        else if (t < 10) k = 'R$ 5 a R$ 10'
        else if (t < 15) k = 'R$ 10 a R$ 15'
        else if (t < 20) k = 'R$ 15 a R$ 20'
        else k = 'Acima de R$ 20'
      }
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(z)
    }
    return Array.from(map.entries())
  }, [sorted, group])

  const totalAtivas = zonas.filter(z => z.ativo).length
  const taxas = zonas.filter(z => z.ativo).map(z => Number(z.taxa))
  const taxaMin = taxas.length ? Math.min(...taxas) : 0
  const taxaMax = taxas.length ? Math.max(...taxas) : 0
  const taxaMedia = taxas.length ? taxas.reduce((s, t) => s + t, 0) / taxas.length : 0

  function taxaColor(v: number) {
    if (taxaMax === taxaMin) return brand.brandPrimary
    const pct = (v - taxaMin) / (taxaMax - taxaMin)
    const hue = 140 - pct * 140
    return `oklch(0.7 0.13 ${hue})`
  }

  async function updateZona(id: string, patch: any) {
    setBusy(id)
    try { await updateTaxa(id, patch); await load() }
    catch (e: any) { alert(e?.message) }
    finally { setBusy(null) }
  }

  async function deleteZona(z: any) {
    if (!confirm(`Remover zona "${z.bairro}"?`)) return
    setBusy(z.id)
    try {
      const { supabaseBrowser } = await import('@/lib/db/supabase-browser')
      await supabaseBrowser().from('taxas_entrega').delete().eq('id', z.id)
      await load()
    } catch (e: any) { alert(e?.message) }
    finally { setBusy(null) }
  }

  async function addNew() {
    if (!newBairro.trim() || !newTaxa.trim()) return
    setCreating(true)
    try {
      await createTaxa(newBairro.trim(), parseFloat(newTaxa.replace(',', '.')))
      setNewBairro(''); setNewTaxa('')
      await load()
    } catch (e: any) { alert(e?.message) }
    finally { setCreating(false) }
  }

  function toggleSelect(id: string) {
    setSelected(s => {
      const ns = new Set(s)
      ns.has(id) ? ns.delete(id) : ns.add(id)
      return ns
    })
  }

  function selectAll() {
    setSelected(new Set(sorted.map(z => z.id)))
  }

  function clearSelected() { setSelected(new Set()); setBulkOpen(false) }

  async function bulkApplyTaxa() {
    const v = parseFloat(bulkValue.replace(',', '.'))
    if (isNaN(v)) return alert('Taxa inválida')
    if (!confirm(`Aplicar R$ ${v.toFixed(2)} em ${selected.size} zonas?`)) return
    setBusy('bulk')
    try {
      const { supabaseBrowser } = await import('@/lib/db/supabase-browser')
      const sb = supabaseBrowser()
      await Promise.all(Array.from(selected).map(id => sb.from('taxas_entrega').update({ taxa: v }).eq('id', id)))
      clearSelected(); setBulkValue('')
      await load()
    } catch (e: any) { alert(e?.message) }
    finally { setBusy(null) }
  }

  async function bulkToggle(ativo: boolean) {
    if (!confirm(`${ativo ? 'Ativar' : 'Desativar'} ${selected.size} zonas?`)) return
    setBusy('bulk')
    try {
      const { supabaseBrowser } = await import('@/lib/db/supabase-browser')
      const sb = supabaseBrowser()
      await Promise.all(Array.from(selected).map(id => sb.from('taxas_entrega').update({ ativo }).eq('id', id)))
      clearSelected()
      await load()
    } catch (e: any) { alert(e?.message) }
    finally { setBusy(null) }
  }

  return (
    <div className="zon-page">
      <div className="page-head">
        <div>
          <h2>Zonas de entrega</h2>
          <p>Bairros atendidos + taxas. IA usa pra calcular preço entrega no pedido.</p>
        </div>
      </div>

      {/* Stats — sem hero-metric, só tiles densos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatTile label="Zonas ativas" value={String(totalAtivas)} sub={`de ${zonas.length} cadastradas`} brand={brand} />
        <StatTile label="Taxa mínima" value={`R$ ${taxaMin.toFixed(2)}`} sub="bairros próximos" brand={brand} icon={TrendingDown} />
        <StatTile label="Taxa média" value={`R$ ${taxaMedia.toFixed(2)}`} sub="custo médio" brand={brand} />
        <StatTile label="Taxa máxima" value={`R$ ${taxaMax.toFixed(2)}`} sub="bairros distantes" brand={brand} icon={TrendingUp} />
      </div>

      {/* Toolbar — search + sort + group + view + add */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, padding: 10,
        background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 240px', minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f8fafc', borderRadius: 8 }}>
          <Search size={14} style={{ color: '#94a3b8' }} />
          <input placeholder="Buscar bairro…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 13 }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}><X size={12} /></button>}
        </div>

        <Divider />

        <Dropdown
          icon={<ArrowUpDown size={13} />}
          label={SORT_LABELS[sort]}
          options={Object.entries(SORT_LABELS).map(([id, l]) => ({ id, label: l }))}
          value={sort}
          onChange={v => setSort(v as SortKey)}
          brand={brand}
        />
        <Dropdown
          icon={<LayoutGrid size={13} />}
          label={GROUP_LABELS[group]}
          options={Object.entries(GROUP_LABELS).map(([id, l]) => ({ id, label: l }))}
          value={group}
          onChange={v => setGroup(v as GroupKey)}
          brand={brand}
        />

        <Divider />

        <div style={{ display: 'flex', background: '#f1f5f9', padding: 2, borderRadius: 8 }}>
          {(['list', 'grid'] as ViewKey[]).map(v => {
            const on = view === v
            const Icon = v === 'list' ? ListIcon : LayoutGrid
            return (
              <button key={v} onClick={() => setView(v)}
                title={v === 'list' ? 'Lista densa' : 'Grade'}
                style={{
                  width: 30, height: 26, border: 'none', borderRadius: 6, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: on ? 'white' : 'transparent', color: on ? brand.brandText : '#94a3b8',
                  boxShadow: on ? '0 1px 2px rgba(15,23,42,.08)' : 'none',
                }}><Icon size={13} /></button>
            )
          })}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b', cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          mostrar inativos
        </label>
      </div>

      {/* Quick add inline */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, padding: '8px 12px',
        background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10,
      }}>
        <Plus size={14} style={{ color: brand.brandPrimary }} />
        <input placeholder="Novo bairro…" value={newBairro} onChange={e => setNewBairro(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addNew()}
          style={{ flex: 1, padding: '4px 8px', border: 'none', outline: 'none', background: 'transparent', fontSize: 13 }} />
        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>R$</span>
        <input placeholder="0,00" value={newTaxa} onChange={e => setNewTaxa(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addNew()}
          type="number" step="0.50"
          style={{ width: 70, padding: '4px 8px', border: 'none', outline: 'none', background: 'transparent', fontSize: 13, textAlign: 'right' }} />
        <button onClick={addNew} disabled={creating || !newBairro.trim() || !newTaxa.trim()}
          style={{
            background: (newBairro.trim() && newTaxa.trim()) ? brand.brandPrimary : '#e2e8f0',
            color: 'white', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: (newBairro.trim() && newTaxa.trim()) ? 'pointer' : 'not-allowed',
          }}>{creating ? <Loader size={12} className="spin" /> : 'Adicionar'}</button>
      </div>

      {/* Bulk action bar (sticky) */}
      {selected.size > 0 && (
        <div style={{
          position: 'sticky', top: 16, zIndex: 10, marginBottom: 12,
          background: brand.brandText, color: 'white', borderRadius: 12, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 14px rgba(15,23,42,.15)',
        }}>
          <Check size={14} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.size} selecionada{selected.size > 1 ? 's' : ''}</span>
          <button onClick={selectAll} style={{ background: 'rgba(255,255,255,.15)', color: 'white', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
            Selecionar visíveis
          </button>
          <div style={{ flex: 1 }} />
          {!bulkOpen ? (
            <>
              <button onClick={() => setBulkOpen(true)} style={{ background: 'white', color: brand.brandText, border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Aplicar taxa
              </button>
              <button onClick={() => bulkToggle(true)} disabled={busy === 'bulk'} style={{ background: 'rgba(255,255,255,.15)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Ativar</button>
              <button onClick={() => bulkToggle(false)} disabled={busy === 'bulk'} style={{ background: 'rgba(255,255,255,.15)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Desativar</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 12 }}>R$</span>
              <input type="number" step="0.50" value={bulkValue} onChange={e => setBulkValue(e.target.value)}
                placeholder="0,00" autoFocus
                style={{ width: 80, padding: '4px 8px', border: 'none', borderRadius: 6, fontSize: 13, textAlign: 'right' }} />
              <button onClick={bulkApplyTaxa} disabled={busy === 'bulk' || !bulkValue}
                style={{ background: 'white', color: brand.brandText, border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {busy === 'bulk' ? <Loader size={12} className="spin" /> : 'Aplicar'}
              </button>
              <button onClick={() => { setBulkOpen(false); setBulkValue('') }} style={{ background: 'transparent', color: 'white', border: 'none', padding: 6, cursor: 'pointer' }}>Cancelar</button>
            </>
          )}
          <button onClick={clearSelected} style={{ background: 'transparent', color: 'white', border: 'none', padding: 4, cursor: 'pointer', display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* List body */}
      {loading ? (
        <div style={{ padding: 24, color: '#94a3b8' }}>Carregando…</div>
      ) : zonas.length === 0 ? (
        <EmptyState brand={brand} />
      ) : sorted.length === 0 ? (
        <div style={{ padding: 24, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
          Nada com filtros atuais. <button onClick={() => { setSearch(''); setShowInactive(true) }} style={{ background: 'none', border: 'none', color: brand.brandPrimary, cursor: 'pointer', textDecoration: 'underline', font: 'inherit' }}>Limpar filtros</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {groups.map(([label, lista]) => (
            <div key={label}>
              {group !== 'none' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{
                    padding: '4px 10px', background: brand.brandSoft, color: brand.brandText,
                    borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
                  }}>{label}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{lista.length} {lista.length === 1 ? 'item' : 'itens'}</span>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                </div>
              )}
              {view === 'list' ? (
                <div style={{ display: 'grid', gap: 4 }}>
                  {lista.map(z => (
                    <ZonaRow key={z.id} z={z} brand={brand} taxaColor={taxaColor}
                      selected={selected.has(z.id)} onToggleSelect={() => toggleSelect(z.id)}
                      onUpdate={updateZona} onDelete={deleteZona} busy={busy === z.id} />
                  ))}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                  {lista.map(z => (
                    <ZonaCard key={z.id} z={z} brand={brand} taxaColor={taxaColor}
                      selected={selected.has(z.id)} onToggleSelect={() => toggleSelect(z.id)}
                      onUpdate={updateZona} onDelete={deleteZona} busy={busy === z.id} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// === Subcomponents ===

function StatTile({ label, value, sub, brand, icon: Icon }: any) {
  return (
    <div style={{
      padding: 14, background: 'white', border: '1px solid #e2e8f0', borderRadius: 12,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
        {Icon && <Icon size={11} style={{ color: brand.brandPrimary }} />}
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>{sub}</div>
    </div>
  )
}

function Divider() {
  return <span style={{ width: 1, height: 22, background: '#e2e8f0' }} />
}

function Dropdown({ icon, label, options, value, onChange, brand }: any) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
          background: open ? brand.brandSoft : 'white', color: open ? brand.brandText : '#475569',
          border: '1px solid', borderColor: open ? brand.brandBorder : '#e2e8f0',
          borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
        {icon}
        <span>{label}</span>
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 21,
            background: 'white', border: '1px solid #e2e8f0', borderRadius: 8,
            boxShadow: '0 8px 20px rgba(15,23,42,.10)', padding: 4, minWidth: 180,
          }}>
            {options.map((o: any) => {
              const on = value === o.id
              return (
                <button key={o.id} onClick={() => { onChange(o.id); setOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                    padding: '6px 10px', border: 'none', cursor: 'pointer', borderRadius: 6,
                    background: on ? brand.brandSoft : 'transparent',
                    color: on ? brand.brandText : '#0f172a', fontSize: 12, fontWeight: on ? 600 : 500,
                  }}
                  onMouseEnter={e => { if (!on) e.currentTarget.style.background = '#f8fafc' }}
                  onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}>
                  {on ? <Check size={12} /> : <span style={{ width: 12 }} />}
                  {o.label}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function ZonaRow({ z, brand, taxaColor, selected, onToggleSelect, onUpdate, onDelete, busy }: any) {
  const inactive = !z.ativo
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '24px 8px 1fr 110px 44px 28px',
      alignItems: 'center', gap: 12, padding: '8px 12px',
      background: selected ? brand.brandSoft : 'white',
      border: '1px solid', borderColor: selected ? brand.brandBorder : '#e2e8f0', borderRadius: 10,
      opacity: inactive ? 0.55 : 1,
    }}>
      <input type="checkbox" checked={selected} onChange={onToggleSelect}
        style={{ width: 16, height: 16, accentColor: brand.brandPrimary, cursor: 'pointer' }} />
      <span style={{ width: 4, height: 28, borderRadius: 2, background: z.ativo ? taxaColor(Number(z.taxa)) : '#cbd5e1' }} />
      <input defaultValue={z.bairro}
        onBlur={e => e.target.value !== z.bairro && e.target.value.trim() && onUpdate(z.id, { bairro: e.target.value.trim() })}
        style={{ border: '1px solid transparent', outline: 'none', background: 'transparent', padding: '4px 8px', borderRadius: 6, fontSize: 14, fontWeight: 500, color: '#0f172a' }}
        onFocus={e => { e.target.style.background = brand.brandSoft; e.target.style.borderColor = brand.brandBorder }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>R$</span>
        <input type="number" step="0.50" defaultValue={Number(z.taxa).toFixed(2)}
          onBlur={e => Number(e.target.value) !== Number(z.taxa) && onUpdate(z.id, { taxa: parseFloat(e.target.value) })}
          style={{ border: '1px solid transparent', outline: 'none', background: 'transparent', padding: '4px 6px', borderRadius: 6, fontSize: 14, fontWeight: 600, color: taxaColor(Number(z.taxa)), width: 76, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
          onFocus={e => { e.target.style.background = '#f8fafc'; e.target.style.borderColor = '#e2e8f0' }} />
      </div>
      <ToggleSwitch on={z.ativo} onChange={() => onUpdate(z.id, { ativo: !z.ativo })} brand={brand} />
      <button onClick={() => onDelete(z)} disabled={busy} title="Remover"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 6, borderRadius: 6, display: 'flex', justifyContent: 'center' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8' }}>
        {busy ? <Loader size={14} className="spin" /> : <Trash2 size={14} />}
      </button>
    </div>
  )
}

function ZonaCard({ z, brand, taxaColor, selected, onToggleSelect, onUpdate, onDelete, busy }: any) {
  const inactive = !z.ativo
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6, padding: 12,
      background: selected ? brand.brandSoft : 'white',
      border: '1px solid', borderColor: selected ? brand.brandBorder : '#e2e8f0', borderRadius: 12,
      opacity: inactive ? 0.55 : 1,
      borderLeft: '3px solid ' + (z.ativo ? taxaColor(Number(z.taxa)) : '#cbd5e1'),
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <input type="checkbox" checked={selected} onChange={onToggleSelect}
          style={{ width: 14, height: 14, accentColor: brand.brandPrimary, cursor: 'pointer' }} />
        <ToggleSwitch on={z.ativo} onChange={() => onUpdate(z.id, { ativo: !z.ativo })} brand={brand} small />
      </div>
      <input defaultValue={z.bairro}
        onBlur={e => e.target.value !== z.bairro && e.target.value.trim() && onUpdate(z.id, { bairro: e.target.value.trim() })}
        style={{ border: 'none', outline: 'none', background: 'transparent', padding: 0, fontSize: 14, fontWeight: 600, color: '#0f172a' }} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>R$</span>
        <input type="number" step="0.50" defaultValue={Number(z.taxa).toFixed(2)}
          onBlur={e => Number(e.target.value) !== Number(z.taxa) && onUpdate(z.id, { taxa: parseFloat(e.target.value) })}
          style={{ border: 'none', outline: 'none', background: 'transparent', padding: 0, fontSize: 18, fontWeight: 700, color: taxaColor(Number(z.taxa)), width: '100%', fontVariantNumeric: 'tabular-nums' }} />
      </div>
      <button onClick={() => onDelete(z)} disabled={busy}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-end' }}>
        {busy ? <Loader size={11} className="spin" /> : <Trash2 size={11} />} remover
      </button>
    </div>
  )
}

function ToggleSwitch({ on, onChange, brand, small }: any) {
  const W = small ? 32 : 40, H = small ? 18 : 22, T = small ? 14 : 18
  return (
    <button onClick={onChange} type="button" title={on ? 'Desativar' : 'Ativar'}
      style={{ width: W, height: H, borderRadius: 99, border: 'none', cursor: 'pointer', background: on ? brand.brandPrimary : '#cbd5e1', position: 'relative', padding: 0, flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: on ? W - T - 2 : 2, width: T, height: T, borderRadius: '50%', background: 'white', transition: 'left 160ms cubic-bezier(.16,1,.3,1)' }} />
    </button>
  )
}

function EmptyState({ brand }: any) {
  return (
    <div style={{
      padding: 48, background: 'white', border: '2px dashed #e2e8f0', borderRadius: 14, textAlign: 'center',
    }}>
      <MapPin size={42} style={{ color: brand.brandPrimary, opacity: 0.6 }} />
      <h3 style={{ margin: '12px 0 4px', fontSize: 16, fontWeight: 600 }}>Nenhuma zona ainda</h3>
      <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Use o campo acima pra adicionar bairro + taxa. IA vai usar pra calcular entrega.</p>
    </div>
  )
}
