import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import path from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { z } from 'zod'
import { prisma } from './lib/prisma.js'
import { mapMenu } from './lib/menu.js'
import { hashPassword } from './lib/auth.js'
import { upsertCustomerFromOrder } from './lib/customers.js'
import { askAssistant } from './lib/assistant.js'
import {
  createMercadoPagoPayment,
  getMpCredentials,
  getPublicPaymentConfig,
  isBinBlocked,
  normalizeBin,
} from './lib/mercadopago.js'
import { mergeSettings } from './lib/settings.js'
import adminRoutes from './routes/admin.js'

const app = express()
const port = Number(process.env.PORT || 8080)
const uploadDir = path.join(process.cwd(), 'uploads')
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true })

const corsOrigin = process.env.CORS_ORIGIN || '*'
const allowedOrigins =
  corsOrigin === '*'
    ? []
    : corsOrigin.split(',').map((s) => s.trim()).filter(Boolean)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true)
      if (corsOrigin === '*') return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      // Túneles de desarrollo + Railway
      if (
        /\.ngrok-free\.dev$|\.ngrok-free\.app$|\.ngrok\.io$|\.trycloudflare\.com$|\.up\.railway\.app$/i.test(
          new URL(origin).hostname,
        )
      ) {
        return callback(null, true)
      }
      return callback(new Error(`CORS blocked: ${origin}`))
    },
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' }))
app.use('/uploads', express.static(uploadDir))

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'chivitos-pro-api' })
})

app.get('/', (_req, res) => {
  res.json({
    service: 'chivitos-pro-api',
    health: '/health',
    menu: '/api/menu',
    orders: '/api/orders',
    payments: '/api/payments',
    assistant: '/api/assistant/chat',
    admin: '/api/admin',
  })
})

app.use('/api/admin', adminRoutes)

app.get('/api/menu', async (_req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { id: 1 } })
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not seeded' })
    }

    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            modifiers: {
              include: { options: true },
            },
          },
        },
      },
    })

    res.json(mapMenu(restaurant, categories))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load menu' })
  }
})

const orderSchema = z.object({
  customerName: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  currency: z.string().default('UYU'),
  fulfillment: z.enum(['delivery', 'pickup']).default('delivery'),
  address: z.string().optional(),
  payment: z.string().default('efectivo'),
  schedule: z.enum(['now', 'later']).default('now'),
  scheduleTime: z.string().optional(),
  subtotal: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().default(0),
  deliveryFee: z.number().nonnegative().default(0),
  items: z
    .array(
      z.object({
        productId: z.string(),
        name: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
        notes: z.string().default(''),
        modifiers: z.array(z.any()).default([]),
        lineTotal: z.number().nonnegative(),
        sizeLabel: z.string().optional(),
      }),
    )
    .min(1),
})

app.post('/api/orders', async (req, res) => {
  try {
    const body = orderSchema.parse(req.body)
    const itemsTotal = body.items.reduce((s, i) => s + i.lineTotal, 0)
    const subtotal = body.subtotal ?? itemsTotal
    const total = Math.max(0, subtotal - (body.discount || 0) + (body.deliveryFee || 0))

    const order = await prisma.order.create({
      data: {
        customerName: body.customerName,
        phone: body.phone,
        notes: body.notes,
        currency: body.currency,
        fulfillment: body.fulfillment,
        address: body.address,
        payment: body.payment,
        schedule: body.schedule,
        scheduleTime: body.scheduleTime,
        subtotal,
        discount: body.discount || 0,
        deliveryFee: body.deliveryFee || 0,
        total,
        payload: body,
        items: {
          create: body.items.map((i) => ({
            productId: i.productId,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            notes: i.notes || '',
            modifiers: i.modifiers,
            lineTotal: i.lineTotal,
            sizeLabel: i.sizeLabel || '',
          })),
        },
      },
      include: { items: true },
    })

    try {
      await upsertCustomerFromOrder({
        name: body.customerName,
        phone: body.phone,
        orderedAt: order.createdAt,
      })
    } catch (e) {
      console.warn('Customer upsert failed', e)
    }

    res.status(201).json({ id: order.id, total: order.total, status: order.status })
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid order', details: err.issues })
    }
    console.error(err)
    res.status(500).json({ error: 'Failed to create order' })
  }
})

app.get('/api/payments/config', async (_req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { id: 1 } })
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' })
    res.json(getPublicPaymentConfig(restaurant.settings))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo cargar config de pagos' })
  }
})

