import { mergeSettings } from './settings.js'

export function mapMenu(restaurant, categories, { includeUnavailable = false } = {}) {
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
      hoursLabel: restaurant.hoursLabel,
      etaMin: restaurant.etaMin,
      etaMax: restaurant.etaMax,
      deliveryFee: restaurant.deliveryFee,
      minOrder: restaurant.minOrder,
      phone: restaurant.phone,
      settings: mergeSettings(restaurant.settings),
    },
    categories: categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      subtitle: cat.subtitle,
      banner: cat.banner,
      items: cat.items
        .filter((item) => includeUnavailable || item.available !== false)
        .map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          ...(item.priceMax != null ? { priceMax: item.priceMax } : {}),
          image: item.image,
          available: item.available !== false,
          featured: !!item.featured,
          ...(item.modifiers?.length
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

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'delivering',
  'delivered',
  'cancelled',
]

export const STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'En preparación',
  ready: 'Listo',
  delivering: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}
