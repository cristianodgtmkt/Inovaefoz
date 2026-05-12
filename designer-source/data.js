// Mock data for Açaí da Barra (Foz do Iguaçu) — PT-BR realistic

const TENANTS = {
  'acai-da-barra': {
    slug: 'acai-da-barra',
    name: 'Açaí da Barra',
    tagline: 'Painel Administrativo',
    icon: 'Grape',
    brandPrimary: '#7e22ce',     // purple-700
    brandPrimaryHover: '#6b21a8', // purple-800
    brandSoft: '#f3e8ff',        // purple-100
    brandBorder: '#e9d5ff',      // purple-200
    brandText: '#581c87',        // purple-900
    location: 'Foz do Iguaçu',
  },
  'tropicana': {
    slug: 'tropicana',
    name: 'Tropicana Churrascaria',
    tagline: 'Painel Administrativo',
    icon: 'Flame',
    brandPrimary: '#dc2626',     // red-600
    brandPrimaryHover: '#b91c1c',
    brandSoft: '#fee2e2',
    brandBorder: '#fecaca',
    brandText: '#7f1d1d',
    location: 'Foz do Iguaçu',
  },
  'wandscheer': {
    slug: 'wandscheer',
    name: 'Wandscheer Turismo',
    tagline: 'Painel Administrativo',
    icon: 'Palmtree',
    brandPrimary: '#0891b2',     // cyan-600
    brandPrimaryHover: '#0e7490',
    brandSoft: '#cffafe',
    brandBorder: '#a5f3fc',
    brandText: '#164e63',
    location: 'Foz do Iguaçu',
  },
};

