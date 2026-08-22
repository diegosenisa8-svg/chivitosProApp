import { Router } from 'express'
import multer from 'multer'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { hashPassword, signToken, verifyPassword } from '../lib/auth.js'
import { requireAdmin, requireFullAdmin } from '../middleware/auth.js'
import { mapMenu } from '../lib/menu.js'
import { mergeSettings, slugify } from '../lib/settings.js'
import { syncCustomersFromOrders, whatsappUrlForPhone } from '../lib/customers.js'
import { getMpCredentials } from '../lib/mercadopago.js'
import { loadBundledMenu, replaceMenuCatalog } from '../lib/replaceMenu.js'
import { checkRateLimit, resetRateLimit } from '../lib/rateLimit.js'

const router = Router()

const uploadDir = path.join(process.cwd(), 'uploads')
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg'
      const safe = ext.match(/^\.(jpe?g|png|webp|gif)$/) ? ext : '.jpg'
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safe}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) {
      cb(new Error('Solo imágenes JPG, PNG, WEBP o GIF'))
      return
    }
    cb(null, true)
  },
})

router.post('/upload', requireAdmin, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Error al subir imagen' })
    }
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' })
    res.status(201).json({
      url: `/uploads/${req.file.filename}`,
      filename: req.file.filename,
      size: req.file.size,
    })
  })
})

router.post('/login', async (req, res) => {
  try {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(4),
      })
      .parse(req.body)

    const email = body.email.trim().toLowerCase()
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip || 'unknown'
    const rl = checkRateLimit(`admin-login:${ip}:${email}`, { limit: 5, windowMs: 15 * 60 * 1000 })
    if (!rl.ok) {
      res.setHeader('Retry-After', String(rl.retryAfterSec))
      return res.status(429).json({
        error: `Demasiados intentos. Probá de nuevo en ${rl.retryAfterSec}s`,
      })
    }

    const password = body.password
    const admin = await prisma.adminUser.findUnique({ where: { email } })
    if (!admin) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' })
    }
    const hash = String(admin.passwordHash || '')
    // Hash bcrypt válido empieza con $2; si no, la fila está mal (ej. texto plano)
    const ok =
      hash.startsWith('$2') && (await verifyPassword(password, hash).catch(() => false))
    if (!ok) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' })
    }

    resetRateLimit(`admin-login:${ip}:${email}`)
    const token = signToken(admin)
    res.json({
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    })
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', details: err.issues })
    }
    console.error(err)
    res.status(500).json({ error: 'Error de login' })
  }
})

router.get('/me', requireAdmin, async (req, res) => {
  const admin = await prisma.adminUser.findUnique({ where: { id: req.admin.sub } })
  if (!admin) return res.status(401).json({ error: 'No autorizado' })
  res.json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role })
})

router.get('/dashboard', requireFullAdmin, async (_req, res) => {
  try {
    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)
    const startOfWeek = new Date(startOfDay)
    startOfWeek.setDate(startOfWeek.getDate() - 6)

    const counted = { in: ['confirmed', 'preparing', 'ready', 'delivering', 'delivered'] }
    const [todayOrders, weekOrders, allRecent, byStatus, products] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: startOfDay }, status: counted },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: startOfWeek }, status: counted },
        include: { items: true },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { items: true },
      }),
      prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.product.count(),
    ])

    const salesToday = todayOrders.reduce((s, o) => s + o.total, 0)
    const salesWeek = weekOrders.reduce((s, o) => s + o.total, 0)
    const avgTicket = weekOrders.length ? salesWeek / weekOrders.length : 0

    const productSales = new Map()
    for (const order of weekOrders) {
      for (const item of order.items) {
        const prev = productSales.get(item.name) || { name: item.name, qty: 0, revenue: 0 }
        prev.qty += item.quantity
        prev.revenue += item.lineTotal
        productSales.set(item.name, prev)
      }
    }
    const topProducts = [...productSales.values()]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8)

    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(startOfDay)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      days.push({ date: key, sales: 0, orders: 0 })
    }
    for (const order of weekOrders) {
      const key = order.createdAt.toISOString().slice(0, 10)
      const bucket = days.find((d) => d.date === key)
      if (bucket) {
        bucket.sales += order.total
        bucket.orders += 1
      }
    }

    const openOrders = await prisma.order.count({
      where: { status: { in: ['pending', 'confirmed', 'preparing', 'ready', 'delivering'] } },
    })

    res.json({
      kpis: {
        salesToday,
        salesWeek,
        ordersToday: todayOrders.length,
        ordersWeek: weekOrders.length,
        avgTicket,
        openOrders,
        products,
      },
      salesByDay: days,
      statusBreakdown: byStatus.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
      topProducts,
      recentOrders: allRecent,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar dashboard' })
  }
})

