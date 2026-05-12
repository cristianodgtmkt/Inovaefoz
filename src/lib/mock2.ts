// Mock data port de data2.js (CONVERSAS, ESCALACOES, CLIENTES, CARDAPIO, ZONAS, AI_AUDIT, AI_GUARDRAILS, RELATORIOS_*)
// TODO: substituir por queries Supabase

export interface Msg { from: 'customer' | 'ai' | 'admin'; text: string; ts: string; tag?: string }
export interface Conv {
  id: string; customer: string; phone: string; initial: string; avatarColor: string
  lastMsg: string; timeAgo: string; unread: number
  status: 'ai' | 'escalated'
  pedidoOpen?: boolean
  msgs?: Msg[]
}

export const CONVERSAS: Conv[] = [
  { id: 'c-1', customer: 'Marina Beltrão', phone: '(45) 99812-4471', initial: 'MB', avatarColor: '#7e22ce',
    lastMsg: 'Perfeito, obrigada! Vou aguardar.', timeAgo: 'há 2min', unread: 2, status: 'ai', pedidoOpen: true,
    msgs: [
      { from: 'customer', text: 'Oi, queria fazer um pedido', ts: '21:42' },
      { from: 'ai', text: 'Olá, Marina! 💜 Bem-vinda ao Açaí da Barra. O que vai querer hoje?', ts: '21:42' },
      { from: 'customer', text: 'Um açaí 500ml com leite condensado, granola e morango', ts: '21:43' },
      { from: 'ai', text: 'Anotado! Açaí 500ml + leite condensado + granola + morango = R$ 24,90. Quer mais alguma coisa?', ts: '21:43' },
      { from: 'customer', text: 'Quero também um 300ml com paçoca e banana', ts: '21:44' },
      { from: 'ai', text: 'Açaí 300ml + paçoca + banana = R$ 17,50. Total: R$ 42,40. Confirma o endereço da última vez (R. Felipe Wandscheer, 842 — apt 304 bloco B)?', ts: '21:45' },
      { from: 'customer', text: 'Sim! Mas sem leite condensado no segundo, esqueci de falar', ts: '21:46' },
      { from: 'ai', text: 'Anotei: sem leite condensado no segundo. Pedido confirmado #1042. Saiu pra preparo agora! Chegada estimada: 35–45min.', ts: '21:47' },
      { from: 'customer', text: 'Perfeito, obrigada! Vou aguardar.', ts: '21:47' },
    ],
  },
  { id: 'c-2', customer: 'Diego Ferreira', phone: '(45) 99715-2204', initial: 'DF', avatarColor: '#dc2626',
    lastMsg: 'Posso pagar em dinheiro? Vou precisar de troco', timeAgo: 'há 12min', unread: 0, status: 'escalated', pedidoOpen: true,
    msgs: [
      { from: 'customer', text: '2 açaí 700ml com leite ninho, ovomaltine e nutella', ts: '21:32' },
      { from: 'ai', text: 'Anotado: 2× Açaí 700ml ninho+ovo+nutella = R$ 64,00. Confirma endereço?', ts: '21:32' },
      { from: 'customer', text: 'Sim, av brasil 1245, casa amarela', ts: '21:33' },
      { from: 'customer', text: 'Posso pagar em dinheiro? Vou precisar de troco', ts: '21:34' },
      { from: 'ai', text: '🚨 Escalando para atendimento humano.', ts: '21:34', tag: 'escalation' },
    ],
  },
  { id: 'c-3', customer: 'Camila Otsuka', phone: '(45) 99602-7733', initial: 'CO', avatarColor: '#0891b2',
    lastMsg: 'Entregar até 21h por favor.', timeAgo: 'há 18min', unread: 0, status: 'ai', pedidoOpen: true,
    msgs: [
      { from: 'customer', text: 'Boa noite, quero pedir', ts: '21:28' },
      { from: 'ai', text: 'Boa noite, Camila! 💜', ts: '21:28' },
    ],
  },
  { id: 'c-4', customer: 'Rafael Almeida', phone: '(45) 99834-1188', initial: 'RA', avatarColor: '#16a34a',
    lastMsg: 'Já recebi, valeu! 🙏', timeAgo: 'há 23min', unread: 0, status: 'ai', msgs: [] },
  { id: 'c-5', customer: 'Letícia Marinho', phone: '(45) 99509-6680', initial: 'LM', avatarColor: '#f59e0b',
    lastMsg: 'O entregador já saiu?', timeAgo: 'há 31min', unread: 1, status: 'ai', pedidoOpen: true, msgs: [] },
  { id: 'c-6', customer: 'João Pedro Vasques', phone: '(45) 99427-3019', initial: 'JV', avatarColor: '#8b5cf6',
    lastMsg: 'Tudo certo, obrigado!', timeAgo: 'há 38min', unread: 0, status: 'ai', msgs: [] },
  { id: 'c-7', customer: 'Patricia Lemos', phone: '(45) 99214-8800', initial: 'PL', avatarColor: '#ec4899',
    lastMsg: 'qual o sabor do milk shake?', timeAgo: 'há 1min', unread: 3, status: 'ai', msgs: [] },
  { id: 'c-8', customer: 'Henrique Cardoso', phone: '(45) 99334-7720', initial: 'HC', avatarColor: '#0891b2',
    lastMsg: 'O sistema de cupons funciona ainda?', timeAgo: 'há 4min', unread: 1, status: 'escalated', msgs: [] },
]

