import type { AdminOrder } from '../lib/adminApi'
import { ORDER_STATUS_LABELS } from '../lib/adminApi'

function esc(s: unknown) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(n: number) {
  return `$ ${Number(n || 0).toLocaleString('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function modifierLines(raw: unknown): string[] {
  if (!Array.isArray(raw) || !raw.length) return []
  return raw.map((m) => {
    const row = m as {
      quantity?: number
      groupName?: string
      groupLabel?: string
      optionName?: string
      name?: string
      price?: number
    }
    const qty = row.quantity && row.quantity > 1 ? `${row.quantity}x ` : ''
    const label = row.optionName || row.name || 'extra'
    const group = row.groupName || row.groupLabel ? `${row.groupName || row.groupLabel}: ` : ''
    const price =
      typeof row.price === 'number' && row.price > 0
        ? ` (+${money(row.price * (row.quantity || 1))})`
        : ''
    return `+ ${qty}${group}${label}${price}`
  })
}

function buildTicketHtml(order: AdminOrder) {
  const when = new Date(order.createdAt).toLocaleString('es-UY', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
  const orderId = order.id.slice(0, 8).toUpperCase()
  const status = ORDER_STATUS_LABELS[order.status] || order.status
  const schedule =
    order.schedule === 'now' ? 'Lo antes posible' : order.scheduleTime || 'Programado'

  const items = order.items
    .map((i) => {
      const mods = modifierLines(i.modifiers)
        .map((line) => `<div class="mod">${esc(line)}</div>`)
        .join('')
      const note = i.notes ? `<div class="mod">* ${esc(i.notes)}</div>` : ''
      const size = i.sizeLabel ? ` (${esc(i.sizeLabel)})` : ''
      return `<div class="item">
        <table><tr>
          <td class="l">${esc(i.quantity)}x ${esc(i.name)}${size}</td>
          <td class="r">${esc(money(i.lineTotal))}</td>
        </tr></table>
        ${mods}${note}
      </div>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Ticket ${esc(orderId)}</title>
<style>
  /* Medida POS-80C: 80(72.1) x 210 mm, márgenes Ninguno */
  @page {
    size: 80mm 210mm;
    margin: 0;
  }
  html, body {
    margin: 0;
    padding: 0;
    width: 72.1mm;
    max-width: 72.1mm;
    background: #fff;
    color: #000;
    font: 12px/1.28 "Courier New", Courier, monospace;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    padding: 2mm 1.5mm 3mm;
  }
  * { box-sizing: border-box; }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  td {
    padding: 0;
    vertical-align: top;
  }
  td.l { text-align: left; word-break: break-word; }
  td.r { text-align: right; white-space: nowrap; width: 1%; padding-left: 4px; }
  .brand {
    text-align: center;
    font-weight: 700;
    font-size: 16px;
    letter-spacing: 0.04em;
    margin: 0 0 2px;
  }
  .center {
    text-align: center;
    margin: 0;
  }
  .sep {
    margin: 5px 0;
    border: 0;
    border-top: 1px dashed #000;
  }
  .id {
    font-weight: 700;
    font-size: 13px;
    margin: 2px 0;
  }
  .item { margin: 4px 0; }
  .mod {
    padding-left: 8px;
    font-size: 11px;
  }
  .total td {
    font-weight: 700;
    font-size: 14px;
    padding-top: 3px;
  }
  .thanks {
    text-align: center;
    font-weight: 700;
    margin: 6px 0 2px;
  }
</style>
</head>
<body>
  <p class="brand">CHIVITOSPRO</p>
  <p class="center">Salto, Uruguay</p>
  <hr class="sep" />

  <p class="id">PEDIDO #${esc(orderId)}</p>
  <div>${esc(when)}</div>
  <div>${esc(status)}</div>
  <hr class="sep" />

  <div>Cliente: ${esc(order.customerName || '—')}</div>
  <div>Tel: ${esc(order.phone || '—')}</div>
  <div>Tipo: ${order.fulfillment === 'delivery' ? 'DELIVERY' : 'RETIRO'}</div>
  <div>Horario: ${esc(schedule)}</div>
  <div>Pago: ${esc(order.payment)}</div>
  ${order.address ? `<div>Dir: ${esc(order.address)}</div>` : ''}
  ${order.notes ? `<div>Notas: ${esc(order.notes)}</div>` : ''}
  <hr class="sep" />

  ${items}
  <hr class="sep" />

  ${
    order.subtotal != null
      ? `<table><tr><td class="l">Subtotal</td><td class="r">${esc(money(order.subtotal))}</td></tr></table>`
      : ''
  }
  ${
    order.discount > 0
      ? `<table><tr><td class="l">Descuento</td><td class="r">-${esc(money(order.discount))}</td></tr></table>`
      : ''
  }
  ${
    order.deliveryFee > 0
      ? `<table><tr><td class="l">Envío</td><td class="r">${esc(money(order.deliveryFee))}</td></tr></table>`
      : ''
  }
  <table class="total"><tr>
    <td class="l">TOTAL</td>
    <td class="r">${esc(money(order.total))}</td>
  </tr></table>
  <hr class="sep" />

  <p class="thanks">Gracias por tu pedido</p>
  <p class="center">ChivitosPro</p>
</body>
</html>`
}

/** Imprime únicamente el ticket en medida POS-80C (80 x 210 mm / útil 72.1 mm). */
export function printKitchenTicket(order: AdminOrder) {
  const html = buildTicketHtml(order)

  const old = document.getElementById('pos80-print-frame')
  if (old) old.remove()

  const iframe = document.createElement('iframe')
  iframe.id = 'pos80-print-frame'
  iframe.setAttribute('title', 'Ticket POS-80C')
  iframe.style.cssText =
    'position:fixed;left:-9999px;top:0;width:80mm;height:210mm;border:0;visibility:hidden;'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  const win = iframe.contentWindow
  if (!doc || !win) {
    iframe.remove()
    window.alert('No se pudo preparar la impresión del ticket.')
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  let printed = false
  const run = () => {
    if (printed) return
    printed = true
    try {
      win.focus()
      win.print()
    } finally {
      window.setTimeout(() => iframe.remove(), 2000)
    }
  }

  iframe.onload = () => window.setTimeout(run, 80)
  window.setTimeout(run, 400)
}
