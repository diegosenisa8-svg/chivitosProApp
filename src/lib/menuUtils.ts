import type { Category, MenuData, MenuItem } from '../types'

const CATEGORY_ORDER = [
  'chivitospro',
  'hamburguesas',
  'milanesas',
  'pizzas',
  'sandwiches',
  'fritos',
  'guarniciones',
  'ensaladas',
  'bebidas',
  'postres',
]

const NAME_FIXES: Record<string, string> = {
  chivitopro: 'Chivito Pro',
  'hamburguesa-ruta66': 'Hamburguesa Ruta 66',
  'hamburguesa-bacon-cheesse': 'Hamburguesa Bacon Cheese',
  sandwiche: 'Sándwich',
  'sandwiche-caliente': 'Sándwich Caliente',
  'sandwiche-con-muzzarella': 'Sándwich con Muzzarella',
  ensaladapro: 'Ensalada Pro',
  'ensaladapro-pollo': 'Ensalada Pro Pollo',
}

const DRINK_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f4e4d0"/><stop offset="1" stop-color="#e8c9a8"/></linearGradient></defs>
  <rect width="400" height="400" fill="url(#g)"/>
  <rect x="150" y="70" width="100" height="220" rx="18" fill="#fff" stroke="#c45c26" stroke-width="8"/>
  <rect x="165" y="95" width="70" height="140" rx="8" fill="#E23B2E" opacity=".85"/>
  <rect x="175" y="40" width="50" height="40" rx="6" fill="#c45c26"/>
</svg>`)

const FEATURED_IDS = new Set([
  'chivitopro',
  'chivito-especial',
  'hamburguesa-crispy',
  'hamburguesa-bacon-crunch',
  'hamburguesa-big-pro',
])

function prettyName(id: string, name: string) {
  if (NAME_FIXES[id]) return NAME_FIXES[id]
  for (const [key, value] of Object.entries(NAME_FIXES)) {
    if (id.includes(key) || name.toLowerCase().includes(key.replace(/-/g, ' '))) {
      return value
    }
  }
  return name
    .replace(/\bRuta66\b/gi, 'Ruta 66')
    .replace(/\bChivitopro\b/gi, 'Chivito Pro')
    .replace(/\bSandwiche\b/gi, 'Sándwich')
    .replace(/\bCheesse\b/gi, 'Cheese')
}

function enrichItem(item: MenuItem, categoryId: string): MenuItem {
  const name = prettyName(item.id, item.name)
  let image = item.image
  if (categoryId === 'bebidas') image = DRINK_IMAGE

  let badge: MenuItem['badge']
  if (FEATURED_IDS.has(item.id)) badge = 'mas-pedido'
  if (item.id.includes('combo')) badge = 'combo'
  if (item.id.includes('nueva') || item.id.includes('ahumada')) badge = 'nuevo'

  return {
    ...item,
    name,
    image,
    badge,
    featured: FEATURED_IDS.has(item.id),
  }
}

export function prepareMenu(menu: MenuData): MenuData {
  const byId = new Map(menu.categories.map((c) => [c.id, c]))
  const ordered: Category[] = []

  for (const id of CATEGORY_ORDER) {
    const cat = byId.get(id)
    if (!cat) continue
    ordered.push({
      ...cat,
      name: cat.id === 'chivitospro' ? 'Chivitos' : cat.name,
      banner: cat.id === 'bebidas' || cat.id === 'postres' ? '/hero.png' : cat.banner,
      items: cat.items.map((i) => enrichItem(i, cat.id)),
    })
    byId.delete(id)
  }

  for (const cat of byId.values()) {
    ordered.push({
      ...cat,
      items: cat.items.map((i) => enrichItem(i, cat.id)),
    })
  }

  return {
    restaurant: {
      ...menu.restaurant,
      etaMin: menu.restaurant.etaMin ?? 35,
      etaMax: menu.restaurant.etaMax ?? 55,
      deliveryFee: menu.restaurant.deliveryFee ?? 80,
      minOrder: menu.restaurant.minOrder ?? 250,
      hoursLabel: menu.restaurant.hoursLabel ?? 'Lun–Dom 11:30 a 00:00',
      phone: menu.restaurant.phone ?? '',
    },
    categories: ordered,
  }
}

export function getFeaturedItems(menu: MenuData, limit = 6): MenuItem[] {
  const all = menu.categories.flatMap((c) => c.items)
  const featured = all.filter((i) => i.featured)
  return (featured.length ? featured : all.slice(0, limit)).slice(0, limit)
}

export function findItem(menu: MenuData, id: string): MenuItem | undefined {
  for (const cat of menu.categories) {
    const found = cat.items.find((i) => i.id === id)
    if (found) return found
  }
  return undefined
}
