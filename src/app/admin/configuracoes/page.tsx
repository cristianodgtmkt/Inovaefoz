"use client"
import { useEffect, useState } from 'react'
import {
  Settings, Clock, CreditCard, MessageSquare, Users, Receipt,
  QrCode, Wallet, Ticket, MoreVertical, Plus, Check,
  UserPlus, Save, Upload, Trash2, Loader, Building2, MessageCircle, Edit2,
} from 'lucide-react'
import { useTenant } from '@/hooks/useTenant'
import { adminFetch, adminUpload } from '@/lib/api/admin-client'
import { maskPhone, fullNumber, validatePhone } from '@/lib/utils/phone'
import { fetchConfiguracoes, setConfiguracao } from '@/lib/db/queries'

const COLOR_SWATCHES = [
  { primary: '#7e22ce', hover: '#6b21a8', soft: '#f3e8ff', border: '#e9d5ff', text: '#581c87' },
  { primary: '#dc2626', hover: '#b91c1c', soft: '#fee2e2', border: '#fecaca', text: '#7f1d1d' },
  { primary: '#0891b2', hover: '#0e7490', soft: '#cffafe', border: '#a5f3fc', text: '#164e63' },
  { primary: '#16a34a', hover: '#15803d', soft: '#dcfce7', border: '#bbf7d0', text: '#14532d' },
  { primary: '#ea580c', hover: '#c2410c', soft: '#ffedd5', border: '#fed7aa', text: '#7c2d12' },
  { primary: '#0f172a', hover: '#020617', soft: '#e2e8f0', border: '#cbd5e1', text: '#020617' },
]

