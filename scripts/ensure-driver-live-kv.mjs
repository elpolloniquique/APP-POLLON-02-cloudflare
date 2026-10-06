/**
 * Crea (si falta) el KV de GPS en vivo, lo escribe en wrangler.toml
 * y lo vincula al proyecto Pages. wrangler pages deploy lee el binding
 * desde wrangler.toml — el PATCH al dashboard no basta.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const PROJECT = process.env.CF_PAGES_PROJECT || 'el-pollon';
const TITLE = 'el-pollon-driver-live';
const BINDING = 'DRIVER_LIVE_KV';
const WRANGLER = join(process.cwd(), 'wrangler.toml');

function fail(msg, { fatal = false } = {}) {
  console.error(`[driver-live-kv] ${msg}`);
  process.exitCode = fatal ? 1 : 0;
}

async function cf(path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err = data?.errors?.[0]?.message || res.statusText || `HTTP ${res.status}`;
    throw new Error(err);
  }
  return data;
}

function writeWranglerKvId(id) {
  let text = readFileSync(WRANGLER, 'utf8');
  const block = `[[kv_namespaces]]\nbinding = "${BINDING}"\nid = "${id}"`;
  if (/\[\[kv_namespaces\]\][\s\S]*?binding\s*=\s*"DRIVER_LIVE_KV"/.test(text)) {
    text = text.replace(
      /\[\[kv_namespaces\]\]\s*\n\s*binding\s*=\s*"DRIVER_LIVE_KV"\s*\n\s*id\s*=\s*"[^"]*"/,
      block,
    );
  } else {
    text = `${text.trimEnd()}\n\n# GPS en vivo (rellenado por scripts/ensure-driver-live-kv.mjs)\n${block}\n`;
  }
  writeFileSync(WRANGLER, text);
  console.log(`[driver-live-kv] wrangler.toml ← ${BINDING}=${id}`);
}

async function main() {
  if (!ACCOUNT || !TOKEN) {
    fail('Sin CLOUDFLARE_API_TOKEN / ACCOUNT_ID — el GPS usará fallback en Functions.');
    return;
  }

  const listed = await cf(`/accounts/${ACCOUNT}/storage/kv/namespaces?per_page=100`);
  const namespaces = listed.result || [];
  let ns = namespaces.find((n) => n.title === TITLE);
  if (!ns) {
    const created = await cf(`/accounts/${ACCOUNT}/storage/kv/namespaces`, {
      method: 'POST',
      body: { title: TITLE },
    });
    ns = created.result;
    console.log(`[driver-live-kv] creado ${TITLE} ${ns.id}`);
  } else {
    console.log(`[driver-live-kv] existe ${TITLE} ${ns.id}`);
  }
  if (!ns?.id) throw new Error('KV sin id');

  writeWranglerKvId(ns.id);

  const project = await cf(`/accounts/${ACCOUNT}/pages/projects/${PROJECT}`);
  const current = project.result || {};
  const configs = current.deployment_configs || {};
  const production = { ...(configs.production || {}) };
  const preview = { ...(configs.preview || {}) };
  production.kv_namespaces = {
    ...(production.kv_namespaces || {}),
    [BINDING]: { namespace_id: ns.id },
  };
  preview.kv_namespaces = {
    ...(preview.kv_namespaces || {}),
    [BINDING]: { namespace_id: ns.id },
  };

  await cf(`/accounts/${ACCOUNT}/pages/projects/${PROJECT}`, {
    method: 'PATCH',
    body: {
      deployment_configs: {
        ...configs,
        production,
        preview,
      },
    },
  });
  console.log(`[driver-live-kv] vinculado ${BINDING} → ${PROJECT}`);
  if (process.env.GITHUB_OUTPUT) {
    const fs = await import('node:fs');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `kv_id=${ns.id}\n`);
  }
}

main().catch((err) => {
  fail(err.message || String(err), { fatal: false });
});
