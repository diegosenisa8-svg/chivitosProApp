/** Simple in-memory rate limiter (per process). */
const buckets = new Map()

/**
 * @param {string} key
 * @param {{ limit?: number, windowMs?: number }} [opts]
 * @returns {{ ok: boolean, retryAfterSec: number, remaining: number }}
 */
export function checkRateLimit(key, opts = {}) {
  const limit = opts.limit ?? 5
  const windowMs = opts.windowMs ?? 15 * 60 * 1000
  const now = Date.now()
  let entry = buckets.get(key)
  if (!entry || now - entry.start >= windowMs) {
    entry = { start: now, count: 0 }
    buckets.set(key, entry)
  }
  entry.count += 1
  const remaining = Math.max(0, limit - entry.count)
  if (entry.count > limit) {
    const retryAfterSec = Math.ceil((entry.start + windowMs - now) / 1000)
    return { ok: false, retryAfterSec, remaining: 0 }
  }
  return { ok: true, retryAfterSec: 0, remaining }
}

export function resetRateLimit(key) {
  buckets.delete(key)
}
