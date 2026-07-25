import cors from 'cors'
import express from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()
const app = express()
const port = Number(process.env.PORT || 8080)

const corsOrigin = process.env.CORS_ORIGIN || '*'
app.use(
  cors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((s) => s.trim()),
  }),
)
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'chivitos-pro-api' })
})

app.get('/', (_req, res) => {
  res.json({
    service: 'chivitos-pro-api',
    health: '/health',
    menu: '/api/menu',
    orders: '/api/orders',
  })
})

function mapMenu(restaurant, categories) {
  return {
    restaurant: {
      name: restaurant.name,
      address: restaurant.address,
      city: restaurant.city,
      country: restaurant.country,
      open: restaurant.open,
      distanceKm: restaurant.distanceKm,
      delivery: restaurant.delivery,
      takeaway: restaurant.takeaway,
      currency: restaurant.currency,
      whatsapp: restaurant.whatsapp,
      logo: restaurant.logo,
      hero: restaurant.hero,
      mapEmbed: restaurant.mapEmbed,
      lat: restaurant.lat,
      lng: restaurant.lng,
    },
    categories: categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      subtitle: cat.subtitle,
      banner: cat.banner,
      items: cat.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        ...(item.priceMax != null ? { priceMax: item.priceMax } : {}),
        image: item.image,
        ...(item.modifiers.length
          ? {
              modifiers: item.modifiers.map((g) => ({
                id: g.externalId,
                name: g.name,
                required: g.required,
                min: g.min,
                max: g.max,
                ...(g.allowQuantity ? { allowQuantity: true } : {}),
                options: g.options.map((o) => ({
                  id: o.externalId,
                  name: o.name,
                  price: o.price,
                })),
              })),
            }
          : {}),
      })),
    })),
  }
}

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
      }),
    )
    .min(1),
})

app.post('/api/orders', async (req, res) => {
  try {
    const body = orderSchema.parse(req.body)
    const total = body.items.reduce((s, i) => s + i.lineTotal, 0)

    const order = await prisma.order.create({
      data: {
        customerName: body.customerName,
        phone: body.phone,
        notes: body.notes,
        currency: body.currency,
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

app.get('/api/orders', async (_req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { items: true },
    })
    res.json(orders)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to list orders' })
  }
})

app.listen(port, () => {
  console.log(`ChivitosPro API on :${port}`)
})
