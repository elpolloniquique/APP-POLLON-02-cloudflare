import { getSupabase } from './supabaseClient';

async function authHeader() {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase no configurado');
  const { data } = await sb.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function callFleetAdmin(body) {
  const headers = await authHeader();
  const res = await fetch('/api/fleet-admin', {
    method: 'POST',
    headers,
    body: JSON.stringify(body || {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
  return json;
}

export async function getMyFleet() {
  return callFleetAdmin({ action: 'me' });
}

export async function loadFleetHome() {
  return callFleetAdmin({ action: 'home' });
}

export async function listFleetTeam() {
  const json = await callFleetAdmin({ action: 'team' });
  return json.drivers || [];
}

export async function listFleetPendingJobs() {
  const json = await callFleetAdmin({ action: 'pending' });
  return json.jobs || [];
}

export async function createFleetMoto(payload) {
  return callFleetAdmin({ action: 'createDriver', ...payload });
}

export async function assignFleetJob(jobId, driverId) {
  return callFleetAdmin({ action: 'assign', jobId, driverId });
}
