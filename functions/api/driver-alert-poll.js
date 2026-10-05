/**
 * Respaldo Xiaomi/OEM: el Service Worker consulta pedidos pendientes
 * si el Web Push de Chrome fue bloqueado. Auth = endpoint+auth de la suscripción.
 */
import { applyCloudflareEnv } from '../_lib/vercelAdapter.js';
import { supabaseClients, adminClient } from '../_lib/driverLiveAuth.js';
import { jobIsNuevoUnassigned } from '../../api/_lib/ensureNotifyOffers.js';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}

function ticketLabel(code) {
  const s = String(code || '').trim();
  if (!s) return '—';
  if (/^\d+$/.test(s)) return s.padStart(6, '0');
  return s;
}

function moneyCLP(n) {
  try {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(Number(n) || 0);
  } catch {
    return `$${Math.round(Number(n) || 0)}`;
  }
}

function offerNoticeText(job, { jobId, offerId, fee } = {}) {
  const ticket = ticketLabel(job?.ticket_code);
  const addr = String(job?.customer_address || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  const money = moneyCLP(fee ?? job?.delivery_fee ?? 0);
  const id = String(jobId || job?.id || '');
  return {
    title: `NUEVO PEDIDO Nº ${ticket}`,
    body: [addr || null, `Delivery ${money}`].filter(Boolean).join(' · ') || `Delivery ${money}`,
    ticket,
    address: addr,
    fee: money,
    tag: id ? `pollon-job-${id}` : 'pollon-driver-offer',
    jobId: id || null,
    offerId: offerId || null,
  };
}

export async function onRequest(context) {
  applyCloudflareEnv(context.env);
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const endpoint = String(body.endpoint || '').trim();
  const auth = String(body.auth || '').trim();
  if (!endpoint || !auth || endpoint.length < 20) {
    return json({ error: 'suscripción inválida' }, 401);
  }

  const creds = supabaseClients();
  if (creds.error) return json({ error: creds.error }, 500);
  const admin = adminClient(creds.url, creds.service);

  const { data: sub, error } = await admin
    .from('ep_driver_push_subscriptions')
    .select('id, driver_id, auth')
    .eq('endpoint', endpoint)
    .maybeSingle();
  if (error || !sub?.driver_id || String(sub.auth || '') !== auth) {
    return json({ error: 'suscripción inválida' }, 401);
  }

  const { data: offers } = await admin
    .from('ep_delivery_offers')
    .select('id, job_id, offered_fee, ep_delivery_jobs(ticket_code, customer_address, delivery_fee)')
    .eq('driver_id', sub.driver_id)
    .eq('status', 'pending')
    .limit(8);

  const out = [];
  for (const offer of offers || []) {
    const jobId = offer.job_id;
    if (!jobId) continue;
    const gate = await jobIsNuevoUnassigned(admin, jobId);
    if (!gate.ok) continue;
    const job = offer.ep_delivery_jobs || gate.job || {};
    const notice = offerNoticeText(job, { jobId, offerId: offer.id, fee: offer.offered_fee ?? job.delivery_fee });
    out.push({
      jobId,
      offerId: offer.id,
      title: notice.title,
      body: notice.body,
      tag: notice.tag,
      ticket: notice.ticket,
      address: notice.address,
      fee: notice.fee,
    });
  }

  return json({ ok: true, offers: out });
}
