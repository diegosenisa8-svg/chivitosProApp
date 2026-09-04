import { OAuth2Client } from 'google-auth-library'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim() || ''
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null

export function isGoogleAuthConfigured() {
  return Boolean(googleClient && GOOGLE_CLIENT_ID)
}

export function getGoogleClientId() {
  return GOOGLE_CLIENT_ID || null
}

/**
 * Verifica el ID token de Google Identity Services.
 * @returns {Promise<{ email: string, name: string | null, sub: string, picture: string | null }>}
 */
export async function verifyGoogleIdToken(idToken) {
  if (!googleClient || !GOOGLE_CLIENT_ID) {
    const err = new Error('Google Sign-In no está configurado en el servidor.')
    err.status = 503
    throw err
  }
  if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
    const err = new Error('Debés iniciar sesión con Google.')
    err.status = 401
    throw err
  }

  let ticket
  try {
    ticket = await googleClient.verifyIdToken({
      idToken: idToken.trim(),
      audience: GOOGLE_CLIENT_ID,
    })
  } catch {
    const err = new Error('Sesión de Google inválida o expirada. Volvé a iniciar sesión.')
    err.status = 401
    throw err
  }

  const payload = ticket.getPayload()
  if (!payload?.email || payload.email_verified !== true) {
    const err = new Error('La cuenta de Google no tiene un email verificado.')
    err.status = 401
    throw err
  }
  if (!payload.sub) {
    const err = new Error('Sesión de Google inválida.')
    err.status = 401
    throw err
  }

  return {
    email: String(payload.email).trim().toLowerCase(),
    name: payload.name ? String(payload.name).trim() : null,
    sub: String(payload.sub),
    picture: payload.picture ? String(payload.picture) : null,
  }
}
