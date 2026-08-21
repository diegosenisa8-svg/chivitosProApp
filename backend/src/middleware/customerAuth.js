import { verifyCustomerToken } from '../lib/customerAuth.js'

export function optionalCustomer(req, _res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    req.customer = null
    return next()
  }
  try {
    req.customer = verifyCustomerToken(token)
  } catch {
    req.customer = null
  }
  next()
}

export function requireCustomer(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'Ingresá a tu cuenta' })
  }
  try {
    req.customer = verifyCustomerToken(token)
    next()
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' })
  }
}
