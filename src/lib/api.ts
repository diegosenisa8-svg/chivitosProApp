import { cartLineTotal } from '../context/CartContext'
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

export async function submitOrder(
  lines: CartLine[],
  currency: string,
  checkout?: CheckoutInfo,
  extras?: { subtotal: number; discount: number; deliveryFee: number },
  customerToken?: string | null,
) {
  if (getApiBase() === null || !lines.length) return null

  const items = lines.map((line) => ({
    productId: line.itemId,
    name: line.name,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    notes: line.notes,
    modifiers: line.modifiers,
    lineTotal: cartLineTotal(line),
    sizeLabel: line.sizeLabel || '',
  }))

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
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
      schedule: checkout?.schedule || 'now',
      scheduleTime: checkout?.scheduleTime,
      subtotal: extras?.subtotal,
      discount: extras?.discount || 0,
      deliveryFee: extras?.deliveryFee || 0,
    }),
  })

  if (!res.ok) {
    throw new Error(`Order failed: ${res.status}`)
  }

  return res.json() as Promise<{ id: string; total: number; status: string }>
}

export async function payWithMercadoPago(body: {
  orderId: string
  token: string
  paymentMethodId: string
  issuerId?: string | number
  installments: number
  bin?: string
  payerEmail?: string
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
