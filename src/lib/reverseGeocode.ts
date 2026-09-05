/** Reverse-geocode lat/lng → calle legible (Nominatim / OSM). */
export async function reverseGeocodeStreet(
  lat: number,
  lng: number,
): Promise<string | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('lat', String(lat))
    url.searchParams.set('lon', String(lng))
    url.searchParams.set('zoom', '18')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('accept-language', 'es')
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      display_name?: string
      address?: Record<string, string>
    }
    const a = data.address || {}
    const road = a.road || a.pedestrian || a.street || a.path || a.residential || ''
    const num = a.house_number || ''
    const street = [road, num].filter(Boolean).join(' ').trim()
    const suburb = a.suburb || a.neighbourhood || a.quarter || a.city_district || ''
    const city = a.city || a.town || a.village || a.municipality || ''
    const line = [street, suburb, city].filter(Boolean).join(', ')
    if (line) return line
    if (data.display_name) {
      return data.display_name.split(',').slice(0, 3).join(',').trim()
    }
    return null
  } catch {
    return null
  }
}
