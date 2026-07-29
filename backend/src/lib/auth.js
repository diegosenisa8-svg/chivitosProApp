import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'chivitos-dev-secret-change-me'

export async function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function signToken(admin) {
  return jwt.sign(
    { sub: admin.id, email: admin.email, role: admin.role, name: admin.name },
    JWT_SECRET,
    { expiresIn: '7d' },
  )
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

export { JWT_SECRET }
