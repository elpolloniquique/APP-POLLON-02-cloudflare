import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminScrollPanel } from '../../components/admin/AdminScrollPanel';
import { useStaffBranch } from '../../hooks/useStaffBranch';

function stockKey(branchId) {
  return branchId ? `pollon_stock_v1_${branchId}` : 'pollon_stock_v1';
}

function loadStock(branchId) {
  try { return JSON.parse(localStorage.getItem(stockKey(branchId)) || '[]'); } catch { return []; }
}

export function AdminInventory() {
  const { branchId, branchName, isBranchScoped } = useStaffBranch();
  const [items, setItems] = useState(() => loadStock(branchId));
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState(0);
  const [minimo, setMinimo] = useState(5);

  useEffect(() => {
    setItems(loadStock(branchId));
  }, [branchId]);

  const save = (list) => {
    localStorage.setItem(stockKey(branchId), JSON.stringify(list));
    setItems(list);
  };

  const agregar = () => {
    if (!nombre.trim()) return;
    save([...items, { id: Date.now(), nombre, cantidad, minimo, updated: new Date().toISOString() }]);
    setNombre('');
    setCantidad(0);
  };

  const movimiento = (id, delta) => {
    save(items.map((i) => (i.id === id ? { ...i, cantidad: Math.max(0, i.cantidad + delta) } : i)));
  };

  const bajo = items.filter((i) => i.cantidad <= i.minimo);

  return (
    <div className="admin-page admin-page--fill">
      <AdminPageHeader
        title="Control de stock"
        subtitle="Inventario de insumos por sucursal"
        branchLabel={isBranchScoped ? branchName : undefined}
      />

      {isBranchScoped && !branchId && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Tu usuario no tiene sucursal asignada. Contacta al super admin.
        </p>
      )}

      {bajo.length > 0 && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800 sm:p-4">
          <strong>⚠️ Alerta bajo stock:</strong> {bajo.map((i) => i.nombre).join(', ')}
        </div>
      )}

      <div className="admin-toolbar">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Insumo" className="min-w-[140px] flex-1" />
        <input type="number" value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} placeholder="Cantidad" className="w-24" />
        <input type="number" value={minimo} onChange={(e) => setMinimo(Number(e.target.value))} placeholder="Mín." className="w-20" />
        <Button onClick={agregar}>Agregar insumo</Button>
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
                  <Button variant="ghost" className="!px-2" onClick={() => movimiento(i.id, -1)}>−</Button>
                  <Button variant="ghost" className="!px-2" onClick={() => movimiento(i.id, 1)}>+</Button>
                </div>
              </div>
            ))}
            {!items.length && <p className="py-8 text-center text-sm text-gray-500">Sin insumos registrados</p>}
          </div>
        </AdminScrollPanel>
      </div>

      <p className="text-xs text-gray-500">Stock guardado por sucursal en este navegador.</p>
    </div>
  );
}

