"use client"
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, KeyRound, Loader, ArrowRight, ArrowLeft, AlertCircle, Grape, CheckCircle2, UserPlus } from 'lucide-react'
import { supabaseBrowser } from '@/lib/db/supabase-browser'
import { getTenant } from '@/lib/tenants'
import { maskPhone, digitsOnly, fullNumber, validatePhone } from '@/lib/utils/phone'

type Step = 'phone' | 'code' | 'signup' | 'signup-sent'

export default function LoginPage() {
  const router = useRouter()
  const tenant = getTenant('acai-da-barra')

  const [step, setStep] = useState<Step>('phone')
  const [telefone, setTelefone] = useState('')
  const [code, setCode] = useState('')
  const [nome, setNome] = useState('')
  const [loja, setLoja] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [resendIn, setResendIn] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const sb = supabaseBrowser()
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/admin')
    })
  }, [router])

  // Cooldown timer
  useEffect(() => {
    if (resendIn <= 0) return
    const t = setInterval(() => setResendIn(v => Math.max(0, v - 1)), 1000)
    return () => clearInterval(t)
  }, [resendIn])

  function rawPhone(): string {
    return fullNumber(telefone)
  }

  async function requestCode() {
    setErr(null); setLoading(true)
    try {
      const r = await fetch('/api/auth/wa/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ telefone: rawPhone() }),
      })
      const data = await r.json()
      if (r.status === 429 && data?.retry_after_sec) {
        setResendIn(data.retry_after_sec)
        setErr(data.error || 'aguarde antes de pedir novo código')
        setStep('code')
        setLoading(false); return
      }
      if (!r.ok) {
        setErr(data?.error || 'falha ao enviar código')
        setLoading(false); return
      }
      // Telefone não cadastrado — bloqueia (sem signup público)
      if (data?.registered === false) {
        setErr('Número não cadastrado. Contate o administrador para liberar acesso.')
        setLoading(false); return
      }
      setStep('code')
      setResendIn(30)
      setLoading(false)
      setTimeout(() => codeRef.current?.focus(), 50)
    } catch (e: any) {
      setErr(e?.message || 'erro de rede')
      setLoading(false)
    }
  }

  async function verifyCode() {
    setErr(null); setLoading(true)
    try {
      const r = await fetch('/api/auth/wa/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ telefone: rawPhone(), code: code.trim() }),
      })
      const data = await r.json()
      if (!r.ok || !data?.action_link) {
        setErr(data?.error || 'código inválido')
        setLoading(false); return
      }
      // Consome magiclink → cria session → redireciona /admin
      window.location.href = data.action_link
    } catch (e: any) {
      setErr(e?.message || 'erro de rede')
      setLoading(false)
    }
  }

  async function submitSignup() {
    setErr(null); setLoading(true)
    try {
      const r = await fetch('/api/auth/wa/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ telefone: rawPhone(), nome: nome.trim(), loja_solicitada: loja.trim() }),
      })
      const data = await r.json()
      if (!r.ok) {
        setErr(data?.error || 'falha ao solicitar acesso')
        setLoading(false); return
      }
      setStep('signup-sent')
      setLoading(false)
    } catch (e: any) {
      setErr(e?.message || 'erro de rede')
      setLoading(false)
    }
  }

  return (
    <div
      className="login-page"
      style={{
        ['--brand' as any]: tenant.brandPrimary,
        ['--brand-soft' as any]: tenant.brandSoft,
        ['--brand-border' as any]: tenant.brandBorder,
      }}
    >
      <div className="login-bg" aria-hidden="true">
        <div className="login-bg-grid" />
        <div
          className="login-bg-glow"
          style={{ background: `radial-gradient(circle, ${tenant.brandPrimary}22 0%, transparent 60%)` }}
        />
      </div>
      <div className="login-card">
        <div className="login-brand">
          <div
            className="login-icon"
            style={{ background: tenant.brandSoft, borderColor: tenant.brandBorder, color: tenant.brandText }}
          >
            <Grape size={26} strokeWidth={2} />
          </div>
          <h1>{tenant.name}<span style={{ color: tenant.brandPrimary }}>.</span></h1>
          <p>{tenant.tagline}</p>
        </div>

        {err && <div className="login-err"><AlertCircle size={14} />{err}</div>}

        {step === 'phone' && (() => {
          const v = validatePhone(telefone)
          const showWarn = digitsOnly(telefone).length >= 2 && !v.valid
          return (
          <form onSubmit={e => { e.preventDefault(); if (v.valid) requestCode() }} className="login-form">
            <label className="field">
              <span>WhatsApp</span>
              <div className="field-input" style={showWarn ? { borderColor: '#f97316' } : {}}>
                <Phone size={15} />
                <span style={{ color: '#94a3b8', fontSize: 14, marginRight: 4, userSelect: 'none' }}>🇧🇷 +55</span>
                <input
                  type="tel"
                  value={telefone}
                  onChange={e => setTelefone(maskPhone(e.target.value))}
                  placeholder="(45) 99999-9999"
                  autoFocus
                  inputMode="tel"
                />
              </div>
              {showWarn && (
                <div style={{ fontSize: 11.5, color: '#c2410c', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={11} />{v.warning}
                </div>
              )}
            </label>
            <button
              type="submit"
              className="btn btn-primary login-submit"
              disabled={loading || !v.valid}
              style={{ background: tenant.brandPrimary }}
            >
              {loading ? (<><Loader size={14} className="spin" />Enviando…</>) : (<>Enviar código no WhatsApp<ArrowRight size={14} /></>)}
            </button>
            <div className="login-foot">
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                Você receberá um código de 6 dígitos no seu WhatsApp.
              </span>
            </div>
          </form>
          )
        })()}

        {step === 'code' && (
          <form onSubmit={e => { e.preventDefault(); verifyCode() }} className="login-form">
            <div className="login-info">
              Código enviado para <b>{telefone}</b>.<br />
              <button type="button" className="login-link" onClick={() => { setStep('phone'); setCode(''); setErr(null) }}>
                <ArrowLeft size={11} /> Trocar número
              </button>
            </div>
            <label className="field">
              <span>Código (6 dígitos)</span>
              <div className="field-input">
                <KeyRound size={15} />
                <input
                  ref={codeRef}
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                  style={{ letterSpacing: '0.4em', fontSize: 18, fontWeight: 600, textAlign: 'center' }}
                />
              </div>
            </label>
            <button
              type="submit"
              className="btn btn-primary login-submit"
              disabled={loading || code.length !== 6}
              style={{ background: tenant.brandPrimary }}
            >
              {loading ? (<><Loader size={14} className="spin" />Validando…</>) : (<>Entrar<ArrowRight size={14} /></>)}
            </button>
            <button
              type="button"
              className="btn btn-soft"
              disabled={resendIn > 0 || loading}
              onClick={() => requestCode()}
            >
              {resendIn > 0 ? `Reenviar em ${resendIn}s` : 'Reenviar código'}
            </button>
          </form>
        )}

        {step === 'signup' && (
          <form onSubmit={e => { e.preventDefault(); submitSignup() }} className="login-form">
            <div className="login-info">
              <UserPlus size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              Telefone <b>{telefone}</b> não está cadastrado.<br />
              Solicite acesso ao painel:
            </div>
            <label className="field">
              <span>Nome completo</span>
              <div className="field-input">
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="João Silva" autoFocus />
              </div>
            </label>
            <label className="field">
              <span>Loja / Estabelecimento (opcional)</span>
              <div className="field-input">
                <input type="text" value={loja} onChange={e => setLoja(e.target.value)} placeholder="Açaí da Esquina" />
              </div>
            </label>
            <button
              type="submit"
              className="btn btn-primary login-submit"
              disabled={loading || nome.trim().length < 2}
              style={{ background: tenant.brandPrimary }}
            >
              {loading ? (<><Loader size={14} className="spin" />Enviando…</>) : (<>Solicitar acesso<ArrowRight size={14} /></>)}
            </button>
            <button type="button" className="btn btn-soft" onClick={() => { setStep('phone'); setErr(null) }}>
              <ArrowLeft size={13} /> Voltar
            </button>
          </form>
        )}

        {step === 'signup-sent' && (
          <div className="login-form">
            <div className="login-success">
              <CheckCircle2 size={36} style={{ color: tenant.brandPrimary }} />
              <h3>Solicitação enviada!</h3>
              <p>Você receberá uma mensagem no WhatsApp <b>{telefone}</b> assim que sua conta for aprovada.</p>
            </div>
            <button type="button" className="btn btn-soft" onClick={() => { setStep('phone'); setErr(null) }}>
              <ArrowLeft size={13} /> Voltar ao login
            </button>
          </div>
        )}

        <div className="login-foot">
          <span className="login-foot-meta">Inovaefoz · Painel SaaS · v1.0</span>
        </div>
      </div>
    </div>
  )
}
