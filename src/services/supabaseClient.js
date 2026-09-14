import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const storageBucket = import.meta.env.VITE_STORAGE_BUCKET || 'product-images';

let client = null;

export function isSupabaseConfigured() {
  return Boolean(url && anonKey && !url.includes('tu-proyecto'));
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: {
        params: { eventsPerSecond: 20 },
      },
    });
  }
  return client;
}

export function getStorageBucket() {
  return storageBucket;
}
