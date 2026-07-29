/** Base de la API. Vacío = same-origin (proxy de Vite / ngrok). */
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
