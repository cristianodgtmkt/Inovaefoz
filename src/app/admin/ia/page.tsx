"use client"
import { useEffect, useState } from 'react'
import {
  BarChart3, Shield, Search, FlaskConical, Download, Settings,
  MessageSquare, DollarSign, Zap, Database, Clock, TriangleAlert, UserCheck,
  Check, AlertCircle, Filter, Calendar, Flag, Loader, Play, Edit3, Plus,
  Brain, Cpu, Save, RefreshCw, FileText, X, Sparkles,
  Heart, Briefcase, PartyPopper, PhoneCall, Handshake, Gift,
  Lightbulb, Ban, ClipboardList, Scale, Target, Lock, Eye,
  ListChecks, ArrowUp, ArrowDown, GripVertical,
} from 'lucide-react'
import { StatCard } from '@/components/primitives'
import { fetchAiUsageDaily, fetchAiAudit, fetchAiGuardrails, fetchAiTracesToday, fetchTenantBudget } from '@/lib/db/queries'
import { adminFetch } from '@/lib/api/admin-client'

const DEFAULT_BRAND = {
  brandPrimary: '#7e22ce', brandPrimaryHover: '#6b21a8',
  brandSoft: '#f3e8ff', brandBorder: '#e9d5ff', brandText: '#581c87',
}

// ============================================================
// Tab: Visão Geral
// ============================================================
function CostChart({ brand, data }: { brand: any; data: any[] }) {
  const max = Math.max(6, ...data.map(d => Number(d.cost_cents || 0) / 100))
  return (
    <div className="cost-chart">
      <div className="cost-bars">
        {data.slice(0, 14).reverse().map((d, i) => {
          const v = Number(d.cost_cents || 0) / 100
          return (
            <div key={i} className="cost-bar-wrap">
              <div className="cost-bar" style={{ height: (v / max * 100) + '%', background: brand.brandPrimary }} title={`R$ ${v.toFixed(2)}`}></div>
            </div>
          )
        })}
        {Array.from({ length: Math.max(0, 14 - data.length) }).map((_, i) => (
          <div key={`e-${i}`} className="cost-bar-wrap"><div className="cost-bar" style={{ height: '0%' }}></div></div>
        ))}
      </div>
      <div className="cost-target" style={{ bottom: '83%' }}><span>meta R$ 6</span></div>
    </div>
  )
}

