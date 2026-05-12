// Login page + Dashboard page
const { useState: useStateD, useEffect: useEffectD, useMemo: useMemoD } = React;

// ────────────────────────────────────────────────────────────────────────────
// Login
// ────────────────────────────────────────────────────────────────────────────
function LoginPage({ brand, onLogin }) {
  const [email, setEmail] = useStateD('cristiano@inovaefoz.com.br');
  const [pw, setPw] = useStateD('••••••••••');
  const [showPw, setShowPw] = useStateD(false);
  const [loading, setLoading] = useStateD(false);
  const [err, setErr] = useStateD(null);

  function submit(e) {
    e?.preventDefault();
    setLoading(true);
    setErr(null);
    setTimeout(() => { setLoading(false); onLogin(); }, 700);
  }

  return (
    <div className="login-page" style={{ '--brand': brand.brandPrimary, '--brand-soft': brand.brandSoft, '--brand-border': brand.brandBorder }}>
      <div className="login-bg" aria-hidden="true">
        <div className="login-bg-grid" />
        <div className="login-bg-glow" style={{ background: `radial-gradient(circle, ${brand.brandPrimary}22 0%, transparent 60%)` }} />
      </div>
      <div className="login-card">
        <div className="login-brand">
          <div className="login-icon" style={{ background: brand.brandSoft, borderColor: brand.brandBorder, color: brand.brandText }}>
            <Icon name={brand.icon} size={26} strokeWidth={2} />
          </div>
          <h1>{brand.name}<span style={{ color: brand.brandPrimary }}>.</span></h1>
          <p>{brand.tagline}</p>
        </div>

        <form onSubmit={submit} className="login-form">
          {err && (
            <div className="login-err"><Icon name="AlertCircle" size={14} />{err}</div>
          )}
          <label className="field">
            <span>Email</span>
            <div className="field-input">
              <Icon name="Mail" size={15} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
            </div>
          </label>
          <label className="field">
            <span>Senha</span>
            <div className="field-input">
              <Icon name="Lock" size={15} />
              <input type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} />
              <button type="button" className="field-eye" onClick={() => setShowPw(v => !v)} aria-label="Mostrar senha">
                <Icon name={showPw ? 'EyeOff' : 'Eye'} size={15} />
              </button>
            </div>
          </label>
          <div className="login-row">
            <label className="login-check">
              <input type="checkbox" defaultChecked /> Manter conectado
            </label>
            <a href="#" className="login-forgot">Esqueceu a senha?</a>
          </div>
          <button type="submit" className="btn btn-primary login-submit" disabled={loading} style={{ background: brand.brandPrimary }}>
            {loading ? (<><Icon name="Loader" size={14} className="spin" />Entrando…</>) : (<>Entrar<Icon name="ArrowRight" size={14} /></>)}
          </button>
          <div className="login-divider"><span>ou</span></div>
          <button type="button" className="btn btn-soft login-magic">
            <Icon name="Sparkles" size={14} />Receber link mágico por email
          </button>
        </form>

        <div className="login-foot">
          <span>Não tem conta? <a href="#" style={{ color: brand.brandPrimary }}>Solicite acesso</a></span>
          <span className="login-foot-meta">Inovaefoz · Painel SaaS · v1.0</span>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Dashboard
// ────────────────────────────────────────────────────────────────────────────
function PhaseRow({ exec }) {
  const dotColor = exec.status === 'success' ? '#22c55e' : '#ef4444';
  return (
    <div className="exec-row">
      <span className="exec-dot" style={{ background: dotColor }} />
      <code className="exec-id">{exec.id}</code>
      <span className="exec-phase">{exec.phase}</span>
      <span className="exec-ms">{exec.ms}ms</span>
      <span className="exec-ago">{exec.ago}</span>
    </div>
  );
}

function DashboardPage({ brand, botPaused }) {
  const [period, setPeriod] = useStateD('hoje');

  const stats = [
    { icon: 'ShoppingBag', label: 'Pedidos hoje', value: '47', sub: '+8 vs ontem', color: 'orange', trend: { dir: 'up', value: '+18%' } },
    { icon: 'MessageSquare', label: 'Conversas', value: '212', sub: '38 ativas agora', color: 'blue', trend: { dir: 'up', value: '+12%' } },
    { icon: 'DollarSign', label: 'Receita estimada', value: 'R$ 2.184', sub: 'Ticket médio R$ 46,46', color: 'green', trend: { dir: 'up', value: '+9%' } },
    { icon: 'Bot', label: 'Status do bot', value: botPaused ? 'Pausado' : 'Ativo', sub: botPaused ? 'Atendimento manual' : '94% taxa de sucesso', color: botPaused ? 'red' : 'green' },
  ];

  const opsStats = [
    { icon: 'ChefHat', label: 'Em andamento', value: '6', sub: 'cozinha + entrega', color: 'red' },
    { icon: 'TriangleAlert', label: 'Escalações', value: '2', sub: '1 aguarda > 30min', color: 'amber' },
    { icon: 'Sparkles', label: 'Custo IA hoje', value: 'R$ 4,82', sub: 'de R$ 12,00 cap', color: 'purple' },
    { icon: 'Zap', label: 'Cache hit rate', value: '78%', sub: 'p95 latência 1.2s', color: 'cyan' },
  ];

  const sparkRevenue = [120, 180, 140, 220, 260, 310, 280, 340, 360, 410, 380, 460, 520, 480];
  const sparkOrders = [3, 5, 4, 7, 8, 9, 8, 11, 10, 13, 12, 14, 17, 15];

  return (
    <div className="dash-page">
      <div className="page-head">
        <div>
          <h2>Dashboard</h2>
          <p>Visão geral · atualiza a cada 30s · <span style={{ color: brand.brandPrimary }}>● ao vivo</span></p>
        </div>
        <div className="page-head-right">
          <PeriodPill value={period} onChange={setPeriod} brand={brand} />
          <button className="btn btn-soft"><Icon name="Download" size={14} />Exportar</button>
        </div>
      </div>

      {botPaused && (
        <div className="banner banner-warn">
          <Icon name="Pause" size={15} />
          <span><b>Bot pausado globalmente.</b> Todos os clientes estão em fila para atendimento humano.</span>
          <button className="btn btn-soft btn-sm">Retomar bot</button>
        </div>
      )}

      <div className="grid-stats">
        {stats.map((s, i) => <StatCard key={i} {...s} />)}
      </div>

      {/* Hero row: revenue chart + AI budget */}
      <div className="grid-hero">
        <div className="card chart-card">
          <header className="card-head">
            <div>
              <div className="card-title">Receita ao longo do dia</div>
              <div className="card-sub">por hora · {period === 'hoje' ? 'hoje' : period}</div>
            </div>
            <div className="card-meta">
              <span className="card-meta-value">R$ 2.184</span>
              <span className="card-meta-trend" data-dir="up"><Icon name="TrendingUp" size={11} />+9% vs ontem</span>
            </div>
          </header>
          <div style={{ padding: '0 4px 4px' }}>
            <Spark data={sparkRevenue} color={brand.brandPrimary} height={140} />
          </div>
          <div className="chart-xaxis">
            <span>10h</span><span>12h</span><span>14h</span><span>16h</span><span>18h</span><span>20h</span><span>22h</span>
          </div>
        </div>

        <div className="card ai-card">
          <header className="card-head">
            <div>
              <div className="card-title">Orçamento IA</div>
              <div className="card-sub">cap diário · reseta 00:00</div>
            </div>
            <span className="badge badge-purple"><Icon name="Sparkles" size={11} />40% usado</span>
          </header>
          <div className="ai-meter">
            <div className="ai-meter-row">
              <span>R$ 4,82</span>
              <span style={{ color: '#94a3b8' }}>de R$ 12,00</span>
            </div>
            <ProgressBar value={4.82} max={12} color="#a855f7" />
          </div>
          <ul className="ai-list">
            <li><span className="ai-list-dot" style={{ background: '#22c55e' }} /><span>Hallucination rate</span><b>0.4%</b></li>
            <li><span className="ai-list-dot" style={{ background: '#06b6d4' }} /><span>Cache hit rate</span><b>78%</b></li>
            <li><span className="ai-list-dot" style={{ background: '#f59e0b' }} /><span>Escalations / 100 msg</span><b>2.1</b></li>
            <li><span className="ai-list-dot" style={{ background: '#8b5cf6' }} /><span>Latência p95</span><b>1.2s</b></li>
          </ul>
          <button className="btn btn-soft btn-block"><Icon name="ArrowRight" size={13} />Ver dashboard IA</button>
        </div>
      </div>

      <div className="grid-stats">
        {opsStats.map((s, i) => <StatCard key={i} {...s} />)}
      </div>

      {/* Bottom row */}
      <div className="grid-bottom">
        <div className="card">
          <header className="card-head">
            <div>
              <div className="card-title">Últimas execuções IA</div>
              <div className="card-sub">7 execuções · 86% sucesso · 0 alertas</div>
            </div>
            <div className="card-meta">
              <span className="badge badge-green">6 OK</span>
              <span className="badge badge-red">1 erro</span>
            </div>
          </header>
          <div className="exec-list">
            {window.MOCK.AI_EXECS.map(e => <PhaseRow key={e.id} exec={e} />)}
          </div>
          <button className="btn btn-soft btn-block"><Icon name="ArrowRight" size={13} />Ver todas execuções</button>
        </div>

        <div className="card">
          <header className="card-head">
            <div>
              <div className="card-title">Acesso rápido</div>
              <div className="card-sub">fluxos operacionais</div>
            </div>
          </header>
          <div className="quick-grid">
            <a className="quick-tile" href="#" style={{ '--accent': '#f97316' }}>
              <span className="quick-icon" style={{ background: '#fff7ed', color: '#c2410c' }}><Icon name="ShoppingBag" size={18} /></span>
              <div><div className="quick-title">Kanban de pedidos</div><div className="quick-sub">6 ativos · 41 hoje</div></div>
              <Icon name="ArrowUpRight" size={14} className="quick-arrow" />
            </a>
            <a className="quick-tile" href="#">
              <span className="quick-icon" style={{ background: '#eff6ff', color: '#1d4ed8' }}><Icon name="MessageSquare" size={18} /></span>
              <div><div className="quick-title">Conversas ao vivo</div><div className="quick-sub">38 ativas · 2 escaladas</div></div>
              <Icon name="ArrowUpRight" size={14} className="quick-arrow" />
            </a>
            <a className="quick-tile" href="#">
              <span className="quick-icon" style={{ background: '#fef2f2', color: '#b91c1c' }}><Icon name="TriangleAlert" size={18} /></span>
              <div><div className="quick-title">Escalações abertas</div><div className="quick-sub">2 esperando · max 38min</div></div>
              <Icon name="ArrowUpRight" size={14} className="quick-arrow" />
            </a>
            <a className="quick-tile" href="#">
              <span className="quick-icon" style={{ background: '#f3e8ff', color: '#7e22ce' }}><Icon name="Utensils" size={18} /></span>
              <div><div className="quick-title">Editar cardápio</div><div className="quick-sub">43 produtos ativos</div></div>
              <Icon name="ArrowUpRight" size={14} className="quick-arrow" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LoginPage, DashboardPage });
