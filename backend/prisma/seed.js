import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const __dirname = dirname(fileURLToPath(import.meta.url))
const force = process.argv.includes('--force')

function loadMenu() {
  const candidates = [
    join(__dirname, '../data/menu.json'),
    join(__dirname, '../../src/data/menu.json'),
  ]
  for (const path of candidates) {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf8'))
    }
  }
  throw new Error('menu.json not found')
}

async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@chivitospro.com').toLowerCase()
  const password = process.env.ADMIN_PASSWORD || 'chivitos2026'
  const name = process.env.ADMIN_NAME || 'Admin ChivitosPro'
  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.adminUser.upsert({
    where: { email },
    update: { name, passwordHash },
    create: { email, name, passwordHash },
  })
  console.log(`Admin OK: ${email} / ${password}`)
}

async function main() {
  await ensureAdmin()

  const existing = await prisma.category.count()
  if (existing > 0 && !force) {
    console.log('Seed skipped (menu already present). Use --force to reset.')
    return
  }

  const menu = loadMenu()
  const r = menu.restaurant

  if (force) {
    await prisma.orderItem.deleteMany()
    await prisma.order.deleteMany()
    await prisma.modifierOption.deleteMany()
    await prisma.modifierGroup.deleteMany()
    await prisma.product.deleteMany()
    await prisma.category.deleteMany()
  }

  const restaurantData = {
    name: r.name,
    address: r.address,
    city: r.city,
    country: r.country,
    open: r.open,
    distanceKm: r.distanceKm,
    delivery: r.delivery,
    takeaway: r.takeaway,
    currency: r.currency,
    whatsapp: r.whatsapp,
    logo: r.logo,
    hero: r.hero,
    mapEmbed: r.mapEmbed,
    lat: r.lat,
    lng: r.lng,
    hoursLabel: r.hoursLabel || 'Lun–Dom 11:30 a 00:00',
    etaMin: r.etaMin || 35,
    etaMax: r.etaMax || 55,
    deliveryFee: r.deliveryFee || 80,
    minOrder: r.minOrder || 250,
    phone: r.phone || '',
  }

  await prisma.restaurant.upsert({
    where: { id: 1 },
    update: restaurantData,
    create: { id: 1, ...restaurantData },
  })

  for (let ci = 0; ci < menu.categories.length; ci++) {
    const cat = menu.categories[ci]
    await prisma.category.create({
      data: {
        id: cat.id,
        name: cat.name,
        subtitle: cat.subtitle || '',
        banner: cat.banner,
        sortOrder: ci,
        items: {
          create: cat.items.map((item, pi) => ({
            id: item.id,
            name: item.name,
            description: item.description || '',
            price: item.price,
            priceMax: item.priceMax ?? null,
            image: item.image,
            sortOrder: pi,
            modifiers: item.modifiers
              ? {
                  create: item.modifiers.map((g) => ({
                    externalId: g.id,
                    name: g.name,
                    required: !!g.required,
                    min: g.min ?? 0,
                    max: g.max ?? 1,
                    allowQuantity: !!g.allowQuantity,
                    options: {
                      create: g.options.map((o) => ({
                        externalId: o.id,
                        name: o.name,
                        price: o.price,
                      })),
                    },
                  })),
                }
              : undefined,
          })),
        },
      },
    })
  }

  console.log(`Seed OK: ${menu.categories.length} categorías`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