router.get('/menu', requireAdmin, async (_req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { id: 1 } })
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { modifiers: { include: { options: true } } },
        },
      },
    })
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' })
    res.json(mapMenu(restaurant, categories, { includeUnavailable: true }))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar menú' })
  }
})

router.patch('/restaurant', requireFullAdmin, async (req, res) => {
  try {
    const body = z
      .object({
        open: z.boolean().optional(),
        name: z.string().optional(),
        address: z.string().optional(),
        whatsapp: z.string().optional(),
        hoursLabel: z.string().optional(),
        etaMin: z.number().int().optional(),
        etaMax: z.number().int().optional(),
        deliveryFee: z.number().optional(),
        minOrder: z.number().optional(),
        phone: z.string().optional(),
        delivery: z.boolean().optional(),
        takeaway: z.boolean().optional(),
        settings: z.record(z.string(), z.any()).optional(),
      })
      .parse(req.body)

    const current = await prisma.restaurant.findUnique({ where: { id: 1 } })
    const data = { ...body }
    if (body.settings) {
      data.settings = mergeSettings({
        ...mergeSettings(current?.settings),
        ...body.settings,
        paymentMethods: {
          ...mergeSettings(current?.settings).paymentMethods,
          ...(body.settings.paymentMethods || {}),
        },
        mercadoPago: {
          ...mergeSettings(current?.settings).mercadoPago,
          ...(body.settings.mercadoPago || {}),
        },
        taxes: {
          ...mergeSettings(current?.settings).taxes,
          ...(body.settings.taxes || {}),
        },
        marketing: {
          ...mergeSettings(current?.settings).marketing,
          ...(body.settings.marketing || {}),
        },
        publish: {
          ...mergeSettings(current?.settings).publish,
          ...(body.settings.publish || {}),
        },
      })
    }

    const restaurant = await prisma.restaurant.update({
      where: { id: 1 },
      data,
    })
    res.json({
      ...restaurant,
      settings: mergeSettings(restaurant.settings),
    })
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', details: err.issues })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo actualizar el local' })
  }
})

router.get('/settings', requireFullAdmin, async (_req, res) => {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: 1 } })
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' })
  res.json(mergeSettings(restaurant.settings))
})

router.get('/payments/mercadopago-status', requireFullAdmin, async (_req, res) => {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: 1 } })
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' })
  const settings = mergeSettings(restaurant.settings)
  const creds = getMpCredentials()
  res.json({
    enabled: Boolean(settings.paymentMethods?.mercadoPago),
    configured: creds.configured,
    hasPublicKey: Boolean(creds.publicKey),
    hasAccessToken: Boolean(creds.accessToken),
    blockedBins: settings.mercadoPago?.blockedBins || [],
    blockedMessage: settings.mercadoPago?.blockedMessage || '',
  })
})

router.patch('/products/:id', requireAdmin, async (req, res) => {
  try {
    const body = z
      .object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        price: z.number().nonnegative().optional(),
        priceMax: z.number().nonnegative().nullable().optional(),
        image: z.string().min(1).optional(),
        available: z.boolean().optional(),
        featured: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      })
      .parse(req.body)

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: body,
      include: { category: true },
    })
    res.json(product)
  } catch (err) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Producto no encontrado' })
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', details: err.issues })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo actualizar el producto' })
  }
})

