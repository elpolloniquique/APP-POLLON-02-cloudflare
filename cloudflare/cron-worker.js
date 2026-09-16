/**
 * Reloj Cloudflare: cada 2 minutos avisa al pollito solo si el pedido
 * sigue en estado Nuevo y sin repartidor. A las 15:00 UTC, cola del bot.
 *
 * Deploy: npx wrangler deploy -c wrangler.cron.toml
 */
export default {
  async scheduled(event, env, ctx) {
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

    const run = async () => {
      try {
        await fetch(url.toString(), {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(25000),
        });
      } catch (err) {
        console.error('[Pollón cron]', path, err?.message || err);
      }
    };

    if (typeof ctx?.waitUntil === 'function') {
      ctx.waitUntil(run());
      return;
    }
    await run();
  },
};
