// Kanban page — Pedidos
// Globals: React, Icon, MOCK
const { useState: useStateK, useEffect: useEffectK, useRef: useRefK, useMemo: useMemoK } = React;

function paymentMeta(p) {
  switch (p) {
    case 'pix': return { icon: 'QrCode', label: 'PIX' };
    case 'cartao': return { icon: 'CreditCard', label: 'Cartão' };
    case 'dinheiro': return { icon: 'Banknote', label: 'Dinheiro' };
    default: return { icon: 'Wallet', label: '—' };
  }
}

function fmtBRL(n) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function timeAgo(min) {
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  return `há ${h}h ${min % 60}min`;
}

function OrderCard({ order, col, expanded, onToggle, onMove, brand, dragging, onDragStart, onDragEnd, cols }) {
  const pm = paymentMeta(order.payment);
  const itemCount = order.items.reduce((a, b) => a + b.qty, 0);
  const isBot = col.id === 'coletando' || col.id === 'aguardando';

  return (
    <article
      className="ocard"
      data-expanded={expanded || undefined}
      data-dragging={dragging || undefined}
      draggable={!expanded}
      onDragStart={(e) => { if (expanded) return e.preventDefault(); onDragStart(order, e); }}
      onDragEnd={onDragEnd}
      style={expanded ? { borderColor: brand.brandBorder, boxShadow: `0 0 0 1px ${brand.brandBorder}, 0 4px 12px -2px rgba(15,23,42,0.08)` } : {}}
    >
      <header className="ocard-head" onClick={() => onToggle(order.id)}>
        <div className="ocard-customer">
          <div className="ocard-name">{order.customer}</div>
          <div className="ocard-phone">{order.phone}</div>
        </div>
        <div className="ocard-meta">
          <div className="ocard-id" style={{ color: brand.brandPrimary }}>#{order.id.split('-')[1]}</div>
          <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={14} className="ocard-chev" />
        </div>
      </header>
      <div className="ocard-row">
        <span className="ocard-pill"><Icon name="Package" size={11} />{itemCount} {itemCount > 1 ? 'itens' : 'item'}</span>
        {!isBot && <span className="ocard-pill ocard-pill-money">{fmtBRL(order.total)}</span>}
        {!isBot && <span className="ocard-pill"><Icon name={pm.icon} size={11} />{pm.label}</span>}
        {isBot && <span className="ocard-pill ocard-pill-bot"><Icon name="Bot" size={11} />IA</span>}
        <span className="ocard-time">{timeAgo(order.placedMin)}</span>
      </div>

      {expanded && (
        <div className="ocard-body">
          <section className="ocard-section">
            <div className="ocard-section-title">Itens</div>
            <ul className="ocard-items">
              {order.items.map((it, i) => (
                <li key={i}>
                  <span className="ocard-item-qty">{it.qty}×</span>
                  <span className="ocard-item-name">{it.name}</span>
                  <span className="ocard-item-price">{fmtBRL(it.price * it.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="ocard-totals">
              <div><span>Subtotal</span><span>{fmtBRL(order.total - 0)}</span></div>
              <div><span>Taxa de entrega</span><span>{fmtBRL(order.fee)}</span></div>
              <div className="ocard-totals-grand"><span>Total</span><span>{fmtBRL(order.total + order.fee)}</span></div>
            </div>
          </section>

          <section className="ocard-section">
            <div className="ocard-section-title">Entrega</div>
            <div className="ocard-addr">
              <Icon name="MapPin" size={13} />
              <div>
                <div>{order.addr}{order.complement ? ` · ${order.complement}` : ''}</div>
                <div className="ocard-addr-bairro">{order.bairro}</div>
              </div>
            </div>
          </section>

          <section className="ocard-section">
            <div className="ocard-section-title">Pagamento</div>
            <div className="ocard-payment">
              <Icon name={pm.icon} size={13} />
              <span>{pm.label}</span>
              {order.troco && <span className="ocard-troco">· troco para {fmtBRL(order.troco)}</span>}
            </div>
          </section>

          {order.note && (
            <div className="ocard-note">
              <Icon name="StickyNote" size={13} />
              <span>{order.note}</span>
            </div>
          )}

          <div className="ocard-actions">
            <button className="btn btn-soft"><Icon name="Printer" size={13} />Imprimir</button>
            <button className="btn btn-soft"><Icon name="MessageSquare" size={13} />Conversa</button>
            <div className="ocard-move">
              <button className="btn btn-primary" style={{ background: brand.brandPrimary }}>
                <Icon name="ArrowRight" size={13} />Mover para…
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function KanbanColumn({ col, orders, expandedId, onToggle, brand, dragOver, onDragOver, onDragLeave, onDrop, onDragStart, onDragEnd, dragId }) {
  return (
    <div
      className="kcol"
      data-dragover={dragOver || undefined}
      onDragOver={(e) => { e.preventDefault(); onDragOver(col.id); }}
      onDragLeave={() => onDragLeave(col.id)}
      onDrop={(e) => { e.preventDefault(); onDrop(col.id); }}
    >
      <header className="kcol-head" style={{ background: col.bg, borderColor: col.border }}>
        <span className="kcol-dot" style={{ background: col.hex }} />
        <span className="kcol-label" style={{ color: col.hex }}>{col.label}</span>
        <span className="kcol-count" style={{ background: 'white', color: col.hex, borderColor: col.border }}>{orders.length}</span>
      </header>
      <div className="kcol-body">
        {orders.length === 0 ? (
          <div className="kcol-empty">
            <Icon name="Inbox" size={20} />
            <span>Arraste aqui</span>
          </div>
        ) : (
          orders.map(o => (
            <OrderCard
              key={o.id}
              order={o}
              col={col}
              expanded={expandedId === o.id}
              onToggle={onToggle}
              brand={brand}
              dragging={dragId === o.id}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </div>
    </div>
  );
}

function NewOrderNotification({ visible, order, onDismiss, brand }) {
  if (!visible || !order) return null;
  return (
    <div className="newpop">
      <div className="newpop-icon" style={{ background: brand.brandSoft, color: brand.brandPrimary }}>
        <Icon name="BellRing" size={18} />
      </div>
      <div className="newpop-text">
        <div className="newpop-title">Novo pedido recebido</div>
        <div className="newpop-sub"><b>{order.customer}</b> · #{order.id.split('-')[1]} · {fmtBRL(order.total + order.fee)}</div>
      </div>
      <div className="newpop-actions">
        <button className="btn btn-primary" style={{ background: brand.brandPrimary }}>
          <Icon name="Printer" size={13} />Imprimir
        </button>
        <button className="btn-icon" onClick={onDismiss} aria-label="Fechar">
          <Icon name="X" size={15} />
        </button>
      </div>
    </div>
  );
}

function KanbanToast({ toast }) {
  if (!toast) return null;
  return (
    <div className="toast" data-kind={toast.kind}>
      <Icon name={toast.kind === 'success' ? 'CheckCircle2' : toast.kind === 'warn' ? 'AlertTriangle' : 'Info'} size={16} />
      <span>{toast.text}</span>
    </div>
  );
}

function PedidosPage({ brand, botPaused, kanbanState = 'full' }) {
  const initial = window.MOCK.ORDERS;
  const [orders, setOrders] = useStateK(initial);
  const [expandedId, setExpandedId] = useStateK('AB-1040');
  const [dragId, setDragId] = useStateK(null);
  const [dragOverCol, setDragOverCol] = useStateK(null);
  const [toast, setToast] = useStateK(null);
  const [newPop, setNewPop] = useStateK(null);

  // Re-seed on tweak change
  useEffectK(() => {
    if (kanbanState === 'empty') setOrders([]);
    else if (kanbanState === 'few') setOrders(initial.filter((_, i) => i < 4));
    else setOrders(initial);
  }, [kanbanState]);

  const cols = window.MOCK.COLS_ALL;

  const byCol = useMemoK(() => {
    const m = {};
    cols.forEach(c => m[c.id] = []);
    orders.forEach(o => { if (m[o.col]) m[o.col].push(o); });
    return m;
  }, [orders, cols]);

  const inKitchen = orders.filter(o => ['novo_pedido', 'em_preparo', 'pronto_retirar', 'saiu_entrega'].includes(o.col)).length;
  const revenueToday = orders.filter(o => o.col !== 'cancelado' && o.col !== 'coletando' && o.col !== 'aguardando').reduce((s, o) => s + o.total + o.fee, 0);

  function onDragStart(order, e) {
    setDragId(order.id);
    if (e?.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', order.id); } catch {}
    }
  }
  function onDragEnd() { setDragId(null); setDragOverCol(null); }
  function onDragOver(colId) { setDragOverCol(colId); }
  function onDragLeave(colId) { setDragOverCol(c => c === colId ? null : c); }
  function onDrop(colId) {
    if (!dragId) return;
    const order = orders.find(o => o.id === dragId);
    if (!order || order.col === colId) { setDragId(null); setDragOverCol(null); return; }
    setOrders(prev => prev.map(o => o.id === dragId ? { ...o, col: colId } : o));
    const col = cols.find(c => c.id === colId);
    const auto = ['em_preparo', 'saiu_entrega', 'entregue'].includes(colId);
    if (auto) {
      setToast({ kind: 'success', text: `Movido para “${col.label}” · mensagem enviada via WhatsApp` });
    } else {
      setToast({ kind: 'info', text: `Movido para “${col.label}”` });
    }
    setDragId(null);
    setDragOverCol(null);
    setTimeout(() => setToast(null), 4000);
  }
  function onToggle(id) { setExpandedId(prev => prev === id ? null : id); }

  // Simulated new-order notification
  useEffectK(() => {
    const t = setTimeout(() => {
      setNewPop({
        id: 'AB-1046', customer: 'Larissa Hoffmann', total: 38.00, fee: 6.00,
      });
    }, 1800);
    return () => clearTimeout(t);
  }, []);

  function dismissPop() { setNewPop(null); }

  return (
    <div className="pedidos-page">
      <div className="page-head">
        <div>
          <h2>Pedidos</h2>
          <p>
            <b>{inKitchen}</b> na cozinha · Receita estimada <b>{fmtBRL(revenueToday)}</b> ·{' '}
            <Icon name="MessageCircle" size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            Ao mover, envia mensagem automática
          </p>
        </div>
        <div className="page-head-right">
          <button className="btn btn-ghost"><Icon name="Filter" size={14} />Filtros</button>
          <button className="btn btn-ghost"><Icon name="RefreshCw" size={14} />Atualizar</button>
          <button className="btn btn-primary" style={{ background: brand.brandPrimary }}>
            <Icon name="Plus" size={14} />Novo pedido manual
          </button>
        </div>
      </div>

      {botPaused && (
        <div className="banner banner-warn">
          <Icon name="Pause" size={15} />
          <span><b>Bot pausado globalmente.</b> Novos pedidos entram em <em>Aguardando</em> e exigem atendimento manual.</span>
          <button className="btn btn-soft btn-sm">Retomar bot</button>
        </div>
      )}

      <div className="kanban">
        <section className="ksection ksection-bot">
          <div className="ksection-head">
            <div className="ksection-title">
              <span className="ksection-emoji">🤖</span>
              <span>Bot · Pré-pedido</span>
            </div>
            <div className="ksection-meta">{(byCol.coletando.length + byCol.aguardando.length)} em fluxo</div>
          </div>
          <div className="kcols">
            {window.MOCK.COLS_BOT.map(col => (
              <KanbanColumn
                key={col.id} col={col} orders={byCol[col.id]} expandedId={expandedId}
                onToggle={onToggle} brand={brand}
                dragOver={dragOverCol === col.id}
                onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                onDragStart={onDragStart} onDragEnd={onDragEnd} dragId={dragId}
              />
            ))}
          </div>
        </section>

        <div className="ksection-divider" aria-hidden="true" />

        <section className="ksection ksection-kitchen">
          <div className="ksection-head">
            <div className="ksection-title">
              <span className="ksection-emoji">👨‍🍳</span>
              <span>Cozinha · Operação</span>
            </div>
            <div className="ksection-meta">{inKitchen} ativos · {byCol.entregue.length} entregues hoje</div>
          </div>
          <div className="kcols kcols-kitchen">
            {window.MOCK.COLS_KITCHEN.map(col => (
              <KanbanColumn
                key={col.id} col={col} orders={byCol[col.id]} expandedId={expandedId}
                onToggle={onToggle} brand={brand}
                dragOver={dragOverCol === col.id}
                onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                onDragStart={onDragStart} onDragEnd={onDragEnd} dragId={dragId}
              />
            ))}
          </div>
        </section>
      </div>

      <NewOrderNotification visible={!!newPop} order={newPop} onDismiss={dismissPop} brand={brand} />
      <KanbanToast toast={toast} />
    </div>
  );
}

Object.assign(window, { PedidosPage, OrderCard, KanbanColumn, fmtBRL, timeAgo, paymentMeta });
