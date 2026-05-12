"use client"
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabaseBrowser } from '@/lib/db/supabase-browser'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { useTenant } from '@/hooks/useTenant'

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  dashboard: { title: 'Operação · Dashboard' },
  pedidos: { title: 'Operação · Pedidos', subtitle: 'Kanban em tempo real' },
  conversas: { title: 'Operação · Conversas' },
  escalacoes: { title: 'Operação · Escalações' },
  clientes: { title: 'Gestão · Clientes' },
  cardapio: { title: 'Gestão · Cardápio' },
  ia: { title: 'Gestão · IA' },
  relatorios: { title: 'Gestão · Relatórios' },
  zonas: { title: 'Gestão · Zonas de entrega' },
  config: { title: 'Gestão · Configurações' },
}

function pageKeyFromPath(p: string | null): string {
  if (!p || p === '/admin' || p === '/admin/') return 'dashboard'
  const seg = p.replace('/admin/', '').split('/')[0]
  if (seg === 'configuracoes') return 'config'
  return seg
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [checking, setChecking] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { tenant, setAiPaused } = useTenant()

  // Auth gate
  useEffect(() => {
    const sb = supabaseBrowser()
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      setUser(session.user)
      setChecking(false)
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, session) => {
      if (!session) router.replace('/login'); else setUser(session.user)
    })
    return () => subscription.unsubscribe()
  }, [router])

  // Inject brand CSS vars + favicon
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--brand', tenant.brandPrimary)
    root.style.setProperty('--brand-hover', tenant.brandPrimaryHover)
    root.style.setProperty('--brand-soft', tenant.brandSoft)
    root.style.setProperty('--brand-border', tenant.brandBorder)
    root.style.setProperty('--brand-text', tenant.brandText)
  }, [tenant])

  async function handleToggleAi() {
    try {
      await setAiPaused(!tenant.ai_paused_global)
    } catch (e: any) {
      alert('Erro ao alterar IA: ' + e.message)
    }
  }

  async function logout() {
    await supabaseBrowser().auth.signOut()
    router.replace('/login')
  }

  if (checking) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Carregando…</div>
  }

  const key = pageKeyFromPath(pathname)
  const meta = PAGE_TITLES[key] || { title: '' }

  return (
    <div className="app">
      <Sidebar
        tenant={tenant}
        active={key}
        aiPaused={!!tenant.ai_paused_global}
        onToggleAi={handleToggleAi}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        user={user}
        onLogout={logout}
      />
      <div className="app-main">
        <Header
          title={meta.title}
          subtitle={meta.subtitle}
          connected={true}
          onMobileMenu={() => setMobileOpen(true)}
        />
        <main className="app-content">
          {children}
        </main>
        <Footer tenant={tenant} />
      </div>
    </div>
  )
}
