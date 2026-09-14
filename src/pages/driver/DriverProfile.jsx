import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ensureMyDriverProfile, updateDriverProfile, setMyOperationalStatus, getMyDriverSummary } from '../../services/driverService';
import { Button } from '../../components/ui/Button';
import {
  isNativeDriverApp,
  getNativePlatform,
  stopDriverBackgroundGps,
  driverShouldShareGps,
} from '../../services/backgroundGpsService';
import {
  DRIVER_APP_VERSION_NAME,
  DRIVER_APP_VERSION_CODE,
} from '../../utils/driverNativeConstants';

export function DriverProfile() {
  const { profile } = useAuth();
  const [driver, setDriver] = useState(null);
  const [form, setForm] = useState({ vehicle_type: 'motocicleta', vehicle_plate: '', vehicle_color: '', phone: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    ensureMyDriverProfile()
      .then((d) => {
        setDriver(d);
        setForm({
          vehicle_type: d.vehicle_type || 'motocicleta',
          vehicle_plate: d.vehicle_plate || '',
          vehicle_color: d.vehicle_color || '',
          phone: d.phone || profile?.phone || '',
        });
      })
      .catch((err) => setError(err.message));
  }, [profile]);

  const save = async () => {
    if (!driver) return;
    try {
      await updateDriverProfile(driver.id, form);
      setMsg('Perfil actualizado');
    } catch (err) {
      setError(err.message);
    }
  };

  const goOffline = async () => {
    try {
      await setMyOperationalStatus('offline');
      const s = await getMyDriverSummary().catch(() => null);
      if (!driverShouldShareGps(s)) await stopDriverBackgroundGps();
      setMsg('Ahora estás offline');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <h2 className="text-xl font-bold">Perfil</h2>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="font-semibold text-gray-900">{profile?.fullName || profile?.nombre}</p>
        <p className="text-sm text-gray-500">{profile?.email}</p>
        <p className="mt-1 text-xs text-pollon-orange capitalize">Rol: {profile?.role || profile?.rol}</p>
        {driver && (
          <p className="mt-1 text-xs text-gray-400">Estado admin: {driver.admin_status}</p>
        )}
        <div className="mt-3 rounded-xl bg-black px-3 py-2 text-[11px] text-white/80">
          <p>
            App: <strong className="text-white">{isNativeDriverApp() ? 'Nativa · aceptar + GPS' : 'Clientes · solo avisos'}</strong>
            {' · '}{getNativePlatform()}
          </p>
          <p className="mt-0.5">
            Versión <strong className="text-white">v{DRIVER_APP_VERSION_NAME}</strong>
            {' '}({DRIVER_APP_VERSION_CODE})
          </p>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}

      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm">
        <label className="block text-sm">
          Tipo de vehículo
          <select value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2">
            <option value="motocicleta">Motocicleta</option>
            <option value="automovil">Automóvil</option>
            <option value="bicicleta">Bicicleta</option>
            <option value="bicicleta_electrica">Bicicleta eléctrica</option>
            <option value="otro">Otro</option>
          </select>
        </label>
        <label className="block text-sm">
          Patente
          <input value={form.vehicle_plate} onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="block text-sm">
          Color
          <input value={form.vehicle_color} onChange={(e) => setForm({ ...form, vehicle_color: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="block text-sm">
          Teléfono
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2" />
        </label>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
          <p className="font-semibold text-slate-800">Cupo máximo de pedidos</p>
          <p className="mt-0.5 text-lg font-bold text-pollon-orange">
            {driver?.max_orders || 2} pedido{(driver?.max_orders || 2) === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Lo define administración. Mientras vas al local puedes aceptar hasta ese tope;
            al marcar un pedido como recogido no llegan más ofertas hasta entregar todos.
          </p>
        </div>
        <Button onClick={save} className="w-full">Guardar</Button>
        <Button variant="outline" onClick={goOffline} className="w-full">Ponerme offline</Button>
      </div>
    </div>
  );
}
