import type { CartLine, CheckoutInfo } from '../types'
import { apiUrl, getApiBase } from './apiBase'

export { getApiBase }

export type PaymentConfig = {
  enabled: boolean
  configured: boolean
  publicKey: string
  blockedBins: string[]
  blockedMessage: string
}

export async function fetchPaymentConfig() {
  if (getApiBase() === null) {
    return {
      enabled: false,
      configured: false,
      publicKey: '',
      blockedBins: [],
      blockedMessage: '',
    } satisfies PaymentConfig
  }
  const res = await fetch(apiUrl('/api/payments/config'))
  if (!res.ok) throw new Error('No se pudo cargar config de pagos')
  return res.json() as Promise<PaymentConfig>
}

export function isBinBlocked(bin: string, blockedBins: string[]) {
  const card = String(bin || '').replace(/\D/g, '')
  if (!card || card.length < 4) return false
  return blockedBins.some((blocked) => {
    const b = String(blocked || '').replace(/\D/g, '')
    if (b.length < 4) return false
    return card.startsWith(b)
  })
}

export type SubmittedOrder = {
  id: string
  status: string
  subtotal: number
  discount: number
  deliveryFee: number
  total: number
  coupon: string
  zone: { id: string; name: string } | null
  /** La ubicación cayó fuera de todas las zonas de reparto. */
  outOfRange: boolean
  /** Autoriza a pagar este pedido durante 30 minutos. */
  paymentToken: string
}

/**
 * Envía QUÉ se pidió, no cuánto cuesta: los precios, el descuento y el envío
 * los calcula y devuelve el backend a partir de la base (backend/src/lib/pricing.js).
 * Los totales que se muestran en pantalla son una previsualización.
 */
export async function submitOrder(
  lines: CartLine[],
  currency: string,
  checkout?: CheckoutInfo,
  extras?: { couponCode?: string; idempotencyKey?: string },
  customerToken?: string | null,
) {
  if (getApiBase() === null || !lines.length) return null

  const items = lines.map((line) => ({
    productId: line.itemId,
    quantity: line.quantity,
    notes: line.notes,
    sizeLabel: line.sizeLabel || '',
    modifiers: line.modifiers.map((m) => ({
      groupId: m.groupId,
      optionId: m.optionId,
      quantity: m.quantity,
    })),
  }))

  const idempotencyKey =
    extras?.idempotencyKey ||
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `ord-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
  }
  if (customerToken) headers.Authorization = `Bearer ${customerToken}`

  const res = await fetch(apiUrl('/api/orders'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      currency,
      items,
      customerName: checkout?.name,
      phone: checkout?.phone,
      notes: checkout?.notes,
      fulfillment: checkout?.fulfillment || 'delivery',
      address: checkout?.address,
      payment: checkout?.payment || 'efectivo',
      cashTendered:
        checkout?.payment === 'efectivo' && checkout?.cashTendered != null
          ? Number(checkout.cashTendered)
          : undefined,
      schedule: checkout?.schedule || 'now',
      scheduleTime: checkout?.scheduleTime,
      couponCode: extras?.couponCode || '',
      idempotencyKey,
      // La zona la resuelve el servidor desde la ubicación.
      location: checkout?.location || undefined,
      addressDetail: (() => {
        const num = String(checkout?.addressDetail || '').trim()
        const apt = String(checkout?.addressApartment || '').trim()
        return [num, apt ? `apto ${apt}` : ''].filter(Boolean).join(', ')
      })(),
      addressReference: checkout?.addressReference || '',
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `No se pudo registrar el pedido (${res.status})`)
  }

  return data as SubmittedOrder
}

export async function payWithMercadoPago(body: {
  orderId: string
  token: string
  paymentMethodId: string
  issuerId?: string | number
  installments: number
  bin?: string
  payerEmail?: string
  paymentToken?: string
}) {
  const res = await fetch(apiUrl('/api/payments/mercadopago'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || data.error || `Pago falló (${res.status})`) as Error & {
      code?: string
    }
    err.code = data.error === 'BIN_BLOCKED' ? 'BIN_BLOCKED' : 'MP_PAY'
    throw err
  }
  return data as {
    orderId: string
    status: string
    mpPaymentId: number | string
    mpStatus: string
    approved: boolean
    pending: boolean
  }
}
