import { prisma } from './prisma.js'

/** Fallback in-memory si Postgres no responde (no ideal con varias réplicas). */
const memoryBuckets = new Map()

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

function memoryCheck(key, limit, windowMs) {
  const now = Date.now()
  let entry = memoryBuckets.get(key)
  if (!entry || now - entry.start >= windowMs) {
    entry = { start: now, count: 0 }
    memoryBuckets.set(key, entry)
  }
  entry.count += 1
  const remaining = Math.max(0, limit - entry.count)
  if (entry.count > limit) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((entry.start + windowMs - now) / 1000),
      remaining: 0,
    }
  }
  return { ok: true, retryAfterSec: 0, remaining }
}

/**
 * @param {string} key
 * @param {{ limit?: number, windowMs?: number }} [opts]
 * @returns {Promise<{ ok: boolean, retryAfterSec: number, remaining: number }>}
 */
export async function checkRateLimit(key, opts = {}) {
  const limit = opts.limit ?? 5
  const windowMs = opts.windowMs ?? 15 * 60 * 1000
  const now = new Date()

  try {
    const existing = await prisma.rateLimitBucket.findUnique({ where: { key } })
    const expired = !existing || now.getTime() - existing.windowStart.getTime() >= windowMs

    if (expired) {
      await prisma.rateLimitBucket.upsert({
        where: { key },
        create: { key, windowStart: now, count: 1 },
        update: { windowStart: now, count: 1 },
      })
      return { ok: true, retryAfterSec: 0, remaining: Math.max(0, limit - 1) }
    }

    const updated = await prisma.rateLimitBucket.update({
      where: { key },
      data: { count: { increment: 1 } },
    })

    if (updated.count > limit) {
      const retryAfterSec = Math.ceil(
        (existing.windowStart.getTime() + windowMs - now.getTime()) / 1000,
      )
      return { ok: false, retryAfterSec: Math.max(1, retryAfterSec), remaining: 0 }
    }
    return {
      ok: true,
      retryAfterSec: 0,
      remaining: Math.max(0, limit - updated.count),
    }
  } catch (err) {
    console.warn('rateLimit DB fallback', err?.message || err)
    return memoryCheck(key, limit, windowMs)
  }
}

export async function resetRateLimit(key) {
  memoryBuckets.delete(key)
  try {
    await prisma.rateLimitBucket.delete({ where: { key } }).catch(() => null)
  } catch {
    /* ignore */
  }
}
