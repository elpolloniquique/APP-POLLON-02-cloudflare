import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { normalizeRole } from '../../services/authService';
import { useStaffBranch } from '../../hooks/useStaffBranch';
import { adminListAllBranches } from '../../services/branchService';
import {
  adminListCategories,
  adminUpsertCategory,
  adminDeleteCategory,
  adminCountProductsInCategory,
  adminListProducts,
  adminUpsertProduct,
  adminBulkPriceIncrease,
  adminBulkSetUnavailable,
  adminCopyMenuFromBranch,
  adminDuplicateCategory,
  adminDuplicateProduct,
  adminReorderCategory,
  adminSuggestProductDisplayOrder,
  adminSetProductDisplayOrder,
  uploadProductImage,
  uploadProductImages,
  isSupabaseConfigured,
} from '../../services/menuService';
import { ProductImagesEditor } from '../../components/admin/ProductImagesEditor';
import { CategoryImageEditor } from '../../components/admin/CategoryImageEditor';
import { DrinkFlavorsEditor } from '../../components/admin/DrinkFlavorsEditor';
import { AdminScrollPanel } from '../../components/admin/AdminScrollPanel';
import { AdminTable } from '../../components/admin/AdminTable';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { getAuditLogs } from '../../services/auditService';
import { money } from '../../utils/format';
import { BAG_PRICE } from '../../utils/constants';
import { defaultProductOptionsForCategory } from '../../utils/productOptions';
import { defaultDrinkFlavors } from '../../utils/drinkFlavors';
import { fetchDrinkFlavors, saveDrinkFlavors } from '../../services/drinkFlavorsService';
import { useToast } from '../../hooks/useToast';
import {
  Plus, Pencil, Trash2, Copy, ArrowUp, ArrowDown, Eye, Search,
  Percent, Ban, Download, CupSoda,
} from 'lucide-react';

const MENU_TABS = [
  { id: 'categorias', label: 'Categorías' },
  { id: 'productos', label: 'Productos' },
  { id: 'sabores', label: 'Sabores de bebida' },
  { id: 'herramientas', label: 'Herramientas' },
  { id: 'historial', label: 'Historial' },
];

const emptyCat = (branchId) => ({
  branchId, name: '', description: '', imageUrl: '', displayOrder: 0, isActive: true,
});

const emptyProd = (branchId, categoryId, categoryName = '', displayOrder = 1) => ({
  branchId, categoryId, name: '', description: '', imageUrl: '', imageUrls: [], price: 0,
  oldPrice: null, available: true, isFeatured: false, isPromotion: false, displayOrder,
  ...defaultProductOptionsForCategory(categoryName),
});

/** Orden sugerido según productos ya cargados en la categoría */
function suggestProductOrderFromList(products, categoryId) {
  const list = categoryId ? products.filter((p) => p.categoryId === categoryId) : products;
  if (!list.length) return 1;
  return Math.max(...list.map((p) => Number(p.displayOrder) || 0), 0) + 1;
}

