// Clientes page + drawer, Cardápio page
const { useState: useStateP, useMemo: useMemoP } = React;

function ClientesPage({ brand }) {
  const all = window.MOCK2.CLIENTES;
  const [q, setQ] = useStateP('');
  const [filter, setFilter] = useStateP('all');
  const [selected, setSelected] = useStateP(null);

  const filtered = useMemoP(() => all.filter(c => {
    if (filter === 'vip' && c.status !== 'vip') return false;
    if (filter === 'new' && c.status !== 'new') return false;
    if (q && !c.name.toLowerCase().includes(q.toLowerCase()) && !c.phone.includes(q)) return false;
    return true;
  }), [q, filter, all]);

  const stats = {
    total: all.length,
    vip: all.filter(c => c.status === 'vip').length,
    new: all.filter(c => c.status === 'new').length,
    ticketMedio: (all.reduce((s, c) => s + c.ticket, 0) / all.length).toFixed(2),
  };

  return (
    <div className="cli-page">
      <div className="page-head">
        <div>
          <h2>Clientes</h2>
          <p><b>{stats.total}</b> clientes · <b>{stats.vip}</b> VIPs · ticket médio <b>R$ {stats.ticketMedio.replace('.', ',')}</b></p>
        </div>
        <div className="page-head-right">
          <button className="btn btn-soft"><Icon name="Download" size={14} />Exportar CSV</button>
          <button className="btn btn-primary" style={{ background: brand.brandPrimary }}><Icon name="UserPlus" size={14} />Novo cliente</button>
        </div>
      </div>

      <div className="cli-toolbar">
        <div className="cli-search">
          <Icon name="Search" size={14} />
          <input placeholder="Buscar por nome ou telefone..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="cli-tabs">
          {[
            { id: 'all', label: `Todos · ${stats.total}` },
            { id: 'vip', label: `VIPs · ${stats.vip}` },
            { id: 'new', label: `Novos · ${stats.new}` },
          ].map(t => (
            <button key={t.id} className="cli-tab" data-active={filter === t.id || undefined} onClick={() => setFilter(t.id)} style={filter === t.id ? { color: brand.brandPrimary, borderColor: brand.brandPrimary } : {}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cli-table">
        <div className="cli-thead">
          <span>Cliente</span>
          <span>Telefone</span>
          <span className="ta-r">Pedidos</span>
          <span className="ta-r">Ticket médio</span>
          <span>Último pedido</span>
          <span>Tags</span>
          <span></span>
        </div>
        {filtered.map(c => (
          <div key={c.id} className="cli-row" onClick={() => setSelected(c)}>
            <div className="cli-cell-name">
              <span className="cv-avatar" style={{ background: c.status === 'vip' ? brand.brandPrimary : '#cbd5e1', width: 32, height: 32, fontSize: 11 }}>
                {c.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
              </span>
              <div>
                <div className="cli-name">{c.name}</div>
                {c.status === 'vip' && <div className="cli-vip"><Icon name="Crown" size={10} />VIP</div>}
                {c.status === 'new' && <div className="cli-new">Nova</div>}
              </div>
            </div>
            <span className="cli-cell-phone">{c.phone}</span>
            <span className="ta-r"><b>{c.orders}</b></span>
            <span className="ta-r">R$ {c.ticket.toFixed(2).replace('.', ',')}</span>
            <span className="cli-cell-last">{c.last}</span>
            <span className="cli-cell-tags">
              {c.tags.map(t => <span key={t} className="cli-chip">{t}</span>)}
            </span>
            <span className="cli-cell-arrow"><Icon name="ChevronRight" size={14} /></span>
          </div>
        ))}
      </div>

      {selected && <ClienteDrawer cliente={selected} onClose={() => setSelected(null)} brand={brand} />}
    </div>
  );
}

function ClienteDrawer({ cliente, onClose, brand }) {
  return (
    <>
      <div className="drawer-overlay" onClick={onClose}></div>
      <aside className="drawer">
        <header className="drawer-head">
          <span className="cv-avatar" style={{ background: cliente.status === 'vip' ? brand.brandPrimary : '#cbd5e1', width: 48, height: 48, fontSize: 16 }}>
            {cliente.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
          </span>
          <div className="drawer-head-text">
            <div className="drawer-name">{cliente.name}</div>
            <div className="drawer-sub">{cliente.phone}</div>
          </div>
          <button className="btn-icon" onClick={onClose}><Icon name="X" size={16} /></button>
        </header>

        <div className="drawer-stats">
          <div><span className="drawer-stat-v">{cliente.orders}</span><span className="drawer-stat-l">pedidos</span></div>
          <div><span className="drawer-stat-v">R$ {cliente.ticket.toFixed(2).replace('.', ',')}</span><span className="drawer-stat-l">ticket médio</span></div>
          <div><span className="drawer-stat-v">R$ {(cliente.orders * cliente.ticket).toFixed(0)}</span><span className="drawer-stat-l">LTV</span></div>
        </div>

        <div className="drawer-section">
          <div className="drawer-section-title">Endereços salvos</div>
          <div className="drawer-addr">
            <Icon name="MapPin" size={14} />
            <div>
              <div><b>Casa</b> · R. Felipe Wandscheer, 842 — apt 304 bloco B</div>
              <div className="drawer-addr-sub">Centro · CEP 85850-000 · taxa R$ 5,00</div>
            </div>
          </div>
          <div className="drawer-addr">
            <Icon name="MapPin" size={14} />
            <div>
              <div><b>Trabalho</b> · Av. Brasil, 1245</div>
              <div className="drawer-addr-sub">Centro · taxa R$ 5,00</div>
            </div>
          </div>
        </div>

        <div className="drawer-section">
          <div className="drawer-section-title">Últimos pedidos</div>
          {[
            { id: '#1042', items: '2× Açaí 500ml ninho', val: 42.40, when: 'hoje 21:47', st: 'em_preparo' },
            { id: '#1031', items: 'Açaí 700ml + Milk shake', val: 51.20, when: 'ontem 20:14', st: 'entregue' },
            { id: '#1018', items: 'Açaí 300ml sem LC', val: 18.00, when: '3 dias atrás', st: 'entregue' },
          ].map((p, i) => (
            <div key={i} className="drawer-order">
              <div>
                <div><b>{p.id}</b> · {p.items}</div>
                <div className="drawer-order-sub">{p.when}</div>
              </div>
              <div className="ta-r">
                <div><b>R$ {p.val.toFixed(2).replace('.', ',')}</b></div>
                <div className={`drawer-st drawer-st-${p.st}`}>{p.st.replace('_', ' ')}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="drawer-section">
          <div className="drawer-section-title">Preferências detectadas pela IA</div>
          <div className="drawer-prefs">
            <span className="cli-chip"><Icon name="Sparkles" size={10} />sem leite condensado</span>
            <span className="cli-chip"><Icon name="Sparkles" size={10} />gosta de morango</span>
            <span className="cli-chip"><Icon name="Sparkles" size={10} />paga no PIX</span>
            <span className="cli-chip"><Icon name="Sparkles" size={10} />pede à noite</span>
          </div>
        </div>

        <footer className="drawer-foot">
          <button className="btn btn-soft"><Icon name="MessageSquare" size={14} />Abrir conversa</button>
          <button className="btn btn-primary" style={{ background: brand.brandPrimary }}><Icon name="Phone" size={14} />Ligar</button>
        </footer>
      </aside>
    </>
  );
}

function CardapioPage({ brand }) {
  const data = window.MOCK2.CARDAPIO;
  const [cat, setCat] = useStateP('acai');
  const [search, setSearch] = useStateP('');
  const [selected, setSelected] = useStateP(null);
  const produtos = data.produtos[cat] || [];
  const filteredP = produtos.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="card-page">
      <div className="page-head">
        <div>
          <h2>Cardápio</h2>
          <p><b>{Object.values(data.produtos).flat().length}</b> produtos · <b>{data.categorias.length}</b> categorias · <b>{data.complementos.length}</b> complementos</p>
        </div>
        <div className="page-head-right">
          <button className="btn btn-soft"><Icon name="Upload" size={14} />Importar</button>
          <button className="btn btn-primary" style={{ background: brand.brandPrimary }}><Icon name="Plus" size={14} />Novo produto</button>
        </div>
      </div>

      <div className="card-layout">
        <aside className="card-cats">
          <div className="card-cats-head">Categorias</div>
          {data.categorias.map(c => (
            <button key={c.id} className="card-cat" data-active={cat === c.id || undefined} onClick={() => setCat(c.id)} style={cat === c.id ? { background: brand.brandSoft, color: brand.brandPrimary, borderColor: brand.brandPrimary } : {}}>
              <span>{c.label}</span>
              <span className="card-cat-count">{c.count}</span>
            </button>
          ))}
          <button className="card-cat card-cat-add"><Icon name="Plus" size={13} />Nova categoria</button>
        </aside>

        <section className="card-products">
          <div className="card-products-toolbar">
            <div className="cli-search" style={{ flex: 1 }}>
              <Icon name="Search" size={14} />
              <input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-soft btn-sm"><Icon name="Grid3x3" size={13} />Grid</button>
            <button className="btn btn-soft btn-sm"><Icon name="List" size={13} />Lista</button>
          </div>

          <div className="card-grid">
            {filteredP.map(p => (
              <article key={p.id} className="card-prod" data-inactive={!p.active || undefined} onClick={() => setSelected(p)}>
                <div className="card-prod-img" style={{ background: brand.brandSoft, color: brand.brandPrimary }}>
                  <Icon name="ImageIcon" size={28} />
                  {!p.active && <span className="card-prod-off">Inativo</span>}
                </div>
                <div className="card-prod-body">
                  <div className="card-prod-name">{p.name}</div>
                  <div className="card-prod-desc">{p.desc}</div>
                  <div className="card-prod-sizes">
                    {p.sizes.map(s => (
                      <span key={s.size} className="card-prod-size">
                        <b>{s.size}</b> R$ {s.price.toFixed(2).replace('.', ',')}
                      </span>
                    ))}
                  </div>
                  <div className="card-prod-foot">
                    <span className="card-prod-foot-l">
                      {p.complementos > 0 && <><Icon name="Layers" size={11} />{p.complementos} complementos</>}
                    </span>
                    <span className="card-prod-sold">vendidos <b>{p.sold}</b></span>
                  </div>
                </div>
              </article>
            ))}
            <button className="card-prod card-prod-add" onClick={() => alert('Novo produto em ' + cat)}>
              <Icon name="Plus" size={24} />
              <span>Adicionar produto em {data.categorias.find(c => c.id === cat)?.label}</span>
            </button>
          </div>
        </section>
      </div>

      {selected && (
        <>
          <div className="drawer-overlay" onClick={() => setSelected(null)}></div>
          <aside className="drawer drawer-wide">
            <header className="drawer-head">
              <div className="card-prod-img" style={{ background: brand.brandSoft, color: brand.brandPrimary, width: 56, height: 56, borderRadius: 12 }}>
                <Icon name="ImageIcon" size={24} />
              </div>
              <div className="drawer-head-text">
                <div className="drawer-name">{selected.name}</div>
                <div className="drawer-sub">{data.categorias.find(c => c.id === cat)?.label} · vendidos {selected.sold}</div>
              </div>
              <button className="btn-icon" onClick={() => setSelected(null)}><Icon name="X" size={16} /></button>
            </header>

            <div className="drawer-section">
              <div className="drawer-section-title">Descrição</div>
              <p className="drawer-p">{selected.desc}</p>
            </div>

            <div className="drawer-section">
              <div className="drawer-section-title">Tamanhos e preços</div>
              {selected.sizes.map(s => (
                <div key={s.size} className="size-row">
                  <input className="size-input" value={s.size} readOnly />
                  <span className="size-cur">R$</span>
                  <input className="size-input size-input-price" value={s.price.toFixed(2).replace('.', ',')} readOnly />
                  <button className="btn-icon"><Icon name="Trash2" size={14} /></button>
                </div>
              ))}
              <button className="btn btn-soft btn-sm"><Icon name="Plus" size={13} />Adicionar tamanho</button>
            </div>

            {selected.complementos > 0 && (
              <div className="drawer-section">
                <div className="drawer-section-title">Complementos disponíveis ({selected.complementos})</div>
                <div className="drawer-prefs">
                  {data.complementos.slice(0, selected.complementos).map(c => (
                    <span key={c} className="cli-chip"><Icon name="Check" size={10} />{c}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="drawer-section">
              <div className="drawer-section-title">Status</div>
              <div className="card-status-row">
                <span>{selected.active ? 'Visível no cardápio' : 'Oculto'}</span>
                <button className="toggle" data-on={selected.active || undefined} style={selected.active ? { background: brand.brandPrimary } : {}}>
                  <span className="toggle-thumb"></span>
                </button>
              </div>
            </div>

            <footer className="drawer-foot">
              <button className="btn btn-soft"><Icon name="Trash2" size={14} />Excluir</button>
              <button className="btn btn-primary" style={{ background: brand.brandPrimary }}><Icon name="Check" size={14} />Salvar alterações</button>
            </footer>
          </aside>
        </>
      )}
    </div>
  );
}

Object.assign(window, { ClientesPage, CardapioPage });