// ============================================================
// GERAL — tenant data + branding (logo + cor)
// ============================================================
function CfgGeral({ brand, reloadTenant }: { brand: any; reloadTenant: () => void }) {
  const [t, setT] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    adminFetch<any>('/api/admin/tenant/me').then(r => setT(r.tenant)).catch(e => setMsg('Erro: ' + e.message))
  }, [])

  function setField(k: string, v: any) { setT((c: any) => ({ ...c, [k]: v })) }
  function setBrand(k: string, v: any) { setT((c: any) => ({ ...c, brand: { ...(c.brand || {}), [k]: v } })) }

  async function save() {
    setSaving(true); setMsg('')
    try {
      await adminFetch('/api/admin/tenant/me', { method: 'PATCH', body: JSON.stringify({
        name: t.name, tagline: t.tagline, brand: t.brand, cnpj: t.cnpj, telefone: t.telefone,
        email: t.email, instagram: t.instagram, endereco_cep: t.endereco_cep,
        endereco_rua: t.endereco_rua, endereco_numero: t.endereco_numero,
        endereco_bairro: t.endereco_bairro, endereco_cidade: t.endereco_cidade, endereco_uf: t.endereco_uf,
      }) })
      setMsg('Salvo ✓')
      reloadTenant()
      setTimeout(() => setMsg(''), 2000)
    } catch (e: any) { setMsg('Erro: ' + e.message) }
    finally { setSaving(false) }
  }

  async function uploadLogo(file: File) {
    if (!file) return
    if (file.size > 1_000_000) { alert('Logo muito grande (max 1MB).'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const r = await adminUpload<any>('/api/admin/tenant/logo', fd)
      setBrand('logo_url', r.logo_url)
      reloadTenant()
    } catch (e: any) { alert('Erro upload: ' + e.message) }
    finally { setUploading(false) }
  }

  function selectColor(c: typeof COLOR_SWATCHES[0]) {
    const newBrand = { ...(t.brand || {}), primary: c.primary, primaryHover: c.hover, soft: c.soft, border: c.border, text: c.text }
    setT((cur: any) => ({ ...cur, brand: newBrand }))
  }

  if (!t) return <div style={{ padding: 24, color: '#94a3b8' }}>Carregando…</div>

  const cur = t.brand?.primary || brand.brandPrimary

  return (
    <>
      <div className="card">
        <div className="card-head">
          <div className="card-h">Identidade da loja</div>
          <button className="btn btn-primary btn-sm" style={{ background: brand.brandPrimary }} onClick={save} disabled={saving}>
            {saving ? <Loader size={13} className="spin" /> : <Save size={13} />}Salvar
          </button>
        </div>
        <div className="cfg-form">
          <label className="zon-field">
            <span className="zon-field-l">Nome da loja</span>
            <input className="zon-field-i" value={t.name || ''} onChange={e => setField('name', e.target.value)} />
          </label>
          <label className="zon-field">
            <span className="zon-field-l">Subtítulo (sidebar)</span>
            <input className="zon-field-i" value={t.tagline || ''} onChange={e => setField('tagline', e.target.value)} />
          </label>
          <label className="zon-field">
            <span className="zon-field-l">CNPJ</span>
            <input className="zon-field-i" value={t.cnpj || ''} onChange={e => setField('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
          </label>
          <label className="zon-field">
            <span className="zon-field-l">Telefone</span>
            <input className="zon-field-i" value={t.telefone || ''} onChange={e => setField('telefone', e.target.value)} placeholder="(45) 9XXXX-XXXX" />
          </label>
          <label className="zon-field">
            <span className="zon-field-l">E-mail</span>
            <input className="zon-field-i" value={t.email || ''} onChange={e => setField('email', e.target.value)} placeholder="contato@loja.com" />
          </label>
          <label className="zon-field">
            <span className="zon-field-l">Instagram</span>
            <input className="zon-field-i" value={t.instagram || ''} onChange={e => setField('instagram', e.target.value)} placeholder="@minha_loja" />
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-h">Endereço</div></div>
        <div className="cfg-form">
          <label className="zon-field">
            <span className="zon-field-l">CEP</span>
            <input className="zon-field-i" value={t.endereco_cep || ''} onChange={e => setField('endereco_cep', e.target.value)} placeholder="00000-000" />
          </label>
          <label className="zon-field">
            <span className="zon-field-l">Rua</span>
            <input className="zon-field-i" value={t.endereco_rua || ''} onChange={e => setField('endereco_rua', e.target.value)} />
          </label>
          <label className="zon-field">
            <span className="zon-field-l">Número</span>
            <input className="zon-field-i" value={t.endereco_numero || ''} onChange={e => setField('endereco_numero', e.target.value)} />
          </label>
          <label className="zon-field">
            <span className="zon-field-l">Bairro</span>
            <input className="zon-field-i" value={t.endereco_bairro || ''} onChange={e => setField('endereco_bairro', e.target.value)} />
          </label>
          <label className="zon-field">
            <span className="zon-field-l">Cidade</span>
            <input className="zon-field-i" value={t.endereco_cidade || ''} onChange={e => setField('endereco_cidade', e.target.value)} />
          </label>
          <label className="zon-field">
            <span className="zon-field-l">UF</span>
            <input className="zon-field-i" value={t.endereco_uf || ''} onChange={e => setField('endereco_uf', e.target.value)} maxLength={2} />
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-h">Branding (logo + cor)</div></div>
        <div className="cfg-brand" style={{ display: 'flex', gap: 24, padding: 16, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <div className="brand-mark" style={{
              background: t.brand?.soft || brand.brandSoft,
              border: '2px solid ' + (t.brand?.border || brand.brandBorder),
              width: 96, height: 96, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
              {t.brand?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.brand.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Building2 size={42} color={t.brand?.text || brand.brandText} />
              )}
            </div>
            <label className="btn btn-soft btn-sm" style={{ cursor: 'pointer' }}>
              {uploading ? <Loader size={13} className="spin" /> : <Upload size={13} />}
              Logo {uploading ? '…' : '(PNG max 1MB)'}
              <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            </label>
          </div>
          <div style={{ flex: 1 }}>
            <div className="cfg-l" style={{ marginBottom: 8 }}>Cor primária</div>
            <div className="cfg-swatches" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {COLOR_SWATCHES.map(c => (
                <button key={c.primary} className="cfg-swatch" onClick={() => selectColor(c)}
                  style={{
                    background: c.primary, width: 40, height: 40, borderRadius: 10,
                    border: 'none', cursor: 'pointer',
                    boxShadow: c.primary === cur ? `0 0 0 3px white, 0 0 0 5px ${c.primary}` : '',
                  }} title={c.primary} />
              ))}
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Mudança aplicada após salvar + recarregar página.</p>
          </div>
        </div>
      </div>

      {msg && <div className="card" style={{ padding: 12, color: msg.startsWith('Erro') ? '#dc2626' : '#16a34a' }}>{msg}</div>}
    </>
  )
}

// ============================================================
// HORÁRIOS
// ============================================================
function CfgHorarios({ brand }: { brand: any }) {
  const [cfg, setCfg] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetchConfiguracoes().then(c => {
      setCfg(c.horario_funcionamento || {
        segunda: { abre: '17:00', fecha: '23:30', ativo: true },
        terca: { abre: '17:00', fecha: '23:30', ativo: true },
        quarta: { abre: '17:00', fecha: '23:30', ativo: true },
        quinta: { abre: '17:00', fecha: '23:30', ativo: true },
        sexta: { abre: '17:00', fecha: '00:30', ativo: true },
        sabado: { abre: '14:00', fecha: '01:00', ativo: true },
        domingo: { abre: '14:00', fecha: '23:00', ativo: true },
      })
    }).catch(() => {})
  }, [])

  const dias = [
    { key: 'segunda', label: 'Segunda-feira' },
    { key: 'terca', label: 'Terça-feira' },
    { key: 'quarta', label: 'Quarta-feira' },
    { key: 'quinta', label: 'Quinta-feira' },
    { key: 'sexta', label: 'Sexta-feira' },
    { key: 'sabado', label: 'Sábado' },
    { key: 'domingo', label: 'Domingo' },
  ]

  function update(key: string, field: string, val: any) {
    setCfg((c: any) => ({ ...c, [key]: { ...c[key], [field]: val } }))
  }
  async function save() {
    setSaving(true); setMsg('')
    try { await setConfiguracao('horario_funcionamento', cfg); setMsg('Salvo ✓'); setTimeout(() => setMsg(''), 2000) }
    catch (e: any) { setMsg('Erro: ' + (e?.message || 'erro')) }
    finally { setSaving(false) }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-h">Horário de funcionamento</div>
        <button className="btn btn-primary btn-sm" style={{ background: brand.brandPrimary }} onClick={save} disabled={saving}>
          {saving ? <Loader size={13} className="spin" /> : <Save size={13} />}Salvar
        </button>
      </div>
      <div className="cfg-horarios" style={{ padding: 12 }}>
        {dias.map(d => {
          const h = cfg[d.key] || { abre: '17:00', fecha: '23:00', ativo: true }
          return (
            <div key={d.key} className="cfg-hrow" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 8 }}>
              <span className="cfg-hday" style={{ width: 140 }}>{d.label}</span>
              <button className="toggle" data-on={h.ativo || undefined}
                onClick={() => update(d.key, 'ativo', !h.ativo)}
                style={h.ativo ? { background: brand.brandPrimary } : {}}>
                <span className="toggle-thumb"></span>
              </button>
              <span className="cfg-hsep" style={{ fontSize: 12, color: h.ativo ? '#475569' : '#94a3b8' }}>
                {h.ativo ? 'aberto das' : 'fechado'}
              </span>
              {h.ativo && (
                <>
                  <input className="zon-field-i" type="time" value={h.abre} onChange={e => update(d.key, 'abre', e.target.value)} style={{ width: 100 }} />
                  <span>às</span>
                  <input className="zon-field-i" type="time" value={h.fecha} onChange={e => update(d.key, 'fecha', e.target.value)} style={{ width: 100 }} />
                </>
              )}
            </div>
          )
        })}
      </div>
      {msg && <div style={{ padding: 12, fontSize: 13, color: msg.startsWith('Erro') ? '#dc2626' : '#16a34a' }}>{msg}</div>}
    </div>
  )
}

// ============================================================
// WHATSAPP — copia comportamento existente (canais)
// ============================================================
function CfgWhatsApp({ brand }: { brand: any }) {
  const [channels, setChannels] = useState<any[]>([])
  const [creating, setCreating] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [activeQR, setActiveQR] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function authHeader() {
    const { supabaseBrowser } = await import('@/lib/db/supabase-browser')
    const sb = supabaseBrowser()
    const { data: { session } } = await sb.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}` }
  }

  async function load() {
    try {
      const { supabaseBrowser } = await import('@/lib/db/supabase-browser')
      const sb = supabaseBrowser()
      const { data } = await sb.from('ai_wa_channels').select('*').order('created_at', { ascending: false })
      setChannels(data || [])
    } catch {}
  }
  useEffect(() => { load(); const id = setInterval(load, 10000); return () => clearInterval(id) }, [])

  async function create() {
    if (!newLabel.trim()) return
    setCreating(true)
    try {
      const r = await fetch('/api/admin/wa-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ label: newLabel }),
      })
      const j = await r.json()
      if (!r.ok) { alert(j?.error || 'erro'); setCreating(false); return }
      setNewLabel('')
      await load()
      if (j.qr_code_base64) setActiveQR({ qr_code_data: j.qr_code_base64, label: newLabel })
      else alert('Canal criado mas QR ainda não gerou. Clica "QR" no canal.')
    } catch (e: any) { alert(e?.message) }
    setCreating(false)
  }

  async function refreshQR(ch: any) {
    setBusy(ch.id)
    try {
      const r = await fetch(`/api/admin/wa-channels/${ch.id}`, { headers: await authHeader() })
      const j = await r.json()
      if (!r.ok) { alert(j?.error || 'erro'); return }
      await load()
      if (j.qr_code_base64) setActiveQR({ qr_code_data: j.qr_code_base64, label: ch.label })
      else if (j.status === 'connected') alert('Canal já conectado!')
      else alert('Sem QR no momento.')
    } catch (e: any) { alert(e?.message) }
    setBusy(null)
  }

  async function setDefault(ch: any) {
    setBusy(ch.id)
    try {
      await fetch(`/api/admin/wa-channels/${ch.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ is_default: true }),
      })
      await load()
    } catch (e: any) { alert(e?.message) }
    setBusy(null)
  }

  async function rename(ch: any) {
    const newName = prompt('Novo nome do canal:', ch.label)
    if (!newName?.trim()) return
    setBusy(ch.id)
    try {
      await fetch(`/api/admin/wa-channels/${ch.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ label: newName.trim() }),
      })
      await load()
    } catch (e: any) { alert(e?.message) }
    setBusy(null)
  }

  async function remove(ch: any) {
    if (!confirm(`Excluir canal "${ch.label}"?`)) return
    setBusy(ch.id)
    try {
      await fetch(`/api/admin/wa-channels/${ch.id}`, { method: 'DELETE', headers: await authHeader() })
      await load()
    } catch (e: any) { alert(e?.message) }
    setBusy(null)
  }

  function statusBadge(status: string) {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      connected: { bg: '#dcfce7', color: '#166534', label: '✓ Conectado' },
      qr_required: { bg: '#fef3c7', color: '#92400e', label: '📷 Aguardando QR' },
      connecting: { bg: '#dbeafe', color: '#1e40af', label: '⏳ Conectando' },
      disconnected: { bg: '#fee2e2', color: '#b91c1c', label: '⊗ Desconectado' },
      pending: { bg: '#f1f5f9', color: '#475569', label: '⏸ Pendente' },
    }
    const m = map[status] || { bg: '#f1f5f9', color: '#475569', label: status }
    return <span style={{ background: m.bg, color: m.color, padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{m.label}</span>
  }

  return (
    <>
      <div className="card">
        <div className="card-head"><div className="card-h">Canais WhatsApp ({channels.length})</div></div>
        <div className="cfg-form">
          <div style={{ display: 'flex', gap: 10 }}>
            <input className="zon-field-i" style={{ flex: 1 }} placeholder="Nome do canal" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
            <button className="btn btn-primary" style={{ background: brand.brandPrimary }} onClick={create} disabled={creating || !newLabel.trim()}>
              <Plus size={14} />{creating ? 'Criando…' : 'Parear novo'}
            </button>
          </div>
        </div>
        {channels.length > 0 && (
          <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
            {channels.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <MessageSquare size={22} style={{ color: '#25D366', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong>{c.label}</strong>
                    {c.is_default && <span style={{ fontSize: 10, background: brand.brandSoft, color: brand.brandText, padding: '2px 8px', borderRadius: 99 }}>DEFAULT</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {c.phone || c.instance_name} · {c.last_status_check ? `verif. ${new Date(c.last_status_check).toLocaleTimeString('pt-BR')}` : 'sem check'}
                  </div>
                </div>
                {statusBadge(c.status)}
                <div style={{ display: 'flex', gap: 6 }}>
                  {c.status !== 'connected' && (
                    <button className="btn btn-soft btn-sm" onClick={() => refreshQR(c)} disabled={busy === c.id}>
                      <QrCode size={13} />{busy === c.id ? '…' : 'QR'}
                    </button>
                  )}
                  {!c.is_default && c.status === 'connected' && (
                    <button className="btn btn-soft btn-sm" onClick={() => setDefault(c)} disabled={busy === c.id}>
                      <Check size={13} />Default
                    </button>
                  )}
                  <button className="btn btn-soft btn-sm" onClick={() => rename(c)} disabled={busy === c.id}>Editar</button>
                  <button className="btn btn-soft btn-sm" onClick={() => remove(c)} disabled={busy === c.id} style={{ color: '#b91c1c' }}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeQR && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
          onClick={() => setActiveQR(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, padding: 28, maxWidth: 420, textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>Escaneie no WhatsApp</h3>
            <p className="muted" style={{ fontSize: 13, margin: '0 0 16px' }}>WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho</p>
            {activeQR.qr_code_data ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeQR.qr_code_data.startsWith('data:') ? activeQR.qr_code_data : `data:image/png;base64,${activeQR.qr_code_data}`}
                alt="QR" style={{ width: 280, height: 280, margin: '0 auto 12px', display: 'block', border: '1px solid #e2e8f0', borderRadius: 8 }} />
            ) : <p style={{ color: '#94a3b8' }}>Sem QR.</p>}
            <button className="btn btn-soft" onClick={() => setActiveQR(null)} style={{ marginTop: 12 }}>Fechar</button>
          </div>
        </div>
      )}
    </>
  )
}

// ============================================================
// PAGAMENTOS — JSONB editor real
// ============================================================
const DEFAULT_PAYS = [
  { id: 'pix', name: 'PIX', sub: 'instantâneo, sem taxa', icon: 'QrCode', enabled: true },
  { id: 'credit', name: 'Cartão crédito', sub: 'maquininha na entrega', icon: 'CreditCard', enabled: true },
  { id: 'debit', name: 'Cartão débito', sub: 'maquininha na entrega', icon: 'CreditCard', enabled: true },
  { id: 'cash', name: 'Dinheiro', sub: 'troco até R$ 100', icon: 'Wallet', enabled: true },
  { id: 'voucher', name: 'Vale-refeição', sub: 'Sodexo, VR, Ticket', icon: 'Ticket', enabled: false },
]

function CfgPagamentos({ brand }: { brand: any }) {
  const [methods, setMethods] = useState<any[]>(DEFAULT_PAYS)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    adminFetch<any>('/api/admin/ia/config').then(r => {
      const raw = r.config?.metodos_pagamento
      if (Array.isArray(raw) && raw.length > 0) {
        // Normalize: aceita ["pix","cash"] OU [{id,name,...}]
        const normalized = raw.map((item: any) => {
          if (typeof item === 'string') {
            const def = DEFAULT_PAYS.find(d => d.id === item)
            return def || { id: item, name: item, sub: '', icon: 'Wallet', enabled: true }
          }
          return { ...item, enabled: item.enabled !== false }
        })
        setMethods(normalized)
      }
    }).catch(() => {})
  }, [])

  function toggle(id: string) {
    setMethods(ms => ms.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m))
  }

  async function save() {
    setSaving(true); setMsg('')
    try {
      await adminFetch('/api/admin/ia/config', { method: 'PATCH', body: JSON.stringify({ metodos_pagamento: methods }) })
      setMsg('Salvo ✓'); setTimeout(() => setMsg(''), 2000)
    } catch (e: any) { setMsg('Erro: ' + e.message) }
    finally { setSaving(false) }
  }

  const ICONS: Record<string, any> = { QrCode, CreditCard, Wallet, Ticket }

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-h">Métodos de pagamento aceitos</div>
        <button className="btn btn-primary btn-sm" style={{ background: brand.brandPrimary }} onClick={save} disabled={saving}>
          {saving ? <Loader size={13} className="spin" /> : <Save size={13} />}Salvar
        </button>
      </div>
      <div className="cfg-pays" style={{ padding: 12 }}>
        {methods.map(m => {
          const Icon = ICONS[m.icon] || Wallet
          return (
            <div key={m.id} className="cfg-pay" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10 }}>
              <span className="cfg-pay-ico" style={{ background: brand.brandSoft, color: brand.brandPrimary, padding: 8, borderRadius: 8 }}>
                <Icon size={16} />
              </span>
              <div className="cfg-pay-text" style={{ flex: 1 }}>
                <div className="cfg-pay-name" style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{m.name}</div>
                <div className="cfg-pay-sub" style={{ fontSize: 12, color: '#64748b' }}>{m.sub}</div>
              </div>
              <button className="toggle" data-on={m.enabled || undefined}
                onClick={() => toggle(m.id)}
                style={m.enabled ? { background: brand.brandPrimary } : {}}>
                <span className="toggle-thumb"></span>
              </button>
            </div>
          )
        })}
      </div>
      {msg && <div style={{ padding: 12, fontSize: 13, color: msg.startsWith('Erro') ? '#dc2626' : '#16a34a' }}>{msg}</div>}
    </div>
  )
}

// ============================================================
// USUÁRIOS — list + invite + remove
// ============================================================
function CfgUsuarios({ brand }: { brand: any }) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteTel, setInviteTel] = useState('')
  const [inviteNome, setInviteNome] = useState('')
  const [inviteRole, setInviteRole] = useState('admin')
  const [inviting, setInviting] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    setLoading(true)
    try {
      const r = await adminFetch<any>('/api/admin/users')
      setUsers(r.users || [])
    } catch (e: any) { setMsg('Erro: ' + e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function invite() {
    const v = validatePhone(inviteTel)
    if (!v.valid || !inviteNome.trim()) {
      setMsg('Erro: ' + (v.warning || 'nome obrigatório'))
      return
    }
    setInviting(true); setMsg('')
    try {
      const r = await adminFetch<any>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ telefone: fullNumber(inviteTel), nome: inviteNome.trim(), role: inviteRole }),
      })
      setMsg(r?.wa_notified ? 'Convite enviado por WhatsApp ✓' : 'Convidado, mas WhatsApp não notificou')
      setInviteTel(''); setInviteNome('')
      load()
      setTimeout(() => setMsg(''), 3500)
    } catch (e: any) { setMsg('Erro: ' + e.message) }
    finally { setInviting(false) }
  }

  async function remove(u: any) {
    const id = u.id || u.user_id
    if (!confirm(`Remover ${u.nome || u.telefone || u.email} do tenant?`)) return
    try {
      await adminFetch(`/api/admin/users?user_id=${id}`, { method: 'DELETE' })
      load()
    } catch (e: any) { alert('Erro: ' + e.message) }
  }

  async function resendInvite(u: any) {
    if (!u.telefone) { alert('User sem telefone — edita primeiro'); return }
    try {
      const r = await adminFetch<any>(`/api/admin/users/${u.id || u.user_id}/resend`, { method: 'POST' })
      setMsg(r?.wa_notified ? 'Convite reenviado por WhatsApp ✓' : 'WhatsApp não enviou')
      setTimeout(() => setMsg(''), 3500)
    } catch (e: any) { alert('Erro: ' + e.message) }
  }

  async function editUser(u: any) {
    const novoNome = prompt('Nome:', u.nome || '')
    if (novoNome === null) return
    const novoTel = prompt('Telefone (só dígitos):', u.telefone || '')
    if (novoTel === null) return
    const novoRole = prompt('Role (owner/admin/manager/operator/viewer):', u.role || 'admin')
    if (novoRole === null) return
    try {
      await adminFetch(`/api/admin/users/${u.id || u.user_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ nome: novoNome.trim(), telefone: novoTel.replace(/\D/g, ''), role: novoRole.trim() }),
      })
      load()
    } catch (e: any) { alert('Erro: ' + e.message) }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-h">Equipe ({users.length})</div>
      </div>

      <div style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="zon-field-i" placeholder="Nome completo" value={inviteNome}
          onChange={e => setInviteNome(e.target.value)} style={{ flex: '1 1 180px' }} />
        <div className="zon-field-i" style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px' }}>
          <span style={{ color: '#94a3b8', fontSize: 13, userSelect: 'none' }}>🇧🇷 +55</span>
          <input
            value={inviteTel}
            onChange={e => setInviteTel(maskPhone(e.target.value))}
            placeholder="(45) 99999-9999"
            inputMode="tel"
            style={{ border: 0, outline: 0, flex: 1, padding: '8px 0', background: 'transparent', fontSize: 13 }}
          />
        </div>
        <select className="zon-field-i" value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ width: 120 }}>
          <option value="owner">owner</option>
          <option value="admin">admin</option>
          <option value="manager">manager</option>
          <option value="operator">operator</option>
          <option value="viewer">viewer</option>
        </select>
        <button className="btn btn-primary btn-sm" style={{ background: brand.brandPrimary }} onClick={invite}
          disabled={inviting || !validatePhone(inviteTel).valid || !inviteNome.trim()}>
          {inviting ? <Loader size={13} className="spin" /> : <UserPlus size={13} />}Convidar via WhatsApp
        </button>
      </div>

      {msg && <div style={{ padding: 12, fontSize: 13, color: msg.startsWith('Erro') ? '#dc2626' : '#16a34a' }}>{msg}</div>}

      {loading ? <p className="muted" style={{ padding: 16 }}>Carregando…</p> : (
        <div className="cfg-users" style={{ padding: 12 }}>
          {users.map(u => (
            <div key={u.user_id} className="cfg-user" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderBottom: '1px solid #f1f5f9' }}>
              <span className="cv-avatar" style={{ background: brand.brandPrimary, color: 'white', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>
                {((u.nome || u.email || '?').slice(0, 2)).toUpperCase()}
              </span>
              <div className="cfg-user-text" style={{ flex: 1 }}>
                <div className="cfg-user-name" style={{ fontSize: 14, fontWeight: 600 }}>
                  {u.nome || u.email}
                </div>
                <div className="cfg-user-email" style={{ fontSize: 12, color: '#94a3b8', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {u.telefone && <span>📱 {u.telefone}</span>}
                  {u.email && <span>✉ {u.email}</span>}
                  {u.last_sign_in_at && <span>· último acesso: {new Date(u.last_sign_in_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
              </div>
              <span className={`cfg-role cfg-role-${u.role}`} style={{ background: brand.brandSoft, color: brand.brandText, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                {u.role}
              </span>
              <button className="btn-icon" onClick={() => resendInvite(u)} title="Reenviar acesso WhatsApp" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a' }}>
                <MessageCircle size={14} />
              </button>
              <button className="btn-icon" onClick={() => editUser(u)} title="Editar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }}>
                <Edit2 size={14} />
              </button>
              <button className="btn-icon" onClick={() => remove(u)} title="Remover" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// FATURAMENTO (placeholder)
// ============================================================
function CfgFaturamento({ brand }: { brand: any }) {
  return (
    <>
      <div className="card">
        <div className="card-head"><div className="card-h">Plano atual</div></div>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 24 }}>Trial</h3>
            <span className="muted">grátis por 30 dias</span>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            Mensagens ilimitadas durante trial. Após o período, planos a partir de R$ 99/mês.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-h">Uso este mês</div></div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Mensagens IA</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>—</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Custo IA acumulado</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>—</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Pedidos processados</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>—</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-h">Histórico</div></div>
        <div style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>
          Sem histórico de faturas. Plano grátis em vigor.
        </div>
      </div>
    </>
  )
}

// ============================================================
// MAIN
// ============================================================
type Section = 'geral' | 'horarios' | 'whatsapp' | 'pagamentos' | 'usuarios' | 'faturamento'

export default function ConfigPage() {
  const { tenant, reload } = useTenant()
  const brand = tenant
  const [section, setSection] = useState<Section>('geral')
  const sections = [
    { id: 'geral' as const, label: 'Geral', Icon: Settings },
    { id: 'horarios' as const, label: 'Horários', Icon: Clock },
    { id: 'whatsapp' as const, label: 'WhatsApp', Icon: MessageSquare },
    { id: 'pagamentos' as const, label: 'Pagamentos', Icon: CreditCard },
    { id: 'usuarios' as const, label: 'Usuários', Icon: Users },
    { id: 'faturamento' as const, label: 'Faturamento', Icon: Receipt },
  ]

  return (
    <div className="cfg-page">
      <div className="page-head">
        <div>
          <h2>Configurações</h2>
          <p>Tenant <b>{tenant.name}</b></p>
        </div>
      </div>

      <div className="cfg-layout">
        <aside className="cfg-nav">
          {sections.map(s => (
            <button key={s.id} className="cfg-nav-item"
              data-active={section === s.id || undefined}
              onClick={() => setSection(s.id)}
              style={section === s.id ? { background: brand.brandSoft, color: brand.brandPrimary, borderLeftColor: brand.brandPrimary } : {}}>
              <s.Icon size={15} />{s.label}
            </button>
          ))}
        </aside>

        <section className="cfg-body">
          {section === 'geral' && <CfgGeral brand={brand} reloadTenant={reload} />}
          {section === 'horarios' && <CfgHorarios brand={brand} />}
          {section === 'whatsapp' && <CfgWhatsApp brand={brand} />}
          {section === 'pagamentos' && <CfgPagamentos brand={brand} />}
          {section === 'usuarios' && <CfgUsuarios brand={brand} />}
          {section === 'faturamento' && <CfgFaturamento brand={brand} />}
        </section>
      </div>
    </div>
  )
}
