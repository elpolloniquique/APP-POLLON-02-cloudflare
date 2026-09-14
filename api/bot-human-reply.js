/**
 * FASE 16: respuesta humana desde el inbox CRM.
 * POST /api/bot-human-reply  { conversationId, text }
 */
import { cors, parseBody, getSupabaseAdmin } from '../lib/whatsapp/supabaseAdmin.js';
import { getWhatsAppProvider } from '../lib/bot/provider.js';
import { normalizeMessage } from '../lib/bot/text.js';
import { requireStaff } from '../lib/bot/auth.js';
import { clientIp, rateLimitHit } from '../lib/bot/rateLimit.js';
import { writeAudit } from '../lib/bot/context.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });

  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ ok: false, error: 'supabase_admin' });

  const staff = await requireStaff(req, admin);
  if (!staff) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (rateLimitHit(`human:${staff.id || clientIp(req)}`, { max: 40, windowMs: 60_000 })) {
    return res.status(429).json({ ok: false, error: 'rate_limit' });
  }

  const body = parseBody(req);
  const conversationId = body.conversationId || body.id;
  const text = String(body.text || body.message || '').trim();
  if (!conversationId || !text) return res.status(400).json({ ok: false, error: 'conversationId_and_text' });

  const { data: conv, error: cErr } = await admin.from('bot_conversations').select('*').eq('id', conversationId).maybeSingle();
  if (cErr || !conv) return res.status(404).json({ ok: false, error: 'not_found' });

  const provider = await getWhatsAppProvider({ admin, branchId: conv.branch_id });
  let sent = false;
  let sendError = null;
  if (provider.configured) {
    try {
      const result = await provider.sendText(conv.phone, text);
      sent = Boolean(result?.ok);
      if (!sent) sendError = result?.error || result?.skipped || 'send_failed';
    } catch (err) {
      sendError = String(err?.message || err);
    }
  } else {
    sendError = 'provider_not_configured';
  }

  await admin.from('bot_messages').insert({
    conversation_id: conv.id,
    phone: conv.phone,
    direction: 'outgoing',
    sender_type: 'human',
    original_text: text,
    normalized_text: normalizeMessage(text).folded,
    intent: 'HUMAN_REPLY',
    status: sent ? 'sent' : 'stored',
    metadata: { staff_id: staff.id, send_error: sendError },
  });

  await admin.from('bot_conversations').update({
    mode: conv.mode === 'bot' ? 'human' : conv.mode,
    assigned_user_id: staff.id,
    unread_count: 0,
    last_message_at: new Date().toISOString(),
    last_message_preview: text.slice(0, 140),
  }).eq('id', conv.id);

  await writeAudit(admin, {
    actorId: staff.id,
    action: 'human_reply',
    message: conv.phone,
    branchId: conv.branch_id,
    metadata: { conversation_id: conv.id, sent },
  });

  return res.status(200).json({
    ok: true,
    sent,
    warning: sent ? null : sendError,
  });
}
