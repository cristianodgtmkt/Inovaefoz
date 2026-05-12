// Tools usadas pelo order_handler specialist
import { supabaseService } from '@/lib/db/supabase'
import type { CardapioSnapshot, ToolCall } from '../types'

export function listMenuTool(snapshot: CardapioSnapshot, productHint?: string): { result: any; toolCall: ToolCall } {
  const t0 = Date.now()
  const matches = productHint
    ? snapshot.produtos.filter(p => p.nome.toLowerCase().includes(productHint.toLowerCase()))
    : snapshot.produtos
  const out = matches.map(p => ({
    nome: p.nome,
    tamanhos: snapshot.tamanhos.filter(t => t.produto_id === p.id).map(t => ({ nome: t.nome, preco: Number(t.preco) })),
    sabores_count: snapshot.sabores.filter(s => s.produto_id === p.id).length,
    complementos_count: snapshot.complementos.filter(c => c.produto_id === p.id).length,
  }))
  return {
    result: out,
    toolCall: { name: 'list_menu', args: { product: productHint || 'all' }, result: out, duration_ms: Date.now() - t0, cached: true },
  }
}

export function getPriceTool(snapshot: CardapioSnapshot, item: string, tamanho?: string): { result: any; toolCall: ToolCall } {
  const t0 = Date.now()
  const prod = snapshot.produtos.find(p => p.nome.toLowerCase().includes(item.toLowerCase()))
  if (!prod) return { result: null, toolCall: { name: 'get_price', args: { item, tamanho }, result: null, duration_ms: Date.now() - t0 } }
  const tams = snapshot.tamanhos.filter(t => t.produto_id === prod.id)
  let found: any = null
  if (tamanho) found = tams.find(t => t.nome.toLowerCase().includes(tamanho.toLowerCase()))
  if (!found && tams.length > 0) found = tams[0]
  const out = found ? { produto: prod.nome, tamanho: found.nome, preco: Number(found.preco) } : null
  return { result: out, toolCall: { name: 'get_price', args: { item, tamanho }, result: out, duration_ms: Date.now() - t0, cached: true } }
}

export function calcTaxaTool(snapshot: CardapioSnapshot, bairro: string): { result: any; toolCall: ToolCall } {
  const t0 = Date.now()
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const target = norm(bairro)
  let found: any = null
  found = snapshot.taxas.find(t => norm(t.bairro) === target)
  if (!found) found = snapshot.taxas.find(t => target.includes(norm(t.bairro)))
  if (!found) found = snapshot.taxas.find(t => norm(t.bairro).includes(target))
  if (!found) {
    const words = target.split(' ').filter(w => w.length >= 3)
    found = snapshot.taxas.find(t => {
      const bw = norm(t.bairro).split(' ')
      return words.some(w => bw.some(b => b.startsWith(w) || w.startsWith(b)))
    })
  }
  const out = found ? { bairro: found.bairro, taxa: Number(found.taxa) } : { bairro_nao_encontrado: true, bairros_disponiveis: snapshot.taxas.map(t => t.bairro) }
  return { result: out, toolCall: { name: 'calc_taxa', args: { bairro }, result: out, duration_ms: Date.now() - t0, cached: true } }
}

export async function saveOrderTool(input: {
  telefone: string
  nome_cliente?: string | null
  items: any[]
  endereco?: string | null
  bairro?: string | null
  complemento?: string | null
  forma_pagamento: string
  troco_para?: number | null
  total: number
  taxa: number
  tenant_id?: string | null
}): Promise<{ result: any; toolCall: ToolCall }> {
  const t0 = Date.now()
  const sb = supabaseService()
  const { data, error } = await sb.from('pedidos').insert({
    tenant_id: input.tenant_id || null,
    status: 'novo_pedido',
    telefone_cliente: input.telefone,
    nome_cliente: input.nome_cliente,
    items: input.items,
    endereco: input.endereco,
    bairro: input.bairro,
    complemento_endereco: input.complemento,
    forma_pagamento: input.forma_pagamento,
    troco_para: input.troco_para,
    taxa_entrega: input.taxa,
    total: input.total,
  }).select('id').single()
  if (error) return { result: { error: error.message }, toolCall: { name: 'save_order', args: input, result: { error: error.message }, duration_ms: Date.now() - t0 } }
  return { result: { id: data.id, codigo: `#${(data.id || '').slice(0, 6)}` }, toolCall: { name: 'save_order', args: input, result: { id: data.id }, duration_ms: Date.now() - t0 } }
}
