// IA + Relatórios pages
const { useState: useStateI } = React;

function IAPage({ brand }) {
  const [tab, setTab] = useStateI('overview');
  const tabs = [
    { id: 'overview', label: 'Visão geral', icon: 'BarChart3' },
    { id: 'guardrails', label: 'Guardrails', icon: 'Shield' },
    { id: 'audit', label: 'Auditoria', icon: 'Search' },
    { id: 'testbed', label: 'Testbed', icon: 'FlaskConical' },
  ];

  return (
    <div className="ia-page">
      <div className="page-head">
        <div>
          <h2>IA</h2>
          <p>Métricas, guardrails e auditoria do agente WhatsApp · modelo <b>claude-haiku-4.5</b> · cache hit <b>91%</b></p>
        </div>
        <div className="page-head-right">
          <button className="btn btn-soft"><Icon name="Download" size={14} />Exportar logs</button>
          <button className="btn btn-primary" style={{ background: brand.brandPrimary }}><Icon name="Settings" size={14} />Config do agente</button>
        </div>
      </div>

      <div className="ia-tabs">
        {tabs.map(t => (
          <button key={t.id} className="ia-tab" data-active={tab === t.id || undefined} onClick={() => setTab(t.id)} style={tab === t.id ? { color: brand.brandPrimary, borderColor: brand.brandPrimary } : {}}>
            <Icon name={t.icon} size={14} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <IAOverview brand={brand} />}
      {tab === 'guardrails' && <IAGuardrails brand={brand} />}
      {tab === 'audit' && <IAAudit brand={brand} />}
      {tab === 'testbed' && <IATestbed brand={brand} />}
    </div>
  );
}

function IAOverview({ brand }) {
  return (
    <div className="ia-overview">
      <div className="stats-grid">
        <StatCard icon="MessageSquare" label="Mensagens (24h)" value="1.247" sub="+18% vs ontem" tone="up" />
        <StatCard icon="DollarSign" label="Custo (24h)" value="R$ 4,82" sub="meta R$ 6,00" tone="up" />
        <StatCard icon="Zap" label="Tokens / msg" value="312" sub="média móvel" />
        <StatCard icon="Database" label="Cache hit" value="91%" sub="+3pp vs ontem" tone="up" />
        <StatCard icon="Clock" label="Latência p50" value="0.8s" sub="p95 1.9s" />
        <StatCard icon="TriangleAlert" label="Hallucinations" value="3" sub="0.24% das msgs" tone="down" />
        <StatCard icon="Shield" label="Guardrails" value="6" sub="bloqueios 24h" tone="up" />
        <StatCard icon="UserCheck" label="Resolução" value="94%" sub="sem escalação" tone="up" />
      </div>

      <div className="ia-grid-2">
        <div className="card">
          <div className="card-head">
            <div className="card-h">Custo por dia (últimos 14 dias)</div>
            <span className="muted">meta: R$ 6/dia</span>
          </div>
          <CostChart brand={brand} />
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-h">Distribuição de intents</div>
            <span className="muted">últimas 24h</span>
          </div>
          <div className="ia-intents">
            {[
              { name: 'Fazer pedido', v: 412, pct: 58 },
              { name: 'Status do pedido', v: 142, pct: 20 },
              { name: 'Cardápio / preços', v: 89, pct: 13 },
              { name: 'Horário / endereço', v: 41, pct: 6 },
              { name: 'Reclamação', v: 18, pct: 3 },
            ].map(i => (
              <div key={i.name} className="intent-row">
                <span className="intent-name">{i.name}</span>
                <div className="intent-bar"><div className="intent-fill" style={{ width: i.pct + '%', background: brand.brandPrimary }}></div></div>
                <span className="intent-v">{i.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-h">Últimas execuções</div>
          <button className="btn btn-soft btn-sm">Ver tudo</button>
        </div>
        <div className="exec-list">
          {[
            { who: 'Marina Beltrão', intent: 'fazer_pedido', tokens: 412, lat: '0.6s', cost: 'R$ 0,003', cached: false, status: 'ok', when: 'agora' },
            { who: 'Diego Ferreira', intent: 'pagamento_dinheiro', tokens: 287, lat: '0.9s', cost: 'R$ 0,002', cached: false, status: 'escalated', when: '12min' },
            { who: 'Camila Otsuka', intent: 'fazer_pedido', tokens: 98, lat: '0.2s', cost: 'R$ 0,000', cached: true, status: 'ok', when: '18min' },
            { who: 'Henrique C.', intent: 'cupom_invalido', tokens: 215, lat: '0.7s', cost: 'R$ 0,002', cached: false, status: 'warn', when: '22min' },
            { who: 'Bruno Caetano', intent: 'fazer_pedido', tokens: 511, lat: '1.4s', cost: 'R$ 0,005', cached: false, status: 'hallucination', when: '1h' },
            { who: 'Letícia Marinho', intent: 'status_pedido', tokens: 64, lat: '0.1s', cost: 'R$ 0,000', cached: true, status: 'ok', when: '1h' },
          ].map((e, i) => (
            <div key={i} className="exec-row">
              <span className={`exec-status exec-status-${e.status}`}>
                <Icon name={e.status === 'ok' ? 'Check' : e.status === 'hallucination' ? 'TriangleAlert' : e.status === 'escalated' ? 'ArrowUpRight' : 'AlertCircle'} size={11} />
              </span>
              <span className="exec-who">{e.who}</span>
              <span className="exec-intent">{e.intent}</span>
              <span className="exec-tok">{e.tokens} tok</span>
              <span className="exec-lat">{e.lat}</span>
              <span className="exec-cost">{e.cost}</span>
              <span>{e.cached && <span className="exec-cache"><Icon name="Database" size={10} />cached</span>}</span>
              <span className="exec-when">{e.when}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CostChart({ brand }) {
  const data = [3.20, 4.10, 3.80, 4.40, 5.10, 4.80, 5.20, 4.60, 4.90, 5.40, 4.20, 4.70, 5.10, 4.82];
  const max = 6;
  return (
    <div className="cost-chart">
      <div className="cost-bars">
        {data.map((v, i) => (
          <div key={i} className="cost-bar-wrap">
            <div className="cost-bar" style={{ height: (v / max * 100) + '%', background: brand.brandPrimary }} title={`R$ ${v.toFixed(2)}`}></div>
          </div>
        ))}
      </div>
      <div className="cost-target" style={{ bottom: '83%' }}><span>meta R$ 6</span></div>
    </div>
  );
}

function IAGuardrails({ brand }) {
  const gs = window.MOCK2.AI_GUARDRAILS;
  return (
    <div className="ia-guardrails">
      <div className="card">
        <div className="card-head">
          <div className="card-h">Regras ativas</div>
          <button className="btn btn-soft btn-sm"><Icon name="Plus" size={13} />Nova regra</button>
        </div>
        <div className="gr-list">
          {gs.map(g => (
            <div key={g.id} className="gr-row">
              <div className="gr-l">
                <div className="gr-name">
                  <Icon name="Shield" size={14} />
                  <code>{g.rule}</code>
                  <span className={`gr-pill ${g.triggered === 0 ? 'gr-pill-q' : 'gr-pill-a'}`}>{g.triggered === 0 ? 'ocioso' : 'ativo'}</span>
                </div>
                <div className="gr-desc">{ruleDesc(g.rule)}</div>
                <div className="gr-examples">Exemplos: <i>{g.examples}</i></div>
              </div>
              <div className="gr-stats">
                <div><span className="gr-stat-v">{g.triggered}</span><span className="gr-stat-l">disparos</span></div>
                <div><span className="gr-stat-v" style={{ color: brand.brandPrimary }}>{g.blocked}</span><span className="gr-stat-l">bloqueios</span></div>
                <button className="toggle" data-on={true} style={{ background: brand.brandPrimary }}><span className="toggle-thumb"></span></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-h">System prompt do agente</div><button className="btn btn-soft btn-sm"><Icon name="Edit3" size={13} />Editar</button></div>
        <pre className="prompt-box">{`Você é o atendente virtual do Açaí da Barra (Foz do Iguaçu).

Regras invioláveis:
1. NUNCA cote preço fora da tabela. Use ferramenta get_price.
2. NUNCA prometa item fora do cardápio. Use ferramenta list_menu.
3. NUNCA aceite endereço fora do raio de entrega. Use check_address.
4. SEMPRE confirme pedido antes de fechar.
5. Se cliente mencionar troco em dinheiro acima de R$ 20, ESCALONE.

Tom: caloroso, próximo, brasileiro do Sul. Use 💜 com moderação.`}</pre>
      </div>
    </div>
  );
}

function ruleDesc(r) {
  const map = {
    price_whitelist: 'Bloqueia qualquer preço gerado pelo modelo que não esteja na tabela atual de preços.',
    item_no_menu: 'Impede que o bot mencione itens que não constam do cardápio ativo.',
    address_outside_zone: 'Não aceita endereços fora das zonas configuradas; oferece retirada no balcão.',
    pii_leak: 'Bloqueia respostas que vazem dados de outros clientes (telefone, endereço, pedido alheio).',
  };
  return map[r] || '';
}

function IAAudit({ brand }) {
  const items = window.MOCK2.AI_AUDIT;
  return (
    <div className="ia-audit">
      <div className="card">
        <div className="card-head">
          <div className="card-h">Casos sinalizados (últimas 24h)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-soft btn-sm"><Icon name="Filter" size={13} />Severidade</button>
            <button className="btn btn-soft btn-sm"><Icon name="Calendar" size={13} />24h</button>
          </div>
        </div>
        <div className="audit-list">
          {items.map(a => (
            <div key={a.id} className="audit-row">
              <span className={`audit-sev audit-sev-${a.severity}`}>{a.severity}</span>
              <div className="audit-body">
                <div className="audit-kind">{a.kind.replace('_', ' ')}</div>
                <div className="audit-text">"{a.text}"</div>
                <div className="audit-meta">conversa com <b>{a.conv}</b> · {a.timeAgo}</div>
              </div>
              <div className="audit-actions">
                <button className="btn btn-soft btn-sm">Ver conversa</button>
                <button className="btn btn-soft btn-sm"><Icon name="Flag" size={12} />Marcar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IATestbed({ brand }) {
  const [input, setInput] = useStateI('Quero 2 açaí 700ml com leite condensado, nutella e ovomaltine.');
  const [running, setRunning] = useStateI(false);
  const [result, setResult] = useStateI(null);

  function run() {
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      setRunning(false);
      setResult({
        text: 'Anotei: 2× Açaí 700ml + leite condensado + nutella + ovomaltine = R$ 64,00. Quer mais alguma coisa ou já confirmamos a entrega? 💜',
        tools: [
          { name: 'list_menu', args: 'category=acai', latMs: 12, cached: true },
          { name: 'get_price', args: 'item=acai_700ml, complementos=3', latMs: 8, cached: true },
        ],
        tokens: 287,
        cost: 0.002,
        latency: '0.6s',
        guardrails: { passed: ['price_whitelist', 'item_no_menu'], blocked: [] },
      });
    }, 1200);
  }

  return (
    <div className="ia-testbed">
      <div className="card">
        <div className="card-head"><div className="card-h">Testbed do agente</div><span className="muted">simulação local · não envia WhatsApp</span></div>
        <div className="tb-input">
          <textarea value={input} onChange={e => setInput(e.target.value)} rows={3} placeholder="Mensagem do cliente..." />
          <div className="tb-actions">
            <select className="tb-select">
              <option>Marina Beltrão (cliente VIP)</option>
              <option>Cliente novo (sem histórico)</option>
              <option>Diego Ferreira (escalado anteriormente)</option>
            </select>
            <button className="btn btn-primary" style={{ background: brand.brandPrimary }} onClick={run} disabled={running}>
              {running ? <><Icon name="Loader" size={14} />Executando...</> : <><Icon name="Play" size={14} />Rodar</>}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="ia-grid-2">
          <div className="card">
            <div className="card-head"><div className="card-h">Resposta do agente</div></div>
            <div className="tb-response">
              <div className="tb-bubble" style={{ background: brand.brandPrimary, color: 'white' }}>{result.text}</div>
              <div className="tb-meta">
                <span>{result.tokens} tokens</span>
                <span>R$ {result.cost.toFixed(3)}</span>
                <span>{result.latency}</span>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div className="card-h">Trace</div></div>
            <div className="tb-trace">
              <div className="tb-trace-section">
                <div className="tb-trace-title">Tool calls</div>
                {result.tools.map((t, i) => (
                  <div key={i} className="tb-tool">
                    <code>{t.name}</code>
                    <span className="tb-tool-args">{t.args}</span>
                    <span className="tb-tool-meta">{t.latMs}ms {t.cached && '· cached'}</span>
                  </div>
                ))}
              </div>
              <div className="tb-trace-section">
                <div className="tb-trace-title">Guardrails</div>
                <div className="tb-guards">
                  {result.guardrails.passed.map(g => (
                    <span key={g} className="cli-chip" style={{ background: '#dcfce7', color: '#166534' }}><Icon name="Check" size={10} />{g}</span>
                  ))}
                  {result.guardrails.blocked.length === 0 && <span className="muted" style={{ fontSize: 11 }}>nenhum bloqueio</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RelatoriosPage({ brand }) {
  const days = window.MOCK2.RELATORIOS_BY_DAY;
  const bairros = window.MOCK2.RELATORIOS_BAIRROS;
  const cats = window.MOCK2.RELATORIOS_CATEGORIAS;
  const heat = window.MOCK2.RELATORIOS_HEATMAP;
  const maxV = Math.max(...heat.map(h => h.v));
  const maxBarReceita = Math.max(...days.map(d => d.receita));
  const totalCat = cats.reduce((s, c) => s + c.value, 0);

  return (
    <div className="rel-page">
      <div className="page-head">
        <div>
          <h2>Relatórios</h2>
          <p>Últimos 7 dias · <b>R$ 15.950</b> em vendas · <b>354</b> pedidos · ticket médio <b>R$ 45,07</b></p>
        </div>
        <div className="page-head-right">
          <button className="btn btn-soft"><Icon name="Calendar" size={14} />7 dias</button>
          <button className="btn btn-soft"><Icon name="Download" size={14} />Exportar PDF</button>
        </div>
      </div>

      <div className="ia-grid-2">
        <div className="card">
          <div className="card-head"><div className="card-h">Pedidos e receita por dia</div></div>
          <div className="rel-bars">
            {days.map(d => (
              <div key={d.d} className="rel-bar-col">
                <div className="rel-bar-stack">
                  <div className="rel-bar rel-bar-receita" style={{ height: (d.receita / maxBarReceita * 100) + '%', background: brand.brandPrimary }}>
                    <span className="rel-bar-val">R$ {d.receita}</span>
                  </div>
                </div>
                <div className="rel-bar-l">{d.d}</div>
                <div className="rel-bar-sub">{d.pedidos} ped.</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-h">Mix de categorias</div></div>
          <div className="rel-donut">
            <Donut data={cats} total={totalCat} />
            <ul className="rel-donut-legend">
              {cats.map(c => (
                <li key={c.name}>
                  <span className="rel-donut-sw" style={{ background: c.color }}></span>
                  <span className="rel-donut-name">{c.name}</span>
                  <span className="rel-donut-v">{((c.value / totalCat) * 100).toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-h">Heatmap de pedidos · dia × hora</div><span className="muted">picos no jantar de qui-sáb</span></div>
        <Heatmap data={heat} maxV={maxV} brand={brand} />
      </div>

      <div className="card">
        <div className="card-head"><div className="card-h">Top bairros</div></div>
        <div className="rel-bairros">
          {bairros.map((b, i) => {
            const pct = (b.value / bairros[0].value) * 100;
            return (
              <div key={b.name} className="rel-bairro-row">
                <span className="rel-bairro-rank">#{i + 1}</span>
                <span className="rel-bairro-name">{b.name}</span>
                <div className="rel-bairro-bar"><div className="rel-bairro-fill" style={{ width: pct + '%', background: brand.brandPrimary }}></div></div>
                <span className="rel-bairro-v"><b>{b.value}</b> pedidos</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Donut({ data, total }) {
  const size = 180;
  const cx = size / 2, cy = size / 2;
  const r = 70, rIn = 45;
  let acc = 0;
  const segs = data.map(d => {
    const start = acc / total * Math.PI * 2 - Math.PI / 2;
    acc += d.value;
    const end = acc / total * Math.PI * 2 - Math.PI / 2;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const x3 = cx + rIn * Math.cos(end), y3 = cy + rIn * Math.sin(end);
    const x4 = cx + rIn * Math.cos(start), y4 = cy + rIn * Math.sin(start);
    return { d: `M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${rIn} ${rIn} 0 ${large} 0 ${x4} ${y4} Z`, color: d.color };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segs.map((s, i) => <path key={i} d={s.d} fill={s.color} />)}
      <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: 22, fontWeight: 700, fill: '#0f172a' }}>{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: 10, fill: '#64748b' }}>pedidos</text>
    </svg>
  );
}

function Heatmap({ data, maxV, brand }) {
  const dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  return (
    <div className="heat-wrap">
      <div className="heat-hrow">
        <span></span>
        {Array.from({ length: 24 }, (_, h) => <span key={h} className="heat-h">{h % 3 === 0 ? h : ''}</span>)}
      </div>
      {dias.map((d, di) => (
        <div key={d} className="heat-row">
          <span className="heat-d">{d}</span>
          {Array.from({ length: 24 }, (_, h) => {
            const cell = data.find(x => x.day === di && x.h === h);
            const intensity = cell.v / maxV;
            return <span key={h} className="heat-cell" title={`${d} ${h}h · ${cell.v} pedidos`} style={{ background: intensity === 0 ? '#f1f5f9' : `color-mix(in oklch, ${brand.brandPrimary} ${Math.round(intensity * 100)}%, white)` }}></span>;
          })}
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { IAPage, RelatoriosPage });
