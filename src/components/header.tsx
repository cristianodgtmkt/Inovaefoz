"use client"
import { Menu, Bell, Search } from 'lucide-react'

export interface HeaderProps {
  title: string
  subtitle?: string
  right?: React.ReactNode
  connected?: boolean
  onMobileMenu?: () => void
}

export function Header({ title, subtitle, right, connected = true, onMobileMenu }: HeaderProps) {
  return (
    <header className="hdr">
      <button className="hdr-burger" onClick={onMobileMenu} aria-label="Abrir menu">
        <Menu size={20} />
      </button>
      <div className="hdr-title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="hdr-right">
        {right}
        <div className="hdr-status">
          <span className="hdr-status-dot" data-active={connected || undefined} />
          <span className="hdr-status-text">{connected ? 'Sistema ativo' : 'Reconectando…'}</span>
        </div>
        <button className="hdr-iconbtn" aria-label="Notificações">
          <Bell size={17} />
          <span className="hdr-iconbtn-dot" />
        </button>
        <button className="hdr-iconbtn" aria-label="Buscar">
          <Search size={17} />
        </button>
      </div>
    </header>
  )
}