export const ESCALACOES = [
  { id: 'e-1', customer: 'Diego Ferreira', phone: '(45) 99715-2204', motivo: 'Troco · valor incomum', preview: 'Posso pagar em dinheiro? Vou precisar de troco', aberta: '12min', atendente: null as string | null, priority: 'normal' as 'normal' | 'high' },
  { id: 'e-2', customer: 'Henrique Cardoso', phone: '(45) 99334-7720', motivo: 'Cupom não reconhecido', preview: 'O sistema de cupons funciona ainda?', aberta: '4min', atendente: null as string | null, priority: 'normal' as 'normal' | 'high' },
  { id: 'e-3', customer: 'Beatriz Schäfer', phone: '(45) 99127-3344', motivo: 'Pedido extraviado', preview: 'Meu pedido nunca chegou ontem...', aberta: '38min', atendente: 'Cristiano' as string | null, priority: 'high' as 'normal' | 'high' },
]

export const CLIENTES = [
  { id: 'cl-1', name: 'Marina Beltrão', phone: '(45) 99812-4471', orders: 14, ticket: 38.60, last: 'hoje · 21:47', status: 'vip', tags: ['VIP', 'sem-LC'] },
  { id: 'cl-2', name: 'Diego Ferreira', phone: '(45) 99715-2204', orders: 22, ticket: 56.40, last: 'hoje · 21:34', status: 'active', tags: ['VIP'] },
  { id: 'cl-3', name: 'Camila Otsuka', phone: '(45) 99602-7733', orders: 9, ticket: 48.20, last: 'hoje · 21:28', status: 'active', tags: [] },
  { id: 'cl-4', name: 'Rafael Almeida', phone: '(45) 99834-1188', orders: 6, ticket: 51.30, last: 'hoje · 21:18', status: 'active', tags: [] },
  { id: 'cl-5', name: 'Letícia Marinho', phone: '(45) 99509-6680', orders: 4, ticket: 38.00, last: 'hoje · 21:10', status: 'active', tags: ['fitness'] },
  { id: 'cl-6', name: 'João Pedro Vasques', phone: '(45) 99427-3019', orders: 11, ticket: 42.10, last: 'hoje · 21:03', status: 'active', tags: [] },
  { id: 'cl-7', name: 'Bruna Sakomoto', phone: '(45) 99680-2911', orders: 2, ticket: 28.00, last: 'hoje · 20:37', status: 'new', tags: ['nova'] },
  { id: 'cl-8', name: 'Henrique Cardoso', phone: '(45) 99334-7720', orders: 18, ticket: 33.40, last: 'hoje · 20:29', status: 'active', tags: ['complicado'] },
  { id: 'cl-9', name: 'Beatriz Schäfer', phone: '(45) 99127-3344', orders: 31, ticket: 67.20, last: 'ontem · 22:14', status: 'vip', tags: ['VIP'] },
  { id: 'cl-10', name: 'Patricia Lemos', phone: '(45) 99214-8800', orders: 1, ticket: 22.00, last: 'hoje · 21:50', status: 'new', tags: ['nova'] },
  { id: 'cl-11', name: 'Mateus Andrade', phone: '(45) 99088-5512', orders: 7, ticket: 31.20, last: 'hoje · 21:48', status: 'active', tags: [] },
  { id: 'cl-12', name: 'Sofia Recco', phone: '(45) 99166-4488', orders: 3, ticket: 28.40, last: 'hoje · 21:46', status: 'new', tags: [] },
]

