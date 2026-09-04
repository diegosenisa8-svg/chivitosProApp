import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { saveMediaBuffer } from '../lib/uploads.js'
import { prisma } from '../lib/prisma.js'
import { hashPassword, signToken, verifyPassword } from '../lib/auth.js'
import { requireAdmin, requireFullAdmin } from '../middleware/auth.js'
import { mapMenu } from '../lib/menu.js'
import { mergeSettings, slugify } from '../lib/settings.js'
import {
  buildCustomerEmailByPhoneKey,
  resolveCustomerEmail,
  syncCustomersFromAccounts,
  syncCustomersFromOrders,
  whatsappUrlForPhone,
} from '../lib/customers.js'
import { isMailConfigured, sendEmail } from '../lib/mail.js'
import { getMpCredentials } from '../lib/mercadopago.js'
import { loadBundledMenu, replaceMenuCatalog } from '../lib/replaceMenu.js'
import {
  applyCategoryAssignmentsToProduct,
  applyLibraryGroupToProduct,
  buildLibraryResponse,
  deleteLibraryGroupEverywhere,
  importLibraryFromProducts,
  propagateLibraryGroupUpdate,
  removeLibraryGroupFromProduct,
  syncCategoryLibraryGroup,
  unsyncCategoryLibraryGroup,
} from '../lib/modifierLibrary.js'
import { checkRateLimit, clientIp, resetRateLimit } from '../lib/rateLimit.js'
import { startOfDayInTimeZone, addLocalDays, localDateKey } from '../lib/timezone.js'
import {
  FULFILLMENT,
  ORDER_STATUS,
  PAYMENT_METHODS,
  RESOURCE_ID,
  canTransition,
  prismaHttpError,
  zodDetails,
} from '../lib/validation.js'

const MAX_PRODUCT_PRICE = 1_000_000

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) {
      cb(new Error('Solo imágenes JPG, PNG, WEBP o GIF'))
      return
    }
    cb(null, true)
  },
})

