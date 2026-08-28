import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { DeliveryZone, LatLng } from '../types'
import { SALTO_CENTER } from '../lib/deliveryZones'

type Props = {
  zones: DeliveryZone[]
  selectedId: string | null
  selectedName?: string
  restaurantLat?: number
  restaurantLng?: number
  /** Modo dibujar: clics agregan nodos (polígono) o ubican centro (círculo). */
  markMode?: boolean
  drawShape?: 'circle' | 'polygon'
  /** Vértices en progreso mientras se dibuja un polígono. */
  draftPolygon?: LatLng[]
  onSelectZone?: (id: string) => void
  onMapClick?: (lat: number, lng: number) => void
  height?: number
}

export function DeliveryZonesMap({
  zones,
  selectedId,
  selectedName,
  restaurantLat = SALTO_CENTER.lat,
  restaurantLng = SALTO_CENTER.lng,
  markMode = false,
  drawShape = 'polygon',
  draftPolygon = [],
  onSelectZone,
  onMapClick,
  height = 440,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layersRef = useRef<L.LayerGroup | null>(null)
  const draftRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [restaurantLat, restaurantLng],
      zoom: 14,
      scrollWheelZoom: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)
    layersRef.current = L.layerGroup().addTo(map)
    draftRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    window.setTimeout(() => map.invalidateSize(), 80)
    window.setTimeout(() => map.invalidateSize(), 400)

    return () => {
      map.remove()
      mapRef.current = null
      layersRef.current = null
      draftRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.invalidateSize()
    const el = map.getContainer()
    if (markMode) el.classList.add('is-marking')
    else el.classList.remove('is-marking')
  }, [markMode, height])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const onClick = (e: L.LeafletMouseEvent) => {
      if (!markMode) return
      onMapClick?.(e.latlng.lat, e.latlng.lng)
    }
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
    }
  }, [markMode, onMapClick])

  useEffect(() => {
    const group = layersRef.current
    if (!group) return
    group.clearLayers()

    L.circleMarker([restaurantLat, restaurantLng], {
      radius: 8,
      color: '#111',
      fillColor: '#E85D04',
      fillOpacity: 1,
      weight: 2,
    })
      .bindTooltip('Local', { permanent: false })
      .addTo(group)

    for (const z of zones.filter((x) => x.active)) {
      const selected = z.id === selectedId
      const feeLabel = z.freeDelivery || z.fee === 0 ? 'Envío gratis' : `$${z.fee}`

      if (z.shape === 'polygon' && z.polygon && z.polygon.length >= 3) {
        const latlngs = z.polygon.map((p) => [p.lat, p.lng] as [number, number])
        const poly = L.polygon(latlngs, {
          color: z.color,
          fillColor: z.color,
          fillOpacity: selected ? 0.4 : 0.2,
          weight: selected ? 3 : 2,
        })
        poly.bindTooltip(`${z.name} · ${feeLabel}`, { sticky: true })
        poly.on('click', (e) => {
          if (markMode) return
          L.DomEvent.stopPropagation(e)
          onSelectZone?.(z.id)
        })
        poly.addTo(group)
        continue
      }

      if (z.lat == null || z.lng == null) continue
      const circle = L.circle([z.lat, z.lng], {
        radius: (z.radiusKm ?? 1.5) * 1000,
        color: z.color,
        fillColor: z.color,
        fillOpacity: selected ? 0.4 : 0.18,
        weight: selected ? 3 : 2,
      })
      circle.bindTooltip(`${z.name} · ${feeLabel}`, { sticky: true })
      circle.on('click', (e) => {
        if (markMode) return
        L.DomEvent.stopPropagation(e)
        onSelectZone?.(z.id)
      })
      circle.addTo(group)
    }
  }, [zones, selectedId, restaurantLat, restaurantLng, onSelectZone, markMode])

  useEffect(() => {
    const draft = draftRef.current
    if (!draft) return
    draft.clearLayers()
    if (!markMode || drawShape !== 'polygon' || draftPolygon.length === 0) return

    const latlngs = draftPolygon.map((p) => [p.lat, p.lng] as [number, number])

    if (draftPolygon.length >= 2) {
      L.polyline(latlngs, {
        color: '#2e7d32',
        weight: 3,
        dashArray: '6 6',
      }).addTo(draft)
    }
    if (draftPolygon.length >= 3) {
      L.polygon(latlngs, {
        color: '#2e7d32',
        fillColor: '#66bb6a',
        fillOpacity: 0.25,
        weight: 2,
        dashArray: '4 4',
      }).addTo(draft)
    }

    draftPolygon.forEach((p, i) => {
      L.circleMarker([p.lat, p.lng], {
        radius: i === 0 ? 7 : 5,
        color: '#1b5e20',
        fillColor: i === 0 ? '#fff' : '#2e7d32',
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip(`Nodo ${i + 1}`, { direction: 'top' })
        .addTo(draft)
    })
  }, [markMode, drawShape, draftPolygon])

  const banner =
    markMode && drawShape === 'polygon' ? (
      <div className="delivery-zones-mark-banner">
        📍 Dibujá el límite de <strong>{selectedName || 'esta zona'}</strong>: acercate y hacé clic
        para agregar nodos ({draftPolygon.length} punto
        {draftPolygon.length === 1 ? '' : 's'}). Con 3 o más podés cerrar la zona.
      </div>
    ) : markMode ? (
      <div className="delivery-zones-mark-banner">
        📍 Tocá el mapa para ubicar el centro de <strong>{selectedName || 'esta zona'}</strong>
      </div>
    ) : (
      <div className="delivery-zones-mark-banner idle">
        Elegí forma libre → <strong>Marcar en el mapa</strong> → clic nodos alrededor del barrio →
        Cerrar zona
      </div>
    )

  return (
    <div className={`delivery-zones-map-wrap${markMode ? ' marking' : ''}`}>
      {banner}
      <div ref={containerRef} className="delivery-zones-map" style={{ height }} />
    </div>
  )
}
