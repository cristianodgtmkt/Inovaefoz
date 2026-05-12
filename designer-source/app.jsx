// Main app: router + layout + tweaks
const { useState: useStateA, useEffect: useEffectA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "tenant": "acai-da-barra",
  "page": "pedidos",
  "botPaused": false,
  "kanbanState": "full",
  "density": "comfortable",
  "sidebarTone": "slate",
  "showLogin": false
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const tenant = window.MOCK.TENANTS[t.tenant] || window.MOCK.TENANTS['acai-da-barra'];
  const [page, setPage] = useStateA(t.page);
  const [mobileNavOpen, setMobileNavOpen] = useStateA(false);
  const [showLogin, setShowLogin] = useStateA(t.showLogin);

  useEffectA(() => { setPage(t.page); }, [t.page]);
  useEffectA(() => { setShowLogin(t.showLogin); }, [t.showLogin]);

  function navigate(id) {
    setPage(id);
    setTweak('page', id);
    setMobileNavOpen(false);
  }

  // Inject brand CSS vars
  useEffectA(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand', tenant.brandPrimary);
    root.style.setProperty('--brand-hover', tenant.brandPrimaryHover);
    root.style.setProperty('--brand-soft', tenant.brandSoft);
    root.style.setProperty('--brand-border', tenant.brandBorder);
    root.style.setProperty('--brand-text', tenant.brandText);
    document.body.dataset.density = t.density;
    document.body.dataset.sidebarTone = t.sidebarTone;
  }, [tenant, t.density, t.sidebarTone]);

  const allTenants = Object.values(window.MOCK.TENANTS);

  if (showLogin) {
    return (
      <>
        <LoginPage brand={tenant} onLogin={() => { setShowLogin(false); setTweak('showLogin', false); }} />
        <AppTweaks t={t} setTweak={setTweak} />
      </>
    );
  }

  let PageEl, pageTitle, pageSubtitle, pageRight;
  if (page === 'pedidos') {
    PageEl = <PedidosPage brand={tenant} botPaused={t.botPaused} kanbanState={t.kanbanState} />;
    pageTitle = null; // pedidos page renders its own head
  } else if (page === 'dashboard') {
    PageEl = <DashboardPage brand={tenant} botPaused={t.botPaused} />;
    pageTitle = null;
  } else if (page === 'conversas') {
    PageEl = <ConversasPage brand={tenant} />;
  } else if (page === 'escalacoes') {
    PageEl = <EscalacoesPage brand={tenant} />;
  } else if (page === 'clientes') {
    PageEl = <ClientesPage brand={tenant} />;
  } else if (page === 'cardapio') {
    PageEl = <CardapioPage brand={tenant} />;
  } else if (page === 'ia') {
    PageEl = <IAPage brand={tenant} />;
  } else if (page === 'relatorios') {
    PageEl = <RelatoriosPage brand={tenant} />;
  } else if (page === 'zonas') {
    PageEl = <ZonasPage brand={tenant} />;
  } else if (page === 'config') {
    PageEl = <ConfigPage brand={tenant} />;
  } else {
    PageEl = <PlaceholderPage page={page} brand={tenant} />;
    pageTitle = null;
  }

  return (
    <div className="app" data-screen-label="App Shell">
      <Sidebar
        tenant={tenant}
        active={page}
        onNavigate={navigate}
        aiPaused={t.botPaused}
        onToggleAi={() => setTweak('botPaused', !t.botPaused)}
        allTenants={allTenants}
        onTenantSwitch={(slug) => setTweak('tenant', slug)}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="app-main">
        <Header
          title={page === 'pedidos' ? 'Operação · Pedidos' : page === 'dashboard' ? 'Operação · Dashboard' : titleFor(page)}
          subtitle={page === 'pedidos' ? 'Kanban em tempo real' : page === 'dashboard' ? `${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}` : ''}
          right={null}
          connected={true}
          onMobileMenu={() => setMobileNavOpen(true)}
        />
        <main className="app-content" data-screen-label={`${page}-content`}>
          {PageEl}
        </main>
        <Footer tenant={tenant} />
      </div>
      <AppTweaks t={t} setTweak={setTweak} />
    </div>
  );
}

