/**
 * Verificación local Delivery / GPS / Mapas
 * Uso: node scripts/verify-delivery.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const base = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}` };

async function check(name, url, opt) {
  try {
    const r = await fetch(url, opt || { headers: h });
    const t = await r.text();
    const short = t.length > 160 ? `${t.slice(0, 160)}…` : t;
    const ok = r.status >= 200 && r.status < 300;
    console.log(`${ok ? 'OK ' : '!! '} ${name}: ${r.status} ${short}`);
    return ok;
  } catch (e) {
    console.log(`!!  ${name}: ERR ${e.message}`);
    return false;
  }
}

const tables = [
  'ep_driver_profiles',
  'ep_driver_location_latest',
  'ep_driver_location_events',
  'ep_delivery_jobs',
  'ep_delivery_assignments',
  'ep_delivery_offers',
  'ep_pricing_rules',
  'ep_dispatch_settings',
  'branches',
  'pedidos',
];

let fails = 0;
for (const t of tables) {
  const ok = await check(t, `${base}/rest/v1/${t}?select=*&limit=1`);
  if (!ok) fails += 1;
}

await check('branches_gps', `${base}/rest/v1/branches?select=id,name,lat,lng&limit=8`);
await check('quote', `${base}/rest/v1/rpc/ep_quote_delivery`, {
  method: 'POST',
  headers: { ...h, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_branch_id: null, p_distance_km: 3.5 }),
});
const verifyOk = await check('ep_verify', `${base}/rest/v1/rpc/ep_verify_delivery_module`, {
  method: 'POST',
  headers: { ...h, 'Content-Type': 'application/json' },
  body: '{}',
});
if (!verifyOk) {
  console.log('\n→ Falta ejecutar: supabase/fix-delivery-production-ready.sql en SQL Editor');
  fails += 1;
}
await check('OSRM', 'https://router.project-osrm.org/route/v1/driving/-70.15,-20.23;-70.14,-20.22?overview=false', {});
await check('CARTO', 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json', {});

console.log(fails === 0 ? '\nTodo OK (tablas + mapas).' : `\nPendientes: ${fails}. Revisa arriba.`);
process.exit(fails === 0 ? 0 : 1);
