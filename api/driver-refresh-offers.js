/**
 * POST /api/driver-refresh-offers
 * Tras "Pedido entregado": vuelve a ofertar pedidos nuevos a ESTE repartidor.
 */
import { createClient } from '@supabase/supabase-js';
import { env } from './_lib/fcmSend.js';
import { findDriverIdForAuthUser, refreshOffersForDriver } from './_lib/ensureNotifyOffers.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return res.status(500).json({ error: 'Faltan vars Supabase' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Sin autorización' });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Token inválido' });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const driverId = await findDriverIdForAuthUser(admin, userData.user.id);
  if (!driverId) return res.status(403).json({ error: 'No eres repartidor' });

  const refreshed = await refreshOffersForDriver(admin, driverId);
  return res.status(200).json({ ...refreshed, afterDelivery: true });
}
