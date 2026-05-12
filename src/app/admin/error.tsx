"use client"
import { useEffect } from 'react'

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[admin-error]', error)
  }, [error])

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ color: '#dc2626', marginBottom: 16 }}>Erro na página</h2>
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{error.name}: {error.message}</div>
        {error.digest && <div style={{ fontSize: 12, color: '#64748b' }}>Digest: {error.digest}</div>}
      </div>
      {error.stack && (
        <details style={{ background: '#f1f5f9', padding: 12, borderRadius: 8 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Stack trace</summary>
          <pre style={{ fontSize: 11, overflow: 'auto', marginTop: 12 }}>{error.stack}</pre>
        </details>
      )}
      <button onClick={reset} style={{ marginTop: 16, padding: '8px 16px', background: '#7e22ce', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
        Tentar novamente
      </button>
    </div>
  )
}