app.post('/api/payments/mercadopago', async (req, res) => {
  try {
    const body = z
      .object({
        orderId: z.string().min(1),
        token: z.string().min(1),
        paymentMethodId: z.string().min(1),
        issuerId: z.union([z.string(), z.number()]).optional(),
        installments: z.number().int().positive().default(1),
        bin: z.string().optional(),
        payerEmail: z.string().email().optional(),
      })
      .parse(req.body)

    const restaurant = await prisma.restaurant.findUnique({ where: { id: 1 } })
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' })

    const settings = mergeSettings(restaurant.settings)
    const { configured } = getMpCredentials()
    if (!settings.paymentMethods?.mercadoPago || !configured) {
      return res.status(503).json({ error: 'Mercado Pago no está habilitado' })
    }

    const bin = normalizeBin(body.bin)
    if (isBinBlocked(bin, settings.mercadoPago.blockedBins)) {
      return res.status(403).json({
        error: 'BIN_BLOCKED',
        message: settings.mercadoPago.blockedMessage,
      })
    }

    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
      include: { items: true },
    })
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' })
    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'El pedido está cancelado' })
    }

    const payment = await createMercadoPagoPayment({
      token: body.token,
      transactionAmount: order.total,
      installments: body.installments,
      paymentMethodId: body.paymentMethodId,
      issuerId: body.issuerId,
      payerEmail: body.payerEmail || undefined,
      description: `Pedido ${order.id.slice(0, 8)} — ChivitosPro`,
      externalReference: order.id,
      bin,
    })

    const mpStatus = String(payment.status || '')
    const approved = mpStatus === 'approved'
    const pending = ['pending', 'in_process', 'in_mediation'].includes(mpStatus)

    const prevPayload =
      order.payload && typeof order.payload === 'object' && !Array.isArray(order.payload)
        ? order.payload
        : {}

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        payment: 'mercadopago',
        status: approved ? 'confirmed' : pending ? 'pending' : order.status,
        payload: {
          ...prevPayload,
          mercadoPago: {
            paymentId: payment.id,
            status: mpStatus,
            statusDetail: payment.status_detail,
            paymentMethodId: body.paymentMethodId,
            bin: bin || null,
          },
        },
      },
    })

    if (!approved && !pending) {
      return res.status(402).json({
        error: 'Pago rechazado',
        status: mpStatus,
        statusDetail: payment.status_detail,
        orderId: order.id,
        mpPaymentId: payment.id,
      })
    }

    res.json({
      orderId: updated.id,
      status: updated.status,
      mpPaymentId: payment.id,
      mpStatus,
      approved,
      pending,
    })
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos de pago inválidos', details: err.issues })
    }
    console.error('MP payment error', err)
    res.status(500).json({ error: err?.message || 'No se pudo procesar el pago' })
  }
})

app.post('/api/assistant/chat', async (req, res) => {
  try {
    const body = z
      .object({
        messages: z
          .array(
            z.object({
              role: z.enum(['user', 'assistant']),
              text: z.string().min(1).max(2000),
            }),
          )
          .min(1)
          .max(20),
      })
      .parse(req.body)

    const reply = await askAssistant(body.messages)
    res.json({ reply })
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Mensaje inválido' })
    }
    if (err?.code === 'NO_KEY') {
      return res.status(503).json({
        error: 'Asistente no configurado. Definí GEMINI_API_KEY en el backend.',
      })
    }
    console.error('Assistant error', err)
    res.status(500).json({ error: err?.message || 'No se pudo responder' })
  }
})

async function ensureAdmin() {
  // Siempre sincroniza email/clave desde env (arregla hashes inválidos o filas manuales)
  const email = (process.env.ADMIN_EMAIL || 'admin@chivitospro.com').toLowerCase()
  const password = process.env.ADMIN_PASSWORD || 'chivitos2026'
  const name = process.env.ADMIN_NAME || 'Admin ChivitosPro'
  const passwordHash = await hashPassword(password)
  await prisma.adminUser.upsert({
    where: { email },
    update: { name, passwordHash, role: 'admin' },
    create: { email, name, passwordHash, role: 'admin' },
  })
  console.log(`Admin sync OK: ${email}`)
}

async function ensureEmployee() {
  const email = (process.env.EMPLOYEE_EMAIL || 'empleado@chivitospro.com').toLowerCase()
  const password = process.env.EMPLOYEE_PASSWORD || 'empleado2026'
  const name = process.env.EMPLOYEE_NAME || 'Empleado ChivitosPro'
  const passwordHash = await hashPassword(password)
  await prisma.adminUser.upsert({
    where: { email },
    update: { name, passwordHash, role: 'empleado' },
    create: { email, name, passwordHash, role: 'empleado' },
  })
  console.log(`Employee sync OK: ${email}`)
}

Promise.all([ensureAdmin(), ensureEmployee()])
  .catch((err) => console.error('User bootstrap error', err))
  .finally(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`ChivitosPro API listening on 0.0.0.0:${port}`)
    })
  })