router.post('/products', requireAdmin, async (req, res) => {
  try {
    const body = z
      .object({
        id: z.string().min(1).optional(),
        categoryId: z.string().min(1),
        name: z.string().min(1),
        description: z.string().default(''),
        price: z.number().nonnegative(),
        priceMax: z.number().nonnegative().nullable().optional(),
        image: z.string().min(1).default('/logo.png'),
        available: z.boolean().default(true),
        featured: z.boolean().default(false),
      })
      .parse(req.body)

    const id = body.id || `${slugify(body.name) || 'producto'}-${Date.now().toString(36)}`
    const count = await prisma.product.count({ where: { categoryId: body.categoryId } })
    const product = await prisma.product.create({
      data: { ...body, id, sortOrder: count },
    })
    res.status(201).json(product)
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', details: err.issues })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo crear el producto' })
  }
})

router.delete('/products/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Producto no encontrado' })
    console.error(err)
    res.status(500).json({ error: 'No se pudo eliminar el producto' })
  }
})

router.post('/categories', requireAdmin, async (req, res) => {
  try {
    const body = z
      .object({
        id: z.string().min(1).optional(),
        name: z.string().min(1),
        subtitle: z.string().default(''),
        banner: z.string().default('/hero.png'),
      })
      .parse(req.body)
    const id = body.id || slugify(body.name) || `cat-${Date.now().toString(36)}`
    const count = await prisma.category.count()
    const category = await prisma.category.create({
      data: { id, name: body.name, subtitle: body.subtitle, banner: body.banner, sortOrder: count },
    })
    res.status(201).json(category)
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', details: err.issues })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo crear la categoría' })
  }
})

router.patch('/categories/:id', requireAdmin, async (req, res) => {
  try {
    const body = z
      .object({
        name: z.string().min(1).optional(),
        subtitle: z.string().optional(),
        banner: z.string().optional(),
        sortOrder: z.number().int().optional(),
      })
      .parse(req.body)
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: body,
    })
    res.json(category)
  } catch (err) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Categoría no encontrada' })
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', details: err.issues })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo actualizar la categoría' })
  }
})

router.delete('/categories/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Categoría no encontrada' })
    console.error(err)
    res.status(500).json({ error: 'No se pudo eliminar la categoría' })
  }
})

/** Reemplaza todo el menú con el catálogo embebido (TuMenuWeb). Borra pedidos. */
router.post('/menu/replace-catalog', requireAdmin, async (req, res) => {
  try {
    const confirm = String(req.body?.confirm || '')
    if (confirm !== 'REEMPLAZAR') {
      return res.status(400).json({
        error: 'Confirmá enviando { "confirm": "REEMPLAZAR" }. Esto borra menú y pedidos.',
      })
    }
    const { path, menu } = loadBundledMenu()
    const result = await replaceMenuCatalog(menu, { wipeOrders: true })
    const mapped = await mapMenu()
    res.json({
      ok: true,
      source: path,
      ...result,
      menu: mapped,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'No se pudo reemplazar el menú' })
  }
})

router.post('/reorder', requireAdmin, async (req, res) => {
  try {
    const body = z
      .object({
        categories: z.array(z.object({ id: z.string(), sortOrder: z.number().int() })).optional(),
        products: z
          .array(
            z.object({
              id: z.string(),
              sortOrder: z.number().int(),
              categoryId: z.string().optional(),
            }),
          )
          .optional(),
      })
      .parse(req.body)

    await prisma.$transaction([
      ...(body.categories || []).map((c) =>
        prisma.category.update({ where: { id: c.id }, data: { sortOrder: c.sortOrder } }),
      ),
      ...(body.products || []).map((p) =>
        prisma.product.update({
          where: { id: p.id },
          data: {
            sortOrder: p.sortOrder,
            ...(p.categoryId ? { categoryId: p.categoryId } : {}),
          },
        }),
      ),
    ])
    res.json({ ok: true })
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', details: err.issues })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo reordenar' })
  }
})

