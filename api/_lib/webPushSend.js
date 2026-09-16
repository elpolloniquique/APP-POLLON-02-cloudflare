/**
 * Web Push en Cloudflare Pages: Web Crypto (subtle), sin Node createECDH.
 * El paquete `web-push` usa crypto.createECDH y en Workers falla:
 * "[unenv] crypto.createECDH is not implemented yet!"
 */
import { sendPushNotification } from 'web-push-browser';

/** Quita saltos de línea/espacios si se pegó mal en el panel. */
export function cleanVapidKey(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function b64urlToUint8(value) {
  const raw = cleanVapidKey(value).replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (raw.length % 4)) % 4);
  const bin = atob(`${raw}${pad}`);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function uint8ToB64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

let vapidSubject = 'mailto:contacto@el-pollon.cl';
let vapidPublic = '';
let vapidPrivate = '';
let keyPairPromise = null;

async function importVapidPair(publicKey, privateKey) {
  const pub = b64urlToUint8(publicKey);
  const priv = b64urlToUint8(privateKey);
  const dBytes = priv.length >= 32 ? priv.subarray(priv.length - 32) : priv;
  if (pub.length !== 65 || pub[0] !== 4) {
    throw new Error('VAPID public key inválida');
  }
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: uint8ToB64url(pub.subarray(1, 33)),
    y: uint8ToB64url(pub.subarray(33, 65)),
    d: uint8ToB64url(dBytes),
  };
  const [pubCrypto, privCrypto] = await Promise.all([
    crypto.subtle.importKey('raw', pub, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']),
    crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']),
  ]);
  return { publicKey: pubCrypto, privateKey: privCrypto };
}

function vapidEmail(subject) {
  const s = String(subject || '').trim();
  return s.replace(/^mailto:/i, '').trim() || 'contacto@el-pollon.cl';
}

export function vapidKeysMatch(publicKey, privateKey) {
  try {
    const pub = b64urlToUint8(publicKey);
    const priv = b64urlToUint8(privateKey);
    return pub.length === 65 && pub[0] === 4 && priv.length >= 32;
  } catch {
    return false;
  }
}

export function setWebPushVapid(subject, publicKey, privateKey) {
  const nextSubject = String(subject || 'mailto:contacto@el-pollon.cl').trim();
  const nextPub = cleanVapidKey(publicKey);
  const nextPriv = cleanVapidKey(privateKey);
  if (nextSubject !== vapidSubject || nextPub !== vapidPublic || nextPriv !== vapidPrivate) {
    vapidSubject = nextSubject;
    vapidPublic = nextPub;
    vapidPrivate = nextPriv;
    keyPairPromise = null;
  }
}

async function getKeyPair() {
  if (!vapidPublic || !vapidPrivate) {
    throw new Error('VAPID no configurado');
  }
  if (!keyPairPromise) {
    keyPairPromise = importVapidPair(vapidPublic, vapidPrivate);
  }
  return keyPairPromise;
}

export async function sendWebPushNotification(subscription, payload, options = {}) {
  const keyPair = await getKeyPair();
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const res = await sendPushNotification(
    keyPair,
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys?.p256dh,
        auth: subscription.keys?.auth,
      },
    },
    vapidEmail(vapidSubject),
    body,
    {
      algorithm: 'aes128gcm',
      urgency: options.urgency || 'high',
      ttl: options.TTL ?? 3600,
    },
  );
  if (!res || res.status < 200 || res.status >= 300) {
    const text = await res?.text?.().catch(() => '') || '';
    const err = new Error((text || '').slice(0, 300) || `Web Push ${res?.status || 0}`);
    err.statusCode = res?.status || 0;
    throw err;
  }
  return { statusCode: res.status };
}
