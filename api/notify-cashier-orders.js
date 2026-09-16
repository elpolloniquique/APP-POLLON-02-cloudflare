/**
 * Avisos a cajeras desactivados: solo los repartidores reciben bandeja.
 * El endpoint queda para no romper clientes viejos.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  return res.status(200).json({ ok: true, disabled: true, webSent: 0 });
}
