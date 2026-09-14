import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownWideNarrow,
  Calendar,
  Download,
  FileSpreadsheet,
  Search,
} from 'lucide-react';

import { useOrders } from '../../hooks/useOrders';
import { useAdminBranchFilter } from '../../hooks/useAdminBranchFilter';
import { adminListProducts } from '../../services/menuService';
import { money } from '../../utils/format';
import {
  REPORT_PERIODS,
  getReportRange,
  filterOrdersForReport,
  buildCatalogSalesRows,
  sortCatalogSalesRows,
  exportCatalogSalesCsv,
  formatShortDate,
  toInputDate,
} from '../../utils/productReportAnalytics';
import { AdminBranchFilter } from '../../components/admin/AdminBranchFilter';
import '../../styles/admin-product-report.css';

const SORT_OPTIONS = [
  { id: 'sales_desc', label: 'Monto: mayor → menor' },
  { id: 'sales_asc', label: 'Monto: menor → mayor' },
  { id: 'qty_desc', label: 'Cantidad: mayor → menor' },
  { id: 'qty_asc', label: 'Cantidad: menor → mayor' },
  { id: 'name_asc', label: 'Nombre A → Z' },
  { id: 'name_desc', label: 'Nombre Z → A' },
  { id: 'category', label: 'Categoría' },
  { id: 'order', label: 'Orden del menú' },
  { id: 'price_desc', label: 'Precio: mayor → menor' },
  { id: 'price_asc', label: 'Precio: menor → mayor' },
];

async function loadCatalogForBranches(branchIds) {
  const ids = (branchIds || []).filter(Boolean);
  if (!ids.length) return [];
  const lists = await Promise.all(
    ids.map((id) => adminListProducts(id).catch(() => [])),
  );
  // Por ID basta aquí; buildCatalogSalesRows une por categoría+nombre (multi-sucursal).
  const byId = new Map();
  lists.flat().forEach((p) => {
    if (p?.id && !byId.has(p.id)) byId.set(p.id, p);
  });
  return [...byId.values()];
}

