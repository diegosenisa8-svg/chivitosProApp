import { mergeSettings } from './settings.js'

/**
 * Cálculo de precios de un pedido — la fuente de verdad es SIEMPRE la base.
 *
 * El front calcula lo mismo para mostrarlo en pantalla (src/context/CartContext.tsx,
 * src/lib/deliveryZones.ts, src/pages/CheckoutPage.tsx), pero lo que llega en el
 * body del pedido no se usa nunca para cobrar: acá se recalcula todo a partir de
 * los productos, los modificadores y la configuración guardados en Postgres.
 *
 * Si cambiás una regla acá, cambiala también en el front (y al revés), o los
 * totales que ve el cliente van a dejar de coincidir con los que se cobran.
 */

/**
 * Cupones que el front resuelve por código sin pasar por settings.promotions
 * (ver applyCoupon en CartContext). Se replican acá para que sigan funcionando.
 */
const BUILT_IN_PROMOS = {
  CHIVITO10: { code: 'CHIVITO10', type: 'percent', value: 10 },
  PRIMERA: { code: 'PRIMERA', type: 'percent', value: 15 },
}

/** Tope de sanidad para grupos con cantidad libre (allowQuantity). */
const MAX_OPTION_QUANTITY = 20

/** Error de pedido con código HTTP y motivo legible para el cliente. */
export class OrderError extends Error {
  constructor(message, { status = 400, code = 'INVALID_ORDER' } = {}) {
    super(message)
    this.name = 'OrderError'
    this.status = status
    this.code = code
  }
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

export function zoneDeliveryFee(zone) {
  if (!zone) return 0
  if (zone.freeDelivery) return 0
  return Math.max(0, Number(zone.fee) || 0)
}

export function activeZones(settings) {
  return (settings.deliveryZones || []).filter((z) => z && z.active)
}

export function resolveCoupon(rawCode, settings) {
  const code = String(rawCode || '').trim().toUpperCase()
  if (!code) return null

  const fromAdmin = (settings.promotions || []).find(
    (p) => p && p.active && String(p.code || '').toUpperCase() === code,
  )
  if (fromAdmin) {
    return {
      code: String(fromAdmin.code || code).toUpperCase(),
      type: fromAdmin.type === 'fixed' ? 'fixed' : 'percent',
      value: Math.max(0, Number(fromAdmin.value) || 0),
    }
  }

  return BUILT_IN_PROMOS[code] || null
}

/** Precio unitario según el tamaño elegido. Solo aplica si el producto tiene rango. */
function unitPriceFor(product, sizeLabel) {
  if (product.priceMax == null) {
    return { unitPrice: product.price, sizeLabel: '' }
  }
  const wantsMax = /grande/i.test(String(sizeLabel || ''))
  return {
    unitPrice: wantsMax ? product.priceMax : product.price,
    sizeLabel: wantsMax ? 'Porción grande' : 'Porción chica',
  }
}

/**
 * Resuelve los modificadores elegidos contra los del producto en la base.
 * Del body solo se leen groupId, optionId y quantity; el precio y el nombre
 * salen siempre de la fila de la base.
 */
function resolveModifiers(product, rawModifiers) {
  const groups = new Map((product.modifiers || []).map((g) => [g.externalId, g]))
  const chosen = []
  const qtyByGroup = new Map()

  for (const m of rawModifiers || []) {
    const group = groups.get(m.groupId)
    if (!group) {
      throw new OrderError(`Opción desconocida en "${product.name}"`, { code: 'UNKNOWN_MODIFIER' })
    }
    const option = (group.options || []).find((o) => o.externalId === m.optionId)
    if (!option) {
      throw new OrderError(
        `Opción desconocida en "${group.name}" (${product.name})`,
        { code: 'UNKNOWN_MODIFIER_OPTION' },
      )
    }

    const quantity = Math.trunc(Number(m.quantity) || 0)
    if (quantity < 1) continue
    if (quantity > MAX_OPTION_QUANTITY) {
      throw new OrderError(
        `Cantidad excesiva en "${option.name}" (máximo ${MAX_OPTION_QUANTITY})`,
        { code: 'MODIFIER_QUANTITY' },
      )
    }

    chosen.push({
      groupId: group.externalId,
      groupName: group.name,
      optionId: option.externalId,
      optionName: option.name,
      price: option.price,
      quantity,
    })
    qtyByGroup.set(group.externalId, (qtyByGroup.get(group.externalId) || 0) + quantity)
  }

  // Mismas reglas que el front (ProductPage: missingRequired y toggleOption).
  for (const group of product.modifiers || []) {
    const total = qtyByGroup.get(group.externalId) || 0
    if (group.required && total < group.min) {
      throw new OrderError(
        `Elegí al menos ${group.min} opción(es) en "${group.name}" para ${product.name}`,
        { code: 'MODIFIER_MIN' },
      )
    }
    if (!group.allowQuantity && group.max > 0 && total > group.max) {
      throw new OrderError(
        `Máximo ${group.max} opción(es) en "${group.name}" para ${product.name}`,
        { code: 'MODIFIER_MAX' },
      )
    }
  }

  return chosen
}

/**
 * Valida el pedido y devuelve los importes calculados por el servidor.
 * @throws {OrderError}
 */
export function priceOrder({ restaurant, products, body }) {
  const settings = mergeSettings(restaurant.settings)
  const fulfillment = body.fulfillment === 'pickup' ? 'pickup' : 'delivery'

  // --- ¿el local está tomando pedidos? --------------------------------------
  if (settings.servicesPaused) {
    throw new OrderError('El local no está tomando pedidos en este momento', {
      status: 409,
      code: 'SERVICE_PAUSED',
    })
  }
  if (!restaurant.open) {
    throw new OrderError('El local está cerrado', { status: 409, code: 'CLOSED' })
  }
  if (fulfillment === 'delivery' && (restaurant.delivery === false || settings.deliveryEnabled === false)) {
    throw new OrderError('El delivery no está disponible', { status: 409, code: 'NO_DELIVERY' })
  }
  if (fulfillment === 'pickup' && (restaurant.takeaway === false || settings.pickupEnabled === false)) {
    throw new OrderError('El retiro en el local no está disponible', { status: 409, code: 'NO_PICKUP' })
  }

  // --- items ----------------------------------------------------------------
  const byId = new Map(products.map((p) => [p.id, p]))
  const items = body.items.map((raw) => {
    const product = byId.get(raw.productId)
    if (!product) {
      throw new OrderError('Hay un producto del pedido que ya no existe en el menú', {
        code: 'UNKNOWN_PRODUCT',
      })
    }
    if (product.available === false) {
      throw new OrderError(`"${product.name}" no está disponible`, { code: 'UNAVAILABLE_PRODUCT' })
    }

    const { unitPrice, sizeLabel } = unitPriceFor(product, raw.sizeLabel)
    const modifiers = resolveModifiers(product, raw.modifiers)
    const extras = modifiers.reduce((s, m) => s + m.price * m.quantity, 0)

    return {
      productId: product.id,
      name: product.name,
      quantity: raw.quantity,
      unitPrice,
      notes: raw.notes || '',
      modifiers,
      lineTotal: round2((unitPrice + extras) * raw.quantity),
      sizeLabel,
    }
  })

  const subtotal = round2(items.reduce((s, i) => s + i.lineTotal, 0))

  // --- envío (espeja MenuCartBridge + CartContext) ---------------------------
  const zones = activeZones(settings)
  let zone = null
  let deliveryFee = 0

  if (fulfillment === 'delivery' && subtotal > 0) {
    if (zones.length === 0) {
      deliveryFee = Math.max(0, Number(restaurant.deliveryFee) || 0)
    } else {
      zone = zones.find((z) => z.id === body.deliveryZoneId) || null
      if (!zone) {
        throw new OrderError('Elegí una zona de entrega válida', { code: 'ZONE_REQUIRED' })
      }
      deliveryFee = zoneDeliveryFee(zone)
    }
  }

  // --- mínimo de pedido (espeja CheckoutPage.validate) -----------------------
  if (fulfillment === 'delivery') {
    const minOrder = Math.max(0, Number(zone?.minOrder ?? restaurant.minOrder ?? 0) || 0)
    if (subtotal < minOrder) {
      throw new OrderError(`El mínimo de pedido para delivery es ${minOrder}`, {
        code: 'MIN_ORDER',
      })
    }
  }

  // --- descuento ------------------------------------------------------------
  const coupon = resolveCoupon(body.couponCode, settings)
  let discount = 0
  if (coupon) {
    discount =
      coupon.type === 'percent' ? round2(subtotal * (coupon.value / 100)) : round2(coupon.value)
    discount = Math.min(discount, subtotal)
  }

  const total = round2(Math.max(0, subtotal - discount + deliveryFee))

  return {
    fulfillment,
    items,
    subtotal,
    discount,
    deliveryFee,
    total,
    coupon: coupon ? coupon.code : '',
    zone: zone ? { id: zone.id, name: zone.name } : null,
  }
}
