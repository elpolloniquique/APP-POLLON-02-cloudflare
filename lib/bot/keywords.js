/** Palabras clave automáticas (sin IA) */

const STOP = new Set([
  'para', 'como', 'cómo', 'esta', 'este', 'esto', 'estos', 'estas', 'que', 'qué', 'con', 'por',
  'una', 'unos', 'unas', 'las', 'los', 'del', 'desde', 'tiene', 'tienen', 'el', 'la', 'de', 'en',
  'y', 'o', 'a', 'un', 'es', 'se', 'al', 'lo', 'su', 'mi', 'me', 'te', 'si', 'sí', 'no', 'ya',
  'hay', 'mas', 'más', 'muy', 'the', 'and', 'puedo', 'puede', 'necesito', 'quiero', 'hola',
  'gracias', 'porfa', 'favor', 'algo', 'aqui', 'aquí', 'alla', 'allá', 'ese', 'esa', 'eso',
]);

export function extractKeywords(text, limit = 12) {
  const folded = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const counts = new Map();
  for (const w of folded.split(' ')) {
    if (w.length < 4 || STOP.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([w]) => w);
}

export function splitVariants(raw) {
  return String(raw || '')
    .split(/\n|,|;/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}
