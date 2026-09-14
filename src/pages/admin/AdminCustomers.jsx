import { useEffect, useState } from 'react';
import { Search, Mail, Phone, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStaffBranch } from '../../hooks/useStaffBranch';
import { normalizeRole } from '../../services/authService';
import { adminListCustomers, adminGetCustomerOrders } from '../../services/customerService';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import { money, formatDateTime } from '../../utils/format';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminTable } from '../../components/admin/AdminTable';
import { AdminScrollPanel } from '../../components/admin/AdminScrollPanel';

export function AdminCustomers() {
  const { profile, role } = useAuth();
  const { branchName, isBranchScoped } = useStaffBranch();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterPromo, setFilterPromo] = useState('all');
  const [selected, setSelected] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const branchId = profile?.branchId || profile?.branch_id;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 320);
    return () => clearTimeout(t);
  }, [search]);

  const load = async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const list = await adminListCustomers({
        branchId: normalizeRole(role) === 'super_admin' ? undefined : branchId,
        search: debouncedSearch || undefined,
        acceptsPromotions: filterPromo === 'promo' ? true : undefined,
      });
      setCustomers(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [debouncedSearch, filterPromo, branchId]);

  const viewCustomer = async (c) => {
    setSelected(c);
    const o = await adminGetCustomerOrders(c.id);
    setOrders(o);
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="admin-page rounded-2xl bg-amber-50 p-6 text-amber-900">
        <h2 className="text-xl font-bold">Clientes</h2>
        <p className="mt-2 text-sm">Ejecuta schema-auth.sql en Supabase para habilitar el módulo de clientes.</p>
      </div>
    );
  }

  return (
    <div className="admin-page admin-page--fill">
      <AdminPageHeader
        title="Clientes registrados"
        subtitle="Buscar, segmentar y ver historial de compras"
        branchLabel={isBranchScoped ? branchName : undefined}
      />

      <div className="admin-toolbar">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o teléfono…"
            className="w-full rounded-xl border py-2 pl-10 pr-3"
          />
        </div>
        <select value={filterPromo} onChange={(e) => setFilterPromo(e.target.value)} className="w-full sm:w-auto">
          <option value="all">Todos los clientes</option>
          <option value="promo">Aceptan promociones por email</option>
        </select>
      </div>

      <div className="admin-page-split">
        {loading ? (
          <p className="col-span-full py-8 text-center text-gray-500">Cargando…</p>
        ) : (
          <AdminTable
            count={customers.length}
            countLabel={`${customers.length} cliente${customers.length !== 1 ? 's' : ''}`}
            emptyMessage="Sin clientes"
            minWidth={480}
            columns={[
              { key: 'name', label: 'Cliente' },
              { key: 'contact', label: 'Contacto' },
              { key: 'promo', label: 'Promos', className: 'hidden sm:table-cell' },
            ]}
          >
            {customers.map((c) => (
              <tr
                key={c.id}
                onClick={() => viewCustomer(c)}
                className={`cursor-pointer border-t hover:bg-red-50 ${selected?.id === c.id ? 'bg-red-50' : ''}`}
              >
                <td className="p-2 sm:p-3">
                  <p className="font-semibold">{c.fullName}</p>
                  <p className="text-xs text-gray-400">{c.isActive ? 'Activo' : 'Inactivo'}</p>
                </td>
                <td className="p-2 text-xs text-gray-600 sm:p-3">
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3 shrink-0" />{c.email || '—'}</span>
                  <span className="mt-1 flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{c.phone || '—'}</span>
                </td>
                <td className="hidden p-2 sm:table-cell sm:p-3">{c.acceptsEmail ? '✅ Email' : '—'}</td>
              </tr>
            ))}
          </AdminTable>
        )}

        <div className="admin-page-detail">
          {selected ? (
            <>
              <div className="border-b px-4 py-3 sm:p-4">
                <h3 className="font-bold">{selected.fullName}</h3>
                <p className="mt-1 text-xs text-gray-500 sm:text-sm">{selected.email} · {selected.phone}</p>
                <p className="mt-2 text-xs">
                  Promociones email: {selected.acceptsEmail ? 'Sí' : 'No'} · WhatsApp: {selected.acceptsWhatsapp ? 'Sí' : 'No'}
                </p>
              </div>
              <h4 className="flex items-center gap-2 px-4 pt-3 text-sm font-bold">
                <ShoppingBag className="h-4 w-4" /> Historial de pedidos ({orders.length})
              </h4>
              <AdminScrollPanel maxRows={12} variant="card" className="admin-scroll-fill flex-1 rounded-none border-0 shadow-none">
                <ul className="space-y-2 p-3 sm:p-4">
                  {orders.map((o) => (
                    <li key={o.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold">#{o.ticketNumber}</span>
                        <span className="font-bold text-pollon-red">{money(o.total)}</span>
                      </div>
                      <p className="text-xs text-gray-500">{formatDateTime(o.createdAt)} · {o.estado}</p>
                    </li>
                  ))}
                  {!orders.length && <p className="py-6 text-center text-sm text-gray-500">Sin pedidos</p>}
                </ul>
              </AdminScrollPanel>
            </>
          ) : (
            <p className="flex flex-1 items-center justify-center p-8 text-center text-sm text-gray-500">
              Selecciona un cliente para ver detalle
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
