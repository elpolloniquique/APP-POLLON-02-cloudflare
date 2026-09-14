import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { adminListAllBranches, adminSaveBranch, adminDeleteBranch, adminSetBranchActive } from '../../services/branchService';
import { isSupabaseConfigured, uploadProductImage } from '../../services/menuService';
import { useToast } from '../../hooks/useToast';
import { Plus, Pencil, Trash2, Power, PowerOff } from 'lucide-react';
import { HeroBannerImageEditor } from '../../components/admin/HeroBannerImageEditor';
import { canManageAllBranches } from '../../services/authService';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminScrollPanel } from '../../components/admin/AdminScrollPanel';
import { formatDeliveryCost, normalizeDeliveryCost } from '../../utils/format';
import { DEFAULT_BRANCH_PAYMENT_METHODS, formatPaymentMethodsSummary, normalizePaymentMethods } from '../../utils/paymentMethods';
import { PaymentMethodsEditor } from '../../components/admin/PaymentMethodsEditor';

const emptyBranch = () => ({
  name: '',
  slug: '',
  city: '',
  address: '',
  phone: '',
  whatsapp: '',
  schedule: 'Lun-Dom: 11:30 - 23:00',
  deliveryCost: '2500',
  deliveryEta: '30-45 min',
  deliveryEnabled: true,
  pickupEnabled: true,
  reservationsEnabled: true,
  isActive: true,
  isOpen: true,
  displayOrder: 0,
  facebookUrl: '',
  instagramUrl: '',
  tiktokUrl: '',
  paymentMethods: [...DEFAULT_BRANCH_PAYMENT_METHODS],
  heroImageUrl: '',
  logoUrl: '',
});