router.post('/upload', requireFullAdmin, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Error al subir imagen' })
    }
    if (!req.file?.buffer) return res.status(400).json({ error: 'No se recibió archivo' })
    try {
      const saved = await saveMediaBuffer({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
      })
      res.status(201).json({
        url: saved.url,
        filename: saved.filename,
        size: saved.size,
        id: saved.id,
      })
    } catch (e) {
      if (e?.code === 'EMPTY_FILE' || e?.code === 'INVALID_IMAGE') {
        return res.status(400).json({ error: e.message })
      }
      console.error(e)
      res.status(500).json({ error: 'No se pudo guardar la imagen' })
    }
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
    // Última entrada de X-Forwarded-For (Railway); contador en Postgres entre réplicas.
    const ip = clientIp(req)
    const rlIp = await checkRateLimit(`admin-login-ip:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 })
    const rl = await checkRateLimit(`admin-login:${ip}:${email}`, { limit: 5, windowMs: 15 * 60 * 1000 })
    if (rlIp.unavailable || rl.unavailable) {
      return res.status(503).json({ error: 'Servicio de seguridad temporalmente no disponible. Probá de nuevo.' })
    }
    const blocked = !rlIp.ok ? rlIp : !rl.ok ? rl : null
    if (blocked) {
      res.setHeader('Retry-After', String(blocked.retryAfterSec))
      return res.status(429).json({
        error: `Demasiados intentos. Probá de nuevo en ${blocked.retryAfterSec}s`,
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

    await resetRateLimit(`admin-login:${ip}:${email}`)
    const token = signToken(admin)
    res.json({
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    })
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', ...zodDetails(err) })
    }
    console.error(err)
    res.status(500).json({ error: 'Error de login' })
  }
})

/**
 * Cambio de contraseña. Incrementar tokenVersion invalida cualquier sesión
 * abierta con la contraseña vieja; se devuelve un token nuevo para no cortar la
 * sesión de quien acaba de cambiarla.
 */
router.post('/change-password', requireAdmin, async (req, res) => {
  try {
    const body = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8).max(200),
      })
      .parse(req.body)

    const admin = await prisma.adminUser.findUnique({ where: { id: req.admin.sub } })
    if (!admin) return res.status(401).json({ error: 'No autorizado' })

    const hash = String(admin.passwordHash || '')
    const ok =
      hash.startsWith('$2') && (await verifyPassword(body.currentPassword, hash).catch(() => false))
    if (!ok) return res.status(401).json({ error: 'La contraseña actual no es correcta' })

    const updated = await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        passwordHash: await hashPassword(body.newPassword),
        tokenVersion: { increment: 1 },
      },
    })

    res.json({
      ok: true,
      token: signToken(updated),
      admin: { id: updated.id, email: updated.email, name: updated.name, role: updated.role },
    })
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({
        error: 'La contraseña nueva debe tener al menos 8 caracteres',
        ...zodDetails(err),
      })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo cambiar la contraseña' })
  }
})

router.get('/me', requireAdmin, async (req, res) => {
  const admin = await prisma.adminUser.findUnique({ where: { id: req.admin.sub } })
  if (!admin) return res.status(401).json({ error: 'No autorizado' })
  res.json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role })
})

router.get('/dashboard', requireFullAdmin, async (_req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { id: 1 } })
    const settings = mergeSettings(restaurant?.settings)
    const tz = settings.timezone || 'America/Montevideo'
    const now = new Date()
    const startOfDay = startOfDayInTimeZone(now, tz)
    const startOfWeek = addLocalDays(startOfDay, -6, tz)

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
      const d = addLocalDays(startOfDay, -i, tz)
      days.push({ date: localDateKey(d, tz), sales: 0, orders: 0 })
    }
    for (const order of weekOrders) {
      const key = localDateKey(order.createdAt, tz)
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
      timezone: tz,
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
    const assignments = await prisma.categoryModifierAssignment.findMany({
      include: { libraryGroup: { select: { id: true, name: true } } },
    })
    const groupsByCategory = new Map()
    for (const a of assignments) {
      const list = groupsByCategory.get(a.categoryId) || []
      list.push({ id: a.libraryGroup.id, name: a.libraryGroup.name })
      groupsByCategory.set(a.categoryId, list)
    }
    const menu = mapMenu(restaurant, categories, { includeUnavailable: true, fullSettings: true })
    menu.categories = menu.categories.map((c) => ({
      ...c,
      modifierGroups: groupsByCategory.get(c.id) || [],
    }))
    res.json(menu)
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
        lat: z.number().optional(),
        lng: z.number().optional(),
        mapEmbed: z.string().optional(),
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
      return res.status(400).json({ error: 'Datos inválidos', ...zodDetails(err) })
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
        name: z.string().min(1).max(160).optional(),
        description: z.string().max(2000).optional(),
        price: z.number().nonnegative().max(MAX_PRODUCT_PRICE).optional(),
        priceMax: z.number().nonnegative().max(MAX_PRODUCT_PRICE).nullable().optional(),
        image: z.string().min(1).max(500).optional(),
        available: z.boolean().optional(),
        featured: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      })
      .parse(req.body)

    // El empleado puede marcar un producto como disponible o sin stock (es la
    // acción que ya usa desde "Configuración del menú"), pero no editar precios,
    // nombres ni imágenes: eso es del admin.
    if (req.admin?.role !== 'admin') {
      const otros = Object.keys(body).filter((k) => k !== 'available')
      if (otros.length > 0) {
        return res.status(403).json({
          error: 'Como empleado solo podés marcar productos como disponibles o sin stock',
        })
      }
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: body,
      include: { category: true },
    })
    res.json(product)
  } catch (err) {
    const mapped = prismaHttpError(err, { notFound: 'Producto no encontrado' })
    if (mapped) return res.status(mapped.status).json(mapped.body)
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', ...zodDetails(err) })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo actualizar el producto' })
  }
})

router.post('/products', requireFullAdmin, async (req, res) => {
  try {
    const body = z
      .object({
        id: RESOURCE_ID.optional(),
        categoryId: z.string().min(1).max(64),
        name: z.string().min(1).max(160),
        description: z.string().max(2000).default(''),
        price: z.number().nonnegative().max(MAX_PRODUCT_PRICE),
        priceMax: z.number().nonnegative().max(MAX_PRODUCT_PRICE).nullable().optional(),
        image: z.string().min(1).max(500).default('/logo.png'),
        available: z.boolean().default(true),
        featured: z.boolean().default(false),
      })
      .parse(req.body)

    const category = await prisma.category.findUnique({ where: { id: body.categoryId } })
    if (!category) return res.status(400).json({ error: 'La categoría no existe' })

    const id = body.id || `${slugify(body.name) || 'producto'}-${Date.now().toString(36)}`
    const count = await prisma.product.count({ where: { categoryId: body.categoryId } })
    const product = await prisma.product.create({
      data: { ...body, id, sortOrder: count },
    })
    await applyCategoryAssignmentsToProduct(body.categoryId, product.id)
    const withModifiers = await prisma.product.findUnique({
      where: { id: product.id },
      include: { modifiers: { include: { options: true } } },
    })
    res.status(201).json(withModifiers)
  } catch (err) {
    const mapped = prismaHttpError(err, {
      conflict: 'Ya existe un producto con ese identificador',
      badRef: 'La categoría no existe',
    })
    if (mapped) return res.status(mapped.status).json(mapped.body)
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', ...zodDetails(err) })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo crear el producto' })
  }
})

router.delete('/products/:id', requireFullAdmin, async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Producto no encontrado' })
    console.error(err)
    res.status(500).json({ error: 'No se pudo eliminar el producto' })
  }
})

router.post('/categories', requireFullAdmin, async (req, res) => {
  try {
    const body = z
      .object({
        id: RESOURCE_ID.optional(),
        name: z.string().min(1).max(120),
        subtitle: z.string().max(300).default(''),
        banner: z.string().max(500).default('/hero.png'),
      })
      .parse(req.body)
    const id = body.id || slugify(body.name) || `cat-${Date.now().toString(36)}`
    const count = await prisma.category.count()
    const category = await prisma.category.create({
      data: { id, name: body.name, subtitle: body.subtitle, banner: body.banner, sortOrder: count },
    })
    res.status(201).json(category)
  } catch (err) {
    const mapped = prismaHttpError(err, {
      conflict: 'Ya existe una categoría con ese identificador',
    })
    if (mapped) return res.status(mapped.status).json(mapped.body)
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', ...zodDetails(err) })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo crear la categoría' })
  }
})

router.patch('/categories/:id', requireFullAdmin, async (req, res) => {
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
      return res.status(400).json({ error: 'Datos inválidos', ...zodDetails(err) })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo actualizar la categoría' })
  }
})

router.delete('/categories/:id', requireFullAdmin, async (req, res) => {
  try {
    // Borrar una categoría arrastra sus productos (onDelete: Cascade). Que eso
    // pase tiene que ser una decisión explícita, no un efecto colateral.
    const products = await prisma.product.count({ where: { categoryId: req.params.id } })
    if (products > 0 && req.query.cascade !== 'true') {
      return res.status(409).json({
        error: `La categoría tiene ${products} producto(s). Confirmá que querés eliminarlos también.`,
        code: 'CATEGORY_NOT_EMPTY',
        products,
      })
    }

    await prisma.category.delete({ where: { id: req.params.id } })
    res.json({ ok: true, deletedProducts: products })
  } catch (err) {
    const mapped = prismaHttpError(err, { notFound: 'Categoría no encontrada' })
    if (mapped) return res.status(mapped.status).json(mapped.body)
    console.error(err)
    res.status(500).json({ error: 'No se pudo eliminar la categoría' })
  }
})

/** Reemplaza todo el menú con el catálogo embebido (TuMenuWeb). Borra pedidos. */
router.post('/menu/replace-catalog', requireFullAdmin, async (req, res) => {
  try {
    const confirm = String(req.body?.confirm || '')
    if (confirm !== 'REEMPLAZAR') {
      return res.status(400).json({
        error: 'Confirmá enviando { "confirm": "REEMPLAZAR" }. Esto borra menú y pedidos.',
      })
    }
    const { path, menu } = loadBundledMenu()
    const result = await replaceMenuCatalog(menu, { wipeOrders: true })
    await importLibraryFromProducts()
    res.json({
      ok: true,
      source: path,
      ...result,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'No se pudo reemplazar el menú' })
  }
})

router.post('/reorder', requireFullAdmin, async (req, res) => {
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
      return res.status(400).json({ error: 'Datos inválidos', ...zodDetails(err) })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo reordenar' })
  }
})

router.put('/products/:id/modifiers', requireFullAdmin, async (req, res) => {
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
    const exists = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } })
    if (!exists) return res.status(404).json({ error: 'Producto no encontrado' })

    // Borrar y recrear en una transacción: si falla a mitad de camino, el
    // producto se quedaba sin ningún modificador.
    await prisma.$transaction(async (tx) => {
      await tx.modifierGroup.deleteMany({ where: { productId } })
      for (const g of body.modifiers) {
        await tx.modifierGroup.create({
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
    })

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { modifiers: { include: { options: true } } },
    })
    res.json(product)
  } catch (err) {
    const mapped = prismaHttpError(err, { notFound: 'Producto no encontrado' })
    if (mapped) return res.status(mapped.status).json(mapped.body)
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', ...zodDetails(err) })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudieron guardar los modifiers' })
  }
})

router.get('/modifier-library', requireAdmin, async (_req, res) => {
  try {
    // Solo lectura: la importación inicial corre al arrancar el servidor y
    // después de reemplazar el catálogo. Un GET no debería escribir en la base.
    res.json(await buildLibraryResponse())
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar biblioteca de extras' })
  }
})

/** Reconstruye la biblioteca a partir de los modificadores ya cargados en productos. */
router.post('/modifier-library/import', requireFullAdmin, async (_req, res) => {
  try {
    await importLibraryFromProducts()
    res.json(await buildLibraryResponse())
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo importar la biblioteca' })
  }
})

const libraryGroupBody = z.object({
  name: z.string().min(1),
  required: z.boolean().default(false),
  min: z.number().int().default(0),
  max: z.number().int().default(1),
  allowQuantity: z.boolean().optional(),
  options: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1),
      price: z.number().default(0),
    }),
  ),
})

router.post('/modifier-library', requireFullAdmin, async (req, res) => {
  try {
    const body = libraryGroupBody.parse(req.body)
    const group = await prisma.modifierLibraryGroup.create({
      data: {
        name: body.name.trim(),
        required: body.required,
        min: body.min,
        max: body.max,
        allowQuantity: !!body.allowQuantity,
        options: {
          create: body.options.map((o, i) => ({
            name: o.name.trim(),
            price: o.price,
            sortOrder: i,
          })),
        },
      },
      include: { options: { orderBy: { sortOrder: 'asc' } }, categories: { include: { category: true } } },
    })
    res.status(201).json({
      id: group.id,
      name: group.name,
      required: group.required,
      min: group.min,
      max: group.max,
      allowQuantity: group.allowQuantity,
      sortOrder: group.sortOrder,
      options: group.options.map((o) => ({ id: o.id, name: o.name, price: o.price })),
      usedByCategories: [],
      usedByProducts: [],
    })
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', ...zodDetails(err) })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo crear el grupo' })
  }
})

router.put('/modifier-library/:id', requireFullAdmin, async (req, res) => {
  try {
    const body = libraryGroupBody.parse(req.body)
    const id = req.params.id
    const existing = await prisma.modifierLibraryGroup.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Grupo no encontrado' })

    const group = await prisma.$transaction(async (tx) => {
      await tx.modifierLibraryOption.deleteMany({ where: { groupId: id } })
      return tx.modifierLibraryGroup.update({
        where: { id },
        data: {
          name: body.name.trim(),
          required: body.required,
          min: body.min,
          max: body.max,
          allowQuantity: !!body.allowQuantity,
          options: {
            create: body.options.map((o, i) => ({
              ...(o.id ? { id: o.id } : {}),
              name: o.name.trim(),
              price: o.price,
              sortOrder: i,
            })),
          },
        },
        include: {
          options: { orderBy: { sortOrder: 'asc' } },
          categories: { include: { category: true } },
        },
      })
    })

    await propagateLibraryGroupUpdate(id)
    const library = await buildLibraryResponse()
    const updated = library.find((g) => g.id === id)
    res.json(updated || group)
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', ...zodDetails(err) })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo actualizar el grupo' })
  }
})

router.delete('/modifier-library/:id', requireFullAdmin, async (req, res) => {
  try {
    const id = req.params.id
    const existing = await prisma.modifierLibraryGroup.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Grupo no encontrado' })
    await deleteLibraryGroupEverywhere(id)
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo eliminar el grupo' })
  }
})

router.post('/categories/:categoryId/modifier-groups/:libraryGroupId', requireFullAdmin, async (req, res) => {
  try {
    const { categoryId, libraryGroupId } = req.params
    const category = await prisma.category.findUnique({ where: { id: categoryId } })
    if (!category) return res.status(404).json({ error: 'Categoría no encontrada' })
    await syncCategoryLibraryGroup(categoryId, libraryGroupId)
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'No se pudo asignar el grupo' })
  }
})

router.delete('/categories/:categoryId/modifier-groups/:libraryGroupId', requireFullAdmin, async (req, res) => {
  try {
    const { categoryId, libraryGroupId } = req.params
    await unsyncCategoryLibraryGroup(categoryId, libraryGroupId)
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo quitar el grupo de la categoría' })
  }
})

router.post('/products/:productId/modifier-groups/:libraryGroupId', requireFullAdmin, async (req, res) => {
  try {
    const { productId, libraryGroupId } = req.params
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' })
    const libraryGroup = await prisma.modifierLibraryGroup.findUnique({
      where: { id: libraryGroupId },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!libraryGroup) return res.status(404).json({ error: 'Grupo no encontrado' })
    await applyLibraryGroupToProduct(productId, libraryGroup)
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo asignar el grupo al producto' })
  }
})

router.delete('/products/:productId/modifier-groups/:libraryGroupId', requireFullAdmin, async (req, res) => {
  try {
    const { productId, libraryGroupId } = req.params
    await removeLibraryGroupFromProduct(productId, libraryGroupId)
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo quitar el grupo del producto' })
  }
})

router.get('/reports', requireFullAdmin, async (req, res) => {
  try {
    const days = z.coerce.number().int().min(1).max(90).catch(30).parse(req.query.days)
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
    await syncCustomersFromAccounts().catch((e) => console.warn('account sync', e))

    const [customers, emailByPhone] = await Promise.all([
      prisma.customer.findMany({
        where: q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
                { phoneKey: { contains: q.replace(/\D/g, ''), mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : undefined,
        orderBy: { lastOrderAt: 'desc' },
      }),
      buildCustomerEmailByPhoneKey(),
    ])

    res.json(
      customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone === '—' ? '' : c.phone,
        phoneKey: c.phoneKey,
        orderCount: c.orderCount,
        lastOrderAt: c.lastOrderAt,
        whatsappUrl: whatsappUrlForPhone(c.phoneKey),
        email: c.email || emailByPhone.get(c.phoneKey) || null,
      })),
    )
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudieron cargar clientes' })
  }
})

/**
 * Envía un mensaje de texto al email de la cuenta del cliente (si está registrado).
 * El destinatario NO viene del body: se resuelve en el servidor.
 */
router.post('/customers/:id/send-email', requireFullAdmin, async (req, res) => {
  try {
    if (!isMailConfigured()) {
      return res.status(503).json({
        error:
          'Correo no configurado. Definí BREVO_API_KEY + BREVO_SENDER_EMAIL (o RESEND_API_KEY + RESEND_FROM) en el servidor.',
      })
    }

    const id = RESOURCE_ID.parse(req.params.id)
    const adminId = req.admin?.id || 'unknown'
    const rl = await checkRateLimit(`admin-customer-mail:${adminId}`, {
      limit: 20,
      windowMs: 15 * 60 * 1000,
    })
    if (!rl.ok) {
      return res.status(429).json({
        error: `Demasiados envíos. Probá de nuevo en ${rl.retryAfterSec}s.`,
      })
    }

    const body = z
      .object({
        subject: z.string().trim().min(1).max(160).optional(),
        message: z.string().trim().min(1).max(5000),
      })
      .parse(req.body)

    const customer = await prisma.customer.findUnique({ where: { id } })
    if (!customer) {
      return res.status(404).json({ error: 'Cliente no encontrado' })
    }

    const to = await resolveCustomerEmail(customer)
    if (!to) {
      return res.status(400).json({
        error:
          'Este cliente no tiene email: no hay cuenta registrada vinculada a su teléfono.',
      })
    }

    const restaurant = await prisma.restaurant.findUnique({ where: { id: 1 } })
    const brand = restaurant?.name?.trim() || 'ChivitosPro'
    const subject = body.subject || `Mensaje de ${brand}`
    const greeting = customer.name?.trim() ? `Hola ${customer.name.trim()},` : 'Hola,'
    const text = `${greeting}\n\n${body.message}\n\n— ${brand}`

    console.info(`Enviando mail a cliente ${customer.id} → ${to} (${text.length} chars)`)
    await sendEmail({ to, subject, text })

    res.json({ ok: true, enviadoA: to })
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', ...zodDetails(err) })
    }
    console.error(err)
    res.status(500).json({ error: err.message || 'No se pudo enviar el correo' })
  }
})

router.get('/orders', requireAdmin, async (req, res) => {
  try {
    const status = ORDER_STATUS.optional().catch(undefined).parse(req.query.status)
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : ''
    const take = z.coerce.number().int().min(1).max(300).catch(100).parse(req.query.take)

    const orders = await prisma.order.findMany({
      where: {
        ...(status ? { status } : {}),
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
        // Mismos enums que al crear el pedido: antes payment y fulfillment eran
        // strings libres acá, y un valor cualquiera ensuciaba los reportes.
        status: ORDER_STATUS.optional(),
        notes: z.string().max(1000).optional(),
        customerName: z.string().max(120).optional(),
        phone: z.string().max(40).optional(),
        address: z.string().max(400).nullable().optional(),
        payment: PAYMENT_METHODS.optional(),
        fulfillment: FULFILLMENT.optional(),
      })
      .parse(req.body)

    if (body.status) {
      const current = await prisma.order.findUnique({
        where: { id: req.params.id },
        select: { status: true },
      })
      if (!current) return res.status(404).json({ error: 'Pedido no encontrado' })
      if (!canTransition(current.status, body.status)) {
        return res.status(409).json({
          error: `No se puede pasar un pedido de "${current.status}" a "${body.status}"`,
          code: 'INVALID_TRANSITION',
        })
      }
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: body,
      include: { items: true },
    })
    res.json(order)
  } catch (err) {
    const mapped = prismaHttpError(err, { notFound: 'Pedido no encontrado' })
    if (mapped) return res.status(mapped.status).json(mapped.body)
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', ...zodDetails(err) })
    }
    console.error(err)
    res.status(500).json({ error: 'No se pudo actualizar el pedido' })
  }
})

// Eliminados: POST /bootstrap y POST /sync-users.
// Eran endpoints publicos sin autenticacion: el primero devolvia la contraseña del
// admin en la respuesta y el segundo reseteaba admin y empleado comparando un
// campo del body contra JWT_SECRET, lo que permitia adivinar por HTTP el secreto
// que firma todos los tokens. Para recuperar un admin roto, usar un script de
// mantenimiento desde la consola del servidor, no una ruta HTTP.

export default router
