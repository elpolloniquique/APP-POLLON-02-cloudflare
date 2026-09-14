/**
 * Procesa un documento del bot (FASE 10) — TXT / PDF / DOCX OSS.
 * POST /api/bot-process-document  { documentId }
 */
import { cors, parseBody, getSupabaseAdmin } from '../lib/whatsapp/supabaseAdmin.js';
import { parseDocumentBuffer } from '../lib/bot/parseDocument.js';
import { extractKeywords } from '../lib/bot/keywords.js';
import { requireStaff } from '../lib/bot/auth.js';
import { writeAudit } from '../lib/bot/context.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });

  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ ok: false, error: 'supabase_admin' });

  const staff = await requireStaff(req, admin);
  if (!staff) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const body = parseBody(req);
  const documentId = body.documentId || body.id;
  if (!documentId) return res.status(400).json({ ok: false, error: 'documentId' });

  const { data: doc, error: docErr } = await admin.from('bot_documents').select('*').eq('id', documentId).maybeSingle();
  if (docErr || !doc) return res.status(404).json({ ok: false, error: 'not_found' });

  await admin.from('bot_documents').update({ status: 'pending', error_text: null }).eq('id', doc.id);

  try {
    const { data: file, error: dlErr } = await admin.storage.from('bot-documents').download(doc.storage_path);
    if (dlErr || !file) throw new Error(dlErr?.message || 'No se pudo leer el archivo');
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseDocumentBuffer(buffer, { mimeType: doc.mime_type, fileName: doc.file_name });
    if (!parsed.ok) {
      await admin.from('bot_documents').update({
        status: 'error',
        error_text: parsed.error === 'unsupported_format'
          ? 'Formato no soportado. Usa PDF, TXT o DOCX.'
          : parsed.error,
      }).eq('id', doc.id);
      return res.status(400).json({ ok: false, error: parsed.error });
    }

    const title = (doc.file_name || 'Documento').replace(/\.[^.]+$/, '');
    const answer = parsed.text.slice(0, 1800);
    let knowledgeId = doc.knowledge_id || null;
    if (knowledgeId) {
      await admin.from('bot_knowledge').update({
        title,
        question: title,
        answer,
        content: parsed.text.slice(0, 8000),
        keywords: extractKeywords(parsed.text),
        source_type: 'document',
        source_name: doc.file_name,
        storage_path: doc.storage_path,
        category: doc.category || 'documento',
        active: doc.active !== false,
        branch_id: doc.branch_id || null,
        updated_by: staff.id,
      }).eq('id', knowledgeId);
      await admin.from('bot_knowledge_chunks').delete().eq('document_id', doc.id);
    } else {
      const { data: knowledge, error: kErr } = await admin.from('bot_knowledge').insert({
        title,
        category: doc.category || 'documento',
        question: `Información de ${title}`,
        answer,
        content: parsed.text.slice(0, 8000),
        keywords: extractKeywords(parsed.text),
        variants: [title],
        source_type: 'document',
        source_name: doc.file_name,
        storage_path: doc.storage_path,
        priority: 40,
        active: true,
        branch_id: doc.branch_id || null,
        created_by: staff.id,
        updated_by: staff.id,
      }).select('id').maybeSingle();
      if (kErr) throw kErr;
      knowledgeId = knowledge?.id || null;
    }

    const chunks = (parsed.chunks || []).map((content, i) => ({
      knowledge_id: knowledgeId,
      document_id: doc.id,
      chunk_index: i,
      content,
      keywords: extractKeywords(content, 8),
    }));
    if (chunks.length) {
      const { error: cErr } = await admin.from('bot_knowledge_chunks').insert(chunks);
      if (cErr) throw cErr;
    }

    await admin.from('bot_documents').update({
      status: 'processed',
      chunk_count: chunks.length,
      knowledge_id: knowledgeId,
      error_text: null,
      updated_at: new Date().toISOString(),
    }).eq('id', doc.id);

    await writeAudit(admin, {
      actorId: staff.id,
      action: 'process_document',
      message: doc.file_name,
      branchId: doc.branch_id,
      metadata: { document_id: doc.id, chunks: chunks.length },
    });

    return res.status(200).json({ ok: true, documentId: doc.id, knowledgeId, chunks: chunks.length, kind: parsed.kind });
  } catch (err) {
    await admin.from('bot_documents').update({
      status: 'error',
      error_text: String(err?.message || err).slice(0, 500),
    }).eq('id', doc.id);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