function IAOverview({ brand }: { brand: any }) {
  const [usage, setUsage] = useState<any[]>([])
  const [traces, setTraces] = useState<any[]>([])
  const [budget, setBudget] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [pauseSaving, setPauseSaving] = useState(false)

  useEffect(() => {
    Promise.all([fetchAiUsageDaily(), fetchAiTracesToday(), fetchTenantBudget()])
      .then(([u, t, b]) => { setUsage(u); setTraces(t); setBudget(b) })
      .catch(() => {})
      .finally(() => setLoading(false))
    adminFetch<any>('/api/admin/tenant/me').then(r => setPaused(!!r.tenant?.ai_paused_global)).catch(() => {})
  }, [])

  async function togglePause() {
    setPauseSaving(true)
    try {
      const next = !paused
      await adminFetch('/api/admin/tenant/me', { method: 'PATCH', body: JSON.stringify({ ai_paused_global: next }) })
      setPaused(next)
    } catch (e: any) { alert('Erro: ' + e.message) }
    finally { setPauseSaving(false) }
  }

  const today = usage[0] || {}
  // Removido: custo, tokens, headroom, budget — esses são internos (Inovaefoz), não pra cliente final
  const cards = [
    { icon: 'MessageSquare', label: 'Mensagens respondidas hoje', value: String(today.calls || 0), color: 'blue' },
    { icon: 'Clock', label: 'Tempo médio de resposta', value: today.avg_duration_ms ? `${(today.avg_duration_ms / 1000).toFixed(1)}s` : '—', color: 'cyan' },
    { icon: 'TriangleAlert', label: 'Casos pra atenção', value: '0', color: 'amber' },
    { icon: 'UserCheck', label: 'Resolvidas sem você', value: '—', color: 'green' },
  ]

  if (loading) return <div style={{ padding: 24, color: '#94a3b8' }}>Carregando…</div>

  return (
    <div className="ia-overview">
      <div className="card" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
        <div>
          <div style={{ fontWeight: 600 }}>IA pausada</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Quando pausada, ela para de responder. Você ou outro atendente respondem manualmente.</div>
        </div>
        <button className={`btn ${paused ? 'btn-primary' : 'btn-soft'}`} onClick={togglePause} disabled={pauseSaving}
          style={paused ? { background: '#dc2626' } : {}}>
          {pauseSaving ? <Loader size={14} className="spin" /> : null}
          {paused ? 'Pausada, clique pra ativar' : 'Ativa, clique pra pausar'}
        </button>
      </div>

      <div className="grid-stats">{cards.map((s, i) => <StatCard key={i} {...s as any} />)}</div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div className="card-h">Últimas conversas atendidas pela IA</div>
        </div>
        <div className="exec-list">
          {traces.length === 0 ? (
            <div style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>
              Nenhuma ainda. Assim que ela responder o primeiro cliente, aparece aqui.
            </div>
          ) : traces.map((t: any) => {
            const status = t.audit_verdict === 'fail' ? 'hallucination' : 'ok'
            const StatusIcon = status === 'ok' ? Check : TriangleAlert
            const intentMap: Record<string, string> = {
              greeting: 'Saudação', menu_responder: 'Cardápio', order_handler: 'Pedido',
              status_handler: 'Status', objection_handler: 'Reclamação', escalation_handler: 'Escalado',
            }
            const intentLabel = intentMap[t.specialist] || t.specialist || t.intent || '—'
            return (
              <div key={t.id} className="exec-row">
                <span className={`exec-status exec-status-${status}`}><StatusIcon size={11} /></span>
                <span className="exec-who">{t.telefone || '—'}</span>
                <span className="exec-intent">{intentLabel}</span>
                <span className="exec-lat">{t.duration_ms ? `${(t.duration_ms / 1000).toFixed(1)}s` : '—'}</span>
                <span></span>
                <span className="exec-when">{t.created_at?.slice(11, 16)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Tab: Configurações
// ============================================================
function IAConfig({ brand }: { brand: any }) {
  const [cfg, setCfg] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    adminFetch<any>('/api/admin/ia/config').then(r => setCfg(r.config)).catch(e => setMsg('Erro: ' + e.message))
  }, [])

  function setField(k: string, v: any) {
    setCfg((c: any) => ({ ...c, [k]: v }))
  }

  async function save() {
    setSaving(true); setMsg('')
    try {
      await adminFetch('/api/admin/ia/config', {
        method: 'PATCH',
        body: JSON.stringify({
          budget_cents_per_day: Number(cfg.budget_cents_per_day) || 1000,
          audit_mode: cfg.audit_mode,
          guardrail_enforce_mode: cfg.guardrail_enforce_mode,
          allow_contact_disclosure: !!cfg.allow_contact_disclosure,
          followup_enabled: !!cfg.followup_enabled,
          daily_report_enabled: !!cfg.daily_report_enabled,
          daily_report_hour: Number(cfg.daily_report_hour) || 8,
          suspect_items: cfg.suspect_items || [],
          price_whitelist_centavos: cfg.price_whitelist_centavos || [],
          guardrails_disabled: cfg.guardrails_disabled || [],
        }),
      })
      setMsg('Salvo ✓')
      setTimeout(() => setMsg(''), 2000)
    } catch (e: any) { setMsg('Erro: ' + e.message) }
    finally { setSaving(false) }
  }

  if (!cfg) return <div style={{ padding: 24, color: '#94a3b8' }}>Carregando configuração…</div>

  const guardrailNames = ['price_whitelist', 'item_must_exist', 'delivery_address', 'order_total_match', 'format']
  const disabledSet = new Set<string>(cfg.guardrails_disabled || [])
  const budgetReais = (cfg.budget_cents_per_day || 1000) / 100

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* SECTION: Budget */}
      <section style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Budget diário</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>Limite gasto IA por dia. Acima → handoff humano automático.</p>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: brand.brandPrimary, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            R$ {budgetReais.toFixed(2)}
          </div>
        </div>
        <input type="range" min={1} max={500} step={1} value={budgetReais}
          onChange={e => setField('budget_cents_per_day', Math.round(Number(e.target.value) * 100))}
          style={{ width: '100%', accentColor: brand.brandPrimary }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
          <span>R$ 1</span>
          <span>R$ 250</span>
          <span>R$ 500</span>
        </div>
      </section>

      {/* SECTION: Modes (segmented) */}
      <section style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Modo de execução</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Segmented
            label="Auditor de respostas"
            help="log_only: só registra · block: bloqueia respostas suspeitas"
            value={cfg.audit_mode}
            options={[{ id: 'log_only', label: 'Log apenas' }, { id: 'block', label: 'Bloquear' }]}
            onChange={v => setField('audit_mode', v)}
            brand={brand}
          />
          <Segmented
            label="Guardrails"
            help="soft: corrige silenciosamente · strict: falha + escala humano"
            value={cfg.guardrail_enforce_mode}
            options={[{ id: 'soft', label: 'Soft' }, { id: 'strict', label: 'Strict' }]}
            onChange={v => setField('guardrail_enforce_mode', v)}
            brand={brand}
          />
        </div>
      </section>

      {/* SECTION: Lists */}
      <section style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Listas customizadas</h3>
        <div style={{ display: 'grid', gap: 14 }}>
          <FieldGroup label="Itens suspeitos (não devem aparecer em respostas)" help='Ex: "trufado", "gourmet". Se IA mencionar, guardrail bloqueia.'>
            <ChipsEditor values={cfg.suspect_items || []} onChange={v => setField('suspect_items', v)} placeholder="ex: trufado" />
          </FieldGroup>
          <FieldGroup label="Preços extra na whitelist (em centavos)" help="Whitelist auto inclui preços do cardápio. Use isso pra valores especiais ex: combos.">
            <ChipsEditor values={(cfg.price_whitelist_centavos || []).map(String)} onChange={v => setField('price_whitelist_centavos', v.map((x: string) => parseInt(x) || 0).filter((x: number) => x > 0))} placeholder="ex: 2490" type="number" />
          </FieldGroup>
          <FieldGroup label="Guardrails desativados" help="Click pra alternar. Desativado = não corre na pipeline.">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {guardrailNames.map(g => {
                const off = disabledSet.has(g)
                return (
                  <button key={g} onClick={() => {
                    const set = new Set(disabledSet)
                    if (off) set.delete(g); else set.add(g)
                    setField('guardrails_disabled', Array.from(set))
                  }}
                  style={{
                    padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                    border: '1px solid', cursor: 'pointer',
                    background: off ? '#f8fafc' : brand.brandSoft,
                    borderColor: off ? '#e2e8f0' : brand.brandPrimary,
                    color: off ? '#94a3b8' : brand.brandText,
                    textDecoration: off ? 'line-through' : 'none',
                  }}>{g}</button>
                )
              })}
            </div>
          </FieldGroup>
        </div>
      </section>

      {/* SECTION: Toggles */}
      <section style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Comportamento</h3>
        <div style={{ display: 'grid', gap: 4 }}>
          <ToggleRow label="Permitir compartilhar contato" help="IA pode passar telefone/email da loja em conversa." checked={!!cfg.allow_contact_disclosure} onChange={v => setField('allow_contact_disclosure', v)} brand={brand} />
          <ToggleRow label="Follow-up automático" help="Mensagem ~18h depois pra carrinho abandonado." checked={!!cfg.followup_enabled} onChange={v => setField('followup_enabled', v)} brand={brand} />
          <ToggleRow label="Relatório diário" help="Resumo do dia anterior por WhatsApp pro admin." checked={!!cfg.daily_report_enabled} onChange={v => setField('daily_report_enabled', v)} brand={brand}
            extra={cfg.daily_report_enabled && (
              <span style={{ fontSize: 12, color: '#64748b' }}>às
                <input type="number" min={0} max={23} value={cfg.daily_report_hour || 8}
                  onChange={e => setField('daily_report_hour', Number(e.target.value))}
                  style={{ width: 50, marginLeft: 6, padding: '2px 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }} />
                h
              </span>
            )} />
        </div>
      </section>

      {/* Save bar — sticky */}
      <div style={{
        position: 'sticky', bottom: 16, zIndex: 5,
        background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12,
        display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end',
        boxShadow: '0 -4px 12px rgba(15,23,42,.06)',
      }}>
        {msg && <span style={{ fontSize: 13, color: msg.startsWith('Erro') ? '#dc2626' : '#16a34a' }}>{msg}</span>}
        <button onClick={save} disabled={saving}
          style={{
            background: brand.brandPrimary, color: 'white', border: 'none',
            padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 6, cursor: saving ? 'wait' : 'pointer',
          }}>
          {saving ? <Loader size={14} className="spin" /> : <Save size={14} />}Salvar configurações
        </button>
      </div>
    </div>
  )
}

function Segmented({ label, help, value, options, onChange, brand }: any) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 8, gap: 2 }}>
        {options.map((o: any) => {
          const on = value === o.id
          return (
            <button key={o.id} onClick={() => onChange(o.id)}
              style={{
                flex: 1, padding: '6px 12px', border: 'none', borderRadius: 6, cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                background: on ? 'white' : 'transparent',
                color: on ? brand.brandText : '#64748b',
                boxShadow: on ? '0 1px 2px rgba(15,23,42,.08)' : 'none',
                transition: 'background 120ms',
              }}>{o.label}</button>
          )
        })}
      </div>
      {help && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{help}</div>}
    </div>
  )
}

function FieldGroup({ label, help, children }: any) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>{label}</div>
      {children}
      {help && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{help}</div>}
    </div>
  )
}

