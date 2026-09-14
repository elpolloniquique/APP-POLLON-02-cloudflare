/** Parsers OSS: TXT / PDF / DOCX. Sin APIs de pago. */

import { chunkText } from './chunkText.js';

export function detectKind(mime = '', fileName = '') {
  const m = String(mime || '').toLowerCase();
  const n = String(fileName || '').toLowerCase();
  if (m.includes('pdf') || n.endsWith('.pdf')) return 'pdf';
  if (m.includes('wordprocessingml') || n.endsWith('.docx')) return 'docx';
  if (m.includes('text') || n.endsWith('.txt') || n.endsWith('.md')) return 'txt';
  return 'unsupported';
}

export async function parseDocumentBuffer(buffer, { mimeType = '', fileName = '' } = {}) {
  const kind = detectKind(mimeType, fileName);
  if (kind === 'unsupported') {
    return { ok: false, error: 'unsupported_format', kind, text: '' };
  }
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  let text = '';
  try {
    if (kind === 'txt') {
      text = bytes.toString('utf8');
    } else if (kind === 'pdf') {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const extracted = await extractText(pdf, { mergePages: true });
      text = Array.isArray(extracted?.text) ? extracted.text.join('\n') : String(extracted?.text || extracted || '');
    } else if (kind === 'docx') {
      const mammothMod = await import('mammoth');
      const mammoth = mammothMod.default || mammothMod;
      const result = await mammoth.extractRawText({ buffer: bytes });
      text = result?.value || '';
    }
  } catch (err) {
    return { ok: false, error: String(err?.message || err), kind, text: '' };
  }
  text = String(text || '').replace(/\u0000/g, '').trim();
  if (!text) return { ok: false, error: 'empty_text', kind, text: '' };
  return { ok: true, kind, text, chunks: chunkText(text) };
}
