import { prisma } from '../lib/prisma.js'
import { verifyAdminToken, TOKEN_TYPE_ADMIN } from '../lib/auth.js'

function bearerToken(req) {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

/**
 * Resuelve el administrador del pedido contra la base.
 *
 * El rol se lee de la fila, no del token: así un cambio de rol tiene efecto
 * inmediato. `tokenVersion` permite invalidar sesiones abiertas (por ejemplo al
 * cambiar la contraseña) sin esperar a que expire el token.
 */
async function loadAdmin(req) {
  const checked = verifyAdminToken(bearerToken(req))
  if (checked.error) return checked

  const user = await prisma.adminUser.findUnique({
    where: { id: checked.payload.sub },
    select: { id: true, email: true, name: true, role: true, tokenVersion: true },
  })
  if (!user) return { error: 'Sesión inválida o expirada' }
  if ((checked.payload.ver ?? 0) !== user.tokenVersion) {
    return { error: 'Sesión cerrada. Ingresá de nuevo' }
  }

  return {
    admin: {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      typ: TOKEN_TYPE_ADMIN,
    },
  }
}

/** Exige un token de administrador válido (rol admin o empleado). */
export async function requireAdmin(req, res, next) {
  const result = await loadAdmin(req)
  if (result.error) return res.status(401).json({ error: result.error })
  req.admin = result.admin
  next()
}

/** Solo rol admin. Falla hacia cerrado: sin un rol `admin` explícito, 403. */
export async function requireFullAdmin(req, res, next) {
  const result = await loadAdmin(req)
  if (result.error) return res.status(401).json({ error: result.error })
  if (result.admin.role !== 'admin') {
    return res.status(403).json({ error: 'Sin permiso para esta sección' })
  }
  req.admin = result.admin
  next()
}
