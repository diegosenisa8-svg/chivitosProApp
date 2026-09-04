import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import path from 'node:path'
import { getUploadDir, getMediaById } from './lib/uploads.js'
import { z } from 'zod'
import { prisma } from './lib/prisma.js'
import { mapMenu } from './lib/menu.js'
import { hashPassword, signPaymentToken, paymentTokenOrderId } from './lib/auth.js'
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
import { OrderError, priceOrder } from './lib/pricing.js'
import { PAYMENT_METHODS, zodDetails } from './lib/validation.js'
import {
  CUSTOMER_STATUS_LABELS,
  hashCustomerPassword,
  signCustomerToken,
  verifyCustomerPassword,
} from './lib/customerAuth.js'
import { optionalCustomer, requireCustomer } from './middleware/customerAuth.js'
import { checkRateLimit, resetRateLimit } from './lib/rateLimit.js'
import adminRoutes from './routes/admin.js'
import { importLibraryFromProducts } from './lib/modifierLibrary.js'

const app = express()
// Railway (y cualquier proxy delante) agrega X-Forwarded-For. Declarar el proxy
// hace que req.ip sea la IP real del cliente y no una cabecera que el propio
// cliente pueda inventar: de eso depende que el rate limit del login sirva.
app.set('trust proxy', 1)
app.disable('x-powered-by')

/**
 * Cabeceras de seguridad. Se hacen a mano en vez de sumar helmet para no tocar
 * las dependencias del servicio. public/_headers no cubre esto: ese formato lo
 * lee Cloudflare Pages y el despliegue real es Railway.
 */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  // Las imágenes del menú se sirven a un front que puede estar en otro dominio.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  }
  next()
})

const port = Number(process.env.PORT || 8080)
const uploadDir = getUploadDir()
console.log(`Uploads: ${uploadDir}`)

const corsOrigin = process.env.CORS_ORIGIN || '*'
const allowedOrigins =
  corsOrigin === '*'
    ? []
    : corsOrigin.split(',').map((s) => s.trim()).filter(Boolean)