router.put('/products/:id/modifiers', requireAdmin, async (req, res) => {
  try {
    const body = z
      .object({
        modifiers: z.array(
          z.object({
            id: z.string().min(1),
            name: z.string().min(1),
            required: z.boolean().default(false),
            min: z.number().int().default(0),
            max: z.number().int().default(1),
            allowQuantity: z.boolean().optional(),
            options: z.array(
              z.object({
                id: z.string().min(1),
                name: z.string().min(1),
                price: z.number().default(0),
              }),
            ),
          }),
        ),
      })
      .parse(req.body)

    const productId = req.params.id
    await prisma.modifierGroup.deleteMany({ where: { productId } })
    for (const g of body.modifiers) {
      await prisma.modifierGroup.create({
        data: {
          externalId: g.id,
          name: g.name,
          required: g.required,
          min: g.min,
          max: g.max,
          allowQuantity: !!g.allowQuantity,
          productId,
          options: {
            create: g.options.map((o) => ({
              externalId: o.id,
              name: o.name,
              price: o.price,
            })),
          },
        },
      })
    }
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { modifiers: { include: { options: true } } },
    })
    res.json(product)
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', details: err.issues })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudieron guardar los modifiers' })
  }
})

router.get('/modifier-library', requireAdmin, async (_req, res) => {
  try {
    const groups = await prisma.modifierGroup.findMany({
      include: { options: true, product: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    })
    const byKey = new Map()
    for (const g of groups) {
      const key = g.externalId || g.name
      const prev = byKey.get(key) || {
        id: g.externalId,
        name: g.name,
        required: g.required,
        min: g.min,
        max: g.max,
        allowQuantity: g.allowQuantity,
        options: g.options.map((o) => ({ id: o.externalId, name: o.name, price: o.price })),
        usedBy: [],
      }
      prev.usedBy.push({ id: g.product.id, name: g.product.name })
      byKey.set(key, prev)
    }
    res.json([...byKey.values()])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar biblioteca de extras' })
  }
})

router.get('/reports', requireFullAdmin, async (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 90)
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - (days - 1))

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: since },
        status: { in: ['confirmed', 'preparing', 'ready', 'delivering', 'delivered'] },
      },
      include: { items: true },
    })

    const byFulfillment = { delivery: 0, pickup: 0 }
    const byPayment = {}
    const byDay = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(since)
      d.setDate(since.getDate() + (days - 1 - i))
      byDay.push({ date: d.toISOString().slice(0, 10), sales: 0, orders: 0 })
    }
    for (const o of orders) {
      byFulfillment[o.fulfillment === 'delivery' ? 'delivery' : 'pickup'] += 1
      byPayment[o.payment] = (byPayment[o.payment] || 0) + 1
      const key = o.createdAt.toISOString().slice(0, 10)
      const bucket = byDay.find((d) => d.date === key)
      if (bucket) {
        bucket.sales += o.total
        bucket.orders += 1
      }
    }
    const productSales = new Map()
    for (const o of orders) {
      for (const item of o.items) {
        const prev = productSales.get(item.name) || { name: item.name, qty: 0, revenue: 0 }
        prev.qty += item.quantity
        prev.revenue += item.lineTotal
        productSales.set(item.name, prev)
      }
    }

    res.json({
      days,
      totals: {
        sales: orders.reduce((s, o) => s + o.total, 0),
        orders: orders.length,
        avgTicket: orders.length
          ? orders.reduce((s, o) => s + o.total, 0) / orders.length
          : 0,
      },
      byFulfillment,
      byPayment,
      byDay,
      topProducts: [...productSales.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 15),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar reportes' })
  }
})

router.get('/customers', requireFullAdmin, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    await syncCustomersFromOrders().catch((e) => console.warn('customer sync', e))

    const customers = await prisma.customer.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
              { phoneKey: { contains: q.replace(/\D/g, ''), mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { lastOrderAt: 'desc' },
    })

    res.json(
      customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        phoneKey: c.phoneKey,
        orderCount: c.orderCount,
        lastOrderAt: c.lastOrderAt,
        whatsappUrl: whatsappUrlForPhone(c.phoneKey),
      })),
    )
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudieron cargar clientes' })
  }
})

