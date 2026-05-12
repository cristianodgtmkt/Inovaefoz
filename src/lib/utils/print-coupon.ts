/**
 * Print thermal coupon (Elgin i9 / Bematech 80mm).
 * Layout: <pre> Courier + padding por chars (estilo iFood). Sem flex/table.
 */

interface OrderForPrint {
  id?: string
  nome_cliente?: string
  telefone_cliente?: string
  items?: any[]
  endereco?: string
  bairro?: string
  complemento_endereco?: string
  forma_pagamento?: string
  troco_para?: number
  total?: number
  taxa_entrega?: number
  observacoes?: string
  created_at?: string
  tipo_entrega?: string
}

const WIDTH = 32  // chars por linha (calibrado pra 72mm Courier 12px)

function fmtBRL(n: number): string {
  return `R$ ${(n || 0).toFixed(2).replace('.', ',')}`
}

function fmtPhone(p: string): string {
  const d = (p || '').replace(/\D/g, '')
  if (d.length === 13) return `(${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`
  if (d.length === 12) return `(${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`
  return p
}

function center(s: string): string {
  if (s.length >= WIDTH) return s
  const pad = Math.floor((WIDTH - s.length) / 2)
  return ' '.repeat(pad) + s
}

function row(label: string, value: string): string {
  const total = label.length + value.length
  if (total >= WIDTH) return label + '\n' + ' '.repeat(WIDTH - value.length) + value
  return label + ' '.repeat(WIDTH - total) + value
}

function divider(char = '-'): string {
  return char.repeat(WIDTH)
}

function wrap(text: string, indent = 0): string {
  const max = WIDTH - indent
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) {
      lines.push(cur)
      cur = w
    } else {
      cur = (cur + ' ' + w).trim()
    }
  }
  if (cur) lines.push(cur)
  return lines.map(l => ' '.repeat(indent) + l).join('\n')
}

export function printCoupon(order: OrderForPrint, tenantName = 'Açaí da Barra') {
  const items = Array.isArray(order.items) ? order.items : []
  const subtotal = order.total || items.reduce((s, i) => s + (i.preco_total || 0) * (i.quantidade || 1), 0)
  const taxa = order.taxa_entrega || 0
  const grand = subtotal + taxa
  const data = order.created_at ? new Date(order.created_at) : new Date()
  const dataStr = data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

  const lines: string[] = []
  lines.push(center(tenantName))
  lines.push(center(`Pedido #${(order.id || '').slice(0, 6).toUpperCase()}`))
  lines.push(center(dataStr))
  lines.push(divider())
  lines.push('CLIENTE')
  lines.push(order.nome_cliente || 'Cliente')
  lines.push(`Tel: ${fmtPhone(order.telefone_cliente || '')}`)
  lines.push('')

  if (order.tipo_entrega === 'retirada') {
    lines.push('** RETIRADA NO LOCAL **')
  } else {
    lines.push('ENDERECO ENTREGA')
    lines.push(wrap(order.endereco || '-'))
    if (order.complemento_endereco) lines.push(wrap('Comp: ' + order.complemento_endereco))
    lines.push(wrap('Bairro: ' + (order.bairro || '-')))
  }
  lines.push(divider())
  lines.push(`ITENS DO PEDIDO (${items.length})`)

  for (const it of items) {
    const qty = it.quantidade || it.qty || 1
    const nome = it.nome || it.name || ''
    const preco = it.preco_total || it.preco || 0
    lines.push(row(`${qty}x ${nome}`, fmtBRL(preco)))
    if (Array.isArray(it.sabores) && it.sabores.length) {
      lines.push(wrap('Sabores: ' + it.sabores.filter(Boolean).join(', '), 2))
    }
    if (Array.isArray(it.complementos) && it.complementos.length) {
      lines.push(wrap('Complementos: ' + it.complementos.filter(Boolean).join(', '), 2))
    }
  }

  if (order.observacoes) {
    lines.push('')
    lines.push('OBS:')
    lines.push(wrap(order.observacoes))
  }
  lines.push(divider())
  lines.push(row('Subtotal:', fmtBRL(subtotal)))
  if (taxa > 0) lines.push(row('Taxa entrega:', fmtBRL(taxa)))
  lines.push(divider())
  lines.push(row('TOTAL:', fmtBRL(grand)))
  lines.push(divider())

  const pgmt = (order.forma_pagamento || '').toLowerCase()
  let pgmtTxt = pgmt.toUpperCase()
  if (pgmt === 'dinheiro') {
    pgmtTxt = order.troco_para && Number(order.troco_para) > 0
      ? `DINHEIRO (troco p/ R$ ${(order.troco_para).toFixed(2).replace('.', ',')})`
      : 'DINHEIRO (sem troco)'
  }
  lines.push('PAGAMENTO:')
  lines.push(wrap(pgmtTxt))
  lines.push(divider('='))
  lines.push(center('Obrigado pela preferencia!'))

  const text = lines.join('\n')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Pedido #${(order.id || '').slice(0, 6)}</title>
<style>
  @page { size: 72mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { margin: 0; padding: 0; width: 72mm; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    font-weight: bold;
    color: #000;
    padding: 2mm 1mm 6mm 1mm;
    line-height: 1.3;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  pre {
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
    margin: 0;
    white-space: pre-wrap;
    word-break: keep-all;
    overflow-wrap: break-word;
  }
</style>
</head>
<body>
<pre>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
<script>
  window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }
</script>
</body>
</html>`

  const w = window.open('', '_blank', 'width=400,height=600')
  if (!w) { alert('Bloqueado pelo navegador. Permita popups pra imprimir.'); return }
  w.document.open()
  w.document.write(html)
  w.document.close()
}
