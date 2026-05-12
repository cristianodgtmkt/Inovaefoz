// Conversas + Escalações pages
const { useState: useStateC, useRef: useRefC, useEffect: useEffectC } = React;

function ConvCard({ conv, selected, onClick, brand }) {
  return (
    <button className="cv-item" data-selected={selected || undefined} onClick={() => onClick(conv.id)} style={selected ? { borderLeftColor: brand.brandPrimary } : {}}>
      <span className="cv-avatar" style={{ background: conv.avatarColor }}>{conv.initial}</span>
      <span className="cv-text">
        <span className="cv-top">
          <span className="cv-name">{conv.customer}</span>
          <span className="cv-time">{conv.timeAgo}</span>
        </span>
        <span className="cv-bottom">
          <span className="cv-preview">{conv.lastMsg}</span>
          {conv.unread > 0 && <span className="cv-unread" style={{ background: brand.brandPrimary }}>{conv.unread}</span>}
        </span>
        <span className="cv-tags">
          {conv.status === 'escalated' && <span className="cv-tag cv-tag-esc"><Icon name="TriangleAlert" size={10} />Escalada</span>}
          {conv.pedidoOpen && <span className="cv-tag cv-tag-cart"><Icon name="ShoppingBag" size={10} />Pedido aberto</span>}
          {conv.status === 'ai' && !conv.pedidoOpen && <span className="cv-tag cv-tag-ai"><Icon name="Bot" size={10} />IA</span>}
        </span>
      </span>
    </button>
  );
}

function Bubble({ msg, brand }) {
  const isCustomer = msg.from === 'customer';
  const isAdmin = msg.from === 'admin';
  const isEsc = msg.tag === 'escalation';
  if (isEsc) {
    return (
      <div className="bbl-system"><Icon name="TriangleAlert" size={13} /><span>{msg.text}</span><span className="bbl-ts">{msg.ts}</span></div>
    );
  }
  return (
    <div className={`bbl bbl-${msg.from}`}>
      <div className="bbl-body" style={isCustomer ? { background: brand.brandPrimary, color: 'white' } : {}}>
        {msg.text}
      </div>
      <div className="bbl-meta">
        {msg.from === 'ai' && <span className="bbl-iatag"><Icon name="Bot" size={10} />IA</span>}
        {isAdmin && <span className="bbl-iatag" style={{ background: '#fef3c7', color: '#92400e' }}><Icon name="User" size={10} />Você</span>}
        <span className="bbl-ts">{msg.ts}</span>
      </div>
    </div>
  );
}

