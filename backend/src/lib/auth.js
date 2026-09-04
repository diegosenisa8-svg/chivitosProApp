import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

/**
 * Secreto de firma de TODOS los tokens (admin y cliente).
 *
 * Sin valor por defecto a propósito: un secreto hardcodeado en el código
 * permitiría a cualquiera que haya visto el repositorio firmar tokens de
 * administrador válidos. Es preferible que el servicio no arranque a que
 * arranque inseguro sin avisar.
 */
const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  console.error(
    'FATAL: falta la variable de entorno JWT_SECRET.\n' +
      '  Generá una con:   openssl rand -base64 48\n' +
      '  y cargala en las variables del servicio (Railway) o en backend/.env',
  )
  process.exit(1)
}

if (JWT_SECRET.length < 32) {
  console.warn(
    `WARN: JWT_SECRET tiene ${JWT_SECRET.length} caracteres. ` +
      'Se recomiendan 32 o más (openssl rand -base64 48).',
  )
}

/**
 * Tipos de token. Viajan en el claim `typ` y NO son intercambiables:
 * admin y cliente se firman con el mismo secreto, así que el tipo es lo único
 * que impide que un token de cliente sirva para entrar al panel.
 */
export const TOKEN_TYPE_ADMIN = 'admin'
export const TOKEN_TYPE_CUSTOMER = 'customer'
export const TOKEN_TYPE_PAYMENT = 'payment'

export async function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function signToken(admin) {
  return jwt.sign(
    {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      name: admin.name,
      typ: TOKEN_TYPE_ADMIN,
      // Versión de sesión: si sube en la base, los tokens viejos dejan de valer.
      ver: admin.tokenVersion ?? 0,
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  )
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })
}

/**
 * Valida un token de administrador sin tocar la base.
 *
 * Verifica la firma y además el tipo: los tokens de cliente se firman con el
 * mismo secreto, así que sin el chequeo de `typ` cualquier persona registrada
 * en la web entraría al panel con su propio token.
 *
 * @returns {{ payload: object } | { error: string }}
 */
export function verifyAdminToken(token) {
  if (!token) return { error: 'No autorizado' }
  let payload
  try {
    payload = verifyToken(token)
  } catch {
    return { error: 'Sesión inválida o expirada' }
  }
  if (payload?.typ !== TOKEN_TYPE_ADMIN) return { error: 'Sesión inválida o expirada' }
  if (!payload.sub) return { error: 'Sesión inválida o expirada' }
  return { payload }
}

/**
 * Token de un solo pedido, de vida corta. Sirve para probar que quien intenta
 * pagar es quien creó el pedido, incluso si pidió como invitado y no tiene
 * cuenta contra la cual comparar.
 */
export function signPaymentToken(orderId) {
  return jwt.sign({ sub: orderId, typ: TOKEN_TYPE_PAYMENT }, JWT_SECRET, { expiresIn: '30m' })
}

/** @returns {string|null} el orderId del token, o null si no es válido. */
export function paymentTokenOrderId(token) {
  if (!token) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })
    if (payload?.typ !== TOKEN_TYPE_PAYMENT) return null
    return payload.sub || null
  } catch {
    return null
  }
}

export { JWT_SECRET }
