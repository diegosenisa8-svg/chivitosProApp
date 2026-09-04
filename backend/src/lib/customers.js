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
  const raw = String(phoneOrKey || '')
  // Claves sintéticas de cuentas sin teléfono (acct:…).
  if (raw.startsWith('acct:') || raw.startsWith('email:')) return null
  const key = normalizePhoneKey(raw)
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

/**
 * Alta/actualización en el CRM admin al crear o iniciar sesión con cuenta.
 * Si no hay teléfono, usa phoneKey sintético `acct:{id}` para que igual figure en el listado.
 */
export async function upsertCustomerFromAccount(account) {
  if (!account?.id || !account?.email) return null

  const email = String(account.email).trim().toLowerCase()
  const name = (account.name && String(account.name).trim()) || 'Cliente'
  const phone = (account.phone && String(account.phone).trim()) || ''
  const phoneKey = normalizePhoneKey(phone)
  const now = new Date()

  let existing = await prisma.customer.findFirst({
    where: { customerAccountId: account.id },
  })
  if (!existing && phoneKey.length >= 8) {
    existing = await prisma.customer.findUnique({ where: { phoneKey } })
  }
  if (!existing) {
    existing = await prisma.customer.findFirst({ where: { email } })
  }

  if (existing) {
    const data = {
      name,
      email,
      customerAccountId: account.id,
    }
    if (phoneKey.length >= 8) {
      data.phoneKey = phoneKey
      data.phone = phone || existing.phone
    }
    return prisma.customer.update({
      where: { id: existing.id },
      data,
    })
  }

  return prisma.customer.create({
    data: {
      phoneKey: phoneKey.length >= 8 ? phoneKey : `acct:${account.id}`,
      phone: phone || '—',
      name,
      email,
      customerAccountId: account.id,
      orderCount: 0,
      lastOrderAt: now,
    },
  })
}

/** Trae al CRM a todas las cuentas registradas que todavía no tienen fila Customer. */
export async function syncCustomersFromAccounts() {
  const accounts = await prisma.customerAccount.findMany({
    select: { id: true, email: true, name: true, phone: true },
  })
  for (const account of accounts) {
    await upsertCustomerFromAccount(account).catch((e) =>
      console.warn('customer from account', account.id, e?.message || e),
    )
  }
  return accounts.length
}

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

/** Resuelve el email de un Customer CRM (campo email o cuenta vinculada). */
export async function resolveCustomerEmail(customer) {
  if (customer?.email) return String(customer.email).trim().toLowerCase()
  if (!customer?.phoneKey) return null
  const map = await buildCustomerEmailByPhoneKey()
  return map.get(customer.phoneKey) || null
}

/** Import clients from existing orders (idempotent-ish: resets counts from history). */
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
