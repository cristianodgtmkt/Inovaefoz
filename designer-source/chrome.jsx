// Shared chrome: Sidebar, Header, Footer, primitives.
// Globals expected: React, lucide (window.lucide via the lucide UMD)

const { useState, useEffect, useRef, useMemo } = React;

// ────────────────────────────────────────────────────────────────────────────
// Icon — thin wrapper around lucide's UMD createIcons via dynamic <i data-lucide>
// We use an inline SVG approach: lucide exposes window.lucide.icons[Name].toSvg()
// ────────────────────────────────────────────────────────────────────────────
// Lucide UMD exposes each icon as a node array: ["svg", attrs, children]
// children are [tagName, attrs] pairs. We render to SVG manually.
function lucideToSvg(node, size, strokeWidth) {
  if (!node) return '';
  // Could be: array [tag, attrs, children] OR object { ...attrs, children }
  let tag, attrs, children;
  if (Array.isArray(node)) {
    [tag, attrs, children] = node;
  } else if (node && typeof node === 'object') {
    // Some lucide versions: icons[Name] = [["path", {...}], ...] OR full svg array
    // Try toSvg method first
    if (typeof node.toSvg === 'function') {
      return node.toSvg({ width: size, height: size, 'stroke-width': strokeWidth });
    }
    return '';
  } else {
    return '';
  }
  attrs = attrs || {};
  children = children || [];
  const a = {
    ...attrs,
    width: size,
    height: size,
    'stroke-width': strokeWidth,
  };
  const attrStr = Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ');
  const inner = children.map(c => {
    if (Array.isArray(c)) {
      const [ctag, cattrs] = c;
      const cAttrStr = Object.entries(cattrs || {}).map(([k, v]) => `${k}="${v}"`).join(' ');
      return `<${ctag} ${cAttrStr} />`;
    }
    return '';
  }).join('');
  return `<${tag} ${attrStr}>${inner}</${tag}>`;
}