export function AdminMenu() {
  const { profile } = useAuth();
  const { show, Toast } = useToast();
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [tab, setTab] = useState('productos');
  const [search, setSearch] = useState('');
  const [filterAvail, setFilterAvail] = useState('all');
  const [loading, setLoading] = useState(false);
  const [catModal, setCatModal] = useState(null);
  const [prodModal, setProdModal] = useState(null);
  const [audit, setAudit] = useState([]);
  const [copyFromId, setCopyFromId] = useState('');
  const [dupProduct, setDupProduct] = useState(null);
  const [dupTargetBranch, setDupTargetBranch] = useState('');
  const [dupTargetCat, setDupTargetCat] = useState('');
  const [dupTargetCats, setDupTargetCats] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingCatImage, setUploadingCatImage] = useState(false);
  const [orderDraft, setOrderDraft] = useState({});
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [drinkFlavors, setDrinkFlavors] = useState(defaultDrinkFlavors());
  const [savingDrinks, setSavingDrinks] = useState(false);

  const user = { id: profile?.id, email: profile?.email };
  const role = normalizeRole(profile?.rol || profile?.role);
  const isSuper = role === 'super_admin';
  const adminBranchId = profile?.branch_id || profile?.branchId;
  const { branchName, isBranchScoped } = useStaffBranch();
  const canManageMenu = role === 'super_admin' || role === 'admin_sucursal' || role === 'administrador';
  const activeBranchId = isSuper ? branchId : (adminBranchId || branchId);

  useEffect(() => {
    adminListAllBranches().then((list) => {
      const visible = isSuper ? list : list.filter((b) => b.id === adminBranchId);
      setBranches(visible.length ? visible : list);
      const initial = isSuper ? (list[0]?.id || '') : (adminBranchId || '');
      setBranchId(initial);
    });
  }, [isSuper, adminBranchId]);

  useEffect(() => {
    if (!isSuper && adminBranchId && branchId !== adminBranchId) {
      setBranchId(adminBranchId);
    }
  }, [isSuper, adminBranchId, branchId]);

  const load = useCallback(async () => {
    const bid = activeBranchId;
    if (!bid) return;
    setLoading(true);
    try {
      const [cats, prods] = await Promise.all([
        adminListCategories(bid),
        adminListProducts(bid, {
          categoryId: selectedCatId || undefined,
          search: search || undefined,
          available: filterAvail === 'all' ? undefined : filterAvail === 'yes',
        }),
      ]);
      setCategories(cats);
      const sorted = [...prods].sort(
        (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || (a.name || '').localeCompare(b.name || '', 'es'),
      );
      setProducts(sorted);
      setOrderDraft({});
      if (!selectedCatId && cats.length) setSelectedCatId(cats[0].id);
    } catch (e) {
      show(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, selectedCatId, search, filterAvail, show]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!activeBranchId) {
      setDrinkFlavors(defaultDrinkFlavors());
      return;
    }
    let cancelled = false;
    fetchDrinkFlavors(activeBranchId)
      .then((list) => {
        if (!cancelled) setDrinkFlavors(list);
      })
      .catch(() => {
        if (!cancelled) setDrinkFlavors(defaultDrinkFlavors());
      });
    return () => { cancelled = true; };
  }, [activeBranchId]);

  useEffect(() => {
    if (!dupProduct) return;
    const target = dupTargetBranch || branchId;
    adminListCategories(target).then(setDupTargetCats).catch(() => setDupTargetCats([]));
  }, [dupProduct, dupTargetBranch, branchId]);

  useEffect(() => {
    if (activeBranchId && tab === 'historial') {
      getAuditLogs(activeBranchId).then(setAudit);
    }
  }, [activeBranchId, tab]);

  const saveCategory = async (e) => {
    e.preventDefault();
    try {
      await adminUpsertCategory({ ...catModal, branchId: activeBranchId }, user);
      setCatModal(null);
      show('Categoría guardada');
      load();
    } catch (err) {
      show(err.message);
    }
  };

  const deleteCategory = async (cat) => {
    const count = await adminCountProductsInCategory(cat.id);
    const msg = count > 0
      ? `¿Eliminar "${cat.name}" y sus ${count} producto(s)? No se puede deshacer.`
      : `¿Eliminar la categoría "${cat.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      await adminDeleteCategory(cat.id, activeBranchId, user);
      show('Categoría eliminada');
      if (selectedCatId === cat.id) setSelectedCatId('');
      load();
    } catch (err) {
      show(err.message);
    }
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    try {
      const imageUrls = prodModal.imageUrls || [];
      const displayOrder = Math.max(1, Math.floor(Number(prodModal.displayOrder) || 1));
      await adminUpsertProduct({
        ...prodModal,
        branchId: activeBranchId,
        imageUrls,
        imageUrl: imageUrls[0] || prodModal.imageUrl || '',
        displayOrder,
      }, user);
      setProdModal(null);
      show('Producto guardado');
      load();
    } catch (err) {
      show(err.message);
    }
  };

  const openNewProductModal = async () => {
    const catId = selectedCatId || categories[0]?.id || '';
    const catName = categories.find((c) => c.id === catId)?.name || '';
    let nextOrder = suggestProductOrderFromList(products, catId);
    if (activeBranchId && catId) {
      try {
        nextOrder = await adminSuggestProductDisplayOrder(activeBranchId, catId);
      } catch {
        /* usa cálculo local */
      }
    }
    setProdModal(emptyProd(activeBranchId, catId, catName, nextOrder));
  };

  const saveProductOrderInline = async (product) => {
    const raw = orderDraft[product.id] ?? product.displayOrder ?? 1;
    const order = Math.max(1, Math.floor(Number(raw) || 1));
    if (order === (product.displayOrder ?? 0)) {
      setOrderDraft((d) => {
        const next = { ...d };
        delete next[product.id];
        return next;
      });
      return;
    }
    setSavingOrderId(product.id);
    try {
      await adminSetProductDisplayOrder(product.id, order, user);
      show(`Orden actualizado: ${product.name} → #${order}`);
      await load();
    } catch (err) {
      show(err.message);
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleProductImagesUpload = async (files) => {
    if (!files?.length) return;
    if (!activeBranchId) {
      show('Selecciona una sucursal antes de subir imágenes');
      return;
    }
    setUploadingImages(true);
    try {
      const result = await uploadProductImages(files, activeBranchId);
      const urls = result.urls || result;
      setProdModal((p) => {
        const prev = p.imageUrls || (p.imageUrl ? [p.imageUrl] : []);
        const merged = [...prev, ...urls].slice(0, 12);
        return { ...p, imageUrls: merged, imageUrl: merged[0] || '' };
      });
      show(result.warning ? `${urls.length} imagen(es) subida(s). ${result.warning}` : `${urls.length} imagen(es) subida(s)`);
    } catch (err) {
      show(err.message || 'No se pudo subir la imagen');
    } finally {
      setUploadingImages(false);
    }
  };

  const openProductModal = (product) => {
    const imageUrls = product.imageUrls?.length
      ? product.imageUrls
      : (product.imageUrl ? [product.imageUrl] : []);
    setProdModal({ ...product, imageUrls, imageUrl: imageUrls[0] || product.imageUrl || '' });
  };

  const handleSaveDrinkFlavors = async () => {
    if (!activeBranchId) {
      show('Selecciona una sucursal antes de guardar sabores');
      return;
    }
    if (!canManageMenu) return;
    setSavingDrinks(true);
    try {
      const saved = await saveDrinkFlavors(drinkFlavors, activeBranchId);
      setDrinkFlavors(saved);
      show(`Sabores guardados (${saved.filter((f) => String(f.name || '').trim()).length})`);
    } catch (err) {
      show(err.message || 'No se pudieron guardar los sabores');
    } finally {
      setSavingDrinks(false);
    }
  };

  const moveCategory = async (cat, dir) => {
    const idx = categories.findIndex((c) => c.id === cat.id);
    const swap = categories[idx + dir];
    if (!swap) return;
    try {
      await adminReorderCategory(cat.id, swap.displayOrder);
      await adminReorderCategory(swap.id, cat.displayOrder);
      load();
    } catch (e) {
      show(e.message);
    }
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="rounded-2xl bg-amber-50 p-6 text-amber-900">
        <h2 className="text-xl font-bold">Configura Supabase</h2>
        <p className="mt-2 text-sm">Ejecuta schema-multi-sucursal.sql y seed-multi-sucursal.sql en tu proyecto Supabase.</p>
      </div>
    );
  }

  if (isBranchScoped && !adminBranchId) {
    return (
      <div className="admin-page rounded-xl bg-amber-50 p-6 text-amber-900">
        <h2 className="text-xl font-bold">Menú por sucursal</h2>
        <p className="mt-2 text-sm">Tu cuenta no tiene sucursal asignada. Contacta al super admin para vincular tu perfil a un local.</p>
      </div>
    );
  }

  const currentBranch = branches.find((b) => b.id === activeBranchId);

  return (
    <div className="admin-page admin-page--fill">
      {Toast}
      <AdminPageHeader
        title="Menú por sucursal"
        subtitle={isSuper ? 'Gestiona el menú de cualquier sucursal' : 'Solo puedes editar el menú de tu local'}
        branchLabel={!isSuper ? (currentBranch?.name || branchName) : undefined}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {isSuper ? (
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="max-w-[200px] rounded-xl border px-3 py-2 text-sm font-semibold sm:max-w-none sm:px-4"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            ) : (
              <span className="rounded-xl bg-pollon-red/10 px-3 py-2 text-sm font-semibold text-pollon-red">
                {currentBranch?.name || branchName}
              </span>
            )}
            <Link
              to={`/tienda?branch=${activeBranchId}`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-xl border border-pollon-red px-3 py-2 text-sm font-semibold text-pollon-red sm:px-4"
            >
              <Eye className="h-4 w-4" /> Vista previa
            </Link>
          </div>
        )}
      />

      <div className="-mx-1 flex gap-1 overflow-x-auto border-b pb-px scrollbar-hide sm:mx-0 sm:gap-2">
        {MENU_TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 border-b-2 px-3 py-2 text-xs font-bold sm:px-4 sm:text-sm ${tab === id ? 'border-pollon-red text-pollon-red' : 'border-transparent text-gray-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'categorias' && (
        <div className="admin-list-shell p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="font-bold">Categorías ({categories.length})</h3>
            {categories.length > 7 && (
              <span className="text-xs text-gray-400">Desplaza para ver más</span>
            )}
          </div>
          <AdminScrollPanel maxRows={12} variant="card" className={`admin-scroll-fill ${categories.length ? '' : 'border-0 shadow-none'}`}>
            <div className="space-y-2 p-2">
            {categories.map((c, i) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-gray-500">Orden {c.displayOrder} · {c.isActive ? 'Activa' : 'Inactiva'}</p>
                </div>
                {canManageMenu && (
                  <>
                    <button type="button" onClick={() => moveCategory(c, -1)} disabled={i === 0} className="p-1" title="Subir"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" onClick={() => moveCategory(c, 1)} disabled={i === categories.length - 1} className="p-1" title="Bajar"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setCatModal(c)} className="p-2 text-gray-600" title="Editar"><Pencil className="h-4 w-4" /></button>
                    <button type="button" onClick={() => deleteCategory(c)} className="p-2 text-red-600" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
                    <button type="button" onClick={() => adminDuplicateCategory(c.id, activeBranchId, user).then(() => { show('Categoría duplicada'); load(); })} className="p-2 text-blue-600" title="Duplicar"><Copy className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            ))}
            {!categories.length && (
              <p className="py-8 text-center text-sm text-gray-500">
                Sin categorías. {canManageMenu ? 'Crea la primera con el botón de arriba.' : ''}
              </p>
            )}
            </div>
          </AdminScrollPanel>
          {canManageMenu && (
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={() => setCatModal(emptyCat(activeBranchId))} className="flex items-center gap-1 rounded-lg bg-pollon-red px-3 py-2 text-sm text-white">
                <Plus className="h-4 w-4" /> Nueva categoría
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'productos' && (
        <div className="admin-page-fill gap-3">
          <div className="admin-toolbar">
            <select value={selectedCatId} onChange={(e) => setSelectedCatId(e.target.value)} className="w-full sm:w-auto">
              <option value="">Todas las categorías</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="relative min-w-[160px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto..." className="w-full rounded-lg border py-2 pl-9 pr-3" />
            </div>
            <select value={filterAvail} onChange={(e) => setFilterAvail(e.target.value)} className="w-full sm:w-auto">
              <option value="all">Todos</option>
              <option value="yes">Disponibles</option>
              <option value="no">No disponibles</option>
            </select>
            <button type="button" onClick={openNewProductModal} className="flex w-full items-center justify-center gap-1 rounded-lg bg-pollon-red px-4 py-2 text-sm text-white sm:w-auto">
              <Plus className="h-4 w-4" /> Nuevo producto
            </button>
          </div>

          {loading ? <p className="text-center text-gray-500">Cargando…</p> : (
            <AdminTable
              count={products.length}
              countLabel={`${products.length} producto${products.length !== 1 ? 's' : ''}`}
              emptyMessage="Sin productos"
              minWidth={720}
              columns={[
                { key: 'order', label: 'Orden', className: 'w-16' },
                { key: 'img', label: 'Img' },
                { key: 'name', label: 'Nombre' },
                { key: 'cat', label: 'Categoría', className: 'hidden md:table-cell' },
                { key: 'price', label: 'Precio' },
                { key: 'status', label: 'Estado' },
                { key: 'actions', label: 'Acciones' },
              ]}
            >
              {products.map((p) => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 sm:p-3">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      aria-label={`Orden del plato ${p.name}`}
                      value={orderDraft[p.id] ?? p.displayOrder ?? 1}
                      disabled={savingOrderId === p.id}
                      onChange={(e) => setOrderDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                      onBlur={() => saveProductOrderInline(p)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      className="admin-order-input w-14 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm font-bold text-pollon-red focus:border-pollon-red focus:outline-none focus:ring-2 focus:ring-pollon-red/20 disabled:opacity-50"
                    />
                  </td>
                  <td className="p-2 sm:p-3">
                    {p.imageUrl ? (
                      <div className="relative inline-block">
                        <img src={p.imageUrl} alt="" className="h-8 w-8 rounded object-cover sm:h-10 sm:w-10" />
                        {(p.imageUrls?.length || 0) > 1 && (
                          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-pollon-red px-1 text-[9px] font-bold text-white">
                            {p.imageUrls.length}
                          </span>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="max-w-[140px] truncate p-2 font-medium sm:max-w-none sm:p-3">{p.name}</td>
                  <td className="hidden p-2 text-gray-500 md:table-cell sm:p-3">{p.categoryName}</td>
                  <td className="p-2 font-bold text-pollon-red sm:p-3">{money(p.price)}</td>
                  <td className="p-2 sm:p-3">{p.available ? '✅' : '❌'}</td>
                  <td className="p-2 sm:p-3">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => openProductModal(p)} className="text-gray-600" title="Editar"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => { setDupProduct(p); setDupTargetBranch(''); setDupTargetCat(''); }} className="text-blue-600" title="Duplicar"><Copy className="h-4 w-4" /></button>
                      <button type="button" onClick={() => adminUpsertProduct({ ...p, available: !p.available }, user).then(load)} className="text-amber-600" title="Disponibilidad"><Ban className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </AdminTable>
          )}
        </div>
      )}

      {tab === 'sabores' && (
        <div className="admin-list-shell rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-bold">
                <CupSoda className="h-5 w-5 text-pollon-red" />
                Sabores de bebida
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Opciones del selector “Sabor de bebida” en combos y ofertas familiares.
              </p>
            </div>
            {canManageMenu && (
              <button
                type="button"
                disabled={savingDrinks || !activeBranchId}
                onClick={handleSaveDrinkFlavors}
                className="rounded-lg bg-pollon-red px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {savingDrinks ? 'Guardando…' : 'Guardar sabores'}
              </button>
            )}
          </div>
          <DrinkFlavorsEditor
            value={drinkFlavors}
            disabled={!canManageMenu}
            onChange={setDrinkFlavors}
          />
        </div>
      )}

      {tab === 'herramientas' && (
        <div className="grid gap-4 md:grid-cols-2">
          {isSuper && (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="flex items-center gap-2 font-bold"><Copy className="h-5 w-5 text-pollon-red" /> Copiar menú de otra sucursal</h3>
              <p className="mt-1 text-sm text-gray-500">Importa categorías y productos completos (solo super admin)</p>
              <select value={copyFromId} onChange={(e) => setCopyFromId(e.target.value)} className="mt-3 w-full rounded-lg border px-3 py-2 text-sm">
                <option value="">Seleccionar origen</option>
                {branches.filter((b) => b.id !== activeBranchId).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <button
                type="button"
                className="mt-3 w-full rounded-lg bg-pollon-red py-2 text-sm font-bold text-white"
                onClick={() => {
                  if (!copyFromId || !confirm('¿Copiar todo el menú? Se agregarán categorías y productos.')) return;
                  adminCopyMenuFromBranch(copyFromId, activeBranchId, user).then(() => { show('Menú copiado'); load(); });
                }}
              >
                Copiar menú
              </button>
            </div>
          )}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="flex items-center gap-2 font-bold"><Percent className="h-5 w-5 text-pollon-red" /> Aumento de precios</h3>
            <p className="mt-1 text-sm text-gray-500">Aplica un % a todos los productos de esta sucursal</p>
            <input type="number" id="price-percent" placeholder="Ej: 10" className="mt-3 w-full rounded-lg border px-3 py-2" />
            <button
              type="button"
              className="mt-3 w-full rounded-lg border-2 border-pollon-red py-2 text-sm font-bold text-pollon-red"
              onClick={() => {
                const pct = document.getElementById('price-percent')?.value;
                if (!pct || !confirm(`¿Aumentar ${pct}% todos los precios?`)) return;
                adminBulkPriceIncrease(activeBranchId, pct, user).then(() => { show('Precios actualizados'); load(); });
              }}
            >
              Aplicar aumento
            </button>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="flex items-center gap-2 font-bold"><Ban className="h-5 w-5 text-red-600" /> Desactivar todos</h3>
            <p className="mt-1 text-sm text-gray-500">Marca todos los productos como no disponibles</p>
            <button
              type="button"
              className="mt-3 w-full rounded-lg bg-red-600 py-2 text-sm font-bold text-white"
              onClick={() => {
                if (!confirm('¿Desactivar TODOS los productos de esta sucursal?')) return;
                adminBulkSetUnavailable(activeBranchId).then(() => { show('Productos desactivados'); load(); });
              }}
            >
              Desactivar productos
            </button>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm opacity-60">
            <h3 className="flex items-center gap-2 font-bold"><Download className="h-5 w-5" /> Exportar Excel/CSV</h3>
            <p className="mt-1 text-sm text-gray-500">Próximamente</p>
          </div>
        </div>
      )}

      {tab === 'historial' && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold">Historial de cambios</h3>
            {audit.length > 7 && <span className="text-xs text-gray-400">Desplaza para ver más</span>}
          </div>
          <AdminScrollPanel maxRows={7} variant="card">
            <div className="space-y-2 p-2">
            {audit.map((a) => (
              <div key={a.id} className="rounded-lg border p-3 text-sm">
                <p className="font-semibold">{a.action} · {a.entity_type}</p>
                <p className="text-xs text-gray-500">{a.user_email} · {new Date(a.created_at).toLocaleString('es-CL')}</p>
              </div>
            ))}
            {!audit.length && <p className="py-8 text-center text-gray-500">Sin registros</p>}
            </div>
          </AdminScrollPanel>
        </div>
      )}

      {catModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={saveCategory} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6">
            <h3 className="text-lg font-bold">{catModal.id ? 'Editar' : 'Nueva'} categoría</h3>
            <div className="mt-4 space-y-3">
              <input required value={catModal.name} onChange={(e) => setCatModal({ ...catModal, name: e.target.value })} placeholder="Nombre" className="w-full rounded-lg border px-3 py-2" />
              <textarea value={catModal.description} onChange={(e) => setCatModal({ ...catModal, description: e.target.value })} placeholder="Descripción" className="w-full rounded-lg border px-3 py-2" rows={2} />
              <input type="number" value={catModal.displayOrder} onChange={(e) => setCatModal({ ...catModal, displayOrder: Number(e.target.value) })} placeholder="Orden" className="w-full rounded-lg border px-3 py-2" />
              <CategoryImageEditor
                imageUrl={catModal.imageUrl || ''}
                onChange={(url) => setCatModal({ ...catModal, imageUrl: url })}
                onUpload={async (file) => {
                  if (!activeBranchId) throw new Error('Selecciona una sucursal antes de subir imágenes');
                  setUploadingCatImage(true);
                  try {
                    return await uploadProductImage(file, activeBranchId);
                  } finally {
                    setUploadingCatImage(false);
                  }
                }}
                onError={show}
                uploading={uploadingCatImage}
              />
              <label className="flex items-center gap-2"><input type="checkbox" checked={catModal.isActive} onChange={(e) => setCatModal({ ...catModal, isActive: e.target.checked })} /> Activa</label>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" className="flex-1 rounded-lg bg-pollon-red py-2 font-bold text-white">Guardar</button>
              <button type="button" onClick={() => setCatModal(null)} className="flex-1 rounded-lg border py-2">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {dupProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-bold">Duplicar producto</h3>
            <p className="mt-1 text-sm text-gray-500">
              {isSuper ? 'Copiar a otra sucursal' : 'Duplicar dentro de tu local'}
            </p>
            <div className="mt-4 space-y-3">
              {isSuper && (
                <select
                  value={dupTargetBranch}
                  onChange={(e) => setDupTargetBranch(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">Sucursal destino</option>
                  {branches.filter((b) => b.id !== activeBranchId).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
              <select
                value={dupTargetCat}
                onChange={(e) => setDupTargetCat(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Seleccionar categoría destino</option>
                {dupTargetCats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg bg-pollon-red py-2 font-bold text-white"
                onClick={async () => {
                  try {
                    let targetBranch = isSuper ? (dupTargetBranch || activeBranchId) : activeBranchId;
                    let targetCat = dupTargetCat;
                    if (dupTargetBranch && !dupTargetCat) {
                      const remoteCats = await adminListCategories(dupTargetBranch);
                      targetCat = remoteCats.find((c) => c.isActive)?.id || remoteCats[0]?.id;
                      if (!targetCat) { show('La sucursal destino no tiene categorías'); return; }
                    }
                    if (!targetCat) targetCat = dupProduct.categoryId;
                    await adminDuplicateProduct(dupProduct.id, targetBranch, targetCat, user);
                    show('Producto duplicado');
                    setDupProduct(null);
                    load();
                  } catch (err) {
                    show(err.message);
                  }
                }}
              >
                Duplicar
              </button>
              <button type="button" onClick={() => setDupProduct(null)} className="flex-1 rounded-lg border py-2">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {prodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={saveProduct} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6">
            <h3 className="text-lg font-bold">{prodModal.id ? 'Editar' : 'Nuevo'} producto</h3>
            <div className="mt-4 space-y-3">
              <select
                required
                value={prodModal.categoryId}
                onChange={(e) => {
                  const catId = e.target.value;
                  const catName = categories.find((c) => c.id === catId)?.name || '';
                  setProdModal((m) => {
                    if (m.id) return { ...m, categoryId: catId };
                    const nextOrder = suggestProductOrderFromList(products, catId);
                    return { ...m, categoryId: catId, displayOrder: nextOrder, ...defaultProductOptionsForCategory(catName) };
                  });
                }}
                className="w-full rounded-lg border px-3 py-2"
              >
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input required value={prodModal.name} onChange={(e) => setProdModal({ ...prodModal, name: e.target.value })} placeholder="Nombre" className="w-full rounded-lg border px-3 py-2" />
              <textarea value={prodModal.description} onChange={(e) => setProdModal({ ...prodModal, description: e.target.value })} placeholder="Descripción" className="w-full rounded-lg border px-3 py-2" rows={3} />
              <div className="grid grid-cols-2 gap-2">
                <input required type="number" value={prodModal.price} onChange={(e) => setProdModal({ ...prodModal, price: Number(e.target.value) })} placeholder="Precio" className="rounded-lg border px-3 py-2" />
                <input type="number" value={prodModal.oldPrice || ''} onChange={(e) => setProdModal({ ...prodModal, oldPrice: Number(e.target.value) || null })} placeholder="Precio anterior" className="rounded-lg border px-3 py-2" />
              </div>
              <div className="rounded-xl border border-pollon-red/20 bg-red-50/40 p-4">
                <label htmlFor="prod-display-order" className="block text-sm font-bold text-pollon-black">
                  Orden del plato
                </label>
                <p className="mt-1 text-xs leading-relaxed text-gray-600">
                  Número entero: <strong>1</strong> aparece primero, <strong>2</strong> después del 1, y así sucesivamente.
                  Los platos se ordenan automáticamente en la tienda según este valor.
                </p>
                <input
                  id="prod-display-order"
                  required
                  type="number"
                  min={1}
                  step={1}
                  value={prodModal.displayOrder ?? 1}
                  onChange={(e) => setProdModal({ ...prodModal, displayOrder: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                  className="mt-2 w-full max-w-[8rem] rounded-lg border border-pollon-red/30 px-3 py-2 text-center text-lg font-bold text-pollon-red focus:border-pollon-red focus:outline-none focus:ring-2 focus:ring-pollon-red/20"
                />
              </div>
              <ProductImagesEditor
                imageUrls={prodModal.imageUrls || []}
                onChange={(imageUrls) => setProdModal({ ...prodModal, imageUrls, imageUrl: imageUrls[0] || '' })}
                onUpload={handleProductImagesUpload}
                onError={show}
                uploading={uploadingImages}
              />
              <label className="flex items-center gap-2"><input type="checkbox" checked={prodModal.available} onChange={(e) => setProdModal({ ...prodModal, available: e.target.checked })} /> Disponible</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={prodModal.isFeatured} onChange={(e) => setProdModal({ ...prodModal, isFeatured: e.target.checked })} /> Destacado</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={prodModal.isPromotion} onChange={(e) => setProdModal({ ...prodModal, isPromotion: e.target.checked })} /> Promoción</label>

              <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 space-y-3">
                <p className="text-sm font-bold text-pollon-black">Opciones al agregar al carrito</p>

                <div className="space-y-2 rounded-lg bg-white p-3 ring-1 ring-gray-100">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!prodModal.drinkEnabled}
                      onChange={(e) => setProdModal({
                        ...prodModal,
                        drinkEnabled: e.target.checked,
                        drinkRequired: e.target.checked ? prodModal.drinkRequired : false,
                      })}
                    />
                    <span className="text-sm font-medium">Selección de bebida</span>
                  </label>
                  {prodModal.drinkEnabled && (
                    <label className="ml-6 flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!prodModal.drinkRequired}
                        onChange={(e) => setProdModal({ ...prodModal, drinkRequired: e.target.checked })}
                      />
                      <span className="text-xs text-gray-600">Obligatoria (incluida en el precio del producto)</span>
                    </label>
                  )}
                </div>

                <div className="space-y-2 rounded-lg bg-white p-3 ring-1 ring-gray-100">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!prodModal.bagEnabled}
                      onChange={(e) => setProdModal({
                        ...prodModal,
                        bagEnabled: e.target.checked,
                        bagRequired: e.target.checked ? prodModal.bagRequired : false,
                      })}
                    />
                    <span className="text-sm font-medium">Opción de bolsa ecológica</span>
                  </label>
                  {prodModal.bagEnabled && (
                    <>
                      <label className="ml-6 flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!prodModal.bagRequired}
                          onChange={(e) => setProdModal({ ...prodModal, bagRequired: e.target.checked })}
                        />
                        <span className="text-xs text-gray-600">Obligatoria al agregar al carrito</span>
                      </label>
                      <div className="ml-6 space-y-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600">Precio por bolsa (CLP)</label>
                          <input
                            type="number"
                            min={0}
                            value={prodModal.bagPrice ?? BAG_PRICE}
                            onChange={(e) => setProdModal({ ...prodModal, bagPrice: Number(e.target.value) || 0 })}
                            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">Unidades por bolsa</label>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="shrink-0 text-xs text-gray-500">1 bolsa cada</span>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={prodModal.bagUnitsPerBag ?? 1}
                              onChange={(e) => setProdModal({
                                ...prodModal,
                                bagUnitsPerBag: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                              })}
                              className="w-20 rounded-lg border px-3 py-2 text-sm text-center"
                            />
                            <span className="text-xs text-gray-500">unidad(es)</span>
                          </div>
                          <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
                            Ej: 1 = una bolsa por unidad · 2 = una bolsa cada 2 unidades · 4 = una bolsa cada 4 unidades.
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={uploadingImages} className="flex-1 rounded-lg bg-pollon-red py-2 font-bold text-white disabled:opacity-50">Guardar</button>
              <button type="button" onClick={() => setProdModal(null)} className="flex-1 rounded-lg border py-2">Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
