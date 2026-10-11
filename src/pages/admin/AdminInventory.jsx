import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminScrollPanel } from '../../components/admin/AdminScrollPanel';
import { useAdminBranchFilter } from '../../hooks/useAdminBranchFilter';
import { addStockItem, adjustStockItem, loadStockItems } from '../../services/cajaStockService';

export function AdminInventory() {
  const {
    branchId,
    branchName,
    isBranchScoped,
    selectedBranchId,
    setSelectedBranchId,
    showBranchFilter,
    branches,
    headerBranchLabel,
  } = useAdminBranchFilter();
  const stockBranch = branchId || selectedBranchId || '';
  const [items, setItems] = useState([]);
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState(0);
  const [minimo, setMinimo] = useState(5);
  const [source, setSource] = useState('local');

  useEffect(() => {
    let cancelled = false;
    loadStockItems(stockBranch).then((list) => {
      if (cancelled) return;
      setItems(list);
      setSource(list.some((i) => i.source === 'cloud') ? 'cloud' : 'local');
    });
    return () => { cancelled = true; };
  }, [stockBranch]);

  const agregar = async () => {
    if (!nombre.trim() || !stockBranch) return;
    const item = await addStockItem(stockBranch, { nombre: nombre.trim(), cantidad, minimo });
    setItems((prev) => [...prev, item]);
    if (item.source === 'cloud') setSource('cloud');
    setNombre('');
    setCantidad(0);
  };

  const movimiento = async (item, delta) => {
    const next = await adjustStockItem(stockBranch, item, delta);
    setItems((prev) => prev.map((row) => (row.id === item.id ? next : row)));
  };

  const bajo = items.filter((i) => i.cantidad <= i.minimo);

  return (
    <div className="admin-page admin-page--fill">
      <AdminPageHeader
        title="Control de stock"
        subtitle="Inventario de insumos por sucursal"
        branchLabel={headerBranchLabel || (isBranchScoped ? branchName : undefined)}
        actions={showBranchFilter ? (
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm"
          >
            <option value="">Elige sucursal</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        ) : null}
      />

      {isBranchScoped && !branchId && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Tu usuario no tiene sucursal asignada. Contacta al super admin.
        </p>
      )}

      {bajo.length > 0 && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800 sm:p-4">
          <strong>Alerta bajo stock:</strong> {bajo.map((i) => i.nombre).join(', ')}
        </div>
      )}

      <div className="admin-toolbar">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Insumo" className="min-w-[140px] flex-1" />
        <input type="number" value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} placeholder="Cantidad" className="w-24" />
        <input type="number" value={minimo} onChange={(e) => setMinimo(Number(e.target.value))} placeholder="Mín." className="w-20" />
        <Button onClick={agregar} disabled={!stockBranch}>Agregar insumo</Button>
      </div>

      <div className="admin-list-shell">
        <div className="admin-table__meta">
          <p>{items.length} insumo{items.length !== 1 ? 's' : ''}</p>
          {items.length > 8 && <p>Desplaza para ver más ↓</p>}
        </div>
        <AdminScrollPanel maxRows={12} variant="card" className="admin-scroll-fill rounded-none border-0 shadow-none">
          <div className="space-y-2 p-2 sm:p-3">
            {items.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/50 p-3 sm:p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{i.nombre}</p>
                  <p className="text-xs text-gray-500 sm:text-sm">
                    Mín: {i.minimo} · Actual:{' '}
                    <strong className={i.cantidad <= i.minimo ? 'text-red-600' : ''}>{i.cantidad}</strong>
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" className="!px-2" onClick={() => movimiento(i, -1)}>−</Button>
                  <Button variant="ghost" className="!px-2" onClick={() => movimiento(i, 1)}>+</Button>
                </div>
              </div>
            ))}
            {!items.length && <p className="py-8 text-center text-sm text-gray-500">Sin insumos registrados</p>}
          </div>
        </AdminScrollPanel>
      </div>

      <p className="text-xs text-gray-500">
        {source === 'cloud'
          ? 'Stock compartido entre cajeras de esta sucursal.'
          : 'Stock en este computador hasta ejecutar fix-web-ops-hardening.sql en Supabase.'}
      </p>
    </div>
  );
}