export function AdminReports() {
  const { orders } = useOrders();
  const {
    applyBranchFilter,
    showBranchFilter,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    branchId: staffBranchId,
    isSuperAdmin,
  } = useAdminBranchFilter();

  const [period, setPeriod] = useState('today');
  const [customFrom, setCustomFrom] = useState(() => toInputDate(new Date()));
  const [customTo, setCustomTo] = useState(() => toInputDate(new Date()));
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('sales_desc');
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  const catalogBranchIds = useMemo(() => {
    if (!isSuperAdmin) return staffBranchId ? [staffBranchId] : [];
    if (selectedBranchId) return [selectedBranchId];
    return (branches || []).map((b) => b.id).filter(Boolean);
  }, [isSuperAdmin, staffBranchId, selectedBranchId, branches]);

  const catalogBranchKey = catalogBranchIds.join('|');

  useEffect(() => {
    let cancelled = false;
    const ids = catalogBranchKey ? catalogBranchKey.split('|') : [];
    (async () => {
      setCatalogLoading(true);
      setCatalogError('');
      try {
        if (!ids.length) {
          if (!cancelled) setCatalog([]);
          return;
        }
        const products = await loadCatalogForBranches(ids);
        if (!cancelled) setCatalog(products);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setCatalog([]);
          setCatalogError('No se pudo cargar el menú de productos.');
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [catalogBranchKey]);

  const ordersScoped = useMemo(() => applyBranchFilter(orders), [orders, applyBranchFilter]);

  const range = useMemo(
    () => getReportRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  const filteredOrders = useMemo(
    () => filterOrdersForReport(ordersScoped, {
      start: range.start,
      end: range.end,
      hourFrom: 0,
      hourTo: 23,
    }),
    [ordersScoped, range],
  );

  const catalogRows = useMemo(
    () => buildCatalogSalesRows(catalog, filteredOrders),
    [catalog, filteredOrders],
  );

  const categories = useMemo(() => {
    const set = new Set(catalogRows.map((r) => r.category).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [catalogRows]);

  const displayRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = catalogRows.filter((r) => {
      if (categoryFilter && r.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q)
        || r.category.toLowerCase().includes(q)
      );
    });
    return sortCatalogSalesRows(filtered, sortBy);
  }, [catalogRows, search, categoryFilter, sortBy]);

  const totals = useMemo(() => ({
    qty: displayRows.reduce((s, r) => s + r.qty, 0),
    sales: displayRows.reduce((s, r) => s + r.sales, 0),
    sold: displayRows.filter((r) => r.qty > 0).length,
  }), [displayRows]);

  function handleExport() {
    exportCatalogSalesCsv(displayRows, `reporte-ventas-platos-${Date.now()}.csv`);
  }

  const fromLabel = formatShortDate(range.start);
  const toLabel = formatShortDate(range.end);

  return (
    <div className="admin-page admin-page--fill admin-product-report">
      <header className="apr-header">
        <div className="apr-header__titles">
          <span className="apr-header__icon" aria-hidden>
            <FileSpreadsheet className="h-4 w-4" />
          </span>
          <div>
            <h1 className="apr-header__title">Reporte de ventas</h1>
            <p className="apr-header__subtitle">
              Todos los platos del menú · {fromLabel} — {toLabel}
            </p>
          </div>
        </div>
        <div className="apr-header__actions">
          <button type="button" className="apr-btn apr-btn--ghost" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        </div>
      </header>

      <section className="apr-filters">
        <div className="apr-period-tabs" role="tablist">
          {REPORT_PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={period === p.id}
              className={`apr-period-tab ${period === p.id ? 'is-active' : ''}`}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="apr-filters__row">
          <label className="apr-field">
            <span>Desde</span>
            <div className="apr-field__control">
              <Calendar className="h-3.5 w-3.5 opacity-60" />
              <input
                type="date"
                value={period === 'custom' ? customFrom : toInputDate(range.start)}
                onChange={(e) => {
                  setPeriod('custom');
                  setCustomFrom(e.target.value);
                }}
              />
            </div>
          </label>
          <label className="apr-field">
            <span>Hasta</span>
            <div className="apr-field__control">
              <Calendar className="h-3.5 w-3.5 opacity-60" />
              <input
                type="date"
                value={period === 'custom' ? customTo : toInputDate(range.end)}
                onChange={(e) => {
                  setPeriod('custom');
                  setCustomTo(e.target.value);
                }}
              />
            </div>
          </label>

          <label className="apr-field">
            <span>Categoría</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="apr-field">
            <span>Ordenar</span>
            <div className="apr-field__control">
              <ArrowDownWideNarrow className="h-3.5 w-3.5 opacity-60" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                {SORT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
          </label>

          <label className="apr-search">
            <Search className="h-3.5 w-3.5 opacity-55" />
            <input
              type="search"
              placeholder="Buscar plato o categoría…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          {showBranchFilter && (
            <label className="apr-field apr-field--branch">
              <span>Sucursal</span>
              <AdminBranchFilter
                branches={branches}
                value={selectedBranchId}
                onChange={setSelectedBranchId}
              />
            </label>
          )}
        </div>

        <div className="apr-meta">
          <span>
            {catalogLoading
              ? 'Cargando menú…'
              : `${displayRows.length} platos · ${totals.sold} con ventas · ${totals.qty} uds`}
          </span>
          <span className="apr-meta__sales">Total: {money(totals.sales)}</span>
        </div>
      </section>

      <section className="apr-sheet" aria-label="Lista de platos">
        <div className="apr-sheet__scroll">
          <table className="apr-sheet-table">
            <thead>
              <tr>
                <th className="apr-col-order">Orden</th>
                <th className="apr-col-cat">Categoría</th>
                <th className="apr-col-name">Producto</th>
                <th className="apr-col-num">Precio unit.</th>
                <th className="apr-col-num">Cant. vendida</th>
                <th className="apr-col-num">Total monto</th>
              </tr>
            </thead>
            <tbody>
              {catalogError && (
                <tr>
                  <td colSpan={6} className="apr-sheet__empty">{catalogError}</td>
                </tr>
              )}
              {!catalogError && catalogLoading && (
                <tr>
                  <td colSpan={6} className="apr-sheet__empty">Cargando productos del menú…</td>
                </tr>
              )}
              {!catalogError && !catalogLoading && displayRows.map((r) => (
                <tr key={r.key} className={r.qty === 0 ? 'is-zero' : undefined}>
                  <td className="apr-col-order">{r.order}</td>
                  <td className="apr-col-cat" title={r.category}>{r.category}</td>
                  <td className="apr-col-name" title={r.name}>
                    {r.name}
                    {r.orphan ? <span className="apr-tag">Fuera de menú</span> : null}
                    {r.available === false ? <span className="apr-tag apr-tag--muted">No disponible</span> : null}
                  </td>
                  <td className="apr-col-num">{money(r.unitPrice)}</td>
                  <td className="apr-col-num">{r.qty}</td>
                  <td className="apr-col-num apr-col-money">{money(r.sales)}</td>
                </tr>
              ))}
              {!catalogError && !catalogLoading && !displayRows.length && (
                <tr>
                  <td colSpan={6} className="apr-sheet__empty">
                    No hay platos con estos filtros. Revisa categoría o búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>TOTAL ({displayRows.length} platos)</td>
                <td className="apr-col-num" />
                <td className="apr-col-num">{totals.qty}</td>
                <td className="apr-col-num apr-col-money">{money(totals.sales)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
