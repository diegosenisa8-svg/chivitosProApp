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
  markMode?: boolean
  drawShape?: 'circle' | 'polygon'
  draftPolygon?: LatLng[]
  onSelectZone?: (id: string) => void
  onMapClick?: (lat: number, lng: number) => void
  onDraftChange?: (points: LatLng[]) => void
  height?: number
}

function midPoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 }
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
  onDraftChange,
  height = 520,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layersRef = useRef<L.LayerGroup | null>(null)
  const draftRef = useRef<L.LayerGroup | null>(null)
  const draftPolygonRef = useRef(draftPolygon)
  const skipMapClickRef = useRef(false)
  draftPolygonRef.current = draftPolygon

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
      if (skipMapClickRef.current) {
        skipMapClickRef.current = false
        return
      }
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
      // En modo dibujo no dibujamos la zona seleccionada (se ve el draft editable)
      if (markMode && z.id === selectedId && drawShape === 'polygon') continue

      const selected = z.id === selectedId
      const feeLabel = z.freeDelivery || z.fee === 0 ? 'Envío gratis' : `$${z.fee}`

      if (z.shape === 'polygon' && z.polygon && z.polygon.length >= 3) {
        const latlngs = z.polygon.map((p) => [p.lat, p.lng] as [number, number])
        const poly = L.polygon(latlngs, {
          color: z.color,
          fillColor: z.color,
          fillOpacity: selected ? 0.35 : 0.18,
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
        fillOpacity: selected ? 0.35 : 0.15,
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
  }, [zones, selectedId, restaurantLat, restaurantLng, onSelectZone, markMode, drawShape])

  useEffect(() => {
    const draft = draftRef.current
    if (!draft) return
    draft.clearLayers()
    if (!markMode || drawShape !== 'polygon') return

    const points = draftPolygon
    if (points.length === 0) return

    const latlngs = points.map((p) => [p.lat, p.lng] as [number, number])

    if (points.length >= 2) {
      L.polyline(latlngs, {
        color: '#2e7d32',
        weight: 3,
        dashArray: '6 6',
      }).addTo(draft)
    }
    if (points.length >= 3) {
      L.polygon(latlngs, {
        color: '#2e7d32',
        fillColor: '#66bb6a',
        fillOpacity: 0.22,
        weight: 2,
      }).addTo(draft)
    }

    // Puntos medios (insertar nodo en el borde)
    if (points.length >= 2) {
      for (let i = 0; i < points.length; i++) {
        const a = points[i]
        const b = points[(i + 1) % points.length]
        // Solo mostrar midpoints si ya hay al menos un segmento cerrado en vista (>=2)
        // Para polígono en progreso, mid entre i e i+1 excepto el cierre hasta tener 3+
        if (i === points.length - 1 && points.length < 3) continue
        const mid = midPoint(a, b)
        const midMarker = L.circleMarker([mid.lat, mid.lng], {
          radius: 5,
          color: '#81c784',
          fillColor: '#fff',
          fillOpacity: 1,
          weight: 2,
          className: 'dz-mid-node',
        })
        midMarker.bindTooltip('Clic: agregar nodo acá', { direction: 'top' })
        midMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          const next = [...draftPolygonRef.current]
          next.splice(i + 1, 0, mid)
          onDraftChange?.(next)
        })
        midMarker.addTo(draft)
      }
    }

    // Nodos arrastrables
    points.forEach((p, i) => {
      const marker = L.marker([p.lat, p.lng], {
        draggable: true,
        autoPan: true,
        title: `Nodo ${i + 1} — arrastrá para mover`,
        icon: L.divIcon({
          className: 'dz-vertex-icon',
          html: `<div class="dz-vertex${i === 0 ? ' first' : ''}">${i + 1}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      })
      marker.bindTooltip(`Nodo ${i + 1} · arrastrá`, { direction: 'top', offset: [0, -10] })
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
      })
      marker.on('dragstart', () => {
        skipMapClickRef.current = true
      })
      marker.on('dragend', (e) => {
        skipMapClickRef.current = true
        window.setTimeout(() => {
          skipMapClickRef.current = false
        }, 50)
        const ll = (e.target as L.Marker).getLatLng()
        const next = draftPolygonRef.current.map((pt, idx) =>
          idx === i ? { lat: ll.lat, lng: ll.lng } : pt,
        )
        onDraftChange?.(next)
      })
      marker.addTo(draft)
    })
  }, [markMode, drawShape, draftPolygon, onDraftChange])

  const banner =
    markMode && drawShape === 'polygon' ? (
      <div className="delivery-zones-mark-banner">
        <strong>{selectedName || 'Zona'}</strong>: arrastrá los nodos numerados para moverlos · clic
        en el punto blanco del borde para agregar · clic en el mapa vacío para sumar al final (
        {draftPolygon.length} nodos)
      </div>
    ) : markMode ? (
      <div className="delivery-zones-mark-banner">
        Tocá el mapa para ubicar el centro de <strong>{selectedName || 'esta zona'}</strong>
      </div>
    ) : (
      <div className="delivery-zones-mark-banner idle">
        Forma libre → Marcar en el mapa → dibujá nodos → arrastralos → Cerrar zona
      </div>
    )

  return (
    <div className={`delivery-zones-map-wrap${markMode ? ' marking' : ''}`}>
      {banner}
      <div ref={containerRef} className="delivery-zones-map" style={{ height }} />
    </div>
  )
}
