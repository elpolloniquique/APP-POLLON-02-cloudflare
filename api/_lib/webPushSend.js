/**
 * Web Push compatible con Cloudflare Workers.
 * web-push.sendNotification usa https.request (Node), que falla o se traga
 * el error en Pages Functions. generateRequestDetails + fetch sí funciona.
 */
import webpush from 'web-push';

export function setWebPushVapid(subject, publicKey, privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function sendWebPushNotification(subscription, payload, options = {}) {
  const details = webpush.generateRequestDetails(subscription, payload, {
    urgency: options.urgency || 'high',
    TTL: options.TTL ?? 3600,
  });
  const body = details.body instanceof Uint8Array
    ? details.body
    : Buffer.from(details.body || []);
  const res = await fetch(details.endpoint, {
    method: 'POST',
    headers: details.headers,
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
