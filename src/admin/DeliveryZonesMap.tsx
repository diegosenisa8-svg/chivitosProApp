import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { DeliveryZone } from '../types'
import { SALTO_CENTER } from '../lib/deliveryZones'

type Props = {
  zones: DeliveryZone[]
  selectedId: string | null
  selectedName?: string
  restaurantLat?: number
  restaurantLng?: number
  /** Modo marcar: el próximo clic ubica el centro de la zona seleccionada. */
  markMode?: boolean
  onSelectZone?: (id: string) => void
  onMoveSelectedCenter?: (lat: number, lng: number) => void
  onMarkDone?: () => void
  height?: number
}

export function DeliveryZonesMap({
  zones,
  selectedId,
  selectedName,
  restaurantLat = SALTO_CENTER.lat,
  restaurantLng = SALTO_CENTER.lng,
  markMode = false,
  onSelectZone,
  onMoveSelectedCenter,
  onMarkDone,
  height = 420,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layersRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [restaurantLat, restaurantLng],
      zoom: 13,
      scrollWheelZoom: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)
    layersRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    // Leaflet a veces queda en gris hasta forzar tamaño
    window.setTimeout(() => map.invalidateSize(), 80)
    window.setTimeout(() => map.invalidateSize(), 400)

    return () => {
      map.remove()
      mapRef.current = null
      layersRef.current = null
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
      if (!markMode || !selectedId) return
      onMoveSelectedCenter?.(e.latlng.lat, e.latlng.lng)
      onMarkDone?.()
    }
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
    }
  }, [markMode, selectedId, onMoveSelectedCenter, onMarkDone])

  useEffect(() => {
    const map = mapRef.current
    const group = layersRef.current
    if (!map || !group) return
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

    for (const z of zones.filter((x) => x.active && x.lat != null && x.lng != null)) {
      const radiusM = (z.radiusKm ?? 1.5) * 1000
      const selected = z.id === selectedId
      const circle = L.circle([z.lat!, z.lng!], {
        radius: radiusM,
        color: z.color,
        fillColor: z.color,
        fillOpacity: selected ? 0.4 : 0.18,
        weight: selected ? 3 : 2,
      })
      circle.bindTooltip(
        `${z.name} · ${z.freeDelivery || z.fee === 0 ? 'Envío gratis' : `$${z.fee}`}`,
        { sticky: true },
      )
      circle.on('click', (e) => {
        if (markMode) return
        L.DomEvent.stopPropagation(e)
        onSelectZone?.(z.id)
      })
      circle.addTo(group)
    }
  }, [zones, selectedId, restaurantLat, restaurantLng, onSelectZone, markMode])

  return (
    <div className={`delivery-zones-map-wrap${markMode ? ' marking' : ''}`}>
      {markMode ? (
        <div className="delivery-zones-mark-banner">
          📍 Tocá el mapa para ubicar <strong>{selectedName || 'esta zona'}</strong>
        </div>
      ) : (
        <div className="delivery-zones-mark-banner idle">
          1) Elegí una zona a la derecha → 2) Tocá <strong>Marcar en el mapa</strong> → 3) Clic
          donde va el círculo
        </div>
      )}
      <div ref={containerRef} className="delivery-zones-map" style={{ height }} />
    </div>
  )
}
