/**
 * Web Push compatible con Cloudflare Workers.
 * web-push.sendNotification usa https.request (Node), que falla o se traga
 * el error en Pages Functions. generateRequestDetails + fetch sí funciona.
 */
import crypto from 'node:crypto';
import webpush from 'web-push';

/** Quita saltos de línea/espacios si se pegó mal en el panel. */
export function cleanVapidKey(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function b64urlToBuf(value) {
  const raw = cleanVapidKey(value).replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (raw.length % 4)) % 4);
  return Buffer.from(`${raw}${pad}`, 'base64');
}

function bufToB64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/** Comprueba que la privada y la pública sean el mismo par (si no, FCM responde 403). */
export function vapidKeysMatch(publicKey, privateKey) {
  try {
    const pub = cleanVapidKey(publicKey);
    const privBuf = b64urlToBuf(privateKey);
    const key = Buffer.alloc(32);
    privBuf.copy(key, Math.max(0, 32 - privBuf.length));
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(key);
    return bufToB64url(ecdh.getPublicKey(null, 'uncompressed')) === pub;
  } catch {
    return false;
  }
}

export function setWebPushVapid(subject, publicKey, privateKey) {
  webpush.setVapidDetails(
    String(subject || 'mailto:contacto@el-pollon.cl').trim(),
    cleanVapidKey(publicKey),
    cleanVapidKey(privateKey),
  );
}

export async function sendWebPushNotification(subscription, payload, options = {}) {
  const details = webpush.generateRequestDetails(subscription, payload, {
    urgency: options.urgency || 'high',
    TTL: options.TTL ?? 3600,
  });
  const headers = {};
  for (const [key, value] of Object.entries(details.headers || {})) {
    if (value == null) continue;
    const name = String(key);
    const lower = name.toLowerCase();
    if (lower === 'content-length' || lower === 'host' || lower === 'connection') continue;
    headers[name] = String(value);
  }
  const body = details.body instanceof Uint8Array
    ? details.body
    : Buffer.from(details.body || []);
  const res = await fetch(details.endpoint, {
    method: 'POST',
    headers,
    body,
  });
  if (res.status < 200 || res.status >= 300) {
    const text = await res.text().catch(() => '');
    const err = new Error((text || '').slice(0, 300) || `Web Push ${res.status}`);
    err.statusCode = res.status;
    throw err;
  }
  return { statusCode: res.status };
}
