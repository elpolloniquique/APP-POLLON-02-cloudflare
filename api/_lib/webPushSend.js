/**
 * Web Push compatible con Cloudflare Workers.
 * web-push.sendNotification usa https.request (Node), que falla o se traga
 * el error en Pages Functions. generateRequestDetails + fetch sí funciona.
 */
import webpush from 'web-push';

/** Quita saltos de línea/espacios si se pegó mal en el panel. */
export function cleanVapidKey(value) {
  return String(value || '').replace(/\s+/g, '').trim();
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
