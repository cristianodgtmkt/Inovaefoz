// Transforma rows do cardápio em chunks pesquisáveis pra ai_kb_chunks
import { supabaseService } from '@/lib/db/supabase'
import { embedWithCache, sha256 } from './embed'
import { env } from '@/lib/config/env'

interface ChunkInput {
  source_type: string
  source_id: string
  source_table: string
  title: string
  content: string
}

async function buildChunks(): Promise<ChunkInput[]> {
  const sb = supabaseService()
  const [produtos, tamanhos, sabores, complementos, taxas, configs] = await Promise.all([
    sb.from('produtos').select('*').eq('ativo', true),
    sb.from('tamanhos').select('*').eq('ativo', true),
    sb.from('sabores').select('*').eq('ativo', true),
    sb.from('complementos').select('*').eq('ativo', true),
    sb.from('taxas_entrega').select('*').eq('ativo', true),
    sb.from('configuracoes').select('*'),
  ])

  const out: ChunkInput[] = []

  for (const p of produtos.data || []) {
    const ts = (tamanhos.data || []).filter(t => t.produto_id === p.id)
    const ss = (sabores.data || []).filter(s => s.produto_id === p.id)
    const cs = (complementos.data || []).filter(c => c.produto_id === p.id)
    const lines: string[] = []
    lines.push(`Produto: ${p.nome}`)
    if (ts.length) lines.push('Tamanhos: ' + ts.map(t => `${t.nome} R$${Number(t.preco).toFixed(2).replace('.', ',')}`).join(', '))
    if (ss.length) {
      lines.push('Sabores disponíveis (' + ss.length + '):')
      lines.push(ss.map(s => '- ' + s.nome).join('\n'))
    }
    if (cs.length) {
      const byTipo = new Map<string, any[]>()
      for (const c of cs) {
        const t = c.tipo || 'outros'
        if (!byTipo.has(t)) byTipo.set(t, [])
        byTipo.get(t)!.push(c)
      }
      lines.push('Complementos:')
      for (const [tipo, list] of byTipo.entries()) {
        lines.push(`  ${tipo}: ` + list.map(c => c.nome).join(', '))
      }
    }
    out.push({
      source_type: 'produto',
      source_id: p.id,
      source_table: 'produtos',
      title: p.nome,
      content: lines.join('\n'),
    })
  }

  if ((taxas.data || []).length) {
    const lines = ['Taxas de entrega por bairro:']
    for (const t of taxas.data!) lines.push(`${t.bairro}: R$ ${Number(t.taxa).toFixed(2).replace('.', ',')}`)
    out.push({
      source_type: 'taxa',
      source_id: 'all',
      source_table: 'taxas_entrega',
      title: 'Taxas de entrega',
      content: lines.join('\n'),
    })
  }

  for (const c of (configs.data || [])) {
    out.push({
      source_type: 'config',
      source_id: c.id || c.chave,
      source_table: 'configuracoes',
      title: c.chave,
      content: `${c.chave}: ${typeof c.valor === 'object' ? JSON.stringify(c.valor) : String(c.valor)}`,
    })
  }

  return out
}

export async function rebuildKb(): Promise<{ embedded: number; skipped: number; total: number; errors: number }> {
  const chunks = await buildChunks()
  const sb = supabaseService()
  const model = env().EMBED_MODEL
  let embedded = 0, skipped = 0, errors = 0

  // Limpa chunks antigos pra rebuild fresh
  await sb.from('ai_kb_chunks').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  for (const c of chunks) {
    const hash = sha256(c.content)
    try {
      const { embedding, cached } = await embedWithCache(c.content)
      const { error } = await sb.from('ai_kb_chunks').insert({
        source_type: c.source_type,
        source_id: c.source_id,
        source_table: c.source_table,
        title: c.title,
        content: c.content,
        content_sha256: hash,
        embedding,
        embedding_model: model,
        embedded_at: new Date().toISOString(),
      })
      if (error) { errors++; console.warn('[kb-builder] insert err', error.message) }
      else { if (cached) skipped++; embedded++ }
    } catch (e: any) { errors++; console.warn('[kb-builder] err', e?.message) }
  }
  return { embedded, skipped, total: chunks.length, errors }
}
