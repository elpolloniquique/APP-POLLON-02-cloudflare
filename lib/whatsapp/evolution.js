/** Cliente Evolution API (Baileys) — solo server-side */

import { env } from './supabaseAdmin.js';
import { normalizeWhatsappPhone } from './phone.js';

function baseUrl() {
  return String(env('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
}

function apiKey() {
  return env('EVOLUTION_API_KEY');
}

export function evolutionConfigured() {
  return Boolean(baseUrl() && apiKey());
}

export function evolutionHostLabel() {
  try {
    const u = new URL(baseUrl());
    return `${u.protocol}//${u.host}`;
  } catch {
    return baseUrl() || '(sin EVOLUTION_API_URL)';
  }
}

function friendlyEvoError(err) {
  const host = evolutionHostLabel();
  const msg = String(err?.message || err || '');
  if (/fetch failed|Failed to parse URL|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|aborted|AbortError|timeout/i.test(msg)) {
    return `No se pudo alcanzar Evolution en ${host}. El servidor tiene que estar ENCENDIDO y el puerto abierto a internet (firewall / Oracle Security List). Prueba en el navegador: ${host}`;
  }
  return msg;
}

async function evoFetch(path, { method = 'GET', body, timeoutMs = 12000 } = {}) {
  const base = baseUrl();
  if (!base || !apiKey()) {
    throw new Error('Faltan EVOLUTION_API_URL o EVOLUTION_API_KEY en Vercel');
  }
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        apikey: apiKey(),
        'Content-Type': 'application/json',
      },
      body: body != null ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    if (!res.ok) {
      const msg = json?.message || json?.error || json?.raw || `Evolution ${res.status}`;
      const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      err.status = res.status;
      err.payload = json;
      throw err;
    }
    return json;
  } catch (err) {
    const wrapped = new Error(friendlyEvoError(err));
    wrapped.status = err?.status;
    wrapped.payload = err?.payload;
    throw wrapped;
  } finally {
    clearTimeout(timer);
  }
}

export async function pingEvolution() {
  if (!evolutionConfigured()) {
    return { ok: false, configured: false, host: evolutionHostLabel(), error: 'Faltan EVOLUTION_API_URL / EVOLUTION_API_KEY' };
  }
  try {
    await evoFetch('/instance/fetchInstances', { timeoutMs: 8000 });
    return { ok: true, configured: true, reachable: true, host: evolutionHostLabel() };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      reachable: false,
      host: evolutionHostLabel(),
      error: err.message || String(err),
    };
  }
}

