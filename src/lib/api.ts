import { cartLineTotal } from '../context/CartContext'
import type { CartLine, CheckoutInfo } from '../types'
import { apiUrl, getApiBase } from './apiBase'

export { getApiBase }

export async function submitOrder(
  lines: CartLine[],
  currency: string,
  checkout?: CheckoutInfo,
  extras?: { subtotal: number; discount: number; deliveryFee: number },
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

  const res = await fetch(apiUrl('/api/orders'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
