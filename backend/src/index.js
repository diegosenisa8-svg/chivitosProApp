import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { z } from 'zod'
import { prisma } from './lib/prisma.js'
import { mapMenu } from './lib/menu.js'
import { hashPassword } from './lib/auth.js'
import adminRoutes from './routes/admin.js'

const app = express()
const port = Number(process.env.PORT || 8080)

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

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'chivitos-pro-api' })
})

app.get('/', (_req, res) => {
  res.json({
    service: 'chivitos-pro-api',
    health: '/health',
    menu: '/api/menu',
    orders: '/api/orders',
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

    res.status(201).json({ id: order.id, total: order.total, status: order.status })
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid order', details: err.issues })
    }
    console.error(err)
    res.status(500).json({ error: 'Failed to create order' })
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
    update: { name, passwordHash },
    create: { email, name, passwordHash },
  })
  console.log(`Admin sync OK: ${email}`)
}

ensureAdmin()
  .catch((err) => console.error('Admin bootstrap error', err))
  .finally(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`ChivitosPro API listening on 0.0.0.0:${port}`)
    })
  })
