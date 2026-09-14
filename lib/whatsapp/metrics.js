/** Métricas Fase 2 — avisos, quejas, % pedidos con WhatsApp válido */

import { normalizeWhatsappPhone } from './phone.js';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000);
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export async function loadWaMetrics(admin, { branchId, days = 7 } = {}) {
  const todayStart = startOfToday().toISOString();
  const periodStart = daysAgo(days).toISOString();

  let pedidosQ = admin.from('pedidos').select('id, cliente_telefono, creado_en, branch_id, estado, datos_json')
    .gte('creado_en', periodStart)
    .limit(3000);
  let outboxQ = admin.from('ep_wa_outbox').select('id, order_id, event, status, sent_at, created_at, error_text')
    .gte('created_at', periodStart)
    .limit(3000);
  let alertsQ = admin.from('ep_wa_alerts').select('id, type, read_at, created_at, branch_id')
    .gte('created_at', periodStart)
    .limit(1000);
  let msgsQ = admin.from('ep_wa_messages').select('id, direction, intent, created_at, branch_id, phone')
    .gte('created_at', periodStart)
    .limit(4000);
  let sessQ = admin.from('ep_wa_sessions').select('id, mode, human_until, branch_id, updated_at, ab_variant, opt_out, last_intent, phone');

  if (branchId) {
    pedidosQ = pedidosQ.eq('branch_id', branchId);
    alertsQ = alertsQ.eq('branch_id', branchId);
    msgsQ = msgsQ.eq('branch_id', branchId);
    sessQ = sessQ.eq('branch_id', branchId);
  }

  let branchOrdersQ = null;
  if (branchId) {
    branchOrdersQ = admin.from('pedidos').select('id').eq('branch_id', branchId).limit(8000);
  }

  const [pedidosRes, outboxRes, alertsRes, msgsRes, sessRes, branchOrdersRes] = await Promise.all([
    pedidosQ,
    outboxQ,
    alertsQ,
    msgsQ,
    sessQ,
    branchOrdersQ || Promise.resolve({ data: [] }),
  ]);

  const pedidos = pedidosRes.data || [];
  const outbox = outboxRes.data || [];
  const alerts = alertsRes.data || [];
  const messages = msgsRes.data || [];
  const sessions = sessRes.data || [];

  const branchOrderIds = branchId
    ? new Set((branchOrdersRes.data || []).map((r) => String(r.id)))
    : null;
  const outboxScoped = branchOrderIds
    ? outbox.filter((o) => branchOrderIds.has(String(o.order_id)))
    : outbox;

  const summarize = (fromIso) => {
    const from = new Date(fromIso).getTime();
    const peds = pedidos.filter((p) => new Date(p.creado_en).getTime() >= from);
    const withWa = peds.filter((p) => Boolean(normalizeWhatsappPhone(p.cliente_telefono)));
    const ob = outboxScoped.filter((o) => new Date(o.created_at || o.sent_at || 0).getTime() >= from);
    const sent = ob.filter((o) => o.status === 'sent');
    const al = alerts.filter((a) => new Date(a.created_at).getTime() >= from);
    const quejas = al.filter((a) => a.type === 'complaint');
    const msgs = messages.filter((m) => new Date(m.created_at).getTime() >= from);
    const confirm = sent.filter((o) => o.event === 'confirmacion');
    return {
      pedidos: peds.length,
      pedidosConWa: withWa.length,
      pctConWa: pct(withWa.length, peds.length),
      avisosEnviados: sent.length,
      avisosError: ob.filter((o) => o.status === 'error').length,
      avisosPending: ob.filter((o) => o.status === 'pending').length,
      confirmaciones: confirm.length,
      pctConfirmados: pct(confirm.length, peds.length),
      quejas: quejas.length,
      desconexiones: al.filter((a) => a.type === 'disconnected').length,
      sinTelefono: al.filter((a) => a.type === 'no_phone').length,
      msgsIn: msgs.filter((m) => m.direction === 'in').length,
      msgsOut: msgs.filter((m) => m.direction === 'out').length,
    };
  };

  const byEventMap = new Map();
  for (const o of outboxScoped) {
    const key = o.event || 'otro';
    const prev = byEventMap.get(key) || { event: key, sent: 0, error: 0, pending: 0 };
    if (o.status === 'sent') prev.sent += 1;
    else if (o.status === 'error') prev.error += 1;
    else prev.pending += 1;
    byEventMap.set(key, prev);
  }

  const now = Date.now();
  const humanOpen = sessions.filter((s) => (
    s.mode === 'human' && s.human_until && new Date(s.human_until).getTime() > now
  )).length;

  const ab = { a: { sessions: 0, avisos: 0 }, b: { sessions: 0, avisos: 0 } };
  const variantByPhone = new Map();
  for (const s of sessions) {
    const v = s.ab_variant === 'b' ? 'b' : (s.ab_variant === 'a' ? 'a' : null);
    if (!v) continue;
    ab[v].sessions += 1;
    if (s.phone) variantByPhone.set(String(s.phone), v);
  }
  for (const m of messages) {
    if (m.intent !== 'activar_avisos' || m.direction !== 'out') continue;
    const v = variantByPhone.get(String(m.phone || ''));
    if (v) ab[v].avisos += 1;
  }

  const pedidosConAvisos = pedidos.filter((p) => p.datos_json?.wa_avisos === true).length;

  return {
    days,
    today: summarize(todayStart),
    period: summarize(periodStart),
    unreadQuejas: alerts.filter((a) => a.type === 'complaint' && !a.read_at).length,
    humanOpen,
    sessions: sessions.length,
    optOut: sessions.filter((s) => s.opt_out).length,
    pedidosConAvisos,
    ab,
    byEvent: [...byEventMap.values()].sort((a, b) => b.sent - a.sent),
  };
}