router.get('/orders', requireAdmin, async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const take = Math.min(Number(req.query.take) || 100, 300)

    const orders = await prisma.order.findMany({
      where: {
        ...(status && status !== 'all' ? { status } : {}),
        ...(q
          ? {
              OR: [
                { customerName: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
                { id: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: { items: true },
    })
    res.json(orders)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar pedidos' })
  }
})

router.get('/orders/:id', requireAdmin, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    })
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' })
    res.json(order)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar pedido' })
  }
})

router.patch('/orders/:id', requireAdmin, async (req, res) => {
  try {
    const body = z
      .object({
        status: z
          .enum([
            'pending',
            'confirmed',
            'preparing',
            'ready',
            'delivering',
            'delivered',
            'cancelled',
          ])
          .optional(),
        notes: z.string().optional(),
        customerName: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().nullable().optional(),
        payment: z.string().optional(),
        fulfillment: z.string().optional(),
      })
      .parse(req.body)

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: body,
      include: { items: true },
    })
    res.json(order)
  } catch (err) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Pedido no encontrado' })
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', details: err.issues })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo actualizar el pedido' })
  }
})

router.post('/bootstrap', async (req, res) => {
  try {
    const existing = await prisma.adminUser.count()
    if (existing > 0) {
      return res.status(400).json({ error: 'Ya existe un admin' })
    }
    const email = (process.env.ADMIN_EMAIL || 'admin@chivitospro.com').toLowerCase()
    const password = process.env.ADMIN_PASSWORD || 'chivitos2026'
    const name = process.env.ADMIN_NAME || 'Admin ChivitosPro'
    const passwordHash = await hashPassword(password)
    const admin = await prisma.adminUser.create({
      data: { email, name, passwordHash },
    })
    res.status(201).json({ id: admin.id, email: admin.email, password })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Bootstrap falló' })
  }
})

/** Resetea admin/empleado a env cuando el body.secret coincide con JWT_SECRET. */
router.post('/sync-users', async (req, res) => {
  try {
    const secret = String(req.body?.secret || '')
    const expected = process.env.JWT_SECRET || ''
    if (!expected || secret !== expected) {
      return res.status(401).json({ error: 'Secret inválido' })
    }
    const email = (process.env.ADMIN_EMAIL || 'admin@chivitospro.com').toLowerCase()
    const password = process.env.ADMIN_PASSWORD || 'chivitos2026'
    const name = process.env.ADMIN_NAME || 'Admin ChivitosPro'
    const passwordHash = await hashPassword(password)
    const admin = await prisma.adminUser.upsert({
      where: { email },
      update: { name, passwordHash, role: 'admin' },
      create: { email, name, passwordHash, role: 'admin' },
    })
    const empEmail = (process.env.EMPLOYEE_EMAIL || 'empleado@chivitospro.com').toLowerCase()
    const empPassword = process.env.EMPLOYEE_PASSWORD || 'empleado2026'
    const empName = process.env.EMPLOYEE_NAME || 'Empleado ChivitosPro'
    const empHash = await hashPassword(empPassword)
    await prisma.adminUser.upsert({
      where: { email: empEmail },
      update: { name: empName, passwordHash: empHash, role: 'empleado' },
      create: { email: empEmail, name: empName, passwordHash: empHash, role: 'empleado' },
    })
    // También fuerza el email canónico documentado por si ADMIN_EMAIL apunta a otro
    if (email !== 'admin@chivitospro.com') {
      const canonHash = await hashPassword(password)
      await prisma.adminUser.upsert({
        where: { email: 'admin@chivitospro.com' },
        update: { name, passwordHash: canonHash, role: 'admin' },
        create: { email: 'admin@chivitospro.com', name, passwordHash: canonHash, role: 'admin' },
      })
    }
    res.json({ ok: true, admin: admin.email })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Sync falló' })
  }
})

export default router
