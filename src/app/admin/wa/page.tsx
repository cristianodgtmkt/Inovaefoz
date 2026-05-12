"use client"
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/db/supabase-browser'

interface Channel {
  id: string
  label: string
  instance_name: string | null
  phone: string | null
  status: string
  qr_code_data: string | null
  qr_code_expires_at: string | null
  is_default: boolean
  last_status_check: string | null
  disconnect_reason: string | null
}

export default function WaChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [activeQR, setActiveQR] = useState<Channel | null>(null)
  const [erro, setErro] = useState('')

  async function load() {
    setLoading(true)
    const sb = supabaseBrowser()
    const { data } = await sb.from('ai_wa_channels').select('*').order('created_at', { ascending: false })
    setChannels((data as Channel[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // Realtime: atualiza quando status mudar
    const sb = supabaseBrowser()
    const ch = sb.channel('wa-channels-rt').on(
      'postgres_changes', { event: '*', schema: 'public', table: 'ai_wa_channels' }, () => load()
    ).subscribe()
    return () => { sb.removeChannel(ch) }
  }, [])

  async function createChannel() {
    if (!newLabel.trim()) return
    setCreating(true)
    setErro('')
    try {
      const sb = supabaseBrowser()
      const { data: { session } } = await sb.auth.getSession()
      const r = await fetch('/api/admin/wa-channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ label: newLabel }),
      })
      const j = await r.json()
      if (!r.ok) {
        setErro(j?.error || 'Falha ao criar')
        setCreating(false)
        return
      }
      setNewLabel('')
      await load()
      // Abre QR pra parear
      const ch = (channels.find(c => c.id === j.channel_id)) ||
        { id: j.channel_id, label: newLabel, instance_name: j.instance_name, status: j.status,
          qr_code_data: j.qr_code_base64, qr_code_expires_at: j.qr_expires_at, phone: null,
          is_default: false, last_status_check: null, disconnect_reason: null }
      setActiveQR(ch as Channel)
    } catch (e: any) {
      setErro(e?.message || 'Erro')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>WhatsApp · Canais</h1>
      <p style={{ color: '#64748b', marginBottom: 24, fontSize: 14 }}>
        Pareie um número WhatsApp escaneando o QR. Cada canal é uma instância isolada Evolution.
      </p>

      <div style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Adicionar novo canal</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Ex: WhatsApp Açaí (principal)"
            style={{ flex: 1, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }}
          />
          <button
            onClick={createChannel}
            disabled={creating || !newLabel.trim()}
            style={{
              background: creating || !newLabel.trim() ? '#e2e8f0' : '#9333ea',
              color: creating || !newLabel.trim() ? '#94a3b8' : 'white',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 700,
              cursor: creating ? 'not-allowed' : 'pointer',
            }}
          >
            {creating ? 'Criando...' : '+ Criar'}
          </button>
        </div>
        {erro && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{erro}</p>}
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Canais existentes</h2>
      {loading ? (
        <p>Carregando...</p>
      ) : channels.length === 0 ? (
        <div style={{ background: 'white', padding: 32, borderRadius: 12, border: '1px dashed #cbd5e1', textAlign: 'center', color: '#94a3b8' }}>
          Nenhum canal pareado. Crie o primeiro acima.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {channels.map(ch => (
            <div key={ch.id} style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{ch.label}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {ch.phone ? `📞 ${ch.phone} · ` : ''}
                  Instance: <code>{ch.instance_name}</code>
                </div>
                {ch.disconnect_reason && (
                  <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>⚠️ {ch.disconnect_reason}</div>
                )}
              </div>
              <StatusBadge status={ch.status} />
              {(ch.status === 'qr_required' || ch.status === 'connecting') && ch.qr_code_data && (
                <button
                  onClick={() => setActiveQR(ch)}
                  style={{ background: '#9333ea', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  📷 Mostrar QR
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal QR */}
      {activeQR && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16,
        }} onClick={() => setActiveQR(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: 16, padding: 24, maxWidth: 420, width: '100%', textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Escaneie o QR no WhatsApp</h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px' }}>
              WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho
            </p>
            {activeQR.qr_code_data ? (
              <img
                src={activeQR.qr_code_data.startsWith('data:') ? activeQR.qr_code_data : `data:image/png;base64,${activeQR.qr_code_data}`}
                alt="QR Code"
                style={{ width: 280, height: 280, margin: '0 auto', display: 'block', border: '1px solid #e2e8f0', borderRadius: 8 }}
              />
            ) : (
              <p style={{ color: '#94a3b8' }}>QR não disponível. Aguarde reconexão...</p>
            )}
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 12 }}>
              QR expira em ~60s. Se não funcionar, recarregue a página.
            </p>
            <button onClick={() => setActiveQR(null)} style={{ marginTop: 16, background: '#e2e8f0', color: '#0f172a', border: 'none', borderRadius: 8, padding: '8px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    connected: { bg: '#d1fae5', color: '#047857', label: '✓ Conectado' },
    qr_required: { bg: '#fef3c7', color: '#92400e', label: '📷 QR necessário' },
    connecting: { bg: '#dbeafe', color: '#1e40af', label: '⏳ Conectando' },
    disconnected: { bg: '#fee2e2', color: '#b91c1c', label: '⊗ Desconectado' },
    pending: { bg: '#f1f5f9', color: '#475569', label: '⏸ Pendente' },
  }
  const m = map[status] || { bg: '#f1f5f9', color: '#475569', label: status }
  return (
    <span style={{ background: m.bg, color: m.color, padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700 }}>
      {m.label}
    </span>
  )
}
