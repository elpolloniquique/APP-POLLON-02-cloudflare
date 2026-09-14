import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, ChevronRight, Search, Link2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getCustomerOrders, claimOrderByTicket } from '../../services/customerService';
import { ORDER_STATUS_LABELS } from '../../utils/constants';
import { money, formatDateTime } from '../../utils/format';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import { getOrders } from '../../services/orderService';

export function AccountOrders() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showClaim, setShowClaim] = useState(false);
  const [ticket, setTicket] = useState('');
  const [phone, setPhone] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [claimOk, setClaimOk] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured() && profile?.id && !String(profile.id).startsWith('local-')) {
        const list = await getCustomerOrders(profile.id);
        setOrders(list);
      } else {
        const all = getOrders();
        const phoneMatch = profile?.phone;
        setOrders(all.filter((o) => o.customer?.phone === phoneMatch || o.customer?.name === profile?.fullName));
      }
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.phone) setPhone((p) => p || profile.phone);
  }, [profile?.phone]);

  useEffect(() => {
    loadOrders();
  }, [profile]);

  const handleClaim = async (e) => {
    e.preventDefault();
    setClaimError('');
    setClaimOk('');

    const code = ticket.replace(/\D/g, '');
    if (!code) {
      setClaimError('Ingresa tu código de seguimiento (ej. 000115)');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 8) {
      setClaimError('Ingresa el teléfono que usaste al hacer el pedido');
      return;
    }

    if (!isSupabaseConfigured() || String(profile?.id || '').startsWith('local-')) {
      setClaimError('La búsqueda por código requiere conexión con la tienda online');
      return;
    }

    setClaiming(true);
    try {
      const result = await claimOrderByTicket(code, phone);
      setClaimOk(
        result.alreadyLinked
          ? 'Este pedido ya estaba en tu cuenta. Te llevamos al seguimiento…'
          : '¡Pedido vinculado! Ya puedes seguirlo en tiempo real…',
      );
      await loadOrders();
      setTicket('');
      window.setTimeout(() => {
        navigate(`/cuenta/seguimiento/${result.orderId}`);
      }, 900);
    } catch (err) {
      setClaimError(err.message || 'No se pudo encontrar el pedido');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-pollon-black">Mis pedidos</h1>
            <p className="mt-1 text-sm text-gray-500">Historial y seguimiento en tiempo real</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowClaim((v) => !v);
              setClaimError('');
              setClaimOk('');
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              showClaim
                ? 'bg-gray-100 text-gray-700 ring-1 ring-gray-200'
                : 'bg-pollon-red text-white shadow-sm hover:bg-pollon-red-dark'
            }`}
          >
            <Search className="h-4 w-4" />
            Buscar mi pedido por código
          </button>
        </div>

        {showClaim && (
          <section className="mt-5 rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50/80 to-orange-50/40 p-4 sm:p-5">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-amber-100">
                <Link2 className="h-5 w-5 text-pollon-red" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-pollon-black">
                  Buscar mi pedido por código de seguimiento
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-gray-600">
                  ¿Pediste sin iniciar sesión y luego creaste tu cuenta? Ingresa el código que recibiste
                  al confirmar (ej. <span className="font-mono font-semibold">#000115</span>) y el
                  teléfono del pedido. Lo vinculamos a tu cuenta para que lo sigas en vivo.
                </p>
              </div>
            </div>

            <form onSubmit={handleClaim} className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="claim-ticket" className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Código de seguimiento
                </label>
                <input
                  id="claim-ticket"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000115"
                  value={ticket}
                  onChange={(e) => setTicket(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-pollon-red focus:ring-2 focus:ring-pollon-red/20"
                />
              </div>
              <div>
                <label htmlFor="claim-phone" className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Teléfono del pedido
                </label>
                <input
                  id="claim-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="900979202"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-pollon-red focus:ring-2 focus:ring-pollon-red/20"
                />
              </div>
              <div className="sm:col-span-2">
                {claimError && (
                  <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-red-100">
                    {claimError}
                  </p>
                )}
                {claimOk && (
                  <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-800 ring-1 ring-green-100">
                    {claimOk}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={claiming}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-pollon-black px-4 py-3 text-sm font-bold text-white transition hover:bg-gray-800 disabled:opacity-50 sm:w-auto"
                >
                  <Search className="h-4 w-4" />
                  {claiming ? 'Buscando…' : 'Vincular y seguir pedido'}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
        {loading ? (
          <p className="py-8 text-center text-gray-500">Cargando pedidos…</p>
        ) : !orders.length ? (
          <div className="py-10 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">Aún no tienes pedidos en esta cuenta</p>
            <p className="mt-1 text-xs text-gray-400">
              Si pediste antes de registrarte, usa <strong>Buscar mi pedido por código</strong>
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setShowClaim(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-pollon-red/30 bg-red-50 px-4 py-2 text-sm font-bold text-pollon-red"
              >
                <Search className="h-4 w-4" />
                Buscar por código
              </button>
              <Link
                to="/tienda"
                className="inline-block rounded-xl bg-pollon-red px-6 py-2 text-sm font-bold text-white"
              >
                Ir a la tienda
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => {
              const st = ORDER_STATUS_LABELS[o.estado] || { label: o.estado };
              return (
                <li key={o.id}>
                  <Link
                    to={`/cuenta/seguimiento/${o.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 transition hover:border-pollon-red hover:shadow-sm"
                  >
                    <div>
                      <p className="font-bold">#{o.ticketNumber || o.id?.slice(-6)}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(o.createdAt)}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold text-white ${st.color || 'bg-gray-500'}`}>
                      {st.label}
                    </span>
                    <p className="font-bold text-pollon-red">{money(o.total)}</p>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
