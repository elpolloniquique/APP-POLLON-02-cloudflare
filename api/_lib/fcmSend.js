/**
 * FCM HTTP v1 (+ legacy) compartido por notify / cron.
 */
import crypto from 'node:crypto';

export function env(...keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v) return v;
  }
  return '';
}

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function parseServiceAccount() {
  const raw = env('FIREBASE_SERVICE_ACCOUNT_JSON', 'GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch {
      return null;
    }
  }
}

export function isFcmV1Configured(sa = parseServiceAccount()) {
  return Boolean(sa?.client_email && sa?.private_key && sa?.project_id);
}

export function isFcmConfigured() {
  return isFcmV1Configured() || Boolean(env('FCM_SERVER_KEY', 'FIREBASE_SERVER_KEY'));
}

export function fcmModeLabel() {
  if (isFcmV1Configured()) return 'http_v1';
  if (env('FCM_SERVER_KEY', 'FIREBASE_SERVER_KEY')) return 'legacy';
  return 'none';
}

let cachedAccessToken = { value: '', exp: 0 };

async function getFirebaseAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken.value && cachedAccessToken.exp > now + 60) {
    return cachedAccessToken.value;
  }

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  }));
  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(sa.private_key).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const jwt = `${unsigned}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error_description || tokenJson.error || 'No se pudo obtener access token FCM');
  }
  cachedAccessToken = {
    value: tokenJson.access_token,
    exp: now + Number(tokenJson.expires_in || 3600),
  };
  return cachedAccessToken.value;
}

async function sendFcmV1(sa, deviceToken, { title, body, data }) {
  const accessToken = await getFirebaseAccessToken(sa);
  const projectId = sa.project_id;
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title, body },
          data: Object.fromEntries(
            Object.entries({
              ...data,
              title,
              body,
            }).map(([k, v]) => [k, String(v ?? '')]),
          ),
          android: {
            priority: 'HIGH',
            ttl: '600s',
            notification: {
              channelId: 'pollon_driver_alarm_v3',
              sound: 'default',
              defaultVibrateTimings: true,
              defaultSound: true,
              notificationPriority: 'PRIORITY_MAX',
              visibility: 'PUBLIC',
              tag: data.tag || 'pollon-offer',
              notificationCount: Math.max(1, Number(data.badgeCount) || 1),
              ticker: title,
              sticky: true,
              clickAction: 'FCM_PLUGIN_ACTIVITY',
            },
          },
        },
      }),
    },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const status = json?.error?.status || '';
    const notRegistered = /NOT_FOUND|UNREGISTERED/i.test(status)
      || /Requested entity was not found/i.test(json?.error?.message || '');
    return { ok: false, status: res.status, json, notRegistered };
  }
  return { ok: true, json };
}

async function sendFcmLegacy(token, { title, body, data }) {
  const key = env('FCM_SERVER_KEY', 'FIREBASE_SERVER_KEY');
  if (!key || !token) return { ok: false, reason: 'no_key' };

  const res = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      Authorization: `key=${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: token,
      priority: 'high',
      content_available: true,
      notification: {
        title,
        body,
        sound: 'default',
        click_action: 'FCM_PLUGIN_ACTIVITY',
        tag: data.tag || 'pollon-offer',
        android_channel_id: 'pollon_driver_alarm_v3',
      },
      data: {
        ...data,
        title,
        body,
      },
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.failure === 1) {
    return {
      ok: false,
      status: res.status,
      json,
      notRegistered: json?.results?.[0]?.error === 'NotRegistered',
    };
  }
  return { ok: true, json };
}

export async function sendFcm(deviceToken, payload) {
  const sa = parseServiceAccount();
  if (isFcmV1Configured(sa)) {
    return sendFcmV1(sa, deviceToken, payload);
  }
  return sendFcmLegacy(deviceToken, payload);
}