function ConversasPage({ brand }) {
  const list = window.MOCK2.CONVERSAS;
  const [selectedId, setSelectedId] = useStateC('c-1');
  const [filter, setFilter] = useStateC('all');
  const [search, setSearch] = useStateC('');
  const [draft, setDraft] = useStateC('');
  const [convs, setConvs] = useStateC(list);
  const [paused, setPaused] = useStateC(false);
  const [toast, setToast] = useStateC(null);
  const messagesRef = useRefC(null);

  const conv = convs.find(c => c.id === selectedId);
  const filtered = convs.filter(c => {
    if (filter === 'escalated' && c.status !== 'escalated') return false;
    if (filter === 'unread' && c.unread === 0) return false;
    if (search && !c.customer.toLowerCase().includes(search.toLowerCase()) && !c.phone.includes(search)) return false;
    return true;
  });

  useEffectC(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [selectedId, conv?.msgs?.length]);

  function send() {
    if (!draft.trim() || !conv) return;
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    setConvs(prev => prev.map(c => c.id === conv.id ? { ...c, msgs: [...(c.msgs||[]), { from: 'admin', text: draft, ts }], lastMsg: draft, timeAgo: 'agora', unread: 0 } : c));
    setDraft('');
    setToast({ kind: 'success', text: `Mensagem enviada para ${conv.customer}` });
    setTimeout(() => setToast(null), 3000);
  }

  function togglePause() {
    setPaused(p => !p);
    setToast({ kind: 'info', text: paused ? `Bot retomado para ${conv.customer}` : `Bot pausado para ${conv.customer} · você está atendendo` });
    setTimeout(() => setToast(null), 3500);
  }

  if (!conv) return null;

  return (
    <div className="conv-page">
      <div className="page-head">
        <div>
          <h2>Conversas</h2>
          <p><b>{filtered.length}</b> conversas · <b>{convs.filter(c => c.unread > 0).length}</b> com mensagens não lidas · <b>{convs.filter(c => c.status === 'escalated').length}</b> escaladas</p>
        </div>
        <div className="page-head-right">
          <button className="btn btn-soft"><Icon name="Filter" size={14} />Filtros</button>
          <button className="btn btn-soft"><Icon name="Archive" size={14} />Arquivadas</button>
        </div>
      </div>

      <div className="conv-shell">
        <aside className="conv-list">
          <div className="conv-search">
            <Icon name="Search" size={14} />
            <input placeholder="Buscar nome, telefone..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="conv-filters">
            {[
              { id: 'all', label: `Todas (${convs.length})` },
              { id: 'unread', label: `Não lidas (${convs.filter(c => c.unread > 0).length})` },
              { id: 'escalated', label: `Escaladas (${convs.filter(c => c.status === 'escalated').length})` },
            ].map(f => (
              <button key={f.id} className="conv-filter-pill" data-active={filter === f.id || undefined} onClick={() => setFilter(f.id)} style={filter === f.id ? { background: brand.brandPrimary, color: 'white', borderColor: brand.brandPrimary } : {}}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="conv-list-body">
            {filtered.map(c => <ConvCard key={c.id} conv={c} selected={c.id === selectedId} onClick={setSelectedId} brand={brand} />)}
          </div>
        </aside>

        <section className="conv-chat">
          <header className="conv-chat-head">
            <span className="cv-avatar" style={{ background: conv.avatarColor }}>{conv.initial}</span>
            <div className="conv-chat-text">
              <div className="conv-chat-name">{conv.customer}</div>
              <div className="conv-chat-sub">
                {conv.phone} ·{' '}
                {conv.pedidoOpen && <span style={{ color: brand.brandPrimary, fontWeight: 600 }}><Icon name="ShoppingBag" size={11} /> Pedido aberto</span>}
                {!conv.pedidoOpen && <span style={{ color: '#94a3b8' }}>Sem pedido em curso</span>}
              </div>
            </div>
            <div className="conv-chat-actions">
              <button className="btn btn-soft btn-sm"><Icon name="UserPlus" size={13} />Atribuir</button>
              <button className="btn btn-soft btn-sm" onClick={togglePause}>
                <Icon name={paused ? 'Play' : 'Pause'} size={13} />
                {paused ? 'Devolver para IA' : 'Pausar bot'}
              </button>
              <button className="btn-icon"><Icon name="MoreVertical" size={15} /></button>
            </div>
          </header>

          <div className="conv-messages" ref={messagesRef}>
            <div className="conv-day-divider"><span>Hoje · 21:42</span></div>
            {(conv.msgs || []).map((m, i) => <Bubble key={i} msg={m} brand={brand} />)}
            {paused && (
              <div className="conv-banner-inline">
                <Icon name="Pause" size={13} />
                <span>Bot pausado para esta conversa. Suas mensagens serão enviadas direto pelo WhatsApp.</span>
              </div>
            )}
          </div>

          <footer className="conv-composer">
            <button className="btn-icon" aria-label="Anexar"><Icon name="Paperclip" size={16} /></button>
            <input
              className="conv-input"
              placeholder={paused ? 'Sua resposta (modo manual)…' : 'Reply manual (pausa o bot temporariamente)…'}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button className="btn-icon" aria-label="Resposta rápida"><Icon name="Sparkles" size={16} /></button>
            <button className="btn btn-primary btn-sm" style={{ background: brand.brandPrimary }} onClick={send} disabled={!draft.trim()}>
              <Icon name="Send" size={13} />Enviar
            </button>
          </footer>
        </section>
      </div>

      {toast && <KanbanToast toast={toast} />}
    </div>
  );
}

function EscalacoesPage({ brand }) {
  const items = window.MOCK2.ESCALACOES;
  return (
    <div className="esc-page">
      <div className="page-head">
        <div>
          <h2>Escalações</h2>
          <p><b>{items.length}</b> aguardando atendimento humano · prioridade alta primeiro</p>
        </div>
        <div className="page-head-right">
          <button className="btn btn-soft"><Icon name="Filter" size={14} />Por motivo</button>
          <button className="btn btn-soft"><Icon name="Clock" size={14} />Por idade</button>
        </div>
      </div>

      <div className="esc-list">
        {items.map(e => (
          <article key={e.id} className="esc-card" data-priority={e.priority}>
            <div className="esc-card-l">
              <div className="esc-meta">
                <span className={`esc-prio esc-prio-${e.priority}`}><Icon name={e.priority === 'high' ? 'AlertOctagon' : 'TriangleAlert'} size={11} />{e.priority === 'high' ? 'Alta' : 'Normal'}</span>
                <span className="esc-motivo">{e.motivo}</span>
                <span className="esc-aberta">aberta há <b>{e.aberta}</b></span>
              </div>
              <div className="esc-customer">
                <span className="cv-avatar" style={{ background: '#cbd5e1', width: 28, height: 28, fontSize: 10 }}>{e.customer.split(' ').map(p => p[0]).slice(0,2).join('')}</span>
                <div>
                  <div className="esc-name">{e.customer}</div>
                  <div className="esc-phone">{e.phone}</div>
                </div>
              </div>
              <p className="esc-preview">"{e.preview}"</p>
              {e.atendente && <div className="esc-atendente"><Icon name="UserCheck" size={11} />Atendendo: <b>{e.atendente}</b></div>}
            </div>
            <div className="esc-actions">
              <button className="btn btn-soft btn-sm"><Icon name="MessageSquare" size={13} />Abrir conversa</button>
              <button className="btn btn-primary btn-sm" style={{ background: brand.brandPrimary }}><Icon name="Headphones" size={13} />Atender agora</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { ConversasPage, EscalacoesPage });