export async function ensureInstanceReady(instanceName, webhookUrl) {
  try {
    await evoFetch(`/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`);
  } catch {
    await evoFetch('/instance/create', {
      method: 'POST',
      body: {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      },
    });
  }

  if (webhookUrl) {
    try {
      await evoFetch(`/webhook/set/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
        body: {
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: [
            'MESSAGES_UPSERT',
            'CONNECTION_UPDATE',
            'QRCODE_UPDATED',
          ],
        },
      });
    } catch {
      try {
        await evoFetch(`/webhook/set/${encodeURIComponent(instanceName)}`, {
          method: 'POST',
          body: {
            webhook: {
              url: webhookUrl,
              byEvents: false,
              base64: false,
              events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
            },
          },
        });
      } catch {
        /* webhook opcional: el usuario puede pegarlo a mano en Evolution */
      }
    }
  }
}

export async function ensureInstance(instanceName, webhookUrl) {
  await ensureInstanceReady(instanceName, webhookUrl);
  return connectInstance(instanceName);
}

export async function connectInstance(instanceName) {
  const data = await evoFetch(`/instance/connect/${encodeURIComponent(instanceName)}`);
  return normalizeQr(data);
}

export function formatPairingCode(value) {
  const s = String(value || '').replace(/[\s-]/g, '').toUpperCase();
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4)}`;
  return s || '';
}

function looksLikePairingCode(value) {
  const s = String(value || '').replace(/[\s-]/g, '').toUpperCase();
  return /^[A-Z0-9]{8}$/.test(s);
}

function extractPairingCode(data) {
  const candidates = [
    data?.pairingCode,
    data?.pairing_code,
    data?.qrcode?.pairingCode,
    data?.qrcode?.pairing_code,
    data?.instance?.pairingCode,
    data?.qrcode?.code,
    data?.code,
  ];
  for (const c of candidates) {
    if (looksLikePairingCode(c)) return formatPairingCode(c);
  }
  return null;
}

/** Pairing code WhatsApp (Dispositivos vinculados → vincular con número). */
export async function connectWithPairingCode(instanceName, phone) {
  const normalized = normalizeWhatsappPhone(phone);
  if (!normalized) throw new Error('Falta el WhatsApp de la sucursal');

  const inst = encodeURIComponent(instanceName);
  const attempts = [
    () => evoFetch(`/instance/connect/${inst}?number=${encodeURIComponent(normalized)}`),
    () => evoFetch(`/instance/connect/${inst}`, { method: 'POST', body: { number: normalized } }),
    () => evoFetch(`/instance/connect/${inst}`),
  ];

  let lastErr = null;
  let lastParsed = null;
  for (const run of attempts) {
    try {
      const data = await run();
      lastParsed = normalizeQr(data);
      if (lastParsed.pairingCode || lastParsed.qr) {
        return { ...lastParsed, phone: normalized, host: evolutionHostLabel() };
      }
    } catch (err) {
      lastErr = err;
    }
  }

  if (lastParsed) return { ...lastParsed, phone: normalized, host: evolutionHostLabel() };
  throw lastErr || new Error('Evolution no mandó código de vinculación');
}

export async function connectionState(instanceName) {
  try {
    const data = await evoFetch(`/instance/connectionState/${encodeURIComponent(instanceName)}`);
    return { ...normalizeState(data), reachable: true };
  } catch (first) {
    try {
      const data = await evoFetch(`/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`);
      const row = Array.isArray(data) ? data[0] : (data?.instance || data);
      return { ...normalizeState(row), reachable: true };
    } catch {
      return {
        state: 'unreachable',
        connected: false,
        phone: null,
        raw: null,
        reachable: false,
        error: first?.message || 'Evolution no responde',
      };
    }
  }
}

export async function logoutInstance(instanceName) {
  try {
    await evoFetch(`/instance/logout/${encodeURIComponent(instanceName)}`, { method: 'DELETE' });
  } catch {
    await evoFetch(`/instance/logout/${encodeURIComponent(instanceName)}`, { method: 'PUT' });
  }
}

export async function deleteInstance(instanceName) {
  try {
    await evoFetch(`/instance/delete/${encodeURIComponent(instanceName)}`, { method: 'DELETE' });
  } catch {
    /* ignore */
  }
}

export async function sendText(instanceName, phone, text) {
  if (!text || !phone) return { skipped: true };
  const number = String(phone).replace(/\D/g, '');
  return evoFetch(`/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: 'POST',
    body: {
      number,
      text: String(text),
    },
  });
}

/** URL pública http(s) para foto de plato (relativa → sitio El Pollón). */
export function publicMediaUrl(imageUrl) {
  const raw = String(imageUrl || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  const site = (env('VITE_PUBLIC_SITE_URL', 'EP_PUBLIC_SITE_URL') || 'https://www.el-pollon.cl').replace(/\/+$/, '');
  return raw.startsWith('/') ? `${site}${raw}` : `${site}/${raw}`;
}

/** 1 imagen (Fase 2). Evolution v1/v2. */
export async function sendImage(instanceName, phone, imageUrl, caption = '') {
  if (!imageUrl || !phone) return { skipped: true };
  const number = String(phone).replace(/\D/g, '');
  const inst = encodeURIComponent(instanceName);
  const attempts = [
    {
      path: `/message/sendMedia/${inst}`,
      body: {
        number,
        mediatype: 'image',
        media: imageUrl,
        caption: caption || '',
      },
    },
    {
      path: `/message/sendWhatsApp/${inst}`,
      body: {
        number,
        mediaMessage: {
          mediatype: 'image',
          media: imageUrl,
          caption: caption || '',
        },
      },
    },
  ];
  let lastErr = null;
  for (const a of attempts) {
    try {
      return await evoFetch(a.path, { method: 'POST', body: a.body });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('No se pudo enviar imagen');
}

function normalizeQr(data) {
  const qrRaw =
    data?.qrcode?.base64
    || data?.base64
    || data?.qr
    || (typeof data?.qrcode === 'string' ? data.qrcode : null)
    || null;
  const qr = typeof qrRaw === 'string' && qrRaw.length > 40 ? qrRaw : null;
  return {
    qr,
    code: looksLikePairingCode(data?.code) ? formatPairingCode(data.code) : null,
    pairingCode: extractPairingCode(data),
    raw: data,
  };
}

function normalizeState(data) {
  const inst = data?.instance || data?.instanceInfo || data;
  const state = String(
    inst?.state
    || inst?.status
    || data?.state
    || data?.status
    || data?.connectionStatus
    || '',
  ).toLowerCase();
  const connected = ['open', 'connected', 'online'].includes(state);
  const phone =
    inst?.ownerJid
    || inst?.wuid
    || inst?.owner
    || data?.ownerJid
    || data?.phone
    || null;
  return { state: state || 'close', connected, phone: phone ? String(phone) : null, raw: data };
}

/** Extrae texto + teléfono de webhook Evolution (v1/v2). */
export function parseInboundWebhook(body) {
  const event = String(body?.event || body?.type || '').toLowerCase();
  const instance = body?.instance || body?.instanceName || body?.data?.instance || null;
  const data = body?.data || body?.message || body;

  if (event && !event.includes('message') && event !== 'messages.upsert' && event !== 'messages_upsert') {
    return { kind: event || 'other', instance, fromMe: true, phone: null, text: '', pushName: '', messageId: null };
  }

  const key = data?.key || data?.message?.key || {};
  const fromMe = Boolean(key.fromMe);
  const remoteJid = key.remoteJid || data?.remoteJid || '';
  if (String(remoteJid).includes('@g.us')) {
    return { kind: 'group', instance, fromMe: true, phone: null, text: '', pushName: '', messageId: key.id || null };
  }

  const msg = data?.message || data?.messages?.[0]?.message || {};
  const text =
    msg.conversation
    || msg.extendedTextMessage?.text
    || msg.imageMessage?.caption
    || msg.videoMessage?.caption
    || msg.documentMessage?.caption
    || data?.messageType === 'conversation' && data?.message?.conversation
    || data?.text
    || data?.body
    || '';

  return {
    kind: 'message',
    instance,
    fromMe,
    remoteJid,
    phone: remoteJid,
    text: String(text || '').trim(),
    pushName: data?.pushName || data?.notifyName || '',
    messageId: key.id || data?.id || null,
    timestamp: data?.messageTimestamp || data?.timestamp || null,
  };
}
