import { apiUrl, getApiBase } from './apiBase'

export type CustomerOrderItem = {
  id: string
  productId: string
  name: string
  quantity: number
  unitPrice: number
  notes: string
  modifiers: unknown
  lineTotal: number
  sizeLabel?: string
}

export type CustomerOrder = {
  id: string
  status: string
  statusLabel: string
  customerName?: string | null
  phone?: string | null
  notes?: string | null
  fulfillment: string
  address?: string | null
  payment: string
  subtotal: number
  discount: number
  deliveryFee: number
  total: number
  createdAt: string
  items: CustomerOrderItem[]
}

export async function fetchMyOrders(token: string | null) {
  if (getApiBase() === null || !token) return []
  const res = await fetch(apiUrl('/api/me/orders'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json().catch(() => [])
  if (!res.ok) throw new Error(data.error || 'No se pudieron cargar pedidos')
  return data as CustomerOrder[]
}
