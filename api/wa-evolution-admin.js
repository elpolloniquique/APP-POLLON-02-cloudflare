/**
 * Proxy Evolution + simulador + live.
 * POST /api/wa-evolution-admin
 * Super admin: todo. Admin sucursal: live/métricas/simulador de SU sucursal.
 *
 * actions: status | qr | pairing | logout | restart | simulate | retry_outbox |
 *          set_human | set_bot | mark_alerts_read | metrics | ping_ollama
 */
import { cors, parseBody, getSupabaseAdmin, getSupabaseUserClient, env } from '../lib/whatsapp/supabaseAdmin.js';
import {
  evolutionConfigured,
  ensureInstance,
  ensureInstanceReady,
  connectInstance,
  connectWithPairingCode,
  connectionState,
  logoutInstance,
  pingEvolution,
  evolutionHostLabel,
} from '../lib/whatsapp/evolution.js';
import { ensureSettingsRow, updateSession, loadBranch } from '../lib/whatsapp/knowledge.js';
import { evolutionInstanceName, normalizeWhatsappPhone } from '../lib/whatsapp/phone.js';
import { handleInbound } from '../lib/whatsapp/engine.js';
import { retryPendingOutbox } from '../lib/whatsapp/notify.js';
import { loadWaMetrics } from '../lib/whatsapp/metrics.js';
import { pingOllama, ollamaConfigured, defaultOllamaModel } from '../lib/whatsapp/ollama.js';

async function requireWaStaff(req, admin) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return { error: 'Sin autorización', status: 401 };
  const userClient = getSupabaseUserClient(token);
  if (!userClient) return { error: 'Sesión inválida', status: 401 };
  const { data: authData } = await userClient.auth.getUser();
  if (!authData?.user) return { error: 'Sesión inválida', status: 401 };
  const { data: caller } = await admin
    .from('profiles')
    .select('id, role, is_active, branch_id')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();
  if (!caller || caller.is_active === false) return { error: 'Perfil no autorizado', status: 403 };
  const role = caller.role === 'administrador' ? 'admin_sucursal' : caller.role;
  if (role === 'super_admin') return { caller, isSuper: true, branchId: null };
  if (role === 'admin_sucursal') {
    if (!caller.branch_id) return { error: 'Admin sucursal sin sucursal asignada', status: 403 };
    return { caller, isSuper: false, branchId: caller.branch_id };
  }
  return { error: 'No autorizado para WhatsApp inteligente', status: 403 };
}