function titleFor(id) {
  const map = {
    conversas: 'Conversas', escalacoes: 'Escalações', clientes: 'Clientes',
    cardapio: 'Cardápio', ia: 'Dashboard IA', relatorios: 'Relatórios',
    zonas: 'Zonas de Entrega', config: 'Configurações',
  };
  return map[id] || id;
}

function PlaceholderPage({ page, brand }) {
  return (
    <div className="placeholder">
      <div className="placeholder-card">
        <div className="placeholder-icon" style={{ background: brand.brandSoft, color: brand.brandPrimary }}>
          <Icon name="Construction" size={28} />
        </div>
        <h2>{titleFor(page)}</h2>
        <p>Esta tela faz parte da <b>Sprint 2+</b> do roadmap.</p>
        <p className="placeholder-sub">Sprint 1 desta entrega foca em: Login · Layout master · Dashboard · Pedidos Kanban.</p>
        <div className="placeholder-actions">
          <button className="btn btn-primary" style={{ background: brand.brandPrimary }} onClick={() => window.dispatchEvent(new CustomEvent('go', { detail: 'pedidos' }))}>
            <Icon name="ArrowLeft" size={13} />Voltar ao Kanban
          </button>
        </div>
      </div>
    </div>
  );
}

function AppTweaks({ t, setTweak }) {
  return (
    <TweaksPanel title="Tweaks · Painel">
      <TweakSection title="Tenant ativo">
        <TweakRadio
          label="Negócio"
          value={t.tenant}
          onChange={(v) => setTweak('tenant', v)}
          options={[
            { value: 'acai-da-barra', label: 'Açaí da Barra' },
            { value: 'tropicana', label: 'Tropicana' },
            { value: 'wandscheer', label: 'Wandscheer' },
          ]}
        />
      </TweakSection>

      <TweakSection title="Navegação">
        <TweakSelect
          label="Página"
          value={t.page}
          onChange={(v) => setTweak('page', v)}
          options={[
            { value: 'dashboard', label: 'Dashboard' },
            { value: 'pedidos', label: 'Pedidos (Kanban)' },
            { value: 'conversas', label: 'Conversas (placeholder)' },
            { value: 'cardapio', label: 'Cardápio (placeholder)' },
            { value: 'ia', label: 'Dashboard IA (placeholder)' },
          ]}
        />
        <TweakToggle label="Tela de login" checked={t.showLogin} onChange={(v) => setTweak('showLogin', v)} />
      </TweakSection>

      <TweakSection title="Estado da operação">
        <TweakToggle label="Bot pausado globalmente" checked={t.botPaused} onChange={(v) => setTweak('botPaused', v)} />
        <TweakRadio
          label="Estado do Kanban"
          value={t.kanbanState}
          onChange={(v) => setTweak('kanbanState', v)}
          options={[
            { value: 'empty', label: 'Vazio' },
            { value: 'few', label: 'Poucos' },
            { value: 'full', label: 'Cheio' },
          ]}
        />
      </TweakSection>

      <TweakSection title="Aparência">
        <TweakRadio
          label="Densidade"
          value={t.density}
          onChange={(v) => setTweak('density', v)}
          options={[
            { value: 'compact', label: 'Compacto' },
            { value: 'comfortable', label: 'Confortável' },
          ]}
        />
        <TweakRadio
          label="Sidebar"
          value={t.sidebarTone}
          onChange={(v) => setTweak('sidebarTone', v)}
          options={[
            { value: 'slate', label: 'Dark slate' },
            { value: 'brand', label: 'Brand' },
            { value: 'light', label: 'Light' },
          ]}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

// Listen for global 'go' events from placeholder
window.addEventListener('go', (e) => {
  // Triggers a tweak update by simulating page change via postMessage
  window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { page: e.detail } }, '*');
});

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