// Kanban column definitions
const COLS_BOT = [
  { id: 'coletando', label: 'Coletando', color: 'slate', hex: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
  { id: 'aguardando', label: 'Aguardando', color: 'orange', hex: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
];

const COLS_KITCHEN = [
  { id: 'novo_pedido', label: 'Novo pedido', color: 'blue', hex: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'em_preparo', label: 'Em preparo', color: 'red', hex: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  { id: 'pronto_retirar', label: 'Pronto', color: 'cyan', hex: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  { id: 'saiu_entrega', label: 'Saiu entrega', color: 'violet', hex: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
  { id: 'entregue', label: 'Entregue', color: 'green', hex: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
];

const COLS_ALL = [...COLS_BOT, ...COLS_KITCHEN];

// Realistic Açaí orders
const ORDERS = [
  {
    id: 'AB-1042',
    customer: 'Marina Beltrão',
    phone: '(45) 99812-4471',
    bairro: 'Jardim das Flores',
    addr: 'R. Felipe Wandscheer, 842',
    complement: 'apt 304, bloco B',
    items: [
      { qty: 1, name: 'Açaí 500ml + leite cond. + granola + morango', price: 24.90 },
      { qty: 1, name: 'Açaí 300ml + paçoca + banana', price: 17.50 },
    ],
    total: 42.40, fee: 6.00, payment: 'pix', troco: null,
    col: 'novo_pedido', placedMin: 4, note: 'Sem leite condensado no segundo.',
  },
  {
    id: 'AB-1041',
    customer: 'Diego Ferreira',
    phone: '(45) 99715-2204',
    bairro: 'Vila A',
    addr: 'Av. Brasil, 1245',
    complement: 'casa amarela',
    items: [
      { qty: 2, name: 'Açaí 700ml + leite ninho + ovomaltine + nutella', price: 32.00 },
    ],
    total: 64.00, fee: 8.00, payment: 'dinheiro', troco: 80.00,
    col: 'em_preparo', placedMin: 12, note: null,
  },
  {
    id: 'AB-1040',
    customer: 'Camila Otsuka',
    phone: '(45) 99602-7733',
    bairro: 'Centro',
    addr: 'R. Almirante Barroso, 502',
    complement: null,
    items: [
      { qty: 1, name: 'Milk Shake Ninho c/ Nutella 500ml', price: 22.00 },
      { qty: 1, name: 'Açaí 300ml + granola + leite cond.', price: 16.00 },
      { qty: 1, name: 'Fondue de morango c/ chocolate', price: 28.00 },
    ],
    total: 66.00, fee: 7.00, payment: 'cartao', troco: null,
    col: 'em_preparo', placedMin: 18, note: 'Entregar até 21h por favor.',
  },
  {
    id: 'AB-1039',
    customer: 'Rafael Almeida',
    phone: '(45) 99834-1188',
    bairro: 'Porto Belo',
    addr: 'R. das Acácias, 77',
    complement: 'condomínio Verde Vale, bloco 3 apt 21',
    items: [
      { qty: 1, name: 'Açaí 1L família + 4 complementos', price: 48.00 },
    ],
    total: 48.00, fee: 9.00, payment: 'pix', troco: null,
    col: 'pronto_retirar', placedMin: 23, note: null,
  },
  {
    id: 'AB-1038',
    customer: 'Letícia Marinho',
    phone: '(45) 99509-6680',
    bairro: 'Jardim das Flores',
    addr: 'R. Caetés, 199',
    complement: null,
    items: [
      { qty: 1, name: 'Açaí Fitness 500ml (sem açúcar) + frutas', price: 26.00 },
      { qty: 1, name: 'Suco de açaí natural 500ml', price: 14.00 },
    ],
    total: 40.00, fee: 6.00, payment: 'pix', troco: null,
    col: 'saiu_entrega', placedMin: 31, note: null,
  },
  {
    id: 'AB-1037',
    customer: 'João Pedro Vasques',
    phone: '(45) 99427-3019',
    bairro: 'KLP',
    addr: 'R. Manêncio Martins, 1421',
    complement: 'fundos',
    items: [
      { qty: 3, name: 'Açaí 500ml + leite cond. + granola', price: 21.00 },
    ],
    total: 63.00, fee: 7.50, payment: 'cartao', troco: null,
    col: 'saiu_entrega', placedMin: 38, note: null,
  },
  {
    id: 'AB-1036',
    customer: 'Bruna Sakomoto',
    phone: '(45) 99680-2911',
    bairro: 'Centro',
    addr: 'R. Rio Branco, 88',
    complement: 'sala 12',
    items: [
      { qty: 1, name: 'Açaí 700ml + nutella + leite ninho', price: 28.00 },
    ],
    total: 28.00, fee: 5.00, payment: 'pix', troco: null,
    col: 'entregue', placedMin: 64, note: null,
  },
  {
    id: 'AB-1035',
    customer: 'Henrique Cardoso',
    phone: '(45) 99334-7720',
    bairro: 'Morumbi',
    addr: 'R. Tarobá, 312',
    complement: null,
    items: [
      { qty: 1, name: 'Milk Shake Ovomaltine 500ml', price: 22.00 },
      { qty: 1, name: 'Açaí 300ml + paçoca + granola', price: 16.00 },
    ],
    total: 38.00, fee: 6.00, payment: 'dinheiro', troco: 50.00,
    col: 'entregue', placedMin: 72, note: null,
  },
  // Bot section
  {
    id: 'AB-1043',
    customer: 'Patricia Lemos',
    phone: '(45) 99214-8800',
    bairro: '—',
    addr: '—',
    complement: null,
    items: [
      { qty: 1, name: 'Açaí 500ml (escolhendo complementos…)', price: 0 },
    ],
    total: 0, fee: 0, payment: '—', troco: null,
    col: 'coletando', placedMin: 1, note: 'IA coletando endereço e complementos.',
  },
  {
    id: 'AB-1044',
    customer: 'Mateus Andrade',
    phone: '(45) 99088-5512',
    bairro: 'Jardim Califórnia',
    addr: 'R. Curitiba, 654',
    complement: null,
    items: [
      { qty: 1, name: 'Açaí 500ml + 3 complementos', price: 22.00 },
    ],
    total: 22.00, fee: 6.00, payment: 'pix', troco: null,
    col: 'aguardando', placedMin: 2, note: 'Aguardando confirmação de pagamento PIX.',
  },
  {
    id: 'AB-1045',
    customer: 'Sofia Recco',
    phone: '(45) 99166-4488',
    bairro: 'Vila Yolanda',
    addr: 'R. Edmundo de Barros, 1112',
    complement: 'apt 71',
    items: [
      { qty: 2, name: 'Açaí 300ml + leite cond.', price: 14.00 },
    ],
    total: 28.00, fee: 5.50, payment: 'pix', troco: null,
    col: 'aguardando', placedMin: 3, note: null,
  },
];

// Recent AI executions (dashboard)
const AI_EXECS = [
  { id: 'exec_7f3a91', phase: 'pedido_finalizado', status: 'success', ms: 1240, ago: 'há 12s' },
  { id: 'exec_7f3a8e', phase: 'router_classify', status: 'success', ms: 410, ago: 'há 38s' },
  { id: 'exec_7f3a8b', phase: 'menu_recommend', status: 'success', ms: 1820, ago: 'há 1min' },
  { id: 'exec_7f3a87', phase: 'address_validate', status: 'error', ms: 920, ago: 'há 2min' },
  { id: 'exec_7f3a82', phase: 'pedido_coletar', status: 'success', ms: 2110, ago: 'há 3min' },
  { id: 'exec_7f3a7f', phase: 'router_classify', status: 'success', ms: 380, ago: 'há 4min' },
  { id: 'exec_7f3a7c', phase: 'price_lookup', status: 'success', ms: 220, ago: 'há 5min' },
];

window.MOCK = { TENANTS, COLS_BOT, COLS_KITCHEN, COLS_ALL, ORDERS, AI_EXECS };
