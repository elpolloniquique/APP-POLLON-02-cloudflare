/** Divide texto en fragmentos para FTS (sin IA) */

export function chunkText(text, maxChars = 900, overlap = 80) {
  const clean = String(text || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const paras = clean.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let buf = '';
  for (const p of paras) {
    if ((buf + '\n\n' + p).length <= maxChars) {
      buf = buf ? `${buf}\n\n${p}` : p;
      continue;
    }
    if (buf) chunks.push(buf);
    if (p.length <= maxChars) {
      buf = p;
      continue;
    }
    for (let i = 0; i < p.length; i += maxChars - overlap) {
      chunks.push(p.slice(i, i + maxChars).trim());
    }
    buf = '';
  }
  if (buf) chunks.push(buf);
  return chunks.filter(Boolean);
}
