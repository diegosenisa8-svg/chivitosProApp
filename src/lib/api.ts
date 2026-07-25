import { cartLineTotal } from '../context/CartContext'
import type { CartLine } from '../types'

const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export async function submitOrder(lines: CartLine[], currency: string) {
  if (!apiBase || !lines.length) return null

  const items = lines.map((line) => ({
    productId: line.itemId,
    name: line.name,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    notes: line.notes,
    modifiers: line.modifiers,
    lineTotal: cartLineTotal(line),
  }))

  const res = await fetch(`${apiBase}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currency, items }),
  })

  if (!res.ok) {
    throw new Error(`Order failed: ${res.status}`)
  }

  return res.json() as Promise<{ id: string; total: number; status: string }>
}
