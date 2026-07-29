import type { MenuData } from '../types'
import { apiUrl, getApiBase } from './apiBase'

const TOKEN_KEY = 'chivitos-admin-token'

export type AdminUser = {
  id: string
  email: string
  name: string
  role: string
}

export type DashboardData = {
  kpis: {
    salesToday: number
    salesWeek: number
    ordersToday: number
    ordersWeek: number
    avgTicket: number
    openOrders: number
    products: number
  }
  salesByDay: { date: string; sales: number; orders: number }[]
  statusBreakdown: { status: string; count: number }[]
  topProducts: { name: string; qty: number; revenue: number }[]
  recentOrders: AdminOrder[]
}

export type AdminOrder = {
  id: string
  status: string
  customerName?: string | null
  phone?: string | null
  notes?: string | null
  fulfillment: string
  address?: string | null
  payment: string
  schedule: string
  scheduleTime?: string | null
  subtotal: number
  discount: number
  deliveryFee: number
  total: number
  currency: string
  createdAt: string
  updatedAt: string
  items: {
    id: string
    productId: string
    name: string
    quantity: number
    unitPrice: number
    notes: string
    modifiers: unknown
    lineTotal: number
    sizeLabel?: string
  }[]
}

export type AdminProduct = {
  id: string
  name: string
  description: string
  price: number
  priceMax?: number | null
  image: string
  available: boolean
  featured?: boolean
  categoryId?: string
  category?: { id: string; name: string }
}

export function getAdminToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setAdminToken(token: string | null) {
  if (!token) sessionStorage.removeItem(TOKEN_KEY)
  else sessionStorage.setItem(TOKEN_KEY, token)
}

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (getApiBase() === null) throw new Error('API deshabilitada')
  const token = getAdminToken()
  const headers = new Headers(init.headers || {})
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(apiUrl(`/api/admin${path}`), { ...init, headers })
  const text = await res.text()
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error(
      'La API no respondió JSON. Configurá API_URL en el servicio web (Railway) apuntando al back.',
    )
  }
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`)
  }
  return data as T
}

export async function adminLogin(email: string, password: string) {
  const data = await adminFetch<{ token: string; admin: AdminUser }>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (!data?.token || !data?.admin) {
    throw new Error('Login inválido: la API no devolvió token')
  }
  setAdminToken(data.token)
  return data.admin
}

export async function adminMe() {
  return adminFetch<AdminUser>('/me')
}

export async function fetchDashboard() {
  return adminFetch<DashboardData>('/dashboard')
}

export async function fetchAdminMenu() {
  return adminFetch<MenuData>('/menu')
}

export async function updateRestaurant(patch: Record<string, unknown>) {
  return adminFetch('/restaurant', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function updateProduct(id: string, patch: Record<string, unknown>) {
  return adminFetch<AdminProduct>(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function createProduct(body: Record<string, unknown>) {
  return adminFetch<AdminProduct>('/products', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function uploadImage(file: File) {
  if (getApiBase() === null) throw new Error('API deshabilitada')
  const token = getAdminToken()
  const form = new FormData()
  form.append('file', file)
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(apiUrl('/api/admin/upload'), { method: 'POST', headers, body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data as { url: string; filename: string; size: number }
}

export async function deleteProduct(id: string) {
  return adminFetch<{ ok: boolean }>(`/products/${id}`, { method: 'DELETE' })
}

export async function createCategory(body: Record<string, unknown>) {
  return adminFetch('/categories', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateCategory(id: string, patch: Record<string, unknown>) {
  return adminFetch(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteCategory(id: string) {
  return adminFetch<{ ok: boolean }>(`/categories/${id}`, { method: 'DELETE' })
}

export async function reorderMenu(body: {
  categories?: { id: string; sortOrder: number }[]
  products?: { id: string; sortOrder: number; categoryId?: string }[]
}) {
  return adminFetch('/reorder', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function saveProductModifiers(
  productId: string,
  modifiers: Array<{
    id: string
    name: string
    required: boolean
    min: number
    max: number
    allowQuantity?: boolean
    options: { id: string; name: string; price: number }[]
  }>,
) {
  return adminFetch(`/products/${productId}/modifiers`, {
    method: 'PUT',
    body: JSON.stringify({ modifiers }),
  })
}

export async function fetchModifierLibrary() {
  return adminFetch<
    {
      id: string
      name: string
      required: boolean
      min: number
      max: number
      allowQuantity?: boolean
      options: { id: string; name: string; price: number }[]
      usedBy: { id: string; name: string }[]
    }[]
  >('/modifier-library')
}

export async function fetchReports(days = 30) {
  return adminFetch<{
    days: number
    totals: { sales: number; orders: number; avgTicket: number }
    byFulfillment: { delivery: number; pickup: number }
    byPayment: Record<string, number>
    byDay: { date: string; sales: number; orders: number }[]
    topProducts: { name: string; qty: number; revenue: number }[]
  }>(`/reports?days=${days}`)
}

export async function fetchSettings() {
  return adminFetch<Record<string, unknown>>('/settings')
}

export async function fetchAdminOrders(params: { status?: string; q?: string } = {}) {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.q) qs.set('q', params.q)
  const query = qs.toString()
  return adminFetch<AdminOrder[]>(`/orders${query ? `?${query}` : ''}`)
}

export async function updateOrder(id: string, patch: Record<string, unknown>) {
  return adminFetch<AdminOrder>(`/orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export type AdminCustomer = {
  id: string
  name: string
  phone: string
  phoneKey: string
  orderCount: number
  lastOrderAt: string
  whatsappUrl: string | null
}

export async function fetchCustomers(q = '') {
  const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
  return adminFetch<AdminCustomer[]>(`/customers${qs}`)
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'En preparación',
  ready: 'Listo',
  delivering: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

export const ORDER_STATUS_FLOW = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'delivering',
  'delivered',
]
