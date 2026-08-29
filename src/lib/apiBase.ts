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

/** Resuelve imagen: absoluta, data URL, /api/media, /uploads o path local. */
export function mediaUrl(src?: string | null) {
  if (!src) return '/logo.png'
  if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('blob:')) return src

  const path = src.startsWith('/') ? src : `/${src}`

  if (path.startsWith('/uploads') || path.startsWith('/api/media')) {
    const base = getApiBase()
    if (base && typeof window !== 'undefined') {
      // localhost en .env rompe imágenes vía ngrok/dominio: usar proxy same-origin
      if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(base)) {
        try {
          const apiOrigin = new URL(base, window.location.origin).origin
          if (apiOrigin !== window.location.origin) {
            return `${base.replace(/\/$/, '')}${path}`
          }
        } catch {
          /* usar ruta relativa */
        }
      }
    }
    return path
  }

  return path
}
