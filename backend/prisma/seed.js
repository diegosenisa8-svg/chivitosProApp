import { PrismaClient } from '@prisma/client'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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

async function main() {
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

  await prisma.restaurant.upsert({
    where: { id: 1 },
    update: {
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
    },
    create: {
      id: 1,
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
    },
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
