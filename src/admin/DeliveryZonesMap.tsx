import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { DeliveryZone } from '../types'
import { SALTO_CENTER } from '../lib/deliveryZones'

type Props = {
  zones: DeliveryZone[]
  selectedId: string | null
  restaurantLat?: number
  restaurantLng?: number
  /** Si true, un clic en el mapa mueve el centro de la zona seleccionada. */
  editable?: boolean
  onSelectZone?: (id: string) => void
  onMoveSelectedCenter?: (lat: number, lng: number) => void
  height?: number
}

export function DeliveryZonesMap({
  zones,
  selectedId,
  restaurantLat = SALTO_CENTER.lat,
  restaurantLng = SALTO_CENTER.lng,
  editable = false,
  onSelectZone,
  onMoveSelectedCenter,
  height = 360,
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

    return () => {
      map.remove()
      mapRef.current = null
      layersRef.current = null
    }
    // Solo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !editable) return
    const onClick = (e: L.LeafletMouseEvent) => {
      onMoveSelectedCenter?.(e.latlng.lat, e.latlng.lng)
    }
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
    }
  }, [editable, onMoveSelectedCenter, selectedId])

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
        fillOpacity: selected ? 0.35 : 0.18,
        weight: selected ? 3 : 2,
      })
      circle.bindTooltip(
        `${z.name} · ${z.freeDelivery || z.fee === 0 ? 'Envío gratis' : `$${z.fee}`}`,
        { sticky: true },
      )
      circle.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        onSelectZone?.(z.id)
      })
      circle.addTo(group)
    }
  }, [zones, selectedId, restaurantLat, restaurantLng, onSelectZone])

  return (
    <div className="delivery-zones-map-wrap">
      <div ref={containerRef} className="delivery-zones-map" style={{ height }} />
      {editable ? (
        <p className="admin-muted delivery-zones-map-hint">
          Seleccioná una zona en la lista y hacé clic en el mapa para ubicar su centro. Ajustá el
          radio con el control de abajo.
        </p>
      ) : null}
    </div>
  )
}
