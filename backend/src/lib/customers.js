import { prisma } from './prisma.js'

/** Digits for wa.me — Uruguay default country 598 when local mobile. */
export function normalizePhoneKey(raw) {
  if (!raw) return ''
  let digits = String(raw).replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 9 && digits.startsWith('09')) {
    digits = `598${digits.slice(1)}`
  } else if (digits.length === 8 && digits.startsWith('9')) {
    digits = `598${digits}`
  } else if (digits.length === 9 && digits.startsWith('9')) {
    digits = `598${digits}`
  }
  return digits
}

export function whatsappUrlForPhone(phoneOrKey) {
  const key = normalizePhoneKey(phoneOrKey)
  return key ? `https://wa.me/${key}` : null
}

export async function upsertCustomerFromOrder({ name, phone, orderedAt = new Date() }) {
  const phoneKey = normalizePhoneKey(phone)
  if (!phoneKey || phoneKey.length < 8) return null

  const displayName = (name && String(name).trim()) || 'Cliente'
  const phoneDisplay = String(phone).trim() || phoneKey

  return prisma.customer.upsert({
    where: { phoneKey },
    create: {
      phoneKey,
      phone: phoneDisplay,
      name: displayName,
      orderCount: 1,
      lastOrderAt: orderedAt,
    },
    update: {
      name: displayName,
      phone: phoneDisplay,
      lastOrderAt: orderedAt,
      orderCount: { increment: 1 },
    },
  })
}

/** Import clients from existing orders (idempotent-ish: resets counts from history). */
/**
 * Mapa phoneKey → email de cuenta registrada.
 * Prioridad: CustomerAccount.phone normalizado; si falta, orders con customerAccount.
 */
export async function buildCustomerEmailByPhoneKey() {
  const map = new Map()

  const accounts = await prisma.customerAccount.findMany({
    select: { email: true, phone: true },
  })
  for (const account of accounts) {
    const key = normalizePhoneKey(account.phone)
    if (key && account.email) map.set(key, account.email)
  }

  const orders = await prisma.order.findMany({
    where: {
      customerAccountId: { not: null },
      phone: { not: null },
    },
    select: {
      phone: true,
      customerAccount: { select: { email: true } },
    },
  })
  for (const order of orders) {
    const key = normalizePhoneKey(order.phone)
    const email = order.customerAccount?.email
    if (key && email && !map.has(key)) map.set(key, email)
  }

  return map
}

/** Resuelve el email de un Customer CRM (solo si tiene cuenta / pedidos vinculados). */
export async function resolveCustomerEmail(customer) {
  if (!customer?.phoneKey) return null
  const map = await buildCustomerEmailByPhoneKey()
  return map.get(customer.phoneKey) || null
}

export async function syncCustomersFromOrders() {
  const orders = await prisma.order.findMany({
    where: {
      phone: { not: null },
    },
    select: { phone: true, customerName: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const byKey = new Map()
  for (const o of orders) {
    const phoneKey = normalizePhoneKey(o.phone)
    if (!phoneKey || phoneKey.length < 8) continue
    const prev = byKey.get(phoneKey)
    const name = (o.customerName && o.customerName.trim()) || prev?.name || 'Cliente'
    const phone = String(o.phone).trim() || phoneKey
    if (!prev) {
      byKey.set(phoneKey, {
        phoneKey,
        phone,
        name,
        orderCount: 1,
        lastOrderAt: o.createdAt,
      })
    } else {
      prev.orderCount += 1
      prev.lastOrderAt = o.createdAt
      prev.phone = phone
      if (o.customerName?.trim()) prev.name = o.customerName.trim()
    }
  }

  for (const row of byKey.values()) {
    await prisma.customer.upsert({
      where: { phoneKey: row.phoneKey },
      create: row,
      update: {
        phone: row.phone,
        name: row.name,
        orderCount: row.orderCount,
        lastOrderAt: row.lastOrderAt,
      },
    })
  }

  return byKey.size
}
