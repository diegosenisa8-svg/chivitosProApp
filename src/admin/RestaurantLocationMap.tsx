import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { SALTO_CENTER } from '../lib/deliveryZones'

type Props = {
  lat: number
  lng: number
  onChange: (lat: number, lng: number) => void
  height?: number
}

/** Mapa Leaflet para ubicar el pin del local (clic o arrastre). */
export function RestaurantLocationMap({ lat, lng, onChange, height = 360 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [lat || SALTO_CENTER.lat, lng || SALTO_CENTER.lng],
      zoom: 15,
      scrollWheelZoom: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    const pinIcon = L.divIcon({
      className: 'restaurant-pin-icon',
      html: '<span class="restaurant-pin-dot"></span>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })

    const marker = L.marker([lat || SALTO_CENTER.lat, lng || SALTO_CENTER.lng], {
      draggable: true,
      title: 'ChivitosPro',
      icon: pinIcon,
    }).addTo(map)

    marker.on('dragend', () => {
      const p = marker.getLatLng()
      onChangeRef.current(p.lat, p.lng)
    })

    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng)
      onChangeRef.current(e.latlng.lat, e.latlng.lng)
    })

    mapRef.current = map
    markerRef.current = marker
    window.setTimeout(() => map.invalidateSize(), 80)
    window.setTimeout(() => map.invalidateSize(), 400)

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return
    const next = L.latLng(lat, lng)
    if (!marker.getLatLng().equals(next, 1e-7)) {
      marker.setLatLng(next)
      map.panTo(next)
    }
  }, [lat, lng])

  return (
    <div
      className="delivery-zones-map restaurant-location-map"
      ref={containerRef}
      style={{ height }}
    />
  )
}

export function buildOsmEmbed(lat: number, lng: number): string {
  const d = 0.012
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`
}
