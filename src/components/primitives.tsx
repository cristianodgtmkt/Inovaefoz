"use client"
import {
  TrendingUp, TrendingDown,
  ShoppingBag, MessageSquare, DollarSign, Bot, ChefHat, TriangleAlert,
  Sparkles, Zap, Database, Clock, UserCheck, Shield, BarChart3, Search,
  FlaskConical, MapPin, Settings, Utensils, ArrowRight, ArrowUpRight,
  Pause, Play, Plus, Filter, RefreshCw, Download, Upload, Edit3, Trash2,
  Check, X, ChevronDown, ChevronUp, ChevronRight, MoreVertical, Inbox,
  Crown, Phone, Send, Paperclip, UserPlus, Headphones, AlertCircle,
  AlertOctagon, BellRing, Printer, MessageCircle, StickyNote, Package,
  CreditCard, Banknote, Wallet, QrCode, Mail, Lock, Eye, EyeOff,
  Loader, CheckCircle2, AlertTriangle, Info, Copy, Key, Webhook,
  Receipt, ArrowUpCircle, FileText, Truck, Map as MapIcon, Plug,
  Code2, Calendar, Layers, Image as ImageIcon, Grid3x3, List,
  Store, Flag, Archive,
} from 'lucide-react'

export const ICONS: Record<string, any> = {
  TrendingUp, TrendingDown, ShoppingBag, MessageSquare, DollarSign, Bot,
  ChefHat, TriangleAlert, Sparkles, Zap, Database, Clock, UserCheck, Shield,
  BarChart3, Search, FlaskConical, MapPin, Settings, Utensils, ArrowRight,
  ArrowUpRight, Pause, Play, Plus, Filter, RefreshCw, Download, Upload,
  Edit3, Trash2, Check, X, ChevronDown, ChevronUp, ChevronRight, MoreVertical,
  Inbox, Crown, Phone, Send, Paperclip, UserPlus, Headphones, AlertCircle,
  AlertOctagon, BellRing, Printer, MessageCircle, StickyNote, Package,
  CreditCard, Banknote, Wallet, QrCode, Mail, Lock, Eye, EyeOff, Loader,
  CheckCircle2, AlertTriangle, Info, Copy, Key, Webhook, Receipt,
  ArrowUpCircle, FileText, Truck, Map: MapIcon, Plug, Code2, Calendar,
  Layers, ImageIcon, Grid3x3, List, Store, Flag, Archive,
}

export function Icon({ name, size = 16, strokeWidth = 2, className = '', style }: { name: string; size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }) {
  const Comp = ICONS[name]
  if (!Comp) return null
  return <Comp size={size} strokeWidth={strokeWidth} className={className} style={style} />
}

interface StatCardProps {
  icon: string
  label: string
  value: string | number
  sub?: string
  color?: string
  trend?: { dir: 'up' | 'down'; value: string }
}

export function StatCard({ icon, label, value, sub, color = 'slate', trend }: StatCardProps) {
  const colors: Record<string, { bg: string; fg: string }> = {
    orange: { bg: '#fff7ed', fg: '#c2410c' },
    blue: { bg: '#eff6ff', fg: '#1d4ed8' },
    green: { bg: '#f0fdf4', fg: '#15803d' },
    red: { bg: '#fef2f2', fg: '#b91c1c' },
    amber: { bg: '#fffbeb', fg: '#a16207' },
    purple: { bg: '#faf5ff', fg: '#6b21a8' },
    cyan: { bg: '#ecfeff', fg: '#0e7490' },
    slate: { bg: '#f1f5f9', fg: '#334155' },
  }
  const c = colors[color] || colors.slate
  return (
    <div className="stat">
      <div className="stat-head">
        <span className="stat-icon" style={{ background: c.bg, color: c.fg }}>
          <Icon name={icon} size={16} />
        </span>
        <span className="stat-label">{label}</span>
        {trend && (
          <span className="stat-trend" data-dir={trend.dir}>
            <Icon name={trend.dir === 'up' ? 'TrendingUp' : 'TrendingDown'} size={11} />
            {trend.value}
          </span>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function PeriodPill({ value, onChange, brand }: { value: string; onChange: (v: string) => void; brand: { brandPrimary: string } }) {
  const opts = [
    { id: 'hoje', label: 'Hoje' },
    { id: '7d', label: '7 dias' },
    { id: '30d', label: '30 dias' },
    { id: '90d', label: '90 dias' },
    { id: 'total', label: 'Total' },
  ]
  return (
    <div className="periodpill">
      {opts.map(o => (
        <button
          key={o.id}
          data-active={value === o.id || undefined}
          onClick={() => onChange(o.id)}
          style={value === o.id ? { background: brand.brandPrimary, color: 'white' } : {}}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Spark({ data, color, height = 36 }: { data: number[]; color: string; height?: number }) {
  const w = 100, h = height
  const max = Math.max(...data), min = Math.min(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')
  const area = `0,${h} ${pts} ${w},${h}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height, overflow: 'visible' }} preserveAspectRatio="none">
      <polygon points={area} fill={color} opacity="0.10" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ProgressBar({ value, max, color = '#7e22ce' }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="pbar">
      <div className="pbar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}