export const CARDAPIO = {
  categorias: [
    { id: 'acai', label: 'Açaí', count: 12 },
    { id: 'sorvete', label: 'Sorvete', count: 8 },
    { id: 'milkshake', label: 'Milk Shake', count: 6 },
    { id: 'fondue', label: 'Fondue', count: 4 },
    { id: 'fitness', label: 'Linha Fitness', count: 5 },
    { id: 'bebidas', label: 'Bebidas', count: 8 },
  ],
  produtos: {
    acai: [
      { id: 'p1', name: 'Açaí Tradicional', desc: 'Açaí puro batido na hora, polpa fresca da Amazônia.', sizes: [{ size: '300ml', price: 12.00 }, { size: '500ml', price: 18.00 }, { size: '700ml', price: 24.00 }, { size: '1L', price: 32.00 }], complementos: 12, active: true, sold: 142 },
      { id: 'p2', name: 'Açaí Família', desc: 'Para 4 pessoas. Inclui 4 complementos.', sizes: [{ size: '1L', price: 48.00 }, { size: '1.5L', price: 64.00 }], complementos: 4, active: true, sold: 38 },
      { id: 'p3', name: 'Açaí Cremoso Premium', desc: 'Mais cremoso, com leite ninho na base.', sizes: [{ size: '500ml', price: 22.00 }, { size: '700ml', price: 28.00 }], complementos: 12, active: true, sold: 71 },
      { id: 'p4', name: 'Açaí Especial Banana', desc: 'Batido com banana, sem adição de açúcar.', sizes: [{ size: '500ml', price: 20.00 }], complementos: 8, active: false, sold: 18 },
    ],
    sorvete: [
      { id: 'p5', name: 'Sorvete de Açaí', desc: 'Casquinha ou pote.', sizes: [{ size: '1 bola', price: 8.00 }, { size: '2 bolas', price: 14.00 }], complementos: 0, active: true, sold: 64 },
    ],
    milkshake: [
      { id: 'p6', name: 'Milk Shake Ninho c/ Nutella', desc: 'Clássico cremoso.', sizes: [{ size: '500ml', price: 22.00 }, { size: '700ml', price: 28.00 }], complementos: 0, active: true, sold: 89 },
      { id: 'p7', name: 'Milk Shake Ovomaltine', desc: 'Com crocante.', sizes: [{ size: '500ml', price: 22.00 }], complementos: 0, active: true, sold: 56 },
    ],
    fondue: [
      { id: 'p8', name: 'Fondue de Morango c/ Chocolate', desc: 'Para 2 pessoas.', sizes: [{ size: 'porção', price: 28.00 }], complementos: 0, active: true, sold: 22 },
    ],
    fitness: [
      { id: 'p9', name: 'Açaí Fitness Sem Açúcar', desc: 'Adoçado com xilitol. Combina com frutas.', sizes: [{ size: '500ml', price: 26.00 }], complementos: 6, active: true, sold: 41 },
    ],
    bebidas: [
      { id: 'p10', name: 'Suco de Açaí Natural', desc: 'Refrescante, sem leite.', sizes: [{ size: '500ml', price: 14.00 }], complementos: 0, active: true, sold: 33 },
    ],
  } as Record<string, any[]>,
  complementos: [
    'Leite condensado', 'Leite Ninho', 'Granola', 'Paçoca', 'Banana', 'Morango', 'Kiwi', 'Manga', 'Nutella', 'Ovomaltine', 'M&M', 'Coco ralado',
  ],
}