function webhookPublicUrl() {
  const secret = env('EP_WA_WEBHOOK_SECRET');
  const site = (env('VITE_PUBLIC_SITE_URL', 'EP_PUBLIC_SITE_URL') || 'https://www.el-pollon.cl').replace(/\/+$/, '');
  const base = `${site}/api/wa-evolution-webhook`;
  return secret ? `${base}?secret=${encodeURIComponent(secret)}` : base;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' });

  const auth = await requireWaStaff(req, admin);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const body = parseBody(req);
  const action = body.action;
  let branchId = body.branchId || body.branch_id;
  if (!auth.isSuper) {
    branchId = auth.branchId;
    if (['qr', 'pairing', 'logout', 'restart', 'ping_ollama', 'ping_evolution'].includes(action)) {
      return res.status(403).json({ error: 'Solo super admin puede conectar Evolution / Ollama' });
    }
  }
  if (!action) return res.status(400).json({ error: 'action requerida' });

  try {
    if (action === 'metrics') {
      const metrics = await loadWaMetrics(admin, { branchId: branchId || null, days: Number(body.days) || 7 });
      return res.status(200).json({ ok: true, metrics });
    }

    if (action === 'ping_ollama') {
      const r = await pingOllama(body.model || defaultOllamaModel());
      return res.status(200).json({ ok: r.ok, configured: ollamaConfigured(), ...r });
    }

    if (action === 'simulate') {
      if (!branchId) return res.status(400).json({ error: 'branchId requerido' });
      const result = await handleInbound({
        admin,
        instance: null,
        phone: body.phone || '56900000000',
        text: body.text || 'hola',
        pushName: body.name || 'Simulador',
        simulate: true,
        branchId,
      });
      return res.status(200).json(result);
    }

    if (action === 'retry_outbox') {
      const results = await retryPendingOutbox(admin, { branchId, limit: 30 });
      return res.status(200).json({ ok: true, results });
    }

    if (action === 'set_human' || action === 'set_bot') {
      const sessionId = body.sessionId;
      if (!sessionId) return res.status(400).json({ error: 'sessionId requerido' });
      const timeout = Number(body.human_timeout_min) || 120;
      const patch = action === 'set_human'
        ? { mode: 'human', human_until: new Date(Date.now() + timeout * 60 * 1000).toISOString() }
        : { mode: 'bot', human_until: null };
      const session = await updateSession(admin, sessionId, patch);
      return res.status(200).json({ ok: true, session });
    }

    if (action === 'mark_alerts_read') {
      let q = admin.from('ep_wa_alerts').update({ read_at: new Date().toISOString() }).is('read_at', null);
      if (branchId) q = q.eq('branch_id', branchId);
      if (body.alertId) q = admin.from('ep_wa_alerts').update({ read_at: new Date().toISOString() }).eq('id', body.alertId);
      await q;
      return res.status(200).json({ ok: true });
    }

    if (!branchId) return res.status(400).json({ error: 'branchId requerido' });
    const settings = await ensureSettingsRow(admin, branchId);
    const instance = settings.evolution_instance || evolutionInstanceName(branchId);

    if (action === 'status') {
      if (!evolutionConfigured()) {
        return res.status(200).json({
          ok: true,
          configured: false,
          reachable: false,
          connected: false,
          state: 'unconfigured',
          instance,
          host: evolutionHostLabel(),
          phone: settings.connected_phone,
        });
      }
      const st = await connectionState(instance);
      await admin.from('ep_wa_settings').update({
        connected: st.connected,
        connected_phone: st.phone || settings.connected_phone,
        evolution_instance: instance,
        updated_at: new Date().toISOString(),
      }).eq('branch_id', branchId);
      return res.status(200).json({
        ok: true,
        configured: true,
        reachable: st.reachable !== false,
        connected: st.connected,
        state: st.state,
        instance,
        host: evolutionHostLabel(),
        phone: st.phone || settings.connected_phone,
        error: st.error || null,
      });
    }

    if (action === 'ping_evolution') {
      const r = await pingEvolution();
      return res.status(200).json(r);
    }

    if (action === 'qr') {
      if (!evolutionConfigured()) {
        return res.status(400).json({ error: 'Faltan EVOLUTION_API_URL / EVOLUTION_API_KEY en Vercel' });
      }
      const ping = await pingEvolution();
      if (!ping.ok) {
        return res.status(502).json({ error: ping.error || `Evolution no responde en ${ping.host}` });
      }
      const qr = await ensureInstance(instance, webhookPublicUrl());
      const st = await connectionState(instance);
      await admin.from('ep_wa_settings').update({
        evolution_instance: instance,
        connected: st.connected,
        connected_phone: st.phone || null,
        last_qr_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('branch_id', branchId);
      return res.status(200).json({
        ok: true,
        instance,
        connected: st.connected,
        state: st.state,
        phone: st.phone,
        qr: qr.qr,
        pairingCode: qr.pairingCode,
        host: evolutionHostLabel(),
        reachable: true,
      });
    }

    if (action === 'pairing') {
      if (!evolutionConfigured()) {
        return res.status(400).json({ error: 'Faltan EVOLUTION_API_URL / EVOLUTION_API_KEY en Vercel' });
      }
      const ping = await pingEvolution();
      if (!ping.ok) {
        return res.status(502).json({ error: ping.error || `Evolution no responde en ${ping.host}` });
      }
      const branch = await loadBranch(admin, branchId);
      const phone = normalizeWhatsappPhone(body.phone || branch?.whatsapp || '');
      if (!phone) {
        return res.status(400).json({ error: 'Falta el WhatsApp de la sucursal' });
      }
      await ensureInstanceReady(instance, webhookPublicUrl());
      const linked = await connectWithPairingCode(instance, phone);
      const st = await connectionState(instance);
      await admin.from('ep_wa_settings').update({
        evolution_instance: instance,
        connected: st.connected,
        connected_phone: st.phone || phone,
        last_qr_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('branch_id', branchId);
      return res.status(200).json({
        ok: true,
        instance,
        connected: st.connected,
        state: st.state,
        phone: st.phone || phone,
        pairingCode: linked.pairingCode || null,
        qr: linked.qr || null,
        host: evolutionHostLabel(),
        reachable: true,
      });
    }

    if (action === 'logout') {
      if (evolutionConfigured()) {
        try { await logoutInstance(instance); } catch { /* ignore */ }
      }
      await admin.from('ep_wa_settings').update({
        connected: false,
        connected_phone: null,
        updated_at: new Date().toISOString(),
      }).eq('branch_id', branchId);
      return res.status(200).json({ ok: true, connected: false });
    }

    if (action === 'restart') {
      if (!evolutionConfigured()) {
        return res.status(400).json({ error: 'Evolution no configurado' });
      }
      try { await logoutInstance(instance); } catch { /* ignore */ }
      const qr = await connectInstance(instance);
      return res.status(200).json({ ok: true, qr: qr.qr, pairingCode: qr.pairingCode });
    }

    return res.status(400).json({ error: `Acción desconocida: ${action}` });
  } catch (err) {
    console.error('[wa-admin]', err?.message || err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}
