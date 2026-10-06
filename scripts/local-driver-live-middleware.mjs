/**
 * GPS en vivo + recarga de ofertas en localhost (Vite).
 * Admin (5173) y nativa (5174) comparten los archivos .local-*.json
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from 'vite';

const STORE = join(process.cwd(), '.local-driver-live.json');
const STAFF_STORE = join(process.cwd(), '.local-staff-jwt.json');
const CLOSED_JOB = new Set([
  'delivered',
  'cancelled',
  'assigned',
  'heading_to_branch',
  'picked_up',
  'delivering',
]);

function readDb() {
  try {
    if (!existsSync(STORE)) return { drivers: {} };
    return JSON.parse(readFileSync(STORE, 'utf8')) || { drivers: {} };
  } catch {
    return { drivers: {} };
  }
}

function writeDb(db) {
  const tmp = `${STORE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(db));
  renameSync(tmp, STORE);
}

function readStaffJwt() {
  try {
    if (!existsSync(STAFF_STORE)) return '';
    const row = JSON.parse(readFileSync(STAFF_STORE, 'utf8')) || {};
    const token = String(row.token || '').trim();
    const saved = Date.parse(row.saved_at || '') || 0;
    if (!token || Date.now() - saved > 2 * 60 * 60 * 1000) return '';
    return token;
  } catch {
    return '';
  }
}

function writeStaffJwt(token) {
  const tmp = `${STAFF_STORE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ token, saved_at: new Date().toISOString() }));
  renameSync(tmp, STAFF_STORE);
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

function userClient(env, jwt) {
  return createClient(env.VITE_SUPABASE_URL || '', env.VITE_SUPABASE_ANON_KEY || '', {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveDriver(env, jwt, hintId) {
  const url = env.VITE_SUPABASE_URL || '';
  const anon = env.VITE_SUPABASE_ANON_KEY || '';
  let driverId = String(hintId || '').trim();
  let branchId = null;
  let driverName = null;
  if (!url || !anon || !jwt) return { driverId, branchId, driverName };
  const sb = userClient(env, jwt);
  const { data: userData } = await sb.auth.getUser(jwt);
  const user = userData?.user;
  if (!user?.id) return { driverId, branchId, driverName };

  const byAuth = await sb
    .from('ep_driver_profiles')
    .select('id, preferred_branch_id, profile_id')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (byAuth.data?.id) {
    return {
      driverId: byAuth.data.id,
      branchId: byAuth.data.preferred_branch_id || null,
      driverName,
    };
  }

  const profile = await sb
    .from('profiles')
    .select('id, full_name')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (profile.data?.id) {
    driverName = profile.data.full_name || null;
    const byProfile = await sb
      .from('ep_driver_profiles')
      .select('id, preferred_branch_id, profile_id')
      .eq('profile_id', profile.data.id)
      .maybeSingle();
    if (byProfile.data?.id) {
      return {
        driverId: byProfile.data.id,
        branchId: byProfile.data.preferred_branch_id || null,
        driverName,
      };
    }
  }
  return { driverId, branchId, driverName };
}

async function maybeSaveStaffJwt(env, jwt, rawUrl) {
  if (!jwt || !String(rawUrl || '').includes('view=staff')) return;
  const sb = userClient(env, jwt);
  const { data } = await sb.rpc('ep_is_dispatch_staff');
  if (data === true) writeStaffJwt(jwt);
}

async function reviveOpenOffers(env, driverJwt, driverId) {
  const driverSb = userClient(env, driverJwt);
  const rpc = await driverSb.rpc('ep_refresh_my_open_offers');
  if (!rpc.error && rpc.data) return { ok: true, ...(typeof rpc.data === 'object' ? rpc.data : {}), via: 'rpc' };

  const staffJwt = readStaffJwt();
  if (!staffJwt) {
    return { ok: false, revived: 0, reason: 'no_staff_session', hint: rpc.error?.message || 'rpc_missing' };
  }

  const sb = userClient(env, staffJwt);
  const peds = await sb
    .from('pedidos')
    .select('id')
    .eq('tipo_entrega', 'delivery')
    .in('estado', ['pendiente', 'nuevo'])
    .order('creado_en', { ascending: false })
    .limit(40);
  const orderIds = (peds.data || []).map((p) => p.id).filter(Boolean);
  if (!orderIds.length) return { ok: true, revived: 0, inserted: 0, via: 'local-staff' };

  const jobs = await sb
    .from('ep_delivery_jobs')
    .select('id, status, assigned_driver_id, delivery_fee')
    .in('source_order_id', orderIds);
  const open = (jobs.data || []).filter((j) => !j.assigned_driver_id && !CLOSED_JOB.has(j.status));
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  let revived = 0;
  let inserted = 0;

  for (const job of open) {
    const existing = await sb
      .from('ep_delivery_offers')
      .select('id, status')
      .eq('job_id', job.id)
      .eq('driver_id', driverId)
      .maybeSingle();
    if (existing.data?.status === 'rejected' || existing.data?.status === 'accepted') continue;
    if (existing.data) {
      if (existing.data.status !== 'pending') {
        const upd = await sb
          .from('ep_delivery_offers')
          .update({
            status: 'pending',
            offered_fee: job.delivery_fee || 0,
            expires_at: expiresAt,
            responded_at: null,
          })
          .eq('id', existing.data.id);
        if (!upd.error) revived += 1;
      }
    } else {
      const ins = await sb.from('ep_delivery_offers').insert({
        job_id: job.id,
        driver_id: driverId,
        status: 'pending',
        offered_fee: job.delivery_fee || 0,
        expires_at: expiresAt,
        responded_at: null,
      });
      if (!ins.error) inserted += 1;
    }
  }

  console.log(`[local-offers] driver=${driverId} revived=${revived} inserted=${inserted}`);
  return { ok: true, revived, inserted, jobs: open.length, via: 'local-staff' };
}

export function localDriverLivePlugin() {
  return {
    name: 'local-driver-live',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      const handler = async (req, res, next) => {
        const rawUrl = String(req.url || '');
        const path = rawUrl.split('?')[0];
        const isLive = path === '/api/driver-live';
        const isRefresh = path === '/api/driver-refresh-offers';
        if (!isLive && !isRefresh) return next();

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
          res.end();
          return;
        }

        try {
          const auth = String(req.headers.authorization || '');
          const jwt = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
          if (!jwt) return sendJson(res, 401, { error: 'Sin autorización' });

          if (isRefresh) {
            if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
            await readBody(req);
            const found = await resolveDriver(env, jwt);
            if (!found.driverId) return sendJson(res, 403, { error: 'No eres repartidor' });
            const result = await reviveOpenOffers(env, jwt, found.driverId);
            return sendJson(res, 200, { ...result, afterDelivery: true });
          }

          if (req.method === 'POST') {
            const body = await readBody(req);
            if (body?.done === true || body?.stop === true) {
              const found = await resolveDriver(env, jwt, body.driver_id);
              if (found.driverId) {
                const db = readDb();
                delete (db.drivers || {})[found.driverId];
                writeDb(db);
              }
              return sendJson(res, 200, { ok: true, stopped: true });
            }
            const lat = Number(body.lat ?? body.latitude);
            const lng = Number(body.lng ?? body.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
              return sendJson(res, 400, { error: 'Coordenadas inválidas' });
            }
            const found = await resolveDriver(env, jwt, body.driver_id);
            if (!found.driverId) return sendJson(res, 403, { error: 'No eres repartidor' });
            const db = readDb();
            db.drivers = db.drivers || {};
            db.drivers[found.driverId] = {
              driver_id: found.driverId,
              lat,
              lng,
              heading: body.heading ?? body.bearing ?? null,
              speed: body.speed ?? null,
              accuracy: body.accuracy ?? null,
              updated_at: new Date().toISOString(),
              branch_id: found.branchId,
              driver_name: found.driverName,
              phase: 'to_store',
            };
            writeDb(db);
            console.log(`[local-gps] ${found.driverId} ${lat.toFixed(5)},${lng.toFixed(5)}`);
            return sendJson(res, 200, { ok: true, pending: false, phase: 'to_store' });
          }

          if (req.method === 'GET') {
            await maybeSaveStaffJwt(env, jwt, rawUrl).catch(() => {});
            const db = readDb();
            const cutoff = Date.now() - 30 * 60 * 1000;
            const locations = Object.values(db.drivers || {}).filter((row) => {
              const t = Date.parse(row.updated_at || '') || 0;
              return t >= cutoff && Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng));
            });
            return sendJson(res, 200, { locations });
          }

          return sendJson(res, 405, { error: 'Method not allowed' });
        } catch (err) {
          return sendJson(res, 500, { error: err?.message || 'Error GPS local' });
        }
      };

      return () => {
        server.middlewares.use(handler);
        const stack = server.middlewares.stack;
        const last = stack.pop();
        stack.unshift(last);
      };
    },
  };
}
