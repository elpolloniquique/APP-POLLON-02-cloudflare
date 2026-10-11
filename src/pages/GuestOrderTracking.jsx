import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Circle, Clock, Search } from 'lucide-react';
import { guestTrackOrder } from '../services/customerService';
import { ORDER_STATUS_LABELS } from '../utils/constants';
import { money, formatDateTime } from '../utils/format';
import { Button } from '../components/ui/Button';

const STEPS = ['pendiente', 'aceptado', 'preparando', 'en_delivery', 'entregado'];

function StatusTimeline({ current }) {
  const estado = String(current || 'pendiente').toLowerCase();
  let idx = STEPS.indexOf(estado);
  if (idx < 0) {
    if (estado === 'nuevo') idx = 0;
    else if (estado === 'confirmado') idx = 1;
    else if (estado === 'listo') idx = 3;
    else if (estado === 'cancelado') idx = -1;
    else idx = 0;
  }

  return (
    <div className="mt-6 space-y-0">
      {STEPS.map((step, i) => {
        const meta = ORDER_STATUS_LABELS[step];
        const reached = idx >= i;
        const active = idx === i;
        return (
          <div key={step} className="flex gap-4">
            <div className="flex flex-col items-center">
              {reached ? (
                <CheckCircle className={`h-7 w-7 ${active ? 'text-pollon-red' : 'text-green-500'}`} />
              ) : (
                <Circle className="h-7 w-7 text-gray-200" />
              )}
              {i < STEPS.length - 1 && (
                <div className={`w-0.5 flex-1 min-h-[28px] ${reached ? 'bg-pollon-red' : 'bg-gray-200'}`} />
              )}
            </div>
            <div className="pb-6 pt-1">
              <p className={`font-bold ${active ? 'text-pollon-red' : reached ? 'text-gray-800' : 'text-gray-400'}`}>
                {meta?.label || step}
              </p>
              {active && (
                <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" /> Estado actual
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GuestOrderTracking() {
  const [params] = useSearchParams();
  const [codigo, setCodigo] = useState(() => String(params.get('codigo') || '').replace(/^#/, ''));
  const [tel, setTel] = useState(() => String(params.get('tel') || '').replace(/\D/g, ''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const canSearch = codigo.trim().length >= 3 && String(tel).replace(/\D/g, '').length >= 8;

  const search = async (event) => {
    event?.preventDefault?.();
    if (!canSearch) {
      setError('Ingresa el código del pedido y el teléfono con el que compraste.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await guestTrackOrder(codigo, tel);
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err?.message || 'No se pudo buscar el pedido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.get('codigo') && params.get('tel')) {
      search();
    }
    // solo al entrar con query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const order = result?.order;
  const estadoLabel = useMemo(
    () => ORDER_STATUS_LABELS[order?.estado]?.label || order?.estado || '',
    [order?.estado],
  );

  return (
    <div className="min-h-screen bg-pollon-cream px-4 py-8">
      <div className="mx-auto w-full max-w-lg">
        <p className="text-xs font-bold uppercase tracking-widest text-pollon-red">El Pollón</p>
        <h1 className="mt-1 font-display text-3xl text-pollon-black">Seguir mi pedido</h1>
        <p className="mt-2 text-sm text-gray-600">
          Ingresa el código que te dimos al comprar y el mismo teléfono del pedido. No necesitas cuenta.
        </p>

        <form onSubmit={search} className="mt-6 space-y-3 rounded-2xl bg-white p-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700">
            Código de seguimiento
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/^#/, ''))}
              placeholder="000123"
              className="mt-1 w-full rounded-xl border px-3 py-2"
              inputMode="numeric"
            />
          </label>
          <label className="block text-sm font-semibold text-gray-700">
            Teléfono del pedido
            <input
              value={tel}
              onChange={(e) => setTel(e.target.value)}
              placeholder="56912345678"
              className="mt-1 w-full rounded-xl border px-3 py-2"
              inputMode="tel"
            />
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            <Search className="mr-2 h-4 w-4" />
            {loading ? 'Buscando…' : 'Ver estado'}
          </Button>
        </form>

        {order && (
          <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-green-800">Pedido #{order.ticketNumber}</p>
            <p className="mt-1 text-lg font-bold text-pollon-black">{estadoLabel}</p>
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              <p><strong>Total:</strong> {money(order.total)}</p>
              {order.createdAt && <p><strong>Fecha:</strong> {formatDateTime(order.createdAt)}</p>}
              {order.branchName && <p><strong>Sucursal:</strong> {order.branchName}</p>}
            </div>
            {order.estado === 'cancelado' && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Este pedido fue cancelado.</p>
            )}
            {order.estado !== 'cancelado' && <StatusTimeline current={order.estado} />}
            {(order.items || []).length > 0 && (
              <div className="mt-4 rounded-xl bg-pollon-cream p-3">
                <p className="text-sm font-bold">Resumen</p>
                <ul className="mt-2 space-y-1 text-sm text-gray-700">
                  {order.items.map((it, i) => (
                    <li key={i}>{it.qty || it.quantity || 1}× {it.name || it.nombre}</li>
                  ))}
                </ul>
              </div>
            )}
            {(result.history || []).length > 0 && (
              <ul className="mt-4 space-y-1 text-xs text-gray-500">
                {result.history.map((h, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{ORDER_STATUS_LABELS[h.status]?.label || h.status}</span>
                    <span>{h.createdAt ? formatDateTime(h.createdAt) : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link to="/tienda" className="font-semibold text-pollon-red">← Seguir comprando</Link>
          <Link to="/cuenta/pedidos" className="font-semibold text-gray-600">Ya tengo cuenta</Link>
        </div>
      </div>
    </div>
  );
}
