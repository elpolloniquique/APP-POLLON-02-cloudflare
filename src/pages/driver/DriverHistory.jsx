import { useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../../services/supabaseClient';
import { ensureMyDriverProfile } from '../../services/driverService';
import { money } from '../../utils/format';

export function DriverHistory() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (!isSupabaseConfigured()) {
          setRows([
            { id: '1', delivered_at: new Date().toISOString(), driver_fee: 2500, ep_delivery_jobs: { ticket_code: '0042', customer_name: 'María G.', customer_address: 'Av. Prat 100' } },
          ]);
          return;
        }
        const driver = await ensureMyDriverProfile();
        const sb = getSupabase();
        const { data } = await sb
          .from('ep_delivery_assignments')
          .select('*, ep_delivery_jobs(*)')
          .eq('driver_id', driver.id)
          .eq('status', 'completed')
          .order('delivered_at', { ascending: false })
          .limit(50);
        setRows(data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-3 p-4">
      <h2 className="text-xl font-bold">Historial</h2>
      {loading && <p className="text-gray-400">Cargando…</p>}
      {rows.map((r) => (
        <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex justify-between">
            <p className="font-semibold">#{r.ep_delivery_jobs?.ticket_code} · {r.ep_delivery_jobs?.customer_name}</p>
            <p className="font-bold text-emerald-600">{money(r.driver_fee)}</p>
          </div>
          <p className="text-xs text-gray-500">{r.ep_delivery_jobs?.customer_address}</p>
          <p className="mt-1 text-[10px] text-gray-400">
            {r.delivered_at ? new Date(r.delivered_at).toLocaleString('es-CL') : ''}
          </p>
        </div>
      ))}
      {!loading && rows.length === 0 && <p className="text-gray-500">Aún no hay entregas completadas.</p>}
    </div>
  );
}
