/** Rate limit en memoria (best-effort en serverless). FASE 19. */

const buckets = new Map();

export function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return String(req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown');
}

/**
 * @returns {boolean} true si EXCEDIÓ el límite
 */
export function rateLimitHit(key, { max = 20, windowMs = 60_000 } = {}) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.reset) {
    b = { n: 0, reset: now + windowMs };
  }
  b.n += 1;
  buckets.set(key, b);
  if (buckets.size > 4000) {
    for (const [k, v] of buckets) {
      if (now > v.reset) buckets.delete(k);
    }
  }
  return b.n > max;
}
