/**
 * Adapta handlers Vercel (req, res) a Cloudflare Pages Functions.
 * Copia env de Cloudflare a process.env para que api/ y lib/ no cambien.
 */

export function applyCloudflareEnv(env = {}) {
  if (typeof process === 'undefined' || !env) return;
  for (const [key, value] of Object.entries(env)) {
    if (value == null || value === '') continue;
    if (typeof value === 'object') continue;
    process.env[key] = String(value);
  }
  if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  }
  if (!process.env.SUPABASE_ANON_KEY && process.env.VITE_SUPABASE_ANON_KEY) {
    process.env.SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
  }
  if (!process.env.VAPID_PUBLIC_KEY && process.env.VITE_VAPID_PUBLIC_KEY) {
    process.env.VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY;
  }
  if (!process.env.EP_PUBLIC_SITE_URL && process.env.VITE_PUBLIC_SITE_URL) {
    process.env.EP_PUBLIC_SITE_URL = process.env.VITE_PUBLIC_SITE_URL;
  }
  if (!process.env.CF_PAGES) process.env.CF_PAGES = '1';
}

function headersToObject(headers) {
  const out = Object.create(null);
  headers.forEach((value, key) => {
    out[String(key).toLowerCase()] = value;
  });
  return out;
}

async function parseBody(request, headerObj) {
  if (request.method === 'GET' || request.method === 'HEAD') return {};
  const raw = await request.text();
  if (!raw) return {};
  const ct = String(headerObj['content-type'] || '');
  if (ct.includes('application/json') || raw.startsWith('{') || raw.startsWith('[')) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

export async function runVercelHandler(handler, request, env) {
  applyCloudflareEnv(env);
  const url = new URL(request.url);
  const headerObj = headersToObject(request.headers);
  const body = await parseBody(request, headerObj);

  const req = {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers: headerObj,
    query: Object.fromEntries(url.searchParams.entries()),
    body,
    socket: {
      remoteAddress: headerObj['cf-connecting-ip'] || headerObj['x-real-ip'] || 'unknown',
    },
  };

  let statusCode = 200;
  const resHeaders = new Headers();
  let payload;
  let settled = false;
  let settle = () => {};
  const wait = new Promise((resolve) => {
    settle = resolve;
  });

  const finish = () => {
    if (settled) return;
    settled = true;
    settle();
  };

  const res = {
    statusCode,
    setHeader(name, value) {
      resHeaders.set(name, String(value));
      return res;
    },
    getHeader(name) {
      return resHeaders.get(name);
    },
    status(code) {
      statusCode = Number(code) || 200;
      res.statusCode = statusCode;
      return res;
    },
    json(data) {
      if (!resHeaders.has('Content-Type')) {
        resHeaders.set('Content-Type', 'application/json; charset=utf-8');
      }
      payload = JSON.stringify(data);
      finish();
      return res;
    },
    end(data) {
      if (data !== undefined && data !== null) {
        payload = typeof data === 'string' ? data : String(data);
      }
      finish();
      return res;
    },
    send(data) {
      return res.end(data);
    },
  };

  try {
    await handler(req, res);
  } catch (err) {
    if (!settled) {
      statusCode = 500;
      resHeaders.set('Content-Type', 'application/json; charset=utf-8');
      payload = JSON.stringify({ error: err?.message || 'Error interno' });
      finish();
    }
  }

  if (!settled) finish();
  await wait;
  return new Response(payload ?? null, { status: statusCode, headers: resHeaders });
}

export function asPagesFunction(handler) {
  return async function onRequest(context) {
    return runVercelHandler(handler, context.request, context.env);
  };
}
