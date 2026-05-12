// Zonas + Configurações pages
const { useState: useStateZ } = React;

function ZonasPage({ brand }) {
  const zonas = window.MOCK2.ZONAS;
  const [selected, setSelected] = useStateZ(zonas[0].id);
  const sel = zonas.find(z => z.id === selected);
  const totalAtivas = zonas.filter(z => z.ativa).length;
  const totalPedidos = zonas.reduce((s, z) => s + z.pedidos, 0);

  return (
    <div className="zon-page">
      <div className="page-head">
        <div>
          <h2>Zonas de entrega</h2>
          <p><b>{totalAtivas}</b> zonas ativas · <b>{totalPedidos}</b> pedidos atendidos no período · taxa média <b>R$ 7,00</b></p>
        </div>
        <div className="page-head-right">
          <button className="btn btn-soft"><Icon name="MapPin" size={14} />Importar do CEP</button>
          <button className="btn btn-primary" style={{ background: brand.brandPrimary }}><Icon name="Plus" size={14} />Nova zona</button>
        </div>
      </div>

      <div className="zon-layout">
        <section className="zon-map">
          <ZonasMap zonas={zonas} selected={selected} onSelect={setSelected} brand={brand} />
          <div className="zon-map-legend">
            <span className="cv-tag cv-tag-ai"><Icon name="Store" size={11} />Loja</span>
            <span className="cv-tag cv-tag-cart">zonas ativas</span>
          </div>
        </section>

        <aside className="zon-list">
          <div className="zon-list-head">
            <span>Lista de zonas</span>
            <span className="muted" style={{ fontSize: 11 }}>arraste para reordenar prioridade</span>
          </div>
          {zonas.map(z => (
            <button key={z.id} className="zon-row" data-active={z.id === selected || undefined} data-off={!z.ativa || undefined} onClick={() => setSelected(z.id)} style={z.id === selected ? { borderLeftColor: brand.brandPrimary, background: brand.brandSoft } : {}}>
              <div className="zon-row-l">
                <div className="zon-row-name">{z.bairro}</div>
                <div className="zon-row-sub">
                  <span><Icon name="DollarSign" size={11} />R$ {z.taxa.toFixed(2).replace('.', ',')}</span>
                  <span><Icon name="Clock" size={11} />{z.tempo}</span>
                  <span><Icon name="Radius" size={11} />{z.raio}km</span>
                </div>
              </div>
              <div className="zon-row-r">
                <span className="zon-row-pedidos"><b>{z.pedidos}</b><span>pedidos</span></span>
                {!z.ativa && <span className="cv-tag cv-tag-esc" style={{ fontSize: 9 }}>pausada</span>}
              </div>
            </button>
          ))}
        </aside>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-h">Editar zona · {sel.bairro}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-soft btn-sm"><Icon name="Trash2" size={13} />Excluir</button>
            <button className="btn btn-primary btn-sm" style={{ background: brand.brandPrimary }}><Icon name="Check" size={13} />Salvar</button>
          </div>
        </div>
        <div className="zon-form">
          <Field label="Nome do bairro" value={sel.bairro} />
          <Field label="Taxa de entrega (R$)" value={sel.taxa.toFixed(2)} />
          <Field label="Raio (km)" value={sel.raio.toString()} />
          <Field label="Tempo estimado" value={sel.tempo} />
          <Field label="Pedido mínimo (R$)" value="0,00" />
          <div className="zon-form-toggle">
            <div>
              <div className="zon-form-toggle-l">Zona ativa</div>
              <div className="muted" style={{ fontSize: 12 }}>Quando desativada, bot recusa endereços nesta área</div>
            </div>
            <button className="toggle" data-on={sel.ativa || undefined} style={sel.ativa ? { background: brand.brandPrimary } : {}}><span className="toggle-thumb"></span></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <label className="zon-field">
      <span className="zon-field-l">{label}</span>
      <input className="zon-field-i" defaultValue={value} />
    </label>
  );
}

