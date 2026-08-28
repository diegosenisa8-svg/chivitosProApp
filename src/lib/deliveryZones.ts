import type { DeliveryZone } from '../types'

/** Centro aproximado de Salto, Uruguay. */
export const SALTO_CENTER = { lat: -31.3883, lng: -57.9601 }

export function zoneDeliveryFee(zone: DeliveryZone | null | undefined): number {
  if (!zone) return 0
  if (zone.freeDelivery) return 0
  return Math.max(0, Number(zone.fee) || 0)
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Encuentra la zona activa más cercana cuyo radio cubre el punto. */
export function findZoneAtPoint(
  zones: DeliveryZone[],
  point: { lat: number; lng: number },
): DeliveryZone | null {
  let best: { zone: DeliveryZone; dist: number } | null = null
  for (const z of zones) {
    if (!z.active || z.lat == null || z.lng == null) continue
    const radius = z.radiusKm ?? 1.5
    const dist = haversineKm(point, { lat: z.lat, lng: z.lng })
    if (dist <= radius && (!best || dist < best.dist)) {
      best = { zone: z, dist }
    }
  }
  return best?.zone || null
}

export function activeDeliveryZones(zones: DeliveryZone[] | undefined): DeliveryZone[] {
  return (zones || []).filter((z) => z.active)
}