export function AdminBranches() {
  const { profile, can, role } = useAuth();
  const { refreshBranches } = useBranch();
  const { show, Toast } = useToast();
  const [list, setList] = useState([]);
  const [modal, setModal] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const user = { id: profile?.id, email: profile?.email };
  const canView = can('branches');
  const canManage = canManageAllBranches(role);
  const myBranchId = profile?.branchId || profile?.branch_id;

  const load = () => {
    setLoadError('');
    return adminListAllBranches()
      .then(setList)
      .catch((err) => setLoadError(err.message || 'No se pudo cargar sucursales'));
  };
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await adminSaveBranch({
        ...modal,
        schedule: modal.schedule,
        deliveryCost: normalizeDeliveryCost(modal.deliveryCost),
        isActive: modal.isActive,
        paymentMethods: normalizePaymentMethods(modal.paymentMethods),
      }, user);
      show(modal.id ? 'Sucursal actualizada' : 'Sucursal creada al final de la lista');
      setModal(null);
      await refreshBranches();
      load();
    } catch (err) {
      const msg = err.message || 'Error al guardar';
      show(
        /hero_image_url/i.test(msg)
          ? 'Para guardar la foto del banner, ejecuta supabase/add-branch-hero-image.sql en Supabase y vuelve a guardar.'
          : /payment_methods/i.test(msg)
            ? 'Para guardar métodos de pago, ejecuta supabase/add-branch-payment-methods.sql en Supabase y vuelve a guardar.'
            : msg.includes('branches') ? `${msg} — ¿Ejecutaste schema-multi-sucursal.sql?` : msg,
      );
    }
  };

  const toggleBranchActive = async (b) => {
    const willActivate = !b.isActive;
    const msg = willActivate
      ? `¿Activar "${b.name}"?\n\nVolverá a aparecer en el menú para los clientes, al final de la lista de sucursales.`
      : `¿Desactivar "${b.name}"?\n\nNo se borrará nada: productos, precios y configuración se mantienen. Solo dejará de mostrarse a los clientes hasta que la actives de nuevo.`;
    if (!window.confirm(msg)) return;

    setTogglingId(b.id);
    try {
      await adminSetBranchActive(b.id, willActivate, user);
      show(willActivate ? `Sucursal "${b.name}" activada` : `Sucursal "${b.name}" desactivada`);
      load();
    } catch (err) {
      show(err.message || 'No se pudo cambiar el estado de la sucursal');
    } finally {
      setTogglingId(null);
    }
  };

  const removeBranch = async (b) => {
    const msg = `¿Eliminar la sucursal "${b.name}"?\n\nSe borrarán también su menú, categorías y productos. Los pedidos antiguos se conservan sin sucursal.\n\nEsta acción no se puede deshacer.`;
    if (!window.confirm(msg)) return;
    setDeletingId(b.id);
    try {
      await adminDeleteBranch(b.id, user);
      show(`Sucursal "${b.name}" eliminada`);
      load();
    } catch (err) {
      show(err.message || 'No se pudo eliminar la sucursal');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isSupabaseConfigured()) {
    return <p className="rounded-xl bg-amber-50 p-4">Configura Supabase y ejecuta schema-multi-sucursal.sql</p>;
  }

  if (!canView) {
    return (
      <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-bold">Sin permiso para ver sucursales</p>
        <p className="mt-2">Tu rol actual es <strong>{role}</strong>.</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      {Toast}
      {loadError && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{loadError}. Verifica que exista la tabla <code>branches</code> (schema-multi-sucursal.sql).</p>
      )}
      <AdminPageHeader
        title="Sucursales"
        subtitle={canManage ? 'Cada sucursal opera de forma independiente' : 'Consulta de sucursales — solo lectura'}
        actions={canManage ? (
          <button
            type="button"
            onClick={() => setModal(emptyBranch())}
            className="flex items-center gap-2 rounded-xl bg-pollon-red px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" /> Nueva sucursal
          </button>
        ) : undefined}
      />

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <div className="flex items-center justify-between border-b px-3 py-2.5 sm:px-4">
          <p className="text-sm font-semibold text-gray-700">
            {list.length} sucursal{list.length !== 1 ? 'es' : ''}
            {list.some((b) => !b.isActive) && (
              <span className="ml-2 font-normal text-gray-500">
                ({list.filter((b) => b.isActive).length} activas)
              </span>
            )}
          </p>
          {list.length > 4 && <p className="text-xs text-gray-400">Desplaza ↓</p>}
        </div>
        <AdminScrollPanel maxRows={4} variant="grid" className="rounded-none border-0 shadow-none">
          <div className="grid gap-3 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4">
            {list.map((b) => (
              <article
                key={b.id}
                className={`rounded-xl p-4 ring-1 sm:rounded-2xl sm:p-5 ${
                  !b.isActive
                    ? 'border border-dashed border-gray-300 bg-gray-50/50 opacity-90 ring-gray-200'
                    : b.id === myBranchId
                      ? 'bg-pollon-red/5 ring-pollon-red/30'
                      : 'bg-gray-50/80 ring-gray-100'
                }`}
              >
                <div className="flex justify-between gap-2">
                  <h3 className={`min-w-0 truncate font-bold ${!b.isActive ? 'text-gray-600' : ''}`}>
                    {b.name}
                    {b.id === myBranchId && <span className="ml-2 text-xs font-normal text-pollon-red">(Tu local)</span>}
                  </h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                    b.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {b.isActive ? 'Activa' : 'Desactivada'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 sm:text-sm">{b.city} · {b.address}</p>
                <p className="text-xs sm:text-sm">WhatsApp: {b.whatsapp}</p>
                <p className="text-xs sm:text-sm">Delivery: {formatDeliveryCost(b.deliveryCost)}</p>
                <p className="text-xs sm:text-sm">Pago: {formatPaymentMethodsSummary(b)}</p>
                {!b.isActive && (
                  <p className="mt-2 text-xs text-amber-800/90">
                    Oculta para clientes. Menú y productos intactos.
                  </p>
                )}
                {canManage && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setModal({ ...b, schedule: b.schedule })}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-pollon-red hover:bg-red-50"
                    >
                      <Pencil className="h-4 w-4" /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleBranchActive(b)}
                      disabled={togglingId === b.id}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold disabled:opacity-50 ${
                        b.isActive
                          ? 'text-amber-700 hover:bg-amber-50'
                          : 'text-green-700 hover:bg-green-50'
                      }`}
                    >
                      {b.isActive ? (
                        <><PowerOff className="h-4 w-4" />{togglingId === b.id ? '…' : 'Desactivar'}</>
                      ) : (
                        <><Power className="h-4 w-4" />{togglingId === b.id ? '…' : 'Activar'}</>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBranch(b)}
                      disabled={deletingId === b.id}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingId === b.id ? 'Eliminando…' : 'Eliminar'}
                    </button>
                  </div>
                )}
              </article>
            ))}
            {!list.length && <p className="col-span-full py-8 text-center text-sm text-gray-500">Sin sucursales</p>}
          </div>
        </AdminScrollPanel>
      </div>

      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={save} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6">
            <h3 className="text-lg font-bold">{modal.id ? 'Editar' : 'Nueva'} sucursal</h3>
            {!modal.id && (
              <p className="mt-1 text-xs text-gray-500">Se agregará al final de la lista visible para los clientes.</p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input required value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} placeholder="Nombre" className="col-span-2 rounded-lg border px-3 py-2" />
              <input value={modal.slug} onChange={(e) => setModal({ ...modal, slug: e.target.value })} placeholder="Slug (iquique-vivar)" className="rounded-lg border px-3 py-2" />
              <input value={modal.city} onChange={(e) => setModal({ ...modal, city: e.target.value })} placeholder="Ciudad (Iquique, Arica…)" className="rounded-lg border px-3 py-2" />
              <input value={modal.address} onChange={(e) => setModal({ ...modal, address: e.target.value })} placeholder="Dirección" className="col-span-2 rounded-lg border px-3 py-2" />
              <input value={modal.phone} onChange={(e) => setModal({ ...modal, phone: e.target.value })} placeholder="Teléfono" className="rounded-lg border px-3 py-2" />
              <input value={modal.whatsapp} onChange={(e) => setModal({ ...modal, whatsapp: e.target.value })} placeholder="WhatsApp" className="rounded-lg border px-3 py-2" />
              <input value={modal.schedule} onChange={(e) => setModal({ ...modal, schedule: e.target.value })} placeholder="Horario" className="col-span-2 rounded-lg border px-3 py-2" />
              <input value={modal.deliveryCost} onChange={(e) => setModal({ ...modal, deliveryCost: e.target.value })} placeholder="2500 o Varía según distancia" className="col-span-2 rounded-lg border px-3 py-2 sm:col-span-1" />
              <input value={modal.deliveryEta} onChange={(e) => setModal({ ...modal, deliveryEta: e.target.value })} placeholder="Tiempo entrega" className="rounded-lg border px-3 py-2" />
              <label className="col-span-2 flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <input type="checkbox" checked={modal.isActive} onChange={(e) => setModal({ ...modal, isActive: e.target.checked })} />
                <span className="text-sm">
                  <span className="font-semibold">Sucursal activa</span>
                  <span className="block text-xs text-gray-500">Si está desmarcada, no aparece en el menú público (igual que Desactivar)</span>
                </span>
              </label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={modal.deliveryEnabled} onChange={(e) => setModal({ ...modal, deliveryEnabled: e.target.checked })} /> Delivery</label>
            </div>
            <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
              <p className="text-sm font-bold text-gray-800">Logotipo del header</p>
              <p className="text-xs text-gray-500">PNG/WebP sin fondo. Se muestra sin círculo en el header de la web.</p>
              <HeroBannerImageEditor
                variant="logo"
                imageUrl={modal.logoUrl || ''}
                onChange={(logoUrl) => setModal({ ...modal, logoUrl })}
                onUpload={async (file) => {
                  setUploadingLogo(true);
                  try {
                    return await uploadProductImage(file, modal.id || 'general');
                  } finally {
                    setUploadingLogo(false);
                  }
                }}
                onError={(msg) => show(msg)}
                uploading={uploadingLogo}
              />
            </div>
            <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
              <p className="text-sm font-bold text-gray-800">Portada del inicio</p>
              <p className="text-xs text-gray-500">Foto de fondo del banner y ciudad junto al GPS. Cambia al elegir esta sucursal.</p>
              <HeroBannerImageEditor
                imageUrl={modal.heroImageUrl || ''}
                onChange={(heroImageUrl) => setModal({ ...modal, heroImageUrl })}
                onUpload={async (file) => {
                  setUploadingHero(true);
                  try {
                    return await uploadProductImage(file, modal.id || 'general');
                  } finally {
                    setUploadingHero(false);
                  }
                }}
                onError={(msg) => show(msg)}
                uploading={uploadingHero}
              />
            </div>
            <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
              <p className="text-sm font-bold text-gray-800">Métodos de pago de esta sucursal</p>
              <p className="text-xs text-gray-500">El cliente solo verá los métodos activos. El cobro es al recibir el pedido.</p>
              <PaymentMethodsEditor
                value={modal.paymentMethods}
                onChange={(paymentMethods) => setModal({ ...modal, paymentMethods })}
              />
            </div>
            <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
              <p className="text-sm font-bold text-gray-800">Redes sociales (footer)</p>
              <input value={modal.facebookUrl || ''} onChange={(e) => setModal({ ...modal, facebookUrl: e.target.value })} placeholder="Facebook — URL o usuario" className="w-full rounded-lg border px-3 py-2 text-sm" />
              <input value={modal.instagramUrl || ''} onChange={(e) => setModal({ ...modal, instagramUrl: e.target.value })} placeholder="Instagram — URL o usuario" className="w-full rounded-lg border px-3 py-2 text-sm" />
              <input value={modal.tiktokUrl || ''} onChange={(e) => setModal({ ...modal, tiktokUrl: e.target.value })} placeholder="TikTok — URL o @usuario" className="w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" className="flex-1 rounded-lg bg-pollon-red py-2 font-bold text-white">Guardar</button>
              <button type="button" onClick={() => setModal(null)} className="flex-1 rounded-lg border py-2">Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
