/**
 * POST nativo Capgo (pantalla apagada / otra app).
 * Escribe en Cloudflare KV. No toca Realtime de Supabase ni reavisa ofertas.
 */
import { applyCloudflareEnv } from '../_lib/vercelAdapter.js';
import { ingestDriverLivePoint } from '../_lib/ingestDriverLive.js';
import {
  supabaseClients,
  adminClient,
  findDriverByPingToken,
} from '../_lib/driverLiveAuth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}

async function parseBody(request) {
  const ct = String(request.headers.get('content-type') || '');
  try {
    if (ct.includes('application/json')) {
      return await request.json();
    }
    const text = await request.text();
    if (!text) return {};
    if (text.startsWith('{')) return JSON.parse(text);
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
  } catch {
    return {};
  }
}

export async function onRequest(context) {
  applyCloudflareEnv(context.env);
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  const token = String(url.searchParams.get('k') || url.searchParams.get('token') || '').trim();
  if (!UUID_RE.test(token)) {
    return json({ error: 'token GPS inválido' }, 401);
  }

  const creds = supabaseClients();
  if (creds.error) return json({ error: creds.error }, 500);

  const admin = adminClient(creds.url, creds.service);
  const driverRow = await findDriverByPingToken(admin, token);
  if (!driverRow?.id) return json({ error: 'token GPS inválido' }, 401);

  const body = await parseBody(request);
  const coords = body?.location || body?.coords || body;
  const result = await ingestDriverLivePoint({
    env,
    admin,
    driverRow,
    lat: coords?.lat ?? coords?.latitude,
    lng: coords?.lng ?? coords?.longitude,
    heading: coords?.heading ?? coords?.bearing,
    speed: coords?.speed,
    accuracy: coords?.accuracy,
  });
  if (result.status) return json(result, result.status);
  return json({ ok: true, cloudflare: true, supabase_gps: false, ...result });
}