function ToggleRow({ label, help, checked, onChange, brand, extra }: any) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
      borderBottom: '1px solid #f1f5f9',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{label}</div>
        {help && <div style={{ fontSize: 11, color: '#94a3b8' }}>{help}</div>}
      </div>
      {extra}
      <button onClick={() => onChange(!checked)} type="button"
        style={{
          width: 40, height: 22, borderRadius: 99, border: 'none', cursor: 'pointer',
          background: checked ? brand.brandPrimary : '#cbd5e1',
          position: 'relative', padding: 0, flexShrink: 0,
        }}>
        <span style={{
          position: 'absolute', top: 2, left: checked ? 20 : 2,
          width: 18, height: 18, borderRadius: '50%', background: 'white',
          transition: 'left 160ms cubic-bezier(.16,1,.3,1)',
        }} />
      </button>
    </div>
  )
}

function ChipsEditor({ values, onChange, placeholder, type }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string; type?: string }) {
  const [input, setInput] = useState('')
  function add() {
    const v = input.trim()
    if (!v) return
    onChange([...values, v])
    setInput('')
  }
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
      {values.map((v, i) => (
        <span key={i} className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {v}
          <button onClick={() => onChange(values.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={11} /></button>
        </span>
      ))}
      <input className="input" type={type || 'text'} placeholder={placeholder} value={input}
        onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
        style={{ width: 140 }} />
      <button className="btn btn-soft" onClick={add}><Plus size={12} /></button>
    </div>
  )
}

// ============================================================
// Tab: Prompts
// ============================================================
function IAPrompts({ brand }: { brand: any }) {
  const [prompts, setPrompts] = useState<Record<string, any>>({})
  const [edit, setEdit] = useState<string>('router')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  function load() {
    adminFetch<any>('/api/admin/ia/prompts').then(r => {
      const map: Record<string, any> = {}
      for (const p of (r.prompts || [])) map[p.specialist] = p
      setPrompts(map)
      if (map[edit]) setContent(map[edit].content)
    }).catch(e => setMsg('Erro: ' + e.message))
  }

  function selectSpecialist(s: string) {
    setEdit(s)
    setContent(prompts[s]?.content || '')
    setMsg('')
  }

  async function save() {
    setSaving(true); setMsg('')
    try {
      await adminFetch(`/api/admin/ia/prompts/${edit}`, { method: 'PATCH', body: JSON.stringify({ content }) })
      setMsg('Salvo ✓')
      load()
      setTimeout(() => setMsg(''), 2000)
    } catch (e: any) { setMsg('Erro: ' + e.message) }
    finally { setSaving(false) }
  }

  const specialists = ['router', 'menu', 'order', 'objection', 'auditor', 'greeting']
  const cur = prompts[edit]

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {specialists.map(s => (
          <button key={s} className={`chip ${edit === s ? 'chip-active' : ''}`}
            onClick={() => selectSpecialist(s)}
            style={edit === s ? { background: brand.brandPrimary, color: 'white' } : {}}>
            {s}
          </button>
        ))}
      </div>

      {cur && (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
          Atualizado: {cur.updated_at?.slice(0, 16) || '—'}
        </div>
      )}

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={20}
        className="input"
        style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
      />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
        <button className="btn btn-primary" style={{ background: brand.brandPrimary }} onClick={save} disabled={saving}>
          {saving ? <Loader size={14} className="spin" /> : <Save size={14} />}
          Salvar prompt
        </button>
        {msg && <span style={{ fontSize: 13, color: msg.startsWith('Erro') ? '#dc2626' : '#16a34a' }}>{msg}</span>}
      </div>
    </div>
  )
}

// ============================================================
// Tab: Modelos
// ============================================================
const MODEL_OPTIONS: Record<string, { value: string; label: string; price: string }[]> = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o mini', price: '~$0.15/1M in' },
    { value: 'gpt-4o', label: 'GPT-4o', price: '~$2.50/1M in' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini', price: '~$0.40/1M in' },
  ],
  anthropic: [
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', price: '~$1.00/1M in' },
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', price: '~$3.00/1M in' },
  ],
}