export const ZONAS = [
  { id: 'z1', bairro: 'Centro', taxa: 5.00, raio: 2.5, tempo: '25min', ativa: true, pedidos: 142 },
  { id: 'z2', bairro: 'Vila A', taxa: 8.00, raio: 4.0, tempo: '35min', ativa: true, pedidos: 89 },
  { id: 'z3', bairro: 'Jardim das Flores', taxa: 6.00, raio: 3.2, tempo: '30min', ativa: true, pedidos: 76 },
  { id: 'z4', bairro: 'Porto Belo', taxa: 9.00, raio: 5.0, tempo: '40min', ativa: true, pedidos: 54 },
  { id: 'z5', bairro: 'KLP', taxa: 7.50, raio: 4.2, tempo: '35min', ativa: true, pedidos: 48 },
  { id: 'z6', bairro: 'Morumbi', taxa: 6.00, raio: 3.5, tempo: '30min', ativa: true, pedidos: 41 },
  { id: 'z7', bairro: 'Jardim Califórnia', taxa: 6.50, raio: 3.8, tempo: '32min', ativa: true, pedidos: 36 },
  { id: 'z8', bairro: 'Vila Yolanda', taxa: 5.50, raio: 3.0, tempo: '28min', ativa: true, pedidos: 31 },
  { id: 'z9', bairro: 'Três Lagoas', taxa: 12.00, raio: 7.5, tempo: '50min', ativa: false, pedidos: 4 },
]

export const AI_AUDIT = [
  { id: 'a1', kind: 'hallucination', severity: 'medium', text: 'Bot afirmou que aceita VR Refeição (não aceitamos)', conv: 'Henrique Cardoso', timeAgo: 'há 22min' },
  { id: 'a2', kind: 'price_mismatch', severity: 'high', text: 'Cotou açaí 700ml por R$ 26 (preço atual: R$ 24)', conv: 'Bruno Caetano', timeAgo: 'há 1h' },
  { id: 'a3', kind: 'item_inexistente', severity: 'low', text: 'Mencionou "açaí trufado" — não está no cardápio', conv: 'Larissa H.', timeAgo: 'há 2h' },
]

export const AI_GUARDRAILS = [
  { id: 'g1', rule: 'price_whitelist', triggered: 3, blocked: 3, examples: 'R$ 19,90, R$ 25,00, R$ 30,00' },
  { id: 'g2', rule: 'item_no_menu', triggered: 1, blocked: 1, examples: '"açaí trufado"' },
  { id: 'g3', rule: 'address_outside_zone', triggered: 2, blocked: 2, examples: 'Cidade vizinha, fora do raio' },
  { id: 'g4', rule: 'pii_leak', triggered: 0, blocked: 0, examples: '—' },
]

export const RELATORIOS_BY_DAY = [
  { d: 'Seg', pedidos: 38, receita: 1620 },
  { d: 'Ter', pedidos: 42, receita: 1820 },
  { d: 'Qua', pedidos: 35, receita: 1480 },
  { d: 'Qui', pedidos: 48, receita: 2120 },
  { d: 'Sex', pedidos: 61, receita: 2850 },
  { d: 'Sáb', pedidos: 72, receita: 3380 },
  { d: 'Dom', pedidos: 58, receita: 2680 },
]

export const RELATORIOS_BAIRROS = [
  { name: 'Centro', value: 142 },
  { name: 'Vila A', value: 89 },
  { name: 'Jd. das Flores', value: 76 },
  { name: 'Porto Belo', value: 54 },
  { name: 'KLP', value: 48 },
  { name: 'Morumbi', value: 41 },
  { name: 'Jd. Califórnia', value: 36 },
  { name: 'Vila Yolanda', value: 31 },
]

export const RELATORIOS_CATEGORIAS = [
  { name: 'Açaí', value: 412, color: '#7e22ce' },
  { name: 'Milk Shake', value: 145, color: '#a855f7' },
  { name: 'Sorvete', value: 64, color: '#c084fc' },
  { name: 'Fitness', value: 41, color: '#ddd6fe' },
  { name: 'Fondue', value: 22, color: '#ede9fe' },
  { name: 'Bebidas', value: 33, color: '#f5f3ff' },
]

// Heatmap deterministic (sem random pra evitar SSR mismatch)
export const RELATORIOS_HEATMAP = (() => {
  const data: { day: number; h: number; v: number }[] = []
  for (let day = 0; day < 7; day++) {
    for (let h = 0; h < 24; h++) {
      let v = 0
      if (h >= 11 && h <= 14) v = 3
      else if (h >= 18 && h <= 22) v = 8
      else if (h >= 15 && h <= 17) v = 2
      else if (h >= 9 && h <= 10) v = 1
      if (day >= 4 && h >= 20 && h <= 22) v += 5
      data.push({ day, h, v })
    }
  }
  return data
})()