app.use(
  cors({
    origin(origin, callback) {
      // Nunca tirar Error: cors lo convierte en HTTP 500
      if (!origin) return callback(null, true)
      if (corsOrigin === '*') return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      try {
        const host = new URL(origin).hostname
        if (
          host === 'localhost' ||
          host === '127.0.0.1' ||
          /\.ngrok-free\.dev$|\.ngrok-free\.app$|\.ngrok\.io$|\.trycloudflare\.com$|\.up\.railway\.app$/i.test(
            host,
          )
        ) {
          return callback(null, true)
        }
      } catch {
        /* ignore */
      }
      return callback(null, false)
    },
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' }))
app.use(
  '/uploads',
  express.static(uploadDir, {
    maxAge: '365d',
    immutable: true,
    fallthrough: true,
  }),
)
// Archivos viejos perdidos en redeploy: 404 silencioso (sin ENOENT en logs)
app.use('/uploads', (_req, res) => {
  res.status(404).end()
})

app.get('/api/media/:id', async (req, res) => {
  try {
    const file = await getMediaById(req.params.id)
    if (!file) return res.status(404).json({ error: 'Imagen no encontrada' })
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream')
    res.setHeader('Content-Length', String(file.size))
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.send(Buffer.from(file.data))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al servir imagen' })
  }
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'chivitos-pro-api' })
})

app.get('/', (_req, res) => {
  res.json({
    service: 'chivitos-pro-api',
    health: '/health',
    menu: '/api/menu',
    orders: '/api/orders',
    auth: '/api/auth',
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

/**
 * Lo que el cliente puede decir de su pedido: QUÉ pide, no CUÁNTO cuesta.
 * Los importes (unitPrice, lineTotal, subtotal, discount, deliveryFee, total)
 * los calcula el servidor en lib/pricing.js a partir de la base. Si un cliente
 * viejo todavía los manda, Zod los descarta silenciosamente.
 */
const orderSchema = z.object({
  customerName: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  notes: z.string().max(1000).optional(),
  currency: z.string().max(8).default('UYU'),
  fulfillment: z.enum(['delivery', 'pickup']).default('delivery'),
  address: z.string().max(400).optional(),
  payment: PAYMENT_METHODS.default('efectivo'),
  schedule: z.enum(['now', 'later']).default('now'),
  scheduleTime: z.string().max(40).optional(),
  couponCode: z.string().max(40).optional(),
  deliveryZoneId: z.string().max(60).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(120),
        quantity: z.number().int().positive().max(99),
        notes: z.string().max(500).default(''),
        sizeLabel: z.string().max(60).optional(),
        modifiers: z
          .array(
            z.object({
              groupId: z.string().min(1).max(120),
              optionId: z.string().min(1).max(120),
              quantity: z.number().int().positive().max(99).default(1),
            }),
          )
          .default([]),
      }),
    )
    .min(1)
    .max(60),
})

app.post('/api/auth/register', async (req, res) => {
  try {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(2),
        phone: z.string().min(8).optional(),
      })
      .parse(req.body)

    const email = body.email.trim().toLowerCase()
    const exists = await prisma.customerAccount.findUnique({ where: { email } })
    if (exists) {
      return res.status(409).json({ error: 'Ese email ya está registrado' })
    }

    const passwordHash = await hashCustomerPassword(body.password)
    const account = await prisma.customerAccount.create({
      data: {
        email,
        passwordHash,
        name: body.name.trim(),
        phone: (body.phone || '').trim(),
      },
    })

    const token = signCustomerToken(account)
    res.status(201).json({
      token,
      customer: {
        id: account.id,
        email: account.email,
        name: account.name,
        phone: account.phone,
      },
    })
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', ...zodDetails(err) })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo registrar' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(1),
      })
      .parse(req.body)

    const email = body.email.trim().toLowerCase()
    // req.ip es confiable gracias a `trust proxy`; leer la cabecera a mano
    // permitía saltear el límite mandando un X-Forwarded-For distinto cada vez.
    const ip = req.ip || 'unknown'
    const rlIp = checkRateLimit(`customer-login-ip:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 })
    const rl = checkRateLimit(`customer-login:${ip}:${email}`, { limit: 5, windowMs: 15 * 60 * 1000 })
    const blocked = !rlIp.ok ? rlIp : !rl.ok ? rl : null
    if (blocked) {
      res.setHeader('Retry-After', String(blocked.retryAfterSec))
      return res.status(429).json({
        error: `Demasiados intentos. Probá de nuevo en ${blocked.retryAfterSec}s`,
      })
    }

    const account = await prisma.customerAccount.findUnique({ where: { email } })
    if (!account) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' })
    }
    const ok = await verifyCustomerPassword(body.password, account.passwordHash)
    if (!ok) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' })
    }

    resetRateLimit(`customer-login:${ip}:${email}`)
    const token = signCustomerToken(account)
    res.json({
      token,
      customer: {
        id: account.id,
        email: account.email,
        name: account.name,
        phone: account.phone,
      },
    })
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos' })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo iniciar sesión' })
  }
})

app.get('/api/auth/me', requireCustomer, async (req, res) => {
  const account = await prisma.customerAccount.findUnique({ where: { id: req.customer.sub } })
  if (!account) return res.status(401).json({ error: 'Cuenta no encontrada' })
  res.json({
    id: account.id,
    email: account.email,
    name: account.name,
    phone: account.phone,
  })
})

app.patch('/api/auth/me', requireCustomer, async (req, res) => {
  try {
    const body = z
      .object({
        name: z.string().min(2).optional(),
        phone: z.string().optional(),
      })
      .parse(req.body)

    const account = await prisma.customerAccount.update({
      where: { id: req.customer.sub },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(body.phone != null ? { phone: body.phone.trim() } : {}),
      },
    })
    res.json({
      id: account.id,
      email: account.email,
      name: account.name,
      phone: account.phone,
    })
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos' })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo actualizar' })
  }
})

app.get('/api/me/orders', requireCustomer, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { customerAccountId: req.customer.sub },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { items: true },
    })
    res.json(
      orders.map((o) => ({
        ...o,
        statusLabel: CUSTOMER_STATUS_LABELS[o.status] || o.status,
      })),
    )
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudieron cargar tus pedidos' })
  }
})

app.get('/api/me/orders/:id', requireCustomer, async (req, res) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, customerAccountId: req.customer.sub },
      include: { items: true },
    })
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' })
    res.json({
      ...order,
      statusLabel: CUSTOMER_STATUS_LABELS[order.status] || order.status,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo cargar el pedido' })
  }
})

app.post('/api/orders', optionalCustomer, async (req, res) => {
  try {
    const body = orderSchema.parse(req.body)

    const restaurant = await prisma.restaurant.findUnique({ where: { id: 1 } })
    if (!restaurant) {
      return res.status(503).json({ error: 'El local no está configurado' })
    }

    // Los productos y sus modificadores salen de la base: son la única fuente
    // válida de precios. Lo que mande el cliente solo dice qué eligió.
    const productIds = [...new Set(body.items.map((i) => i.productId))]
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { modifiers: { include: { options: true } } },
    })

    const priced = priceOrder({ restaurant, products, body })

    let accountId = null
    let customerName = body.customerName
    let phone = body.phone
    if (req.customer?.sub) {
      const account = await prisma.customerAccount.findUnique({ where: { id: req.customer.sub } })
      if (account) {
        accountId = account.id
        customerName = customerName || account.name
        phone = phone || account.phone
      }
    }

    const order = await prisma.order.create({
      data: {
        customerName,
        phone,
        notes: body.notes,
        currency: body.currency,
        fulfillment: priced.fulfillment,
        address: priced.fulfillment === 'delivery' ? body.address : null,
        payment: body.payment,
        schedule: body.schedule,
        scheduleTime: body.scheduleTime,
        subtotal: priced.subtotal,
        discount: priced.discount,
        deliveryFee: priced.deliveryFee,
        total: priced.total,
        payload: {
          request: body,
          pricing: {
            subtotal: priced.subtotal,
            discount: priced.discount,
            deliveryFee: priced.deliveryFee,
            total: priced.total,
            coupon: priced.coupon,
            zone: priced.zone,
          },
        },
        customerAccountId: accountId,
        items: {
          create: priced.items.map((i) => ({
            productId: i.productId,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            notes: i.notes,
            modifiers: i.modifiers,
            lineTotal: i.lineTotal,
            sizeLabel: i.sizeLabel,
          })),
        },
      },
      include: { items: true },
    })

    try {
      await upsertCustomerFromOrder({
        name: customerName,
        phone,
        orderedAt: order.createdAt,
      })
    } catch (e) {
      console.warn('Customer upsert failed', e)
    }

    res.status(201).json({
      id: order.id,
      status: order.status,
      subtotal: order.subtotal,
      discount: order.discount,
      deliveryFee: order.deliveryFee,
      total: order.total,
      coupon: priced.coupon,
      // Habilita a pagar ESTE pedido durante los próximos 30 minutos.
      paymentToken: signPaymentToken(order.id),
    })
  } catch (err) {
    if (err instanceof OrderError) {
      return res.status(err.status).json({ error: err.message, code: err.code })
    }
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Pedido inválido', ...zodDetails(err) })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo crear el pedido' })
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

app.post('/api/payments/mercadopago', optionalCustomer, async (req, res) => {
  try {
    const body = z
      .object({
        orderId: z.string().min(1).max(64),
        token: z.string().min(1),
        paymentMethodId: z.string().min(1).max(60),
        issuerId: z.union([z.string(), z.number()]).optional(),
        installments: z.number().int().positive().max(24).default(1),
        bin: z.string().max(16).optional(),
        payerEmail: z.string().email().optional(),
        paymentToken: z.string().optional(),
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

    // Solo puede pagar quien creó el pedido: o bien es el dueño de la cuenta,
    // o bien presenta el token de pago que devolvió POST /api/orders. Sin esto,
    // cualquiera con un id de pedido podía operar sobre pedidos ajenos.
    const ownedByCustomer =
      Boolean(order.customerAccountId) && order.customerAccountId === req.customer?.sub
    const hasPaymentToken = paymentTokenOrderId(body.paymentToken) === order.id
    if (!ownedByCustomer && !hasPaymentToken) {
      return res.status(403).json({ error: 'No podés pagar este pedido' })
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'El pedido está cancelado' })
    }

    const previousMp =
      order.payload && typeof order.payload === 'object' ? order.payload.mercadoPago : null
    if (
      previousMp?.paymentId &&
      ['approved', 'pending', 'in_process', 'authorized'].includes(String(previousMp.status || ''))
    ) {
      return res.status(409).json({
        error: 'Este pedido ya tiene un pago registrado',
        status: previousMp.status,
      })
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
      return res.status(400).json({ error: 'Datos de pago inválidos', ...zodDetails(err) })
    }
    console.error('MP payment error', err)
    res.status(500).json({ error: err?.message || 'No se pudo procesar el pago' })
  }
})

app.post('/api/assistant/chat', async (req, res) => {
  try {
    // El asistente consume cuota de Gemini y arma el menú completo en cada
    // mensaje: sin límite, cualquiera podía vaciar la cuota con un bucle.
    const ip = req.ip || 'unknown'
    const rl = checkRateLimit(`assistant:${ip}`, { limit: 20, windowMs: 10 * 60 * 1000 })
    if (!rl.ok) {
      res.setHeader('Retry-After', String(rl.retryAfterSec))
      return res.status(429).json({
        error: `Estás yendo muy rápido. Probá de nuevo en ${rl.retryAfterSec}s`,
      })
    }

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

/**
 * Crea el usuario si no existe. NO pisa la contraseña de uno que ya existe:
 * antes se reescribía en cada arranque, así que cualquier cambio de contraseña
 * se revertía solo en el siguiente deploy.
 *
 * Única excepción (la red de seguridad que ya había): si la fila quedó con un
 * hash que no es bcrypt, se repara desde la variable de entorno.
 */
async function ensureUser({ email, password, name, role, label }) {
  const existing = await prisma.adminUser.findUnique({ where: { email } })

  if (!existing) {
    await prisma.adminUser.create({
      data: { email, name, role, passwordHash: await hashPassword(password) },
    })
    console.log(`${label} creado: ${email}`)
    return
  }

  if (!String(existing.passwordHash || '').startsWith('$2')) {
    await prisma.adminUser.update({
      where: { email },
      data: { role, passwordHash: await hashPassword(password) },
    })
    console.warn(`${label} ${email}: hash inválido reparado desde el entorno`)
    return
  }

  console.log(`${label} OK: ${email}`)
}

async function ensureAdmin() {
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
    console.warn(
      'WARN: ADMIN_PASSWORD no está definida. Si el admin todavía no existe se creará ' +
        'con la contraseña por defecto del código, que es pública. Definila en Railway.',
    )
  }
  await ensureUser({
    email: (process.env.ADMIN_EMAIL || 'admin@chivitospro.com').toLowerCase(),
    password: process.env.ADMIN_PASSWORD || 'chivitos2026',
    name: process.env.ADMIN_NAME || 'Admin ChivitosPro',
    role: 'admin',
    label: 'Admin',
  })
}

async function ensureEmployee() {
  await ensureUser({
    email: (process.env.EMPLOYEE_EMAIL || 'empleado@chivitospro.com').toLowerCase(),
    password: process.env.EMPLOYEE_PASSWORD || 'empleado2026',
    name: process.env.EMPLOYEE_NAME || 'Empleado ChivitosPro',
    role: 'empleado',
    label: 'Empleado',
  })
}

// Rutas de API inexistentes: 404 en JSON en vez del HTML por defecto de Express.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado' })
})

// Manejador de errores central. Registra el detalle del lado del servidor y
// nunca devuelve stack traces al cliente.
app.use((err, _req, res, _next) => {
  console.error('Unhandled error', err)
  if (res.headersSent) return
  res.status(500).json({ error: 'Error interno' })
})

Promise.all([
  ensureAdmin(),
  ensureEmployee(),
  // La biblioteca de extras se importaba desde un GET; ahora se hace una sola
  // vez al arrancar (la función sale temprano si ya hay grupos cargados).
  importLibraryFromProducts().catch((e) => console.warn('Library import skipped', e)),
])
  .catch((err) => console.error('User bootstrap error', err))
  .finally(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`ChivitosPro API listening on 0.0.0.0:${port}`)
    })
  })