function IAModels({ brand }: { brand: any }) {
  const [cfg, setCfg] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    adminFetch<any>('/api/admin/ia/config').then(r => setCfg(r.config)).catch(e => setMsg('Erro: ' + e.message))
  }, [])

  function setM(k: string, v: string) { setCfg((c: any) => ({ ...c, [k]: v })) }

  async function save() {
    setSaving(true); setMsg('')
    try {
      await adminFetch('/api/admin/ia/config', { method: 'PATCH', body: JSON.stringify({
        model_router: cfg.model_router, model_menu: cfg.model_menu,
        model_order: cfg.model_order, model_objection: cfg.model_objection,
        model_auditor: cfg.model_auditor,
      }) })
      setMsg('Salvo ✓')
      setTimeout(() => setMsg(''), 2000)
    } catch (e: any) { setMsg('Erro: ' + e.message) }
    finally { setSaving(false) }
  }

  if (!cfg) return <div style={{ padding: 24, color: '#94a3b8' }}>Carregando…</div>

  const slots = [
    { key: 'model_router', label: 'Router (classifica intent)', provider: 'openai', def: 'gpt-4o-mini' },
    { key: 'model_menu', label: 'Menu/RAG', provider: 'openai', def: 'gpt-4o-mini' },
    { key: 'model_order', label: 'Order handler', provider: 'anthropic', def: 'claude-sonnet-4-5-20250929' },
    { key: 'model_objection', label: 'Objection handler', provider: 'anthropic', def: 'claude-sonnet-4-5-20250929' },
    { key: 'model_auditor', label: 'Auditor', provider: 'anthropic', def: 'claude-haiku-4-5-20251001' },
  ]

  return (
    <div className="card" style={{ padding: 20, display: 'grid', gap: 14 }}>
      {slots.map(s => {
        const opts = MODEL_OPTIONS[s.provider]
        const cur = cfg[s.key] || s.def
        const meta = opts.find(o => o.value === cur)
        return (
          <div key={s.key} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 100px', gap: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</label>
            <select className="input" value={cur} onChange={e => setM(s.key, e.target.value)}>
              {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <span style={{ fontSize: 11, color: '#64748b' }}>{meta?.price || ''}</span>
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <button className="btn btn-primary" style={{ background: brand.brandPrimary }} onClick={save} disabled={saving}>
          {saving ? <Loader size={14} className="spin" /> : <Save size={14} />}
          Salvar modelos
        </button>
        {msg && <span style={{ fontSize: 13, color: msg.startsWith('Erro') ? '#dc2626' : '#16a34a' }}>{msg}</span>}
      </div>
    </div>
  )
}

// ============================================================
// Tab: RAG Debug
// ============================================================
function IARAGDebug({ brand }: { brand: any }) {
  const [query, setQuery] = useState('açaí trufado')
  const [chunks, setChunks] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState('')

  async function run() {
    setRunning(true); setMsg(''); setChunks([])
    try {
      const r = await adminFetch<any>('/api/admin/ia/rag-debug', { method: 'POST', body: JSON.stringify({ query, k: 6 }) })
      setChunks(r.chunks || [])
      setStats(r.stats || null)
    } catch (e: any) { setMsg('Erro: ' + e.message) }
    finally { setRunning(false) }
  }

  async function rebuild() {
    setMsg('Recompilando…')
    try {
      await adminFetch('/api/admin/cardapio/rebuild-kb', { method: 'POST' })
      setMsg('KB recompilada ✓')
      run()
    } catch (e: any) { setMsg('Erro: ' + e.message) }
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input className="input" style={{ flex: 1 }} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} />
        <button className="btn btn-primary" style={{ background: brand.brandPrimary }} onClick={run} disabled={running}>
          {running ? <Loader size={14} className="spin" /> : <Search size={14} />}
          Buscar
        </button>
        <button className="btn btn-soft" onClick={rebuild}><RefreshCw size={14} />Recompilar KB</button>
      </div>

      {msg && <div style={{ fontSize: 13, color: msg.startsWith('Erro') ? '#dc2626' : '#16a34a', marginBottom: 8 }}>{msg}</div>}

      {stats && (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
          KB: {stats.chunk_count || 0} chunks · Última compilação: {stats.last_built_at?.slice(0, 16) || '—'}
        </div>
      )}

      <div style={{ display: 'grid', gap: 8 }}>
        {chunks.map((c, i) => (
          <div key={i} className="card" style={{ padding: 12, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>#{i + 1} · {c.source_type || '—'}</span>
              <span style={{ color: '#64748b' }}>score: {c.similarity?.toFixed(3) || c.score?.toFixed(3) || '—'}</span>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, color: '#475569' }}>{c.content}</pre>
          </div>
        ))}
        {chunks.length === 0 && !running && <div style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>Sem resultados ainda. Digite uma query e clique buscar.</div>}
      </div>
    </div>
  )
}

// ============================================================
// Tab: Testbed REAL
// ============================================================
function IATestbed({ brand }: { brand: any }) {
  const [input, setInput] = useState('Quero 2 açaí 700ml com leite condensado, nutella e ovomaltine.')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [err, setErr] = useState('')

  async function run() {
    setRunning(true); setResult(null); setErr('')
    try {
      const r = await adminFetch<any>('/api/admin/ia/testbed', { method: 'POST', body: JSON.stringify({ message: input }) })
      setResult(r)
    } catch (e: any) { setErr(e.message) }
    finally { setRunning(false) }
  }

  return (
    <div className="ia-testbed">
      <div className="card">
        <div className="card-head">
          <div className="card-h">Testbed do agente</div>
          <span className="muted">execução REAL · não envia WhatsApp · não grava conversa</span>
        </div>
        <div className="tb-input" style={{ padding: 12 }}>
          <textarea value={input} onChange={e => setInput(e.target.value)} rows={3} className="input" style={{ width: '100%' }} />
          <div className="tb-actions" style={{ marginTop: 8 }}>
            <button className="btn btn-primary" style={{ background: brand.brandPrimary }} onClick={run} disabled={running}>
              {running ? <><Loader size={14} className="spin" />Executando...</> : <><Play size={14} />Rodar</>}
            </button>
          </div>
        </div>
      </div>

      {err && <div className="card" style={{ marginTop: 12, padding: 12, color: '#dc2626', fontSize: 13 }}>Erro: {err}</div>}

      {result && (
        <>
          <div className="card" style={{ marginTop: 12, padding: 16 }}>
            <div className="card-h" style={{ marginBottom: 8 }}>Resposta do agente</div>
            <div className="tb-bubble" style={{ background: brand.brandPrimary, color: 'white', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{result.reply}</div>
          </div>

          <div className="ia-grid-2" style={{ marginTop: 12 }}>
            <div className="card" style={{ padding: 12 }}>
              <div className="card-h" style={{ marginBottom: 8 }}>Pipeline trace</div>
              <ul className="ai-list" style={{ fontSize: 12 }}>
                <li><span>Intent</span><b>{result.intent}</b></li>
                <li><span>Specialist</span><b>{result.specialist}</b></li>
                <li><span>Audit verdict</span><b style={{ color: result.audit_verdict === 'fail' ? '#dc2626' : '#16a34a' }}>{result.audit_verdict}</b></li>
                <li><span>Tools called</span><b>{(result.tools_called || []).join(', ') || '—'}</b></li>
                <li><span>Chunks recuperados</span><b>{(result.retrieved_chunk_ids || []).length}</b></li>
                <li><span>Escalou?</span><b>{result.shouldEscalate ? 'sim' : 'não'}</b></li>
                <li><span>Guardrail failures</span><b>{(result.guardrail_failures || []).length}</b></li>
              </ul>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div className="card-h" style={{ marginBottom: 8 }}>Métricas</div>
              <ul className="ai-list" style={{ fontSize: 12 }}>
                <li><span>Tokens in</span><b>{result.tokens_in}</b></li>
                <li><span>Tokens out</span><b>{result.tokens_out}</b></li>
                <li><span>Custo</span><b>R$ {(result.cost_cents / 100).toFixed(4)}</b></li>
                <li><span>Latência</span><b>{result.duration_ms}ms</b></li>
                <li><span>Tenant</span><b>{result.tenant_id?.slice(0, 8)}…</b></li>
              </ul>
            </div>
          </div>

          {(result.guardrail_failures || []).length > 0 && (
            <div className="card" style={{ marginTop: 12, padding: 12, fontSize: 13 }}>
              <div className="card-h" style={{ marginBottom: 8 }}>Guardrail failures</div>
              {(result.guardrail_failures as string[]).map((f, i) => <div key={i} style={{ color: '#dc2626' }}>• {f}</div>)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================
// Tab: Auditoria + Guardrails
// ============================================================
function IAGuardrails({ brand }: { brand: any }) {
  const [items, setItems] = useState<any[]>([])
  useEffect(() => { fetchAiGuardrails(50).then(setItems).catch(() => {}) }, [])
  return (
    <div className="ia-guardrails">
      <div className="card">
        <div className="card-head"><div className="card-h">Bloqueios recentes ({items.length})</div></div>
        <div className="gr-list">
          {items.length === 0 ? (
            <div style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>Nenhum guardrail bloqueou ainda.</div>
          ) : items.map((g: any) => (
            <div key={g.id} className="gr-row">
              <div className="gr-l">
                <div className="gr-name">
                  <Shield size={14} />
                  <code>{g.guardrail}</code>
                  <span className="gr-pill gr-pill-a">bloqueado</span>
                </div>
                <div className="gr-desc">{g.reason || g.specialist}</div>
                {g.original_text && <div className="gr-examples">Texto: <i>{(g.original_text || '').slice(0, 100)}</i></div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function IAAudit() {
  const [items, setItems] = useState<any[]>([])
  useEffect(() => { fetchAiAudit(30).then(setItems).catch(() => {}) }, [])
  return (
    <div className="ia-audit">
      <div className="card">
        <div className="card-head"><div className="card-h">Casos sinalizados ({items.length})</div></div>
        <div className="audit-list">
          {items.length === 0 ? (
            <div style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>Auditor nada sinalizou ainda.</div>
          ) : items.map((a: any) => (
            <div key={a.id} className="audit-row">
              <span className={`audit-sev audit-sev-${a.severity || 'low'}`}>{a.severity || 'low'}</span>
              <div className="audit-body">
                <div className="audit-kind">{(a.issue || '').replace('_', ' ')}</div>
                <div className="audit-text">"{a.original_reply}"</div>
                <div className="audit-meta">specialist <b>{a.specialist}</b> · {a.created_at?.slice(0, 16)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// IA PERSONALIDADE — multiple choice em PT-BR simples
// ============================================================
const PERSONALIDADE_CHOICES = {
  tom: {
    title: 'Como ela deve falar com o cliente?',
    help: 'Escolha o tom que combina com sua loja',
    options: [
      { id: 'amigavel', label: 'Amigável', Icon: Heart, desc: 'Conversa próxima e calorosa. "Oi, tudo bem?"' },
      { id: 'profissional', label: 'Profissional', Icon: Briefcase, desc: 'Direto e formal. "Olá, em que posso ajudar?"' },
      { id: 'brincalhao', label: 'Brincalhão', Icon: PartyPopper, desc: 'Bem-humorado e descolado. "E aí, fala comigo!"' },
    ],
  },
  reclamacao: {
    title: 'Quando o cliente reclama, o que ela faz?',
    help: 'Reclamações sobre demora, qualidade ou erro',
    options: [
      { id: 'escala_sempre', label: 'Sempre chama você', Icon: PhoneCall, desc: 'Qualquer reclamação vira atendimento humano' },
      { id: 'tenta_resolver', label: 'Tenta acalmar primeiro', Icon: Handshake, desc: 'Pede desculpas, oferece solução. Se piorar, chama você' },
      { id: 'oferece_brinde', label: 'Pode oferecer brinde', Icon: Gift, desc: 'Pode dar item grátis até R$ 5 pra resolver na hora' },
    ],
  },
  item_sem: {
    title: 'Cliente pediu algo que não temos. E aí?',
    help: 'Item fora do cardápio ou esgotado',
    options: [
      { id: 'sugere', label: 'Sugere algo parecido', Icon: Lightbulb, desc: '"Não temos X mas tenho Y, parecido. Quer experimentar?"' },
      { id: 'avisa', label: 'Avisa direto', Icon: Ban, desc: '"Esse item não está no cardápio hoje."' },
      { id: 'chama_voce', label: 'Te avisa pra confirmar', Icon: ClipboardList, desc: 'Manda mensagem pra você decidir se vale incluir' },
    ],
  },
  velocidade: {
    title: 'Velocidade ou cuidado?',
    help: 'Trade-off entre responder rápido vs verificar mais',
    options: [
      { id: 'rapida', label: 'Mais rápida', Icon: Zap, desc: 'Responde em segundos. Custa menos. Pode errar mais.' },
      { id: 'equilibrada', label: 'Equilibrada', Icon: Scale, desc: 'Velocidade boa + cuidado. Recomendado.' },
      { id: 'cuidadosa', label: 'Mais cuidadosa', Icon: Target, desc: 'Demora mais, erra menos. Custa mais.' },
    ],
  },
  contato: {
    title: 'Pode dar telefone/endereço da loja?',
    help: 'Quando cliente pede informação de contato',
    options: [
      { id: 'sim', label: 'Pode dar', Icon: Check, desc: 'Cliente pode pedir e ela responde direto' },
      { id: 'nao', label: 'Não pode', Icon: Lock, desc: 'Quando perguntarem, ela direciona pra outro canal' },
    ],
  },
}

function IAPersonalidade({ brand }: { brand: any }) {
  const [cfg, setCfg] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    adminFetch<any>('/api/admin/ia/config').then(r => {
      setCfg({
        tom: r.config?.persona_tom || 'amigavel',
        reclamacao: r.config?.persona_reclamacao || 'tenta_resolver',
        item_sem: r.config?.persona_item_sem || 'sugere',
        velocidade: r.config?.persona_velocidade || 'equilibrada',
        contato: r.config?.persona_contato || (r.config?.allow_contact_disclosure ? 'sim' : 'nao'),
      })
    }).catch(e => setMsg('Erro: ' + e.message))
  }, [])

  async function pick(field: string, value: string) {
    setCfg((c: any) => ({ ...c, [field]: value }))
    setSaving(true); setMsg('')
    try {
      const patch: any = { [`persona_${field}`]: value }
      // Map persona_contato → allow_contact_disclosure (existing column)
      if (field === 'contato') patch.allow_contact_disclosure = value === 'sim'
      // Map persona_velocidade → models (rapido = mini, cuidadoso = sonnet)
      if (field === 'velocidade') {
        const speedMap: Record<string, any> = {
          rapida: { model_menu: 'gpt-4o-mini', model_order: 'claude-haiku-4-5-20251001' },
          equilibrada: { model_menu: 'gpt-4o-mini', model_order: 'claude-sonnet-4-5-20250929' },
          cuidadosa: { model_menu: 'gpt-4o', model_order: 'claude-sonnet-4-5-20250929' },
        }
        Object.assign(patch, speedMap[value] || {})
      }
      await adminFetch('/api/admin/ia/config', { method: 'PATCH', body: JSON.stringify(patch) })
      setMsg('Salvo automaticamente ✓')
      setTimeout(() => setMsg(''), 1500)
    } catch (e: any) { setMsg('Erro: ' + e.message) }
    finally { setSaving(false) }
  }

  if (!cfg) return <div style={{ padding: 24, color: '#94a3b8' }}>Carregando…</div>

  return (
    <div style={{ display: 'grid', gap: 20, paddingBottom: 40 }}>
      <div style={{
        padding: 16, background: brand.brandSoft, borderRadius: 12, display: 'flex', gap: 14, alignItems: 'center',
      }}>
        <span style={{
          width: 44, height: 44, borderRadius: 12, background: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: brand.brandPrimary,
        }}>
          <Sparkles size={22} strokeWidth={1.75} />
        </span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: brand.brandText }}>Personalidade da sua atendente</div>
          <div style={{ fontSize: 12, color: brand.brandText, opacity: 0.85 }}>
            Escolha como você quer que ela trabalhe. Salva sozinho enquanto você seleciona.
            {saving && <span style={{ marginLeft: 8 }}><Loader size={11} className="spin" /></span>}
            {msg && <span style={{ marginLeft: 8, color: msg.startsWith('Erro') ? '#dc2626' : brand.brandText, fontWeight: 600 }}>{msg}</span>}
          </div>
        </div>
      </div>

      {Object.entries(PERSONALIDADE_CHOICES).map(([field, group]) => (
        <section key={field}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{group.title}</h3>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>{group.help}</p>
          <div style={{
            display: 'grid', gridTemplateColumns: `repeat(${group.options.length}, 1fr)`, gap: 10,
          }}>
            {group.options.map(o => {
              const on = cfg[field] === o.id
              const OptIcon = o.Icon
              return (
                <button key={o.id} onClick={() => pick(field, o.id)}
                  style={{
                    padding: 16, textAlign: 'left', cursor: 'pointer', borderRadius: 12,
                    border: '2px solid', borderColor: on ? brand.brandPrimary : '#e2e8f0',
                    background: on ? brand.brandSoft : 'white',
                    display: 'flex', flexDirection: 'column', gap: 8,
                    transition: 'border-color 120ms, background 120ms',
                  }}
                  onMouseEnter={e => { if (!on) e.currentTarget.style.borderColor = brand.brandBorder }}
                  onMouseLeave={e => { if (!on) e.currentTarget.style.borderColor = '#e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      width: 38, height: 38, borderRadius: 10, display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center',
                      background: on ? 'white' : '#f8fafc',
                      color: on ? brand.brandPrimary : '#475569',
                    }}>
                      <OptIcon size={18} strokeWidth={1.75} />
                    </span>
                    {on && <Check size={18} style={{ color: brand.brandPrimary }} />}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: on ? brand.brandText : '#0f172a' }}>{o.label}</div>
                  <div style={{ fontSize: 12, color: on ? brand.brandText : '#64748b', opacity: on ? 0.85 : 1, lineHeight: 1.4 }}>{o.desc}</div>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

// ============================================================
// IA LIMITES — versão simples de Configurações
// ============================================================
function IALimites({ brand }: { brand: any }) {
  const [cfg, setCfg] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    adminFetch<any>('/api/admin/ia/config').then(r => setCfg(r.config)).catch(e => setMsg('Erro: ' + e.message))
  }, [])

  async function update(patch: any) {
    setCfg((c: any) => ({ ...c, ...patch }))
    setSaving(true); setMsg('')
    try {
      await adminFetch('/api/admin/ia/config', { method: 'PATCH', body: JSON.stringify(patch) })
      setMsg('Salvo ✓'); setTimeout(() => setMsg(''), 1500)
    } catch (e: any) { setMsg('Erro: ' + e.message) }
    finally { setSaving(false) }
  }

  if (!cfg) return <div style={{ padding: 24, color: '#94a3b8' }}>Carregando…</div>

  const protecaoMap: Record<string, { label: string; desc: string }> = {
    log_only: { label: 'Suave', desc: 'Avisa quando algo estranho mas não bloqueia. Bom pra começar.' },
    block: { label: 'Rigorosa', desc: 'Bloqueia respostas suspeitas. Mais segura mas pode atrasar.' },
  }

  return (
    <div style={{ display: 'grid', gap: 20, paddingBottom: 40 }}>
      <div style={{ padding: 16, background: brand.brandSoft, borderRadius: 12, display: 'flex', gap: 14, alignItems: 'center' }}>
        <span style={{
          width: 44, height: 44, borderRadius: 12, background: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: brand.brandPrimary,
        }}>
          <Shield size={22} strokeWidth={1.75} />
        </span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: brand.brandText }}>Comportamento da atendente</div>
          <div style={{ fontSize: 12, color: brand.brandText, opacity: 0.85 }}>
            Como ela protege sua loja contra erros e o que ela faz sozinha.
            {saving && <span style={{ marginLeft: 8 }}><Loader size={11} className="spin" /></span>}
            {msg && <span style={{ marginLeft: 8, fontWeight: 600 }}>{msg}</span>}
          </div>
        </div>
      </div>

      {/* Modo proteção */}
      <section>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Nível de proteção</h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>
          Quanto a IA deve ser cuidadosa pra não dar resposta errada (preço inventado, item que não existe, etc)
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {(['log_only', 'block'] as const).map(m => {
            const on = cfg.audit_mode === m
            const meta = protecaoMap[m]
            const ProtIcon = m === 'block' ? Shield : Eye
            return (
              <button key={m} onClick={() => update({ audit_mode: m, guardrail_enforce_mode: m === 'block' ? 'strict' : 'soft' })}
                style={{
                  padding: 16, textAlign: 'left', cursor: 'pointer', borderRadius: 12,
                  border: '2px solid', borderColor: on ? brand.brandPrimary : '#e2e8f0',
                  background: on ? brand.brandSoft : 'white',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    width: 38, height: 38, borderRadius: 10, display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: on ? 'white' : '#f8fafc',
                    color: on ? brand.brandPrimary : '#475569',
                  }}>
                    <ProtIcon size={18} strokeWidth={1.75} />
                  </span>
                  {on && <Check size={18} style={{ color: brand.brandPrimary }} />}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: on ? brand.brandText : '#0f172a' }}>{meta.label}</div>
                <div style={{ fontSize: 12, color: on ? brand.brandText : '#64748b', lineHeight: 1.4 }}>{meta.desc}</div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Comportamentos automáticos */}
      <section>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Comportamentos automáticos</h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>O que ela faz sozinha sem você pedir</p>
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 4 }}>
          <SimpleToggleRow
            label="Lembrar carrinho abandonado"
            help="Manda msg pro cliente que abandonou pedido há ~18h"
            checked={!!cfg.followup_enabled}
            onChange={v => update({ followup_enabled: v })}
            brand={brand}
          />
          <SimpleToggleRow
            label="Resumo diário no seu WhatsApp"
            help="Manda relatório do dia anterior toda manhã"
            checked={!!cfg.daily_report_enabled}
            onChange={v => update({ daily_report_enabled: v })}
            brand={brand}
          />
        </div>
      </section>
    </div>
  )
}

function SimpleToggleRow({ label, help, checked, onChange, brand }: any) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
      borderBottom: '1px solid #f1f5f9',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{label}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{help}</div>
      </div>
      <button onClick={() => onChange(!checked)} type="button"
        style={{
          width: 44, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer',
          background: checked ? brand.brandPrimary : '#cbd5e1',
          position: 'relative', padding: 0, flexShrink: 0,
        }}>
        <span style={{
          position: 'absolute', top: 2, left: checked ? 22 : 2,
          width: 20, height: 20, borderRadius: '50%', background: 'white',
          transition: 'left 160ms cubic-bezier(.16,1,.3,1)',
        }} />
      </button>
    </div>
  )
}

// ============================================================
// IA ETAPAS DO PEDIDO — blueprint editor
// ============================================================
const STEP_TYPE_LABELS: Record<string, string> = {
  choice: 'Escolha 1 opção',
  choice_produto: 'Escolha do produto',
  choice_tamanho: 'Escolha tamanho',
  multi_choice_sabor: 'Sabores (1+)',
  multi_choice_complemento: 'Complementos (0+)',
  quantity: 'Quantidade do item',
  add_more_items: 'Adicionar outro item?',
  address: 'Endereço',
  currency: 'Valor em R$',
  text: 'Texto livre',
  phone: 'Telefone',
  confirm: 'Confirmação final',
}

const DEFAULT_BLUEPRINT_UI = [
  { id: 'item', label: 'Produto', type: 'choice_produto', scope: 'item', prompt: 'Qual produto?', required: true, order: 1 },
  { id: 'tamanho', label: 'Tamanho', type: 'choice_tamanho', scope: 'item', prompt: 'Qual tamanho?', required: true, order: 2, only_if: 'item.has_tamanhos' },
  { id: 'sabores', label: 'Sabores', type: 'multi_choice_sabor', scope: 'item', prompt: 'Qual sabor?', required: true, min: 1, max: 3, order: 3, only_if: 'item.has_sabores' },
  { id: 'complementos', label: 'Complementos', type: 'multi_choice_complemento', scope: 'item', prompt: 'Quer complementos?', required: false, min: 0, max: 5, order: 4, only_if: 'item.has_complementos' },
  { id: 'quantidade', label: 'Quantidade', type: 'quantity', scope: 'item', prompt: 'Quantos?', required: true, min: 1, max: 99, order: 5 },
  { id: 'adicionar_mais', label: 'Mais um item?', type: 'add_more_items', scope: 'item', prompt: 'Quer adicionar outro item ou pode fechar?', required: true, options: ['adicionar', 'fechar'], order: 6 },
  { id: 'tipo_entrega', label: 'Entrega ou retirada', type: 'choice', scope: 'order', prompt: 'É entrega ou retirada?', required: true, options: ['entrega', 'retirada'], order: 10 },
  { id: 'endereco', label: 'Endereço', type: 'address', scope: 'order', prompt: 'Bairro, rua e número?', required: true, only_if: 'tipo_entrega=entrega', order: 11 },
  { id: 'pagamento', label: 'Pagamento', type: 'choice', scope: 'order', prompt: 'PIX, cartão ou dinheiro?', required: true, options: ['pix', 'cartao', 'dinheiro'], order: 12 },
  { id: 'troco', label: 'Troco', type: 'currency', scope: 'order', prompt: 'Troco pra quanto?', required: true, only_if: 'pagamento=dinheiro', order: 13 },
  { id: 'confirmacao', label: 'Confirmação', type: 'confirm', scope: 'order', prompt: 'Confirma o pedido?', required: true, order: 99 },
]

function IAEtapasPedido({ brand }: { brand: any }) {
  const [steps, setSteps] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [editing, setEditing] = useState<string | null>(null)

  useEffect(() => {
    adminFetch<any>('/api/admin/ia/config').then(r => {
      const bp = r.config?.order_blueprint
      setSteps(Array.isArray(bp) && bp.length > 0 ? bp.sort((a: any, b: any) => a.order - b.order) : DEFAULT_BLUEPRINT_UI)
    }).catch(e => setMsg('Erro: ' + e.message))
  }, [])

  async function persist(newSteps: any[]) {
    setSaving(true); setMsg('')
    try {
      await adminFetch('/api/admin/ia/config', { method: 'PATCH', body: JSON.stringify({ order_blueprint: newSteps }) })
      setMsg('Salvo ✓'); setTimeout(() => setMsg(''), 1500)
    } catch (e: any) { setMsg('Erro: ' + e.message) }
    finally { setSaving(false) }
  }

  function update(id: string, patch: any) {
    const newSteps = steps.map(s => s.id === id ? { ...s, ...patch } : s)
    setSteps(newSteps); persist(newSteps)
  }
  function move(id: string, dir: -1 | 1) {
    const idx = steps.findIndex(s => s.id === id)
    if (idx < 0) return
    const target = idx + dir
    if (target < 0 || target >= steps.length) return
    const arr = steps.slice()
    const [moved] = arr.splice(idx, 1)
    arr.splice(target, 0, moved)
    const reordered = arr.map((s, i) => ({ ...s, order: (i + 1) * 10 }))
    setSteps(reordered); persist(reordered)
  }
  function remove(id: string) {
    if (!confirm('Remover essa etapa?')) return
    const newSteps = steps.filter(s => s.id !== id)
    setSteps(newSteps); persist(newSteps)
  }
  function reset() {
    if (!confirm('Voltar pras etapas padrão? Vai perder customizações.')) return
    setSteps(DEFAULT_BLUEPRINT_UI); persist(DEFAULT_BLUEPRINT_UI)
  }

  return (
    <div style={{ display: 'grid', gap: 20, paddingBottom: 40 }}>
      <div style={{ padding: 16, background: brand.brandSoft, borderRadius: 12, display: 'flex', gap: 14, alignItems: 'center' }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: brand.brandPrimary }}>
          <ListChecks size={22} strokeWidth={1.75} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: brand.brandText }}>Etapas do pedido</div>
          <div style={{ fontSize: 12, color: brand.brandText, opacity: 0.85 }}>
            Defina o que a IA TEM que coletar antes de fechar pedido. Ela só salva quando todas etapas obrigatórias preencheram.
            {saving && <span style={{ marginLeft: 8 }}><Loader size={11} className="spin" /></span>}
            {msg && <span style={{ marginLeft: 8, fontWeight: 600 }}>{msg}</span>}
          </div>
        </div>
        <button onClick={reset}
          style={{ background: 'transparent', border: '1px solid white', color: 'white', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Restaurar padrão
        </button>
      </div>

      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          {steps.map((s, i) => {
            const isEditing = editing === s.id
            return (
              <div key={s.id} style={{
                border: '1px solid', borderColor: isEditing ? brand.brandBorder : '#e2e8f0',
                borderRadius: 10, padding: 12, background: isEditing ? brand.brandSoft : 'white',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: brand.brandSoft, color: brand.brandText,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 12, fontVariantNumeric: 'tabular-nums',
                  }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{s.label}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                        background: s.scope === 'item' ? '#fef3c7' : '#dbeafe',
                        color: s.scope === 'item' ? '#854d0e' : '#1e40af',
                        textTransform: 'uppercase',
                      }}>{s.scope === 'item' ? 'por item' : 'do pedido'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      {STEP_TYPE_LABELS[s.type] || s.type}
                      {s.required ? ' · obrigatório' : ' · opcional'}
                      {s.only_if && ` · só se ${s.only_if}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => move(s.id, -1)} disabled={i === 0} style={iconBtn}><ArrowUp size={13} /></button>
                    <button onClick={() => move(s.id, 1)} disabled={i === steps.length - 1} style={iconBtn}><ArrowDown size={13} /></button>
                    <button onClick={() => setEditing(isEditing ? null : s.id)} style={{ ...iconBtn, color: brand.brandPrimary }}>
                      <Edit3 size={13} />
                    </button>
                    <button onClick={() => remove(s.id)} style={{ ...iconBtn, color: '#dc2626' }}><X size={13} /></button>
                  </div>
                </div>

                {isEditing && (
                  <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                    <Field label="Pergunta que ela faz">
                      <input className="input" defaultValue={s.prompt}
                        onBlur={e => e.target.value !== s.prompt && update(s.id, { prompt: e.target.value })}
                        style={{ width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
                    </Field>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="checkbox" defaultChecked={s.required}
                          onChange={e => update(s.id, { required: e.target.checked })} />
                        Obrigatório
                      </label>
                      {(s.type === 'multi_choice_sabor' || s.type === 'multi_choice_complemento') && (
                        <>
                          <label>min: <input type="number" defaultValue={s.min || 0}
                            onBlur={e => update(s.id, { min: Number(e.target.value) })}
                            style={{ width: 50, padding: '2px 6px', border: '1px solid #e2e8f0', borderRadius: 4 }} /></label>
                          <label>max: <input type="number" defaultValue={s.max || 5}
                            onBlur={e => update(s.id, { max: Number(e.target.value) })}
                            style={{ width: 50, padding: '2px 6px', border: '1px solid #e2e8f0', borderRadius: 4 }} /></label>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {steps.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            Sem etapas. Clica restaurar padrão pra começar.
          </div>
        )}
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  width: 26, height: 26, border: 'none', cursor: 'pointer',
  background: 'transparent', borderRadius: 6, color: '#64748b',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}

function Field({ label, children }: any) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  )
}

// ============================================================
// MAIN
// ============================================================
type Tab = 'overview' | 'personalidade' | 'limites' | 'pedido' | 'cardapio' | 'testar' | 'historico'

export default function IAPage() {
  const [brand, setBrand] = useState(DEFAULT_BRAND)

  useEffect(() => {
    adminFetch<any>('/api/admin/tenant/me').then(r => {
      const b = r.tenant?.brand || {}
      setBrand({
        brandPrimary: b.primary || DEFAULT_BRAND.brandPrimary,
        brandPrimaryHover: b.primaryHover || DEFAULT_BRAND.brandPrimaryHover,
        brandSoft: b.soft || DEFAULT_BRAND.brandSoft,
        brandBorder: b.border || DEFAULT_BRAND.brandBorder,
        brandText: b.text || DEFAULT_BRAND.brandText,
      })
    }).catch(() => {})
  }, [])

  const [tab, setTab] = useState<Tab>('overview')

  const tabs: { id: Tab; label: string; Icon: any }[] = [
    { id: 'overview', label: 'Visão geral', Icon: BarChart3 },
    { id: 'personalidade', label: 'Personalidade', Icon: Sparkles },
    { id: 'pedido', label: 'Etapas do pedido', Icon: ListChecks },
    { id: 'limites', label: 'Comportamento', Icon: Shield },
    { id: 'cardapio', label: 'Cardápio que ela conhece', Icon: Database },
    { id: 'testar', label: 'Testar conversa', Icon: MessageSquare },
    { id: 'historico', label: 'Histórico', Icon: Search },
  ]

  return (
    <div className="ia-page">
      <div className="page-head">
        <div>
          <h2>IA Atendente</h2>
          <p>Como ela conversa, quanto pode gastar, o que sabe sobre seu negócio</p>
        </div>
      </div>

      <div className="ia-tabs" style={{ flexWrap: 'wrap', display: 'flex', gap: 4, marginBottom: 20 }}>
        {tabs.map(t => {
          const on = tab === t.id
          return (
            <button key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer',
                background: on ? brand.brandSoft : 'transparent',
                color: on ? brand.brandPrimary : '#64748b',
                fontSize: 13, fontWeight: 600,
                borderBottom: on ? `2px solid ${brand.brandPrimary}` : '2px solid transparent',
              }}>
              <t.Icon size={14} strokeWidth={1.75} />{t.label}
            </button>
          )
        })}
      </div>

      {tab === 'overview' && <IAOverview brand={brand} />}
      {tab === 'personalidade' && <IAPersonalidade brand={brand} />}
      {tab === 'pedido' && <IAEtapasPedido brand={brand} />}
      {tab === 'limites' && <IALimites brand={brand} />}
      {tab === 'cardapio' && <IARAGDebug brand={brand} />}
      {tab === 'testar' && <IATestbed brand={brand} />}
      {tab === 'historico' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ background: brand.brandSoft, padding: 14, borderRadius: 12, fontSize: 13, color: brand.brandText, display: 'flex', gap: 10, alignItems: 'center' }}>
            <Search size={16} strokeWidth={1.75} style={{ flexShrink: 0 }} />
            <span>Conversas onde a IA teve dificuldade ou acionou o sistema de proteção. Use pra ajustar a personalidade.</span>
          </div>
          <IAAudit />
          <IAGuardrails brand={brand} />
        </div>
      )}
    </div>
  )
}
