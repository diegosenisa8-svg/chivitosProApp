/**
 * Geometría de zonas de entrega.
 *
 * Es el espejo exacto de src/lib/deliveryZones.ts en el front. El front lo usa
 * para mostrarle la zona al cliente; el servidor lo usa para decidir cuánto se
 * cobra. Si cambiás una fórmula acá, cambiala también allá.
 */

export function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Ray casting: ¿el punto cae dentro del polígono? */
export function pointInPolygon(point, polygon) {
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

export function polygonCentroid(polygon) {
  if (!polygon || !polygon.length) return null
  const lat = polygon.reduce((s, p) => s + p.lat, 0) / polygon.length
  const lng = polygon.reduce((s, p) => s + p.lng, 0) / polygon.length
  return { lat, lng }
}

/** Zona activa que contiene el punto; la más cercana si hay solapamiento. */
export function findZoneAtPoint(zones, point) {
  let best = null
  for (const z of zones || []) {
    if (!z || !z.active) continue

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
  return best ? best.zone : null
}

/** Coordenada válida y dentro del rango terrestre. */
export function isValidPoint(point) {
  return (
    point &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180 &&
    !(point.lat === 0 && point.lng === 0)
  )
}
