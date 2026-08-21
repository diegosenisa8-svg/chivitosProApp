import jwt from 'jsonwebtoken'
import { hashPassword, verifyPassword, JWT_SECRET } from './auth.js'

export async function hashCustomerPassword(password) {
  return hashPassword(password)
}

export async function verifyCustomerPassword(password, hash) {
  return verifyPassword(password, hash)
}

export function signCustomerToken(account) {
  return jwt.sign(
    {
      sub: account.id,
      email: account.email,
      name: account.name,
      typ: 'customer',
    },
    JWT_SECRET,
    { expiresIn: '30d' },
  )
}

export function verifyCustomerToken(token) {
  const payload = jwt.verify(token, JWT_SECRET)
  if (payload?.typ !== 'customer') {
    const err = new Error('Token inválido')
    err.name = 'JsonWebTokenError'
    throw err
  }
  return payload
}

export const CUSTOMER_STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Aceptado',
  preparing: 'En preparación',
  ready: 'Listo',
  delivering: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}
