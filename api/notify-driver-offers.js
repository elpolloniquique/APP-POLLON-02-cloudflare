/**
 * Vercel Serverless — avisa a repartidores con oferta pendiente.
 * POST /api/notify-driver-offers  Body: { jobId }
 *
 * Prioridad:
 *  1) FCM HTTP v1 (FIREBASE_SERVICE_ACCOUNT_JSON)  ← recomendado
 *  2) FCM legacy (FCM_SERVER_KEY) si aún existe
 *  3) Web Push (VAPID) fallback
 */
import { createClient } from '@supabase/supabase-js';
import {
  env,
  parseServiceAccount,
  isFcmConfigured,
  fcmModeLabel,
} from './_lib/fcmSend.js';
import { handleGpsPing, isGpsPingRequest } from './_lib/gpsPing.js';
import { setWebPushVapid, sendWebPushNotification, cleanVapidKey } from './_lib/webPushSend.js';
import { listOpenNotifyJobIds, unwrapJobId, findDriverIdForAuthUser } from './_lib/ensureNotifyOffers.js';
import { sendPushesForJob, remindDriverWebPush } from './_lib/sendJobPushes.js';
import { retryAndNotifyOffers } from './_lib/retryAndNotify.js';

export default async function handler(req, res) {
  if (isGpsPingRequest(req)) {
    return handleGpsPing(req, res);
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublic = cleanVapidKey(env('EP_WEB_PUSH_PUBLIC_KEY', 'VITE_VAPID_PUBLIC_KEY', 'VAPID_PUBLIC_KEY'));
  const vapidPrivate = cleanVapidKey(env('VAPID_PRIVATE_KEY'));
  const vapidSubject = String(env('VAPID_SUBJECT') || 'mailto:contacto@el-pollon.cl').trim();
  const hasFcm = isFcmConfigured();

  // Chequeo público: no revela secretos, sí dice si Cloudflare tiene el par VAPID.
  if (req.method === 'GET') {
    const q = req.query || {};
    if (q.check === 'vapid' || q.check === 'chain') {
      const report = {
        vapidPrivate: Boolean(vapidPrivate),
        vapidPublic: Boolean(vapidPublic),
        vapidPublicLen: vapidPublic.length,
        vapidPublicPrefix: vapidPublic.slice(0, 12),
        vapidSubject,
        supabase: Boolean(supabaseUrl && anonKey && serviceKey),
        fcm: hasFcm,
      };
      if (q.check === 'chain' && supabaseUrl && serviceKey) {
        const admin = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const [{ count: pushSubs }, { count: pendingOffers }, openIds] = await Promise.all([
          admin.from('ep_driver_push_subscriptions').select('id', { count: 'exact', head: true }),
          admin.from('ep_delivery_offers').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          listOpenNotifyJobIds(admin),
        ]);
        report.pushSubscriptions = Number(pushSubs) || 0;
        report.pendingOffers = Number(pendingOffers) || 0;
        report.openJobs = openIds.length;
        const latestRes = await admin
          .from('pedidos')
          .select('id, codigo_pedido, estado, tipo_entrega, creado_en')
          .in('estado', ['pendiente', 'nuevo'])
          .order('creado_en', { ascending: false })
          .limit(8);
        const latest = latestRes.data || [];
        const latestIds = latest.map((p) => p.id).filter(Boolean);
        let jobsByOrder = {};
        if (latestIds.length) {
          const { data: jobRows } = await admin
            .from('ep_delivery_jobs')
            .select('id, source_order_id, status, ticket_code, assigned_driver_id')
            .in('source_order_id', latestIds);
          jobsByOrder = Object.fromEntries((jobRows || []).map((j) => [j.source_order_id, j]));
        }
        report.latestNuevos = latest.map((p) => {
          const job = jobsByOrder[p.id];
          return {
            codigo: p.codigo_pedido || '',
            estado: p.estado,
            tipo: p.tipo_entrega || 'delivery',
            hasJob: Boolean(job),
            jobStatus: job?.status || null,
            assigned: Boolean(job?.assigned_driver_id),
          };
        });
        report.ready = Boolean(
          vapidPublic && vapidPrivate && supabaseUrl && serviceKey && (Number(pushSubs) || 0) > 0,
        );
        report.pushEngine = 'webcrypto';
        try {
          const { data: stamp } = await admin
            .from('ep_internal_secrets')
            .select('value, updated_at')
            .eq('key', 'last_driver_notify_at')
            .maybeSingle();
          if (stamp?.updated_at) {
            const ago = Math.round((Date.now() - new Date(stamp.updated_at).getTime()) / 1000);
            report.lastNotifyAgoSec = ago;
            report.lastNotifyAt = stamp.updated_at;
          }
        } catch {
          /* sin tabla de sello */
        }
        report.missing = [
          !vapidPublic ? 'clave_publica' : null,
          !vapidPrivate ? 'clave_privada' : null,
          !(supabaseUrl && serviceKey) ? 'supabase' : null,
          !(Number(pushSubs) > 0) ? 'suscripcion_pollito' : null,
        ].filter(Boolean);
      }
      return res.status(200).json(report);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return res.status(500).json({ error: 'Faltan vars Supabase (URL, ANON, SERVICE_ROLE)' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Sin autorización' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  let jobId = unwrapJobId(body.jobId);
  const orderId = String(body.orderId || body.order_id || '').trim();
  const selfTest = Boolean(body.selfTest);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Token inválido' });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Prueba Web Push del propio repartidor (PWA pollito → bandeja)
  if (selfTest) {
    const driverId = await findDriverIdForAuthUser(admin, userData.user.id);
    if (!driverId) {
      return res.status(403).json({ error: 'No eres repartidor' });
    }
    if (!vapidPublic || !vapidPrivate) {
      return res.status(200).json({
        ok: false,
        webConfigured: false,
        webSent: 0,
        error: 'VAPID no configurado en el servidor. En Cloudflare Pages falta VAPID_PRIVATE_KEY (secret, Runtime).',
      });
    }
    const { data: subs } = await admin
      .from('ep_driver_push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('driver_id', driverId);
    if (!subs?.length) {
      return res.status(200).json({
        ok: false,
        webConfigured: true,
        webSent: 0,
        error: 'Sin suscripción guardada. Activa notificaciones en la PWA.',
      });
    }
    const { count: pendingCount } = await admin
      .from('ep_delivery_offers')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', driverId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());
    const badgeCount = Math.max(1, Number(pendingCount) || 1);
    const stamp = Date.now();
    setWebPushVapid(vapidSubject, vapidPublic, vapidPrivate);
    let webSent = 0;
    let lastError = '';
    const staleWeb = [];
    await Promise.all(
      subs.map(async (sub) => {
        const payload = JSON.stringify({
          title: 'El Pollón · Nuevo pedido',
          body: 'Prueba de bandeja · Desliza desde arriba · El número va en el ícono del pollito · Acepta en app nativa',
          url: '/repartidor',
          tag: `pollon-selftest-${stamp}`,
          badgeCount,
          type: 'driver_offer_test',
        });
        try {
          await sendWebPushNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { urgency: 'high', TTL: 3600 },
          );
          webSent += 1;
        } catch (err) {
          const code = err?.statusCode;
          if (code === 404 || code === 410) staleWeb.push(sub.id);
          else lastError = err?.message || String(err);
        }
      }),
    );
    if (staleWeb.length) {
      await admin.from('ep_driver_push_subscriptions').delete().in('id', staleWeb);
    }
    return res.status(200).json({
      ok: webSent > 0,
      webSent,
      webConfigured: true,
      badgeCount,
      selfTest: true,
      vapidPublicPrefix: vapidPublic.slice(0, 12),
      lastError: lastError || undefined,
      error: webSent > 0 ? undefined : (lastError || 'El servidor no pudo entregar el aviso Web Push'),
    });
  }

  if (body.remindMe) {
    const driverId = await findDriverIdForAuthUser(admin, userData.user.id);
    if (!driverId) {
      return res.status(403).json({ error: 'No eres repartidor' });
    }
    // Un pollito abierto mantiene el reloj de 1 min para TODOS los repartidores.
    const global = await retryAndNotifyOffers(admin, { force: false }).catch(() => null);
    const reminded = await remindDriverWebPush(admin, driverId, {
      skipWeb: Number(global?.webSent) > 0,
    });
    return res.status(200).json({ ...reminded, remindMe: true, globalWeb: global?.webSent || 0 });
  }

  if (!jobId && orderId) {
    const { data: upserted } = await admin.rpc('ep_upsert_job_from_pedido', { p_order_id: orderId });
    jobId = unwrapJobId(upserted);
    if (!jobId) {
      const { data: existing } = await admin
        .from('ep_delivery_jobs')
        .select('id')
        .eq('source_order_id', orderId)
        .maybeSingle();
      jobId = existing?.id || '';
    }
  }

  if (!jobId) return res.status(400).json({ error: 'jobId requerido' });

  const { data: isStaff } = await userClient.rpc('ep_is_dispatch_staff');
  const { data: jobVisible, error: jobVisErr } = await userClient
    .from('ep_delivery_jobs')
    .select('id')
    .eq('id', jobId)
    .maybeSingle();
  if (!isStaff && (jobVisErr || !jobVisible)) {
    return res.status(403).json({ error: 'Sin permiso para este pedido' });
  }

  const pushed = await sendPushesForJob(admin, jobId);
  return res.status(200).json({
    ...pushed,
    fcmConfigured: hasFcm,
    fcmMode: fcmModeLabel(),
    webConfigured: Boolean(vapidPublic && vapidPrivate),
    projectId: parseServiceAccount()?.project_id || null,
  });
}
