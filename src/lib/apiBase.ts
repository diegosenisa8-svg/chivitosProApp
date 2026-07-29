/** Base de la API. Vacío = same-origin (proxy de Vite / ngrok / Railway web). */
export function getApiBase() {
  const raw = import.meta.env.VITE_API_URL
  if (raw === 'off') return null
  if (!raw) return ''
  return String(raw).replace(/\/$/, '')
}

export function apiUrl(path: string) {
  const base = getApiBase()
  if (base === null) throw new Error('API deshabilitada')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

/** Resuelve imagen: absoluta, data URL, /uploads o path local. */
export function mediaUrl(src?: string | null) {
  if (!src) return '/logo.png'
  if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('blob:')) return src
  if (src.startsWith('/uploads')) {
    const base = getApiBase()
    return base === null ? src : `${base}${src}`
  }
  return src
}
