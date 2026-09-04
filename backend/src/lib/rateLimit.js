import { prisma } from './prisma.js'

/**
 * IP del cliente detrás de Railway / proxies.
 * Tomamos la ÚLTIMA entrada de X-Forwarded-For: es la que agrega la plataforma
 * y el cliente no puede falsificarla. Las entradas previas sí las puede inventar.
 */
export function clientIp(req) {
  const xf = req.headers?.['x-forwarded-for']
  if (typeof xf === 'string' && xf.trim()) {
    const parts = xf.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length) return parts[parts.length - 1]
  }
  if (Array.isArray(xf) && xf.length) {
    const last = String(xf[xf.length - 1] || '').trim()
    if (last) return last
  }
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

/**
 * Rate limit atómico en Postgres (una sola sentencia).
 * Si la base no responde: fail-closed (ok=false) — no hay fallback en memoria.
 *
 * @param {string} key
 * @param {{ limit?: number, windowMs?: number }} [opts]
 * @returns {Promise<{ ok: boolean, retryAfterSec: number, remaining: number, unavailable?: boolean }>}
 */
export async function checkRateLimit(key, opts = {}) {
  const limit = opts.limit ?? 5
  const windowMs = opts.windowMs ?? 15 * 60 * 1000
  const now = new Date()
  const windowStartIso = now.toISOString()

  try {
    // Una sola operación: inserta o incrementa / reinicia ventana.
    const rows = await prisma.$queryRaw`
      INSERT INTO "RateLimitBucket" ("key", "windowStart", "count", "updatedAt")
      VALUES (${key}, ${now}::timestamp, 1, ${now}::timestamp)
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN (EXTRACT(EPOCH FROM (${now}::timestamp - "RateLimitBucket"."windowStart")) * 1000) >= ${windowMs}
          THEN 1
          ELSE "RateLimitBucket"."count" + 1
        END,
        "windowStart" = CASE
          WHEN (EXTRACT(EPOCH FROM (${now}::timestamp - "RateLimitBucket"."windowStart")) * 1000) >= ${windowMs}
          THEN ${now}::timestamp
          ELSE "RateLimitBucket"."windowStart"
        END,
        "updatedAt" = ${now}::timestamp
      RETURNING "count", "windowStart"
    `

    const row = Array.isArray(rows) ? rows[0] : rows
    const count = Number(row?.count) || 1
    const windowStart = row?.windowStart ? new Date(row.windowStart) : now

    if (count > limit) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000),
      )
      return { ok: false, retryAfterSec, remaining: 0 }
    }
    return {
      ok: true,
      retryAfterSec: 0,
      remaining: Math.max(0, limit - count),
    }
  } catch (err) {
    console.error('rateLimit unavailable', err?.message || err)
    // Fail-closed: no dejar pasar intentos si no podemos contarlos.
    return {
      ok: false,
      retryAfterSec: 60,
      remaining: 0,
      unavailable: true,
    }
  }
}

export async function resetRateLimit(key) {
  try {
    await prisma.rateLimitBucket.delete({ where: { key } }).catch(() => null)
  } catch {
    /* ignore */
  }
}