function Icon({ name, size = 16, strokeWidth = 2, className = '', style = {} }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const L = window.lucide;
    if (!L) return;
    const icons = L.icons || L;
    const key = Object.keys(icons).find(k => k.toLowerCase() === name.toLowerCase());
    if (!key) {
      ref.current.innerHTML = '';
      return;
    }
    ref.current.innerHTML = lucideToSvg(icons[key], size, strokeWidth);
  }, [name, size, strokeWidth]);
  return <span ref={ref} className={`lucide-wrap ${className}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0, ...style }} />;
}

// ────────────────────────────────────────────────────────────────────────────
// Sidebar
// ────────────────────────────────────────────────────────────────────────────
const NAV_OPERACAO = [
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', href: '/admin' },
  { id: 'pedidos', label: 'Pedidos', icon: 'ShoppingBag', href: '/admin/pedidos', badge: 4 },
  { id: 'conversas', label: 'Conversas', icon: 'MessageSquare', href: '/admin/conversas', badge: 7 },
  { id: 'escalacoes', label: 'Escalações', icon: 'TriangleAlert', href: '/admin/escalacoes', badge: 2, badgeKind: 'danger' },
];
const NAV_GESTAO = [
  { id: 'clientes', label: 'Clientes', icon: 'Users', href: '/admin/clientes' },
  { id: 'cardapio', label: 'Cardápio', icon: 'Utensils', href: '/admin/cardapio' },
  { id: 'ia', label: 'IA', icon: 'BrainCircuit', href: '/admin/ia' },
  { id: 'relatorios', label: 'Relatórios', icon: 'BarChart3', href: '/admin/relatorios' },
  { id: 'zonas', label: 'Zonas Entrega', icon: 'MapPin', href: '/admin/zonas' },
  { id: 'config', label: 'Configurações', icon: 'Settings', href: '/admin/configuracoes' },
];

function NavItem({ item, active, brand, onClick }) {
  const isDanger = item.badgeKind === 'danger';
  return (
    <button
      onClick={onClick}
      className="sb-nav-item"
      data-active={active || undefined}
      style={active ? { background: 'rgba(255,255,255,0.06)', borderLeftColor: brand.brandPrimary } : {}}
    >
      <span className="sb-nav-icon"><Icon name={item.icon} size={17} strokeWidth={1.75} /></span>
      <span className="sb-nav-label">{item.label}</span>
      {item.badge != null && (
        <span className="sb-nav-badge" style={isDanger ? { background: '#ef4444', color: 'white' } : {}}>
          {item.badge}
        </span>
      )}
    </button>
  );
}

function Sidebar({ tenant, active, onNavigate, aiPaused, onToggleAi, onTenantSwitch, allTenants, mobileOpen, onMobileClose }) {
  const brand = tenant;
  const [tswitchOpen, setTswitchOpen] = useState(false);

  return (
    <>
      {mobileOpen && <div className="sb-scrim" onClick={onMobileClose} />}
      <aside className="sb" data-mobile-open={mobileOpen || undefined}>
        {/* Tenant card */}
        <div className="sb-tenant">
          <button className="sb-tenant-button" onClick={() => setTswitchOpen(v => !v)}>
            <span className="sb-tenant-icon" style={{ background: brand.brandSoft, borderColor: brand.brandBorder, color: brand.brandText }}>
              <Icon name={brand.icon} size={20} strokeWidth={2} />
            </span>
            <span className="sb-tenant-text">
              <span className="sb-tenant-name">
                {brand.name}
                <span className="sb-tenant-dot" style={{ background: brand.brandPrimary }} />
              </span>
              <span className="sb-tenant-tag">{brand.tagline}</span>
            </span>
            <Icon name="ChevronsUpDown" size={14} className="sb-tenant-chev" />
          </button>
          {tswitchOpen && (
            <div className="sb-tswitcher">
              {allTenants.map(t => (
                <button
                  key={t.slug}
                  className="sb-tswitch-item"
                  data-current={t.slug === brand.slug || undefined}
                  onClick={() => { onTenantSwitch(t.slug); setTswitchOpen(false); }}
                >
                  <span className="sb-tswitch-icon" style={{ background: t.brandSoft, borderColor: t.brandBorder, color: t.brandText }}>
                    <Icon name={t.icon} size={14} />
                  </span>
                  <span className="sb-tswitch-name">{t.name}</span>
                  {t.slug === brand.slug && <Icon name="Check" size={14} style={{ marginLeft: 'auto', color: '#94a3b8' }} />}
                </button>
              ))}
              <div className="sb-tswitch-divider" />
              <button className="sb-tswitch-item sb-tswitch-super">
                <span className="sb-tswitch-icon" style={{ background: '#1e293b', borderColor: '#334155', color: '#cbd5e1' }}>
                  <Icon name="Shield" size={14} />
                </span>
                <span className="sb-tswitch-name">Super-admin · Inovaefoz</span>
                <Icon name="ArrowUpRight" size={12} style={{ marginLeft: 'auto', color: '#64748b' }} />
              </button>
            </div>
          )}
        </div>

        {/* AI Active toggle */}
        <div className="sb-ai">
          <button className="sb-ai-toggle" data-active={!aiPaused || undefined} onClick={onToggleAi}>
            <span className="sb-ai-knob" data-active={!aiPaused || undefined}>
              <Icon name={aiPaused ? 'Pause' : 'Sparkles'} size={11} strokeWidth={2.5} />
            </span>
            <span className="sb-ai-label">
              <span className="sb-ai-title">{aiPaused ? 'Bot pausado' : 'IA Ativa'}</span>
              <span className="sb-ai-sub">{aiPaused ? 'Atendimento manual' : 'Respondendo clientes'}</span>
            </span>
            <span className="sb-ai-dot" data-active={!aiPaused || undefined} />
          </button>
        </div>

        <nav className="sb-nav">
          <div className="sb-nav-section">
            <div className="sb-nav-section-label">Operação</div>
            {NAV_OPERACAO.map(item => (
              <NavItem key={item.id} item={item} active={item.id === active} brand={brand} onClick={() => onNavigate(item.id)} />
            ))}
          </div>
          <div className="sb-nav-section">
            <div className="sb-nav-section-label">Gestão</div>
            {NAV_GESTAO.map(item => (
              <NavItem key={item.id} item={item} active={item.id === active} brand={brand} onClick={() => onNavigate(item.id)} />
            ))}
          </div>
        </nav>

        <div className="sb-foot">
          <button className="sb-user">
            <span className="sb-user-avatar">CV</span>
            <span className="sb-user-text">
              <span className="sb-user-name">Cristiano V.</span>
              <span className="sb-user-role">owner · Inovaefoz</span>
            </span>
            <Icon name="LogOut" size={14} className="sb-user-exit" />
          </button>
        </div>
      </aside>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Header
// ────────────────────────────────────────────────────────────────────────────
function Header({ title, subtitle, right, onMobileMenu, connected = true }) {
  return (
    <header className="hdr">
      <button className="hdr-burger" onClick={onMobileMenu} aria-label="Abrir menu">
        <Icon name="Menu" size={20} />
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
          <Icon name="Bell" size={17} />
          <span className="hdr-iconbtn-dot" />
        </button>
        <button className="hdr-iconbtn" aria-label="Buscar">
          <Icon name="Search" size={17} />
        </button>
      </div>
    </header>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Footer
// ────────────────────────────────────────────────────────────────────────────
function Footer({ tenant }) {
  return (
    <footer className="ftr">
      <span>{tenant.name} · Painel Administrativo · v1.0</span>
      <div className="ftr-right">
        <a href="#">Status</a>
        <a href="#">Suporte</a>
        <a href="#">Política de privacidade</a>
      </div>
    </footer>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Primitives
// ────────────────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, trend, color = 'slate', accent }) {
  const colors = {
    orange: { bg: '#fff7ed', fg: '#c2410c', dot: '#f97316' },
    blue: { bg: '#eff6ff', fg: '#1d4ed8', dot: '#3b82f6' },
    green: { bg: '#f0fdf4', fg: '#15803d', dot: '#22c55e' },
    red: { bg: '#fef2f2', fg: '#b91c1c', dot: '#ef4444' },
    amber: { bg: '#fffbeb', fg: '#a16207', dot: '#f59e0b' },
    purple: { bg: '#faf5ff', fg: '#6b21a8', dot: '#a855f7' },
    cyan: { bg: '#ecfeff', fg: '#0e7490', dot: '#06b6d4' },
    slate: { bg: '#f1f5f9', fg: '#334155', dot: '#64748b' },
  };
  const c = colors[color] || colors.slate;
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
  );
}

function PeriodPill({ value, onChange, brand }) {
  const opts = [
    { id: 'hoje', label: 'Hoje' },
    { id: '7d', label: '7 dias' },
    { id: '30d', label: '30 dias' },
    { id: '90d', label: '90 dias' },
    { id: 'total', label: 'Total' },
  ];
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
  );
}

function Spark({ data, color, height = 36 }) {
  const w = 100, h = height;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const area = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height, overflow: 'visible' }} preserveAspectRatio="none">
      <polygon points={area} fill={color} opacity="0.10" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProgressBar({ value, max, color = '#7e22ce' }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="pbar">
      <div className="pbar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// Expose
Object.assign(window, {
  Icon, Sidebar, Header, Footer,
  StatCard, PeriodPill, Spark, ProgressBar,
  NAV_OPERACAO, NAV_GESTAO,
});
