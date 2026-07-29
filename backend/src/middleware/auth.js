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
