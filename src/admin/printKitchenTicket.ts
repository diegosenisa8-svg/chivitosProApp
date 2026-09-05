import type { AdminOrder } from '../lib/adminApi'

export type TicketRestaurant = {
  name?: string
  address?: string
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

/** Traduce lat/lng a calle (Nominatim). Si falla, null — no imprimimos coordenadas. */
async function streetFromCoords(lat: number, lng: number): Promise<string | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('lat', String(lat))
    url.searchParams.set('lon', String(lng))
    url.searchParams.set('zoom', '18')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('accept-language', 'es')
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      display_name?: string
      address?: Record<string, string>
    }
    const a = data.address || {}
    const road = a.road || a.pedestrian || a.street || a.path || a.residential || ''
    const num = a.house_number || ''
    const street = [road, num].filter(Boolean).join(' ').trim()
    const suburb = a.suburb || a.neighbourhood || a.quarter || a.city_district || ''
    const city = a.city || a.town || a.village || a.municipality || ''
    const line = [street, suburb, city].filter(Boolean).join(', ')
    if (line) return line
    if (data.display_name) {
      return data.display_name.split(',').slice(0, 3).join(',').trim()
    }
    return null
  } catch {
    return null
  }
}

async function deliveryAddressLines(order: AdminOrder): Promise<string[]> {
  const lines: string[] = []

  // Calle escrita a mano (modo "describir ubicación")
  const written = String(order.address || '')
    .split('·')
    .map((p) => p.trim())
    .filter((p) => p && !/^FUERA DE ZONA$/i.test(p) && !/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(p))

  // Preferir calle legible: reverse-geocode si hay GPS; si no, texto del pedido.
  let street: string | null = null
  if (order.lat != null && order.lng != null) {
    street = await streetFromCoords(order.lat, order.lng)
  }
  if (street) lines.push(street)
  else if (written.length) {
    // Si el address compuesto empieza por detalle numérico corto, no lo uses como calle.
    const maybeStreet = written.find((p) => p.length > 4 && !/^\d+[A-Za-z]?$/.test(p))
    if (maybeStreet) lines.push(maybeStreet)
  }

  const detail = String(order.addressDetail || '').trim()
  if (detail) lines.push(`Nº / apto: ${detail}`)

  const ref = String(order.addressReference || '').trim()
  if (ref) lines.push(`Ref: ${ref}`)

  if (order.deliveryZoneName && !order.outOfRange) {
    lines.push(`Zona: ${order.deliveryZoneName}`)
  }

  if (!lines.length) {
    if (written.length) lines.push(...written)
    else lines.push('Sin dirección')
  }

  return lines
}

function formatConfirmedAt(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d
    .toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', hour12: true })
    .toLowerCase()
}

function ticketBodyHtml(
  order: AdminOrder,
  restaurant: TicketRestaurant | null | undefined,
  deliveryLines: string[],
) {
  const name = splitName(order.customerName)
  const paid = isPaid(order.payment, order.status)
  const payTitle = paymentTitle(order.payment)
  const brand = restaurant?.name || 'ChivitosPro'
  const footAddr =
    [restaurant?.address, restaurant?.city].filter(Boolean).join(', ') ||
    'Uruguay 1802, 50000 Salto'
  const footPhone = restaurant?.phone || restaurant?.whatsapp || '+598 4735 4634'
  const currency = order.currency || 'UYU'
  const isDelivery = order.fulfillment === 'delivery'
  const orderNum = (order.id.replace(/\D/g, '').slice(-10) || order.id.slice(0, 10)).toUpperCase()
  const confirmedAt = formatConfirmedAt(order.createdAt)

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

  const addrBlock = isDelivery
    ? deliveryLines.map((l) => `<div class="gray">${esc(l)}</div>`).join('')
    : ''

  return `
  <div class="ticket">
  <div class="bar">
    <table><tr>
      <td class="l">Pedido #${esc(orderNum)}</td>
      <td class="r">${esc(payTitle)}</td>
    </tr></table>
  </div>
  <div class="gray">Confirmado a las ${esc(confirmedAt)}</div>
  <div class="gray">
    <table><tr>
      <td class="l">${esc(order.payment || '—')}</td>
      <td class="r">${paid ? 'Confirmado' : 'Pendiente'}</td>
    </tr></table>
  </div>

  <div class="bar">
    <table><tr>
      <td class="l">${isDelivery ? 'Dirección' : 'Retiro en local'}</td>
      <td class="r">${isDelivery ? 'Delivery' : ''}</td>
    </tr></table>
  </div>
  ${addrBlock}
  ${isDelivery && order.outOfRange ? `<div><b>** FUERA DE RANGO - CONFIRMAR **</b></div>` : ''}
  ${order.notes ? `<div class="gray"><b>NOTAS:</b> ${esc(order.notes)}</div>` : ''}

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
  </div>`
}

function buildTicketHtml(
  order: AdminOrder,
  restaurant: TicketRestaurant | null | undefined,
  deliveryLines: string[],
) {
  const orderNum = (order.id.replace(/\D/g, '').slice(-10) || order.id.slice(0, 10)).toUpperCase()
  const copy = ticketBodyHtml(order, restaurant, deliveryLines)

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Ticket ${esc(orderNum)}</title>
<style>
  /* Alto automático: sin hoja fija 210mm (evita imprimir blanco de más). */
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: 72.1mm;
    max-width: 72.1mm;
    height: auto;
    background: #fff;
    color: #000;
    font: 11.5px/1.3 Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body { padding: 1.5mm 2mm 2mm; }
  .ticket { width: 100%; }
  .ticket + .ticket {
    break-before: page;
    page-break-before: always;
    margin-top: 0;
    padding-top: 1.5mm;
  }
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
    margin-top: 8px;
    font-size: 11px;
    line-height: 1.35;
  }
</style>
</head>
<body>
  ${copy}
  ${copy}
</body>
</html>`
}

/** Imprime 2 copias del ticket POS-80C, cortando al alto del contenido (sin blanco final). */
export async function printKitchenTicket(order: AdminOrder, restaurant?: TicketRestaurant | null) {
  const deliveryLines =
    order.fulfillment === 'delivery' ? await deliveryAddressLines(order) : []
  const html = buildTicketHtml(order, restaurant, deliveryLines)

  const old = document.getElementById('pos80-print-frame')
  if (old) old.remove()

  const iframe = document.createElement('iframe')
  iframe.id = 'pos80-print-frame'
  iframe.setAttribute('title', 'Ticket POS-80C')
  iframe.style.cssText =
    'position:fixed;left:-9999px;top:0;width:80mm;height:1px;border:0;visibility:hidden;'
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
  window.setTimeout(run, 500)
}
