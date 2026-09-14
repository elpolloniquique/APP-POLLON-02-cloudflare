import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import {
  DEFAULT_TEMPLATES,
  DEFAULT_COMPLAINT_KEYWORDS,
  DEFAULT_LOYALTY_TIERS,
  DEFAULT_LINK_WEB,
} from '../../lib/whatsapp/defaults.js';
import { evolutionInstanceName } from '../../lib/whatsapp/phone.js';
import { mergeSettings } from '../../lib/whatsapp/knowledge.js';

export { DEFAULT_TEMPLATES, DEFAULT_COMPLAINT_KEYWORDS, DEFAULT_LOYALTY_TIERS, DEFAULT_LINK_WEB };

function sb() {
  const client = getSupabase();
  if (!client) throw new Error('Supabase no configurado');
  return client;
}

async function authHeaders() {
  const client = getSupabase();
  const { data } = await client.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Sesión expirada');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function waAdmin(action, payload = {}) {
  const res = await fetch('/api/wa-evolution-admin', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Error WhatsApp');
  return json;
}

export async function ensureWaSettings(branchId) {
  if (!isSupabaseConfigured() || !branchId) return mergeSettings(null, branchId);
  const client = sb();
  const { data } = await client.from('ep_wa_settings').select('*').eq('branch_id', branchId).maybeSingle();
  if (data) return mergeSettings(data, branchId);

  const insert = {
    branch_id: branchId,
    enabled: false,
    modo_proactivo: false,
    avisos_en_modo_humano: true,
    enviar_foto_plato: false,
    ab_welcome_enabled: false,
    avisos_si_opt_out: true,
    ollama_enabled: false,
    ollama_model: 'llama3.2',
    usar_horario_sucursal: true,
    bot_24_7: false,
    human_timeout_min: 120,
    contar_compras_solo_sucursal: true,
    lookback_hours: 48,
    rate_limit_per_min: 4,
    link_web: DEFAULT_LINK_WEB,
    evolution_instance: evolutionInstanceName(branchId),
    templates: DEFAULT_TEMPLATES,
    complaint_keywords: DEFAULT_COMPLAINT_KEYWORDS,
    loyalty_tiers: DEFAULT_LOYALTY_TIERS,
  };
  const { data: created, error } = await client
    .from('ep_wa_settings')
    .upsert(insert, { onConflict: 'branch_id' })
    .select('*')
    .maybeSingle();
  if (error) return mergeSettings(null, branchId);
  return mergeSettings(created || insert, branchId);
}

export async function saveWaSettings(branchId, patch) {
  const client = sb();
  const { data, error } = await client
    .from('ep_wa_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('branch_id', branchId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return mergeSettings(data, branchId);
}

export async function listWaKb(branchId) {
  const client = sb();
  const { data, error } = await client
    .from('ep_wa_kb')
    .select('*')
    .or(`branch_id.is.null,branch_id.eq.${branchId}`)
    .order('prioridad', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveWaKb(row) {
  const client = sb();
  const payload = {
    branch_id: row.branch_id ?? row.branchId ?? null,
    title: row.title || row.pregunta || 'Sin título',
    keywords: Array.isArray(row.keywords) ? row.keywords : String(row.keywords || '').split(',').map((s) => s.trim()).filter(Boolean),
    pregunta: row.pregunta || '',
    respuesta: row.respuesta || '',
    intent_hint: row.intent_hint || row.intentHint || null,
    activa: row.activa !== false,
    prioridad: Number(row.prioridad) || 10,
    updated_at: new Date().toISOString(),
  };
  if (row.id) {
    const { data, error } = await client.from('ep_wa_kb').update(payload).eq('id', row.id).select('*').maybeSingle();
    if (error) throw error;
    return data;
  }
  const { data, error } = await client.from('ep_wa_kb').insert(payload).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteWaKb(id) {
  const { error } = await sb().from('ep_wa_kb').delete().eq('id', id);
  if (error) throw error;
}

export async function listWaSessions(branchId, limit = 30) {
  const { data, error } = await sb()
    .from('ep_wa_sessions')
    .select('*')
    .eq('branch_id', branchId)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function listWaMessages(branchId, { phone, limit = 40 } = {}) {
  let q = sb().from('ep_wa_messages').select('*').eq('branch_id', branchId).order('created_at', { ascending: false }).limit(limit);
  if (phone) q = q.eq('phone', phone);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).reverse();
}

export async function listWaAlerts(branchId, { unreadOnly = false, limit = 40 } = {}) {
  let q = sb().from('ep_wa_alerts').select('*').eq('branch_id', branchId).order('created_at', { ascending: false }).limit(limit);
  if (unreadOnly) q = q.is('read_at', null);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function listWaOutbox(limit = 40) {
  const { data, error } = await sb()
    .from('ep_wa_outbox')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function notifyOrderFromClient({ orderId, codigo_pedido, phone, event = 'insert' }) {
  try {
    await fetch('/api/wa-order-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, orderId, codigo_pedido, phone }),
    });
  } catch {
    /* no bloquear checkout */
  }
}

export async function notifyOrderFromStaff({ orderId, estado, prevEstado, event = 'update' }) {
  try {
    const headers = await authHeaders();
    await fetch('/api/wa-order-notify', {
      method: 'POST',
      headers,
      body: JSON.stringify({ event, orderId, estado, prevEstado }),
    });
  } catch {
    /* no bloquear avance de pedido */
  }
}
