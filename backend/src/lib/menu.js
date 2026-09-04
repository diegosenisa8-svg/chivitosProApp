import { mergeSettings } from './settings.js'

/**
 * Subconjunto de la configuración que la web pública necesita para funcionar.
 *
 * El objeto completo incluye emails del staff, teléfono de alertas, impresoras,
 * integraciones, métricas internas y las promociones inactivas con su valor:
 * nada de eso tiene por qué viajar en /api/menu. El panel admin sigue recibiendo
 * todo a través de /api/admin/menu y /api/admin/settings.
 */
export function publicSettings(raw) {
  const settings = mergeSettings(raw)
  const paymentMethods = settings.paymentMethods || {}

  return {
    servicesPaused: !!settings.servicesPaused,
    deliveryEnabled: settings.deliveryEnabled !== false,
    pickupEnabled: settings.pickupEnabled !== false,
    scheduledOrdersEnabled: !!settings.scheduledOrdersEnabled,
    timezone: settings.timezone,
    paymentMethods,
    // Los datos bancarios son necesarios para pagar por transferencia, pero solo
    // se publican si ese medio de pago está realmente habilitado.
    ...(paymentMethods.transferencia ? { transferPayment: settings.transferPayment } : {}),
    deliveryZones: (settings.deliveryZones || []).filter((z) => z && z.active),
    promotions: (settings.promotions || [])
      .filter((p) => p && p.active)
      .map((p) => ({
        code: p.code,
        title: p.title,
        type: p.type,
        value: p.value,
        active: true,
      })),
  }
}

export function mapMenu(restaurant, categories, { includeUnavailable = false, fullSettings = false } = {}) {
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
      settings: fullSettings ? mergeSettings(restaurant.settings) : publicSettings(restaurant.settings),
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
