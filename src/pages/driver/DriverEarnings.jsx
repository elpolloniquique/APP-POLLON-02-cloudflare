import { useEffect, useState } from 'react';
import { getMyDriverSummary } from '../../services/driverService';
import { money } from '../../utils/format';

export function DriverEarnings() {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    getMyDriverSummary().then(setSummary).catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <h2 className="text-xl font-bold">Ingresos</h2>
      <div className="rounded-2xl bg-gradient-to-br from-pollon-red to-pollon-orange p-6 text-white shadow-lg">
        <p className="text-sm opacity-80">Hoy</p>
        <p className="mt-1 text-4xl font-bold">{money(summary?.todayFees ?? 0)}</p>
        <p className="mt-2 text-sm opacity-80">{summary?.todayDeliveries ?? 0} entregas</p>
      </div>
      <p className="text-sm text-gray-500">
        Los fees corresponden al delivery cotizado al aceptar cada pedido. La liquidación semanal/mensual se consolida desde el panel admin → Reporte de repartidores.
      </p>
    </div>
  );
}
