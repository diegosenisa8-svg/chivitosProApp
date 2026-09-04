import type { AdminOrder } from '../lib/adminApi'
import { ORDER_STATUS_LABELS } from '../lib/adminApi'

export type TicketRestaurant = {
  name?: string
  address?: string
  addressDetail?: string | null
  addressReference?: string | null
  outOfRange?: boolean
  deliveryZoneName?: string | null
  lat?: number | null
  lng?: number | null
  city?: string
  phone?: string
  whatsapp?: string
  etaMin?: number
  etaMax?: number
}

function esc(s: unknown) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(n: number, withCurrency = false, currency = 'UYU') {
  const v = Number(n || 0).toLocaleString('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return withCurrency ? `${v} ${currency}` : v
}

function formatLong(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const day = d.getDate()
  const month = d.toLocaleDateString('es-UY', { month: 'long' })
  const time = d
    .toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', hour12: true })
    .toLowerCase()
  return `${day}-${month} a las ${time}`
}

function paymentTitle(payment: string) {
  const p = (payment || '').toLowerCase()
  if (/mercado|mp|online|tarjeta|card|débito|debito|crédito|credito/.test(p)) return 'Pago Online'
  if (/efectivo|cash/.test(p)) return 'Pago en efectivo'
  if (/transfer/.test(p)) return 'Transferencia'
  return payment || 'Pago'
}

function isPaid(payment: string, status: string) {
  const p = (payment || '').toLowerCase()
  if (/mercado|mp|online|tarjeta|card|pagado|paid|transfer/.test(p)) return true
  if (['delivered', 'ready', 'delivering'].includes(status) && /online|mp/.test(p)) return true
  return false
}

function splitName(full?: string | null) {
  const parts = String(full || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return { first: '—', last: '—' }
  if (parts.length === 1) return { first: parts[0], last: '—' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
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
    }
    const qty = row.quantity && row.quantity > 1 ? `${row.quantity}x ` : ''
    const label = row.optionName || row.name || 'extra'
    const group = row.groupName || row.groupLabel ? `${row.groupName || row.groupLabel}: ` : ''
    return `${qty}${group}${label}`
  })
}