function ZonasMap({ zonas, selected, onSelect, brand }) {
  // simplified abstract map — circles around store
  const w = 700, h = 360;
  const cx = w / 2, cy = h / 2;
  const positions = [
    { x: 0, y: 0 }, { x: 1.0, y: 0.3 }, { x: -0.8, y: 0.6 }, { x: 0.5, y: -0.7 },
    { x: -1.0, y: -0.4 }, { x: 0.3, y: 0.9 }, { x: -0.4, y: 1.0 }, { x: 1.1, y: -0.4 },
    { x: 1.6, y: 0.8 },
  ];
  return (
    <svg className="zon-map-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      {/* grid background */}
      <defs>
        <pattern id="zgrid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={w} height={h} fill="url(#zgrid)" />
      {/* river */}
      <path d={`M0 ${h * 0.7} Q ${w * 0.3} ${h * 0.5} ${w * 0.6} ${h * 0.75} T ${w} ${h * 0.65}`} stroke="#bae6fd" strokeWidth="14" fill="none" opacity="0.7" />
      {/* zones */}
      {zonas.slice(0, positions.length).map((z, i) => {
        const p = positions[i];
        const scale = 38;
        const x = cx + p.x * scale * 2.3;
        const y = cy + p.y * scale * 1.4;
        const r = z.raio * scale / 4;
        const isSel = z.id === selected;
        return (
          <g key={z.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(z.id)} opacity={z.ativa ? 1 : 0.35}>
            <circle cx={x} cy={y} r={r}
              fill={isSel ? brand.brandPrimary : `color-mix(in oklch, ${brand.brandPrimary} 18%, white)`}
              stroke={brand.brandPrimary}
              strokeWidth={isSel ? 2.5 : 1.2}
              fillOpacity={isSel ? 0.35 : 0.6} />
            <text x={x} y={y - 4} textAnchor="middle" style={{ fontSize: 11, fontWeight: 600, fill: '#0f172a' }}>{z.bairro}</text>
            <text x={x} y={y + 10} textAnchor="middle" style={{ fontSize: 10, fill: '#475569' }}>R$ {z.taxa.toFixed(2).replace('.', ',')}</text>
          </g>
        );
      })}
      {/* store */}
      <g>
        <circle cx={cx} cy={cy} r="14" fill={brand.brandPrimary} />
        <text x={cx} y={cy + 4} textAnchor="middle" style={{ fontSize: 13, fill: 'white' }}>🍇</text>
        <text x={cx} y={cy + 32} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: '#0f172a' }}>Açaí da Barra</text>
      </g>
    </svg>
  );
}

function ConfigPage({ brand }) {
  const [section, setSection] = useStateZ('geral');
  const sections = [
    { id: 'geral', label: 'Geral', icon: 'Settings' },
    { id: 'horarios', label: 'Horários', icon: 'Clock' },
    { id: 'pagamentos', label: 'Pagamentos', icon: 'CreditCard' },
    { id: 'whatsapp', label: 'WhatsApp', icon: 'MessageSquare' },
    { id: 'usuarios', label: 'Usuários', icon: 'Users' },
    { id: 'integracoes', label: 'Integrações', icon: 'Plug' },
    { id: 'faturamento', label: 'Faturamento', icon: 'Receipt' },
    { id: 'avancado', label: 'Avançado', icon: 'Code2' },
  ];

  return (
    <div className="cfg-page">
      <div className="page-head">
        <div>
          <h2>Configurações</h2>
          <p>Tenant <b>Açaí da Barra</b> · plano <b>Pro</b> · próximo faturamento em <b>12 dias</b></p>
        </div>
      </div>

      <div className="cfg-layout">
        <aside className="cfg-nav">
          {sections.map(s => (
            <button key={s.id} className="cfg-nav-item" data-active={section === s.id || undefined} onClick={() => setSection(s.id)} style={section === s.id ? { background: brand.brandSoft, color: brand.brandPrimary, borderLeftColor: brand.brandPrimary } : {}}>
              <Icon name={s.icon} size={15} />{s.label}
            </button>
          ))}
        </aside>

        <section className="cfg-body">
          {section === 'geral' && <CfgGeral brand={brand} />}
          {section === 'horarios' && <CfgHorarios brand={brand} />}
          {section === 'pagamentos' && <CfgPagamentos brand={brand} />}
          {section === 'whatsapp' && <CfgWhatsApp brand={brand} />}
          {section === 'usuarios' && <CfgUsuarios brand={brand} />}
          {section === 'integracoes' && <CfgIntegracoes brand={brand} />}
          {section === 'faturamento' && <CfgFaturamento brand={brand} />}
          {section === 'avancado' && <CfgAvancado brand={brand} />}
        </section>
      </div>
    </div>
  );
}

