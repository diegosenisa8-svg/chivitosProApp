import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from './prisma.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function loadBundledMenu() {
  const candidates = [
    join(process.cwd(), 'data/menu.json'),
    join(process.cwd(), 'backend/data/menu.json'),
    join(__dirname, '../../data/menu.json'),
    join(__dirname, '../../../src/data/menu.json'),
  ]
  for (const path of candidates) {
    if (existsSync(path)) {
      return { path, menu: JSON.parse(readFileSync(path, 'utf8')) }
    }
  }
  throw new Error('menu.json not found')
}

/** Wipe categories/products/modifiers and insert catalog. Keeps restaurant settings. */
export async function replaceMenuCatalog(menu, { wipeOrders = true } = {}) {
  if (wipeOrders) {
    await prisma.orderItem.deleteMany()
    await prisma.order.deleteMany()
  }
  await prisma.modifierOption.deleteMany()
  await prisma.modifierGroup.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()

  const r = menu.restaurant
  if (r) {
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
  }

  let productCount = 0
  for (let ci = 0; ci < menu.categories.length; ci++) {
    const cat = menu.categories[ci]
    await prisma.category.create({
      data: {
        id: cat.id,
        name: cat.name,
        subtitle: cat.subtitle || '',
        banner: cat.banner || '/logo.png',
        sortOrder: ci,
        items: {
          create: (cat.items || []).map((item, pi) => {
            productCount += 1
            return {
              id: item.id,
              name: item.name,
              description: item.description || '',
              price: item.price,
              priceMax: item.priceMax ?? null,
              image: item.image || '/logo.png',
              sortOrder: pi,
              available: item.available !== false,
              featured: !!item.featured,
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
                        create: (g.options || []).map((o) => ({
                          externalId: o.id,
                          name: o.name,
                          price: o.price,
                        })),
                      },
                    })),
                  }
                : undefined,
            }
          }),
        },
      },
    })
  }

  return {
    categories: menu.categories.length,
    products: productCount,
  }
}
