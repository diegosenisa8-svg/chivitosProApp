import { verifyToken } from '../lib/auth.js'

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  try {
    req.admin = verifyToken(token)
    next()
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' })
  }
}

/** Solo rol admin (no empleado). */
export function requireFullAdmin(req, res, next) {
  requireAdmin(req, res, () => {
    const role = String(req.admin?.role || 'admin')
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Sin permiso para esta sección' })
    }
    next()
  })
}
