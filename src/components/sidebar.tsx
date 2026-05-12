"use client"
import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, ShoppingBag, MessageSquare, TriangleAlert, Users,
  Utensils, BrainCircuit, BarChart3, MapPin, Settings,
  Pause, Sparkles, LogOut,
  Grape, Flame,
} from 'lucide-react'
import type { Tenant } from '@/lib/tenants'
import { supabaseBrowser } from '@/lib/db/supabase-browser'

function useBadgeCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({})

  async function fetchCounts() {
    try {
      const sb = supabaseBrowser()
      const yesterday = new Date(Date.now() - 86400_000).toISOString()
      const [pedidos, conversas, escalacoes] = await Promise.all([
        sb.from('pedidos').select('id', { count: 'exact', head: true })
          .in('status', ['novo_pedido', 'em_preparo', 'pronto_retirar', 'saiu_entrega']),
        sb.from('conversas').select('id', { count: 'exact', head: true }).gte('created_at', yesterday),
        sb.from('conversas').select('id', { count: 'exact', head: true }).eq('intent', 'escalation'),
      ])
      setCounts({
        pedidos: pedidos.count || 0,
        conversas: conversas.count || 0,
        escalacoes: escalacoes.count || 0,
      })
    } catch {}
  }

  useEffect(() => {
    fetchCounts()
    const id = setInterval(fetchCounts, 30_000)
    return () => clearInterval(id)
  }, [])

  return counts
}

const ICON_MAP: Record<string, any> = {
  LayoutDashboard, ShoppingBag, MessageSquare, TriangleAlert,
  Users, Utensils, BrainCircuit, BarChart3, MapPin, Settings,
  Pause, Sparkles, LogOut,
  Grape, Flame,
}

const NAV_OPERACAO = [
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', href: '/admin' },
  { id: 'pedidos', label: 'Pedidos', icon: 'ShoppingBag', href: '/admin/pedidos', countKey: 'pedidos' },
  { id: 'conversas', label: 'Conversas', icon: 'MessageSquare', href: '/admin/conversas', countKey: 'conversas' },
  { id: 'escalacoes', label: 'Escalações', icon: 'TriangleAlert', href: '/admin/escalacoes', countKey: 'escalacoes', badgeKind: 'danger' },
]

const NAV_GESTAO = [
  { id: 'clientes', label: 'Clientes', icon: 'Users', href: '/admin/clientes' },
  { id: 'cardapio', label: 'Cardápio', icon: 'Utensils', href: '/admin/cardapio' },
  { id: 'ia', label: 'IA', icon: 'BrainCircuit', href: '/admin/ia' },
  { id: 'relatorios', label: 'Relatórios', icon: 'BarChart3', href: '/admin/relatorios' },
  { id: 'zonas', label: 'Zonas Entrega', icon: 'MapPin', href: '/admin/zonas' },
  { id: 'config', label: 'Configurações', icon: 'Settings', href: '/admin/configuracoes' },
]

interface NavItemProps {
  item: any
  active: boolean
  brand: Tenant
  onClick?: () => void
  count?: number
}
function NavItem({ item, active, brand, onClick, count }: NavItemProps) {
  const IconComp = ICON_MAP[item.icon] || LayoutDashboard
  const isDanger = item.badgeKind === 'danger'
  const showBadge = typeof count === 'number' && count > 0
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className="sb-nav-item"
      data-active={active || undefined}
      style={active ? { background: 'rgba(255,255,255,0.06)', borderLeftColor: brand.brandPrimary } : {}}
    >
      <span className="sb-nav-icon">
        <IconComp size={17} strokeWidth={1.75} />
      </span>
      <span className="sb-nav-label">{item.label}</span>
      {showBadge && (
        <span className="sb-nav-badge" style={isDanger ? { background: '#ef4444', color: 'white' } : {}}>
          {count}
        </span>
      )}
    </Link>
  )
}

export interface SidebarProps {
  tenant: Tenant
  active: string
  aiPaused?: boolean
  onToggleAi?: () => void
  onTenantSwitch?: (slug: string) => void
  mobileOpen?: boolean
  onMobileClose?: () => void
  user?: { email?: string; name?: string }
  onLogout?: () => void
}

export function Sidebar({ tenant, active, aiPaused, onToggleAi, onTenantSwitch, mobileOpen, onMobileClose, user, onLogout }: SidebarProps) {
  const TenantIcon = ICON_MAP[tenant.icon] || Grape
  const counts = useBadgeCounts()

  return (
    <>
      {mobileOpen && <div className="sb-scrim" onClick={onMobileClose} />}
      <aside className="sb" data-mobile-open={mobileOpen || undefined}>
        {/* Tenant card (display only, sem switcher) */}
        <div className="sb-tenant">
          <div className="sb-tenant-button" style={{ cursor: 'default' }}>
            <span
              className="sb-tenant-icon"
              style={{ background: tenant.brandSoft, borderColor: tenant.brandBorder, color: tenant.brandText, overflow: 'hidden' }}
            >
              {tenant.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenant.logo_url} alt={tenant.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <TenantIcon size={20} strokeWidth={2} />
              )}
            </span>
            <span className="sb-tenant-text">
              <span className="sb-tenant-name" style={{ textDecoration: 'none' }}>
                {tenant.name}
              </span>
              <span className="sb-tenant-tag">{tenant.tagline}</span>
            </span>
          </div>
        </div>

        {/* AI toggle */}
        <div className="sb-ai">
          <button className="sb-ai-toggle" data-active={!aiPaused || undefined} onClick={onToggleAi}>
            <span className="sb-ai-knob" data-active={!aiPaused || undefined}>
              {aiPaused ? <Pause size={11} strokeWidth={2.5} /> : <Sparkles size={11} strokeWidth={2.5} />}
            </span>
            <span className="sb-ai-label">
              <span className="sb-ai-title">{aiPaused ? 'Bot pausado' : 'IA Ativa'}</span>
              <span className="sb-ai-sub">{aiPaused ? 'Atendimento manual' : 'Respondendo clientes'}</span>
            </span>
            <span className="sb-ai-dot" data-active={!aiPaused || undefined} />
          </button>
        </div>

        {/* Nav */}
        <nav className="sb-nav">
          <div className="sb-nav-section">
            <div className="sb-nav-section-label">Operação</div>
            {NAV_OPERACAO.map(item => (
              <NavItem
                key={item.id} item={item}
                active={item.id === active} brand={tenant}
                onClick={onMobileClose}
                count={item.countKey ? counts[item.countKey] : undefined}
              />
            ))}
          </div>
          <div className="sb-nav-section">
            <div className="sb-nav-section-label">Gestão</div>
            {NAV_GESTAO.map(item => (
              <NavItem
                key={item.id} item={item}
                active={item.id === active} brand={tenant}
                onClick={onMobileClose}
              />
            ))}
          </div>

        </nav>

        <div className="sb-foot">
          <button className="sb-user" onClick={onLogout}>
            <span className="sb-user-avatar" style={{ background: tenant.brandPrimary }}>
              {(user?.name || user?.email || 'U').slice(0, 2).toUpperCase()}
            </span>
            <span className="sb-user-text">
              <span className="sb-user-name">{user?.name || user?.email?.split('@')[0] || 'Usuário'}</span>
              <span className="sb-user-role">owner · Inovaefoz</span>
            </span>
            <LogOut size={14} className="sb-user-exit" />
          </button>
        </div>
      </aside>
    </>
  )
}