function CfgGeral({ brand }) {
  return (
    <>
      <div className="card">
        <div className="card-head"><div className="card-h">Identidade da loja</div></div>
        <div className="cfg-form">
          <Field label="Nome fantasia" value="Açaí da Barra" />
          <Field label="Razão social" value="Açaí da Barra LTDA ME" />
          <Field label="CNPJ" value="34.582.119/0001-46" />
          <Field label="Telefone" value="(45) 3025-7788" />
          <Field label="E-mail" value="contato@acaidabarra.com.br" />
          <Field label="Instagram" value="@acaidabarrafoz" />
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-h">Branding</div></div>
        <div className="cfg-brand">
          <div className="cfg-brand-logo">
            <div className="brand-mark" style={{ background: brand.brandSoft, borderColor: 'color-mix(in oklch, ' + brand.brandPrimary + ' 30%, white)', width: 80, height: 80, borderRadius: 16, fontSize: 36 }}>🍇</div>
            <button className="btn btn-soft btn-sm"><Icon name="Upload" size={13} />Trocar logo</button>
          </div>
          <div style={{ flex: 1 }}>
            <div className="cfg-l">Cor primária</div>
            <div className="cfg-swatches">
              {['#7e22ce', '#dc2626', '#0891b2', '#16a34a', '#ea580c', '#0f172a'].map(c => (
                <button key={c} className="cfg-swatch" data-on={c === brand.brandPrimary || undefined} style={{ background: c, boxShadow: c === brand.brandPrimary ? '0 0 0 3px white, 0 0 0 5px ' + c : undefined }}></button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-h">Endereço da loja</div></div>
        <div className="cfg-form">
          <Field label="CEP" value="85.860-000" />
          <Field label="Logradouro" value="Av. Brasil" />
          <Field label="Número" value="2785" />
          <Field label="Bairro" value="Centro" />
          <Field label="Cidade" value="Foz do Iguaçu" />
          <Field label="UF" value="PR" />
        </div>
      </div>
    </>
  );
}

function CfgHorarios({ brand }) {
  const dias = [
    { d: 'Segunda-feira', open: '17:00', close: '23:30', ativo: true },
    { d: 'Terça-feira', open: '17:00', close: '23:30', ativo: true },
    { d: 'Quarta-feira', open: '17:00', close: '23:30', ativo: true },
    { d: 'Quinta-feira', open: '17:00', close: '23:30', ativo: true },
    { d: 'Sexta-feira', open: '17:00', close: '00:30', ativo: true },
    { d: 'Sábado', open: '14:00', close: '01:00', ativo: true },
    { d: 'Domingo', open: '14:00', close: '23:00', ativo: true },
  ];
  return (
    <div className="card">
      <div className="card-head"><div className="card-h">Horário de funcionamento</div></div>
      <div className="cfg-horarios">
        {dias.map(h => (
          <div key={h.d} className="cfg-hrow">
            <span className="cfg-hday">{h.d}</span>
            <button className="toggle" data-on={h.ativo || undefined} style={h.ativo ? { background: brand.brandPrimary } : {}}><span className="toggle-thumb"></span></button>
            <span className="cfg-hsep">aberto das</span>
            <input className="zon-field-i cfg-htime" defaultValue={h.open} />
            <span>às</span>
            <input className="zon-field-i cfg-htime" defaultValue={h.close} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CfgPagamentos({ brand }) {
  const methods = [
    { id: 'pix', name: 'PIX', sub: 'instantâneo · sem taxa', icon: 'QrCode', on: true },
    { id: 'credit', name: 'Cartão de crédito', sub: 'maquininha na entrega', icon: 'CreditCard', on: true },
    { id: 'debit', name: 'Cartão de débito', sub: 'maquininha na entrega', icon: 'CreditCard', on: true },
    { id: 'cash', name: 'Dinheiro', sub: 'troco somente até R$ 100', icon: 'Wallet', on: true },
    { id: 'voucher', name: 'Vale-refeição', sub: 'Sodexo, VR, Ticket', icon: 'Ticket', on: false },
  ];
  return (
    <div className="card">
      <div className="card-head"><div className="card-h">Métodos de pagamento aceitos</div></div>
      <div className="cfg-pays">
        {methods.map(m => (
          <div key={m.id} className="cfg-pay">
            <span className="cfg-pay-ico" style={{ background: brand.brandSoft, color: brand.brandPrimary }}><Icon name={m.icon} size={16} /></span>
            <div className="cfg-pay-text">
              <div className="cfg-pay-name">{m.name}</div>
              <div className="cfg-pay-sub">{m.sub}</div>
            </div>
            <button className="toggle" data-on={m.on || undefined} style={m.on ? { background: brand.brandPrimary } : {}}><span className="toggle-thumb"></span></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CfgWhatsApp({ brand }) {
  return (
    <>
      <div className="card">
        <div className="card-head"><div className="card-h">Número conectado</div><span className="cv-tag cv-tag-cart" style={{ background: '#dcfce7', color: '#166534' }}><span className="pulse-dot"></span>Conectado há 14 dias</span></div>
        <div className="cfg-wa-conn">
          <Icon name="MessageSquare" size={32} style={{ color: '#25D366' }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>+55 (45) 99812-4477</div>
            <div className="muted">WhatsApp Business · Cloud API · Meta</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-soft btn-sm"><Icon name="QrCode" size={13} />Reconectar</button>
            <button className="btn btn-soft btn-sm"><Icon name="Unplug" size={13} />Desconectar</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-h">Comportamento do bot</div></div>
        <div className="cfg-form">
          <CfgToggle brand={brand} label="Responder automaticamente" sub="IA atende mensagens recebidas" on />
          <CfgToggle brand={brand} label="Confirmar pedido por áudio" sub="Aceita mensagens de voz transcritas" on />
          <CfgToggle brand={brand} label="Enviar resumo do pedido" sub="Envia comprovante com tudo que foi pedido antes de fechar" on />
          <CfgToggle brand={brand} label="Notificar status por WhatsApp" sub="'Saiu para entrega', 'Chegou', etc" on />
          <CfgToggle brand={brand} label="Pedir avaliação após entrega" sub="Envia 30min após status 'entregue'" />
        </div>
      </div>
    </>
  );
}

function CfgToggle({ brand, label, sub, on }) {
  const [v, setV] = useStateZ(!!on);
  return (
    <div className="zon-form-toggle">
      <div>
        <div className="zon-form-toggle-l">{label}</div>
        <div className="muted" style={{ fontSize: 12 }}>{sub}</div>
      </div>
      <button className="toggle" data-on={v || undefined} onClick={() => setV(!v)} style={v ? { background: brand.brandPrimary } : {}}><span className="toggle-thumb"></span></button>
    </div>
  );
}

function CfgUsuarios({ brand }) {
  const users = [
    { name: 'Cristiano Wandscheer', email: 'cristiano@acaidabarra.com.br', role: 'Owner', last: 'agora' },
    { name: 'Joice Wandscheer', email: 'joice@acaidabarra.com.br', role: 'Admin', last: 'há 5min' },
    { name: 'Felipe Reichert', email: 'felipe.r@acaidabarra.com.br', role: 'Operador', last: 'há 22min' },
    { name: 'Ana Beatriz Costa', email: 'ana.b@acaidabarra.com.br', role: 'Atendente', last: 'há 1h' },
    { name: 'Bruno Linhares', email: 'bruno.l@acaidabarra.com.br', role: 'Entregador', last: 'há 3h' },
  ];
  return (
    <div className="card">
      <div className="card-head"><div className="card-h">Equipe ({users.length})</div><button className="btn btn-primary btn-sm" style={{ background: brand.brandPrimary }}><Icon name="UserPlus" size={13} />Convidar</button></div>
      <div className="cfg-users">
        {users.map(u => (
          <div key={u.email} className="cfg-user">
            <span className="cv-avatar" style={{ background: '#cbd5e1', width: 36, height: 36, fontSize: 12 }}>{u.name.split(' ').map(p => p[0]).slice(0, 2).join('')}</span>
            <div className="cfg-user-text">
              <div className="cfg-user-name">{u.name}</div>
              <div className="cfg-user-email">{u.email}</div>
            </div>
            <span className={`cfg-role cfg-role-${u.role.toLowerCase()}`}>{u.role}</span>
            <span className="cfg-user-last">{u.last}</span>
            <button className="btn-icon"><Icon name="MoreVertical" size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CfgIntegracoes({ brand }) {
  const ints = [
    { name: 'iFood', sub: 'Sincroniza pedidos do iFood', icon: 'Utensils', on: false, color: '#EA1D2C' },
    { name: 'Mercado Pago', sub: 'PIX e cartão online', icon: 'CreditCard', on: true, color: '#009ee3' },
    { name: 'Google Maps', sub: 'Cálculo de rota e endereços', icon: 'Map', on: true, color: '#4285F4' },
    { name: 'Loggi', sub: 'Entregas terceirizadas', icon: 'Truck', on: false, color: '#FFD700' },
    { name: 'Nuvem Fiscal', sub: 'Emissão automática de NFC-e', icon: 'FileText', on: true, color: '#10b981' },
    { name: 'Webhook customizado', sub: 'Eventos para sua URL', icon: 'Webhook', on: false, color: '#64748b' },
  ];
  return (
    <div className="cfg-ints">
      {ints.map(i => (
        <div key={i.name} className="cfg-int">
          <span className="cfg-int-ico" style={{ background: i.color + '20', color: i.color }}><Icon name={i.icon} size={20} /></span>
          <div className="cfg-int-text">
            <div className="cfg-int-name">{i.name}</div>
            <div className="cfg-int-sub">{i.sub}</div>
          </div>
          {i.on ? (
            <span className="cv-tag cv-tag-cart" style={{ background: '#dcfce7', color: '#166534' }}><Icon name="Check" size={10} />Conectado</span>
          ) : (
            <button className="btn btn-soft btn-sm">Conectar</button>
          )}
        </div>
      ))}
    </div>
  );
}

function CfgFaturamento({ brand }) {
  return (
    <>
      <div className="card cfg-plan-card" style={{ background: brand.brandSoft }}>
        <div>
          <div className="cfg-plan-name" style={{ color: brand.brandPrimary }}>Plano Pro</div>
          <div className="cfg-plan-price">R$ 297<span>/mês</span></div>
          <div className="muted" style={{ fontSize: 13 }}>Mensagens ilimitadas · 5 usuários · IA com guardrails</div>
        </div>
        <div className="cfg-plan-actions">
          <div className="cfg-plan-next">Próximo faturamento em <b>12 dias</b></div>
          <button className="btn btn-primary" style={{ background: brand.brandPrimary }}><Icon name="ArrowUpCircle" size={14} />Upgrade para Enterprise</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-h">Histórico de faturas</div></div>
        <div className="cfg-faturas">
          {[
            { date: '01/abr/2025', val: 297.00, status: 'paga' },
            { date: '01/mar/2025', val: 297.00, status: 'paga' },
            { date: '01/fev/2025', val: 297.00, status: 'paga' },
            { date: '01/jan/2025', val: 297.00, status: 'paga' },
            { date: '01/dez/2024', val: 197.00, status: 'paga' },
          ].map((f, i) => (
            <div key={i} className="cfg-fatura">
              <Icon name="Receipt" size={14} />
              <span style={{ flex: 1 }}>{f.date}</span>
              <span><b>R$ {f.val.toFixed(2).replace('.', ',')}</b></span>
              <span className="cv-tag cv-tag-cart" style={{ background: '#dcfce7', color: '#166534' }}>{f.status}</span>
              <button className="btn-icon"><Icon name="Download" size={14} /></button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function CfgAvancado({ brand }) {
  return (
    <>
      <div className="card">
        <div className="card-head"><div className="card-h">API Keys</div><button className="btn btn-soft btn-sm"><Icon name="Plus" size={13} />Nova chave</button></div>
        <div className="cfg-keys">
          <div className="cfg-key">
            <Icon name="Key" size={14} style={{ color: brand.brandPrimary }} />
            <div style={{ flex: 1 }}>
              <div className="cfg-key-name">Produção · main</div>
              <code className="cfg-key-val">sk_live_••••••••••••••8a4f</code>
            </div>
            <span className="muted">criada há 3 meses</span>
            <button className="btn-icon"><Icon name="Copy" size={13} /></button>
          </div>
          <div className="cfg-key">
            <Icon name="Key" size={14} style={{ color: '#94a3b8' }} />
            <div style={{ flex: 1 }}>
              <div className="cfg-key-name">Sandbox · testes</div>
              <code className="cfg-key-val">sk_test_••••••••••••••2c11</code>
            </div>
            <span className="muted">criada há 1 mês</span>
            <button className="btn-icon"><Icon name="Copy" size={13} /></button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-h">Webhooks</div><button className="btn btn-soft btn-sm"><Icon name="Plus" size={13} />Novo webhook</button></div>
        <div className="cfg-keys">
          <div className="cfg-key">
            <Icon name="Webhook" size={14} style={{ color: brand.brandPrimary }} />
            <div style={{ flex: 1 }}>
              <div className="cfg-key-name">order.created · order.updated</div>
              <code className="cfg-key-val">https://api.acaidabarra.com.br/v2/webhooks/orders</code>
            </div>
            <span className="cv-tag cv-tag-cart" style={{ background: '#dcfce7', color: '#166534' }}>ativo</span>
            <button className="btn-icon"><Icon name="MoreVertical" size={13} /></button>
          </div>
        </div>
      </div>

      <div className="card cfg-danger">
        <div className="card-head"><div className="card-h" style={{ color: '#b91c1c' }}>Zona de perigo</div></div>
        <div className="cfg-danger-rows">
          <div className="cfg-danger-row">
            <div>
              <div className="zon-form-toggle-l">Limpar todos os dados de teste</div>
              <div className="muted" style={{ fontSize: 12 }}>Apaga pedidos, conversas e clientes com tag "teste"</div>
            </div>
            <button className="btn btn-soft btn-sm" style={{ color: '#b91c1c', borderColor: '#fecaca' }}>Limpar</button>
          </div>
          <div className="cfg-danger-row">
            <div>
              <div className="zon-form-toggle-l">Encerrar tenant</div>
              <div className="muted" style={{ fontSize: 12 }}>Cancela assinatura e arquiva todos os dados. Ação irreversível.</div>
            </div>
            <button className="btn btn-sm" style={{ background: '#b91c1c', color: 'white', border: 0 }}>Encerrar conta</button>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { ZonasPage, ConfigPage });
