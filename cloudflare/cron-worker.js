/**
 * Cron Triggers de Cloudflare (backup diario, igual que vercel.json).
 * El reloj real de 1 min sigue en Supabase pg_cron → /api/cron-retry-driver-offers
 *
 * Deploy: npx wrangler deploy -c wrangler.cron.toml
 * Secret: npx wrangler secret put CRON_SECRET -c wrangler.cron.toml
 */
export default {
  async scheduled(event, env) {
    const base = String(env.EP_PUBLIC_SITE_URL || env.VITE_PUBLIC_SITE_URL || 'https://www.el-pollon.cl').replace(/\/$/, '');
    const secret = String(env.CRON_SECRET || '');
    const headers = {
      Authorization: secret ? `Bearer ${secret}` : '',
      'x-cloudflare-cron': '1',
      'x-vercel-cron': '1',
    };
    const path = event.cron === '0 15 * * *'
      ? '/api/bot-dispatch-queue'
      : '/api/cron-retry-driver-offers';
    const url = new URL(`${base}${path}`);
    if (secret) url.searchParams.set('secret', secret);
    const res = await fetch(url.toString(), { method: 'GET', headers });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Cron ${path} → ${res.status} ${text.slice(0, 300)}`);
    }
  },
};
