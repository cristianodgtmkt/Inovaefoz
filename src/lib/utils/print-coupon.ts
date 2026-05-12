/**
 * Print thermal coupon (80mm) for Elgin i9 / Bematech / etc.
 * Opens new window with formatted HTML + auto-triggers print dialog.
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

function fmtBRL(n: number): string {
  return (n || 0).toFixed(2).replace('.', ',')
}

function fmtPhone(p: string): string {
  const d = (p || '').replace(/\D/g, '')
  if (d.length === 13) return `(${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`
  if (d.length === 12) return `(${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`
  return p
}

export function printCoupon(order: OrderForPrint, tenantName = 'Açaí da Barra') {
  const items = Array.isArray(order.items) ? order.items : []
  const subtotal = order.total || items.reduce((s, i) => s + (i.preco_total || 0) * (i.quantidade || 1), 0)
  const taxa = order.taxa_entrega || 0
  const grand = subtotal + taxa
  const data = order.created_at ? new Date(order.created_at) : new Date()
  const dataStr = data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

  const itemsHtml = items.map(it => {
    const qty = it.quantidade || it.qty || 1
    const nome = it.nome || it.name || ''
    const preco = it.preco_total || it.preco || 0
    const sabores = Array.isArray(it.sabores) ? it.sabores.filter(Boolean) : []
    const comps = Array.isArray(it.complementos) ? it.complementos.filter(Boolean) : []
    let html = `<div class="item">
      <div class="item-line"><span>${qty}x ${nome}</span><span>R$ ${fmtBRL(preco)}</span></div>`
    if (sabores.length) html += `<div class="sub">Sabores: ${sabores.join(', ')}</div>`
    if (comps.length) html += `<div class="sub">Complementos: ${comps.join(', ')}</div>`
    html += `</div>`
    return html
  }).join('')

  const pgmt = (order.forma_pagamento || '').toLowerCase()
  let pgmtTxt = pgmt.toUpperCase()
  if (pgmt === 'dinheiro') {
    pgmtTxt = order.troco_para && Number(order.troco_para) > 0
      ? `DINHEIRO - troco p/ R$ ${fmtBRL(order.troco_para)}`
      : 'DINHEIRO - sem troco (valor exato)'
  }

  const enderecoBlock = order.tipo_entrega === 'retirada'
    ? `<div class="block"><b>RETIRADA NO LOCAL</b></div>`
    : `<div class="block">
        <b>ENDEREGO ENTREGA</b><br/>
        ${order.endereco || '-'}${order.complemento_endereco ? ` (${order.complemento_endereco})` : ''}<br/>
        Bairro: ${order.bairro || '-'}
      </div>`

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Pedido #${(order.id || '').slice(0, 6)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    width: 80mm;
    padding: 4mm 3mm;
    color: #000;
    line-height: 1.35;
  }
  .header { text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 2mm; }
  .meta { text-align: center; font-size: 11px; margin-bottom: 3mm; }
  hr { border: 0; border-top: 1px dashed #000; margin: 2mm 0; }
  .block { margin: 2mm 0; }
  .item { margin-bottom: 2mm; }
  .item-line { display: flex; justify-content: space-between; font-weight: bold; }
  .sub { font-size: 11px; margin-left: 3mm; color: #000; }
  .totals { margin-top: 2mm; }
  .totals div { display: flex; justify-content: space-between; }
  .grand { font-size: 14px; font-weight: bold; border-top: 1px solid #000; padding-top: 1mm; margin-top: 1mm; }
  .footer { text-align: center; font-size: 10px; margin-top: 4mm; }
  .obs { font-style: italic; font-size: 11px; margin-top: 2mm; padding: 1mm; border: 1px dashed #000; }
</style>
</head>
<body>
  <div class="header">${tenantName.toUpperCase()}</div>
  <div class="meta">${dataStr}<br/>Pedido #${(order.id || '').slice(0, 6).toUpperCase()}</div>
  <hr/>
  <div class="block">
    <b>CLIENTE</b><br/>
    ${order.nome_cliente || 'Cliente'}<br/>
    Tel: ${fmtPhone(order.telefone_cliente || '')}
  </div>
  ${enderecoBlock}
  <hr/>
  <div class="block"><b>ITENS</b></div>
  ${itemsHtml}
  ${order.observacoes ? `<div class="obs"><b>Obs:</b> ${order.observacoes}</div>` : ''}
  <hr/>
  <div class="totals">
    <div><span>Subtotal</span><span>R$ ${fmtBRL(subtotal)}</span></div>
    ${taxa > 0 ? `<div><span>Taxa entrega</span><span>R$ ${fmtBRL(taxa)}</span></div>` : ''}
    <div class="grand"><span>TOTAL</span><span>R$ ${fmtBRL(grand)}</span></div>
  </div>
  <hr/>
  <div class="block"><b>PAGAMENTO</b><br/>${pgmtTxt}</div>
  <div class="footer">--- Obrigado pela preferencia! ---</div>
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