function buildTicketHtml(order: AdminOrder, restaurant?: TicketRestaurant | null) {
  const name = splitName(order.customerName)
  const paid = isPaid(order.payment, order.status)
  const payTitle = paymentTitle(order.payment)
  const schedule =
    order.schedule === 'now' ? 'Lo antes posible' : order.scheduleTime || 'Programado'
  const etaMax =
    restaurant?.etaMax ?? (order.fulfillment === 'delivery' ? 30 : 15)
  const etaMin = restaurant?.etaMin
  const etaLabel = etaMin != null ? `${etaMin}-${etaMax} min` : `${etaMax} min`
  const brand = restaurant?.name || 'ChivitosPro'
  const footAddr =
    [restaurant?.address, restaurant?.city].filter(Boolean).join(', ') ||
    'Uruguay 1802, 50000 Salto'
  const footPhone = restaurant?.phone || restaurant?.whatsapp || '+598 4735 4634'
  const orderNum = (order.id.replace(/\D/g, '').slice(-10) || order.id.slice(0, 10)).toUpperCase()
  const when = formatLong(order.createdAt)
  const accepted = formatLong(order.updatedAt || order.createdAt)
  const currency = order.currency || 'UYU'
  const isDelivery = order.fulfillment === 'delivery'
  const status = ORDER_STATUS_LABELS[order.status] || order.status

  const items = order.items
    .map((i) => {
      const mods = modifierLines(i.modifiers)
        .map((line) => `<div class="mod">${esc(line)}</div>`)
        .join('')
      const note = i.notes ? `<div class="mod">* ${esc(i.notes)}</div>` : ''
      const size = i.sizeLabel ? ` (${esc(i.sizeLabel)})` : ''
      return `<div class="item">
        <table class="line"><tr>
          <td class="l"><b>${esc(i.quantity)}x ${esc(i.name)}${size}</b></td>
          <td class="r"><b>${esc(money(i.lineTotal))}</b></td>
        </tr></table>
        ${mods}${note}
      </div>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Ticket ${esc(orderNum)}</title>
<style>
  @page { size: 80mm 210mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: 72.1mm;
    max-width: 72.1mm;
    background: #fff;
    color: #000;
    font: 11.5px/1.3 Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body { padding: 1.5mm 2mm 4mm; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 0; vertical-align: top; }
  td.l { text-align: left; word-break: break-word; }
  td.r { text-align: right; white-space: nowrap; width: 1%; padding-left: 4px; }
  .bar {
    background: #000 !important;
    color: #fff !important;
    font-weight: 700;
    padding: 4px 5px;
    margin-top: 5px;
  }
  .bar table td { color: #fff !important; font-weight: 700; }
  .gray {
    background: #e8e8e8 !important;
    padding: 4px 5px;
  }
  .h {
    font-weight: 700;
    margin: 8px 0 3px;
    font-size: 12.5px;
  }
  .kv { margin: 1px 0; }
  .item { margin: 5px 0 6px; }
  .mod {
    font-style: italic;
    padding-left: 10px;
    margin-top: 1px;
  }
  .box {
    border: 1px solid #000;
    padding: 5px;
    margin-top: 6px;
  }
  .pill {
    display: inline-block;
    background: #000 !important;
    color: #fff !important;
    font-weight: 700;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 999px;
    margin-top: 4px;
  }
  .totals { margin-top: 8px; text-align: right; }
  .totals .total { font-size: 15px; font-weight: 700; margin-top: 2px; }
  .pay {
    border: 1px solid #000;
    margin-top: 8px;
    padding: 6px 8px;
  }
  .pay table td { font-weight: 700; }
  .foot {
    text-align: center;
    margin-top: 10px;
    font-size: 11px;
    line-height: 1.35;
  }
</style>
</head>
<body>
  <div class="bar">${esc(payTitle)}</div>
  <div class="gray">
    <table><tr>
      <td class="l">${esc(order.payment || '—')}</td>
      <td class="r">${paid ? 'Confirmado' : 'Pendiente'}</td>
    </tr></table>
  </div>

  <div class="bar">
    <table><tr>
      <td class="l">${esc(schedule)}</td>
      <td class="r">${esc(etaLabel)}</td>
    </tr></table>
  </div>
  ${
    isDelivery
      ? `<div class="bar"><table><tr>
          <td class="l">Tiempo estimado</td>
          <td class="r">~ ${esc(String(etaMax))} min</td>
        </tr></table></div>
        <div class="gray">Pedido ${esc(when)}</div>`
      : ''
  }

  <div class="bar">
    <table><tr>
      <td class="l">${isDelivery ? 'Dirección' : 'Retiro en local'}</td>
      <td class="r">${isDelivery ? 'Delivery' : ''}</td>
    </tr></table>
  </div>
  ${isDelivery ? `<div class="gray">${esc(order.addressDetail || order.address || 'Sin dirección')}</div>` : ''}
  ${isDelivery && order.addressReference ? `<div class="gray">Ref: ${esc(order.addressReference)}</div>` : ''}
  ${isDelivery && order.outOfRange ? `<div><b>** FUERA DE RANGO - CONFIRMAR **</b></div>` : ''}
  ${isDelivery && order.lat != null && order.lng != null ? `<div class="gray">${order.lat.toFixed(5)}, ${order.lng.toFixed(5)}</div>` : ''}
  ${order.notes ? `<div class="gray"><b>NOTAS:</b> ${esc(order.notes)}</div>` : ''}

  <div class="h">Detalles del Pedido:</div>
  <div class="kv">Número: ${esc(orderNum)}</div>
  <div class="kv">Puesto en: ${esc(when)}</div>
  <div class="kv">Actualizado: ${esc(accepted)}</div>
  <div class="kv">Estado: ${esc(status)}</div>

  <div class="h">Información Cliente:</div>
  <div class="kv">Nombre: ${esc(name.first)}</div>
  <div class="kv">Apellido: ${esc(name.last)}</div>
  <div class="kv">Teléfono: ${esc(order.phone || '—')}</div>

  <div class="h">Artículos:</div>
  ${items}

  ${
    order.discount > 0
      ? `<div class="box">
          <table><tr>
            <td class="l"><b>Descuento</b></td>
            <td class="r"><b>${esc(money(order.discount))}</b></td>
          </tr></table>
          <div class="pill">Ahorro: ${esc(money(order.discount, true, currency))}</div>
        </div>`
      : ''
  }

  <div class="totals">
    ${
      order.deliveryFee > 0
        ? `<div>Envío: ${esc(money(order.deliveryFee, true, currency))}</div>`
        : ''
    }
    <div>Sub-total: ${esc(money(order.subtotal ?? order.total, true, currency))}</div>
    <div class="total">Total: ${esc(money(order.total, true, currency))}</div>
  </div>

  <div class="pay">
    <table><tr>
      <td class="l">${paid ? '☑' : '☐'} Pagado</td>
      <td class="r">${paid ? '☐' : '☑'} No Pagado</td>
    </tr></table>
  </div>

  <div class="foot">
    <div><b>${esc(brand)}</b></div>
    <div>${esc(footAddr)}</div>
    <div>${esc(footPhone)}</div>
  </div>
</body>
</html>`
}

/** Imprime únicamente el ticket en medida POS-80C (80 x 210 mm / útil 72.1 mm). */
export function printKitchenTicket(order: AdminOrder, restaurant?: TicketRestaurant | null) {
  const html = buildTicketHtml(order, restaurant)

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
