import type { DeliveryZone, LatLng } from '../types'

/** Centro aproximado de Salto, Uruguay. */
export const SALTO_CENTER = { lat: -31.3883, lng: -57.9601 }

export function zoneDeliveryFee(zone: DeliveryZone | null | undefined): number {
  if (!zone) return 0
  if (zone.freeDelivery) return 0
  return Math.max(0, Number(zone.fee) || 0)
}

export function haversineKm(a: LatLng, b: LatLng) {
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

/** Ray casting point-in-polygon. */
export function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  if (!polygon || polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng
    const yi = polygon[i].lat
    const xj = polygon[j].lng
    const yj = polygon[j].lat
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 0.0) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function polygonCentroid(polygon: LatLng[]): LatLng | null {
  if (!polygon.length) return null
  const lat = polygon.reduce((s, p) => s + p.lat, 0) / polygon.length
  const lng = polygon.reduce((s, p) => s + p.lng, 0) / polygon.length
  return { lat, lng }
}

/** Encuentra la zona activa que contiene el punto (polígono o círculo). */
export function findZoneAtPoint(zones: DeliveryZone[], point: LatLng): DeliveryZone | null {
  let best: { zone: DeliveryZone; score: number } | null = null
  for (const z of zones) {
    if (!z.active) continue
    if (z.shape === 'polygon' && z.polygon && z.polygon.length >= 3) {
      if (!pointInPolygon(point, z.polygon)) continue
      const c = polygonCentroid(z.polygon)
      const dist = c ? haversineKm(point, c) : 0
      if (!best || dist < best.score) best = { zone: z, score: dist }
      continue
    }
    if (z.lat == null || z.lng == null) continue
    const radius = z.radiusKm ?? 1.5
    const dist = haversineKm(point, { lat: z.lat, lng: z.lng })
    if (dist <= radius && (!best || dist < best.score)) {
      best = { zone: z, score: dist }
    }
  }
  return best?.zone || null
}

/** ¿La zona tiene centro+radio o polígono usable? */
export function zoneHasGeometry(zone: DeliveryZone | null | undefined): boolean {
  if (!zone) return false
  if (zone.shape === 'polygon' && zone.polygon && zone.polygon.length >= 3) return true
  return zone.lat != null && zone.lng != null && Number.isFinite(zone.lat) && Number.isFinite(zone.lng)
}

export function activeDeliveryZones(zones: DeliveryZone[] | undefined): DeliveryZone[] {
  return (zones || []).filter((z) => z.active)
}

export type DeliveryResolution = {
  zone: DeliveryZone | null
  outOfRange: boolean
  fee: number
}

/**
 * Espejo exacto de backend/src/lib/pricing.js: resuelve zona y costo de envío a
 * partir de la ubicación. Acá es solo para mostrárselo al cliente; lo que se
 * cobra lo decide el servidor con esta misma regla.
 */
export function resolveDelivery(
  zones: DeliveryZone[] | undefined,
  point: LatLng | null | undefined,
  fallbackFee: number,
): DeliveryResolution {
  const active = activeDeliveryZones(zones)
  if (!point) return { zone: null, outOfRange: false, fee: 0 }
  const usable = active.filter(zoneHasGeometry)
  // Sin geometría cargada: no asustar con "fuera de rango"; usar envío general.
  if (usable.length === 0) {
    return { zone: null, outOfRange: false, fee: Math.max(0, fallbackFee || 0) }
  }
  const zone = findZoneAtPoint(usable, point)
  if (zone) return { zone, outOfRange: false, fee: zoneDeliveryFee(zone) }
  return {
    zone: null,
    outOfRange: true,
    fee: usable.reduce((max, z) => Math.max(max, zoneDeliveryFee(z)), 0),
  }
}
