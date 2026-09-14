import { money } from './format';

export const REPORT_PERIODS = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'year', label: 'Año' },
  { id: 'custom', label: 'Personalizado' },
];

export const CHICKEN_LEGEND = [
  { label: 'Platos personales', eq: '1/4 pollo', value: 0.25 },
  { label: 'Platos para dos', eq: '1/2 pollo', value: 0.5 },
  { label: 'Ofertas familiares', eq: '1 pollo', value: 1 },
  { label: 'Pollo entero solo', eq: '1 pollo', value: 1 },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: h,
  label: `${String(h).padStart(2, '0')}:00`,
}));

export { HOUR_OPTIONS };

function parseDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function shiftDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Rango según período (o custom). */
export function getReportRange(periodId, customFrom, customTo) {
  const now = new Date();
  let start = startOfDay(now);
  let end = endOfDay(now);

  if (periodId === 'today') {
    /* default */
  } else if (periodId === 'week') {
    start = startOfDay(shiftDays(now, -6));
  } else if (periodId === 'month') {
    start = startOfDay(shiftDays(now, -29));
  } else if (periodId === 'quarter') {
    start = startOfDay(shiftDays(now, -89));
  } else if (periodId === 'year') {
    start = startOfDay(shiftDays(now, -364));
  } else if (periodId === 'custom') {
    if (customFrom) start = startOfDay(new Date(`${customFrom}T00:00:00`));
    if (customTo) end = endOfDay(new Date(`${customTo}T00:00:00`));
  }

  const ms = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - ms);

  return { start, end, prevStart, prevEnd };
}

export function filterOrdersForReport(orders, { start, end, hourFrom = 0, hourTo = 23 }) {
  return (orders || []).filter((o) => {
    if (o.estado === 'cancelado') return false;
    const d = parseDate(o.createdAt);
    if (!d) return false;
    if (d < start || d > end) return false;
    const h = d.getHours();
    const from = Number(hourFrom) || 0;
    const to = Number(hourTo);
    const toH = Number.isFinite(to) ? to : 23;
    if (from <= toH) return h >= from && h <= toH;
    return h >= from || h <= toH;
  });
}

/**
 * Equivalente en pollos por ítem (heurística por nombre/categoría).
 * Personales=1/4, Dos=1/2, Familiares=1, agregados de pollo según fracción.
 */
export function chickenEquivalent(item) {
  const name = String(item?.name || '').toLowerCase();
  const cat = String(item?.category || item?.categoryName || item?.categoria || '').toLowerCase();
  const blob = `${cat} ${name}`;

  if (/bebida|coca|inca|fanta|sprite|agua|descartable|aluza|tenedor|bolsa|vaso/.test(blob)) return 0;
  if (/papa|ensalada/.test(blob) && !/pollo|1\/4|1\/2|combo|oferton|ofertón/.test(name)) return 0;
  if (/bistec|chuleta|lomo|tallarin|nugget|salchipapa|pechuga/.test(name) && !/1\/4|1\/2|combo/.test(name)) {
    if (/saltado de pollo|pollo/.test(name)) return 0.25;
    return 0;
  }

  if (/2\s*pollos|dos\s*pollos/.test(name)) return 2;
  if (/1\s*\/\s*4|cuarto|1\/4/.test(name)) return 0.25;
  if (/1\s*\/\s*2|medio\s*pollo|1\/2/.test(name)) return 0.5;
  if (/pollo\s*entero|1\s*pollo|oferton|ofertón/.test(name)) return 1;

  if (/personal|ofertas-personales|platos personales/.test(blob)) return 0.25;
  if (/para\s*dos|ofertas-dos|ofertas para dos/.test(blob)) return 0.5;
  if (/familiar|ofertas-familiares|ofertas familiares/.test(blob)) return 1;

  if (/agregado/.test(cat) && /pollo/.test(name)) {
    if (/1\/4|cuarto/.test(name)) return 0.25;
    if (/1\/2|medio/.test(name)) return 0.5;
    return 1;
  }

  if (/pollo|brasa|combo|chaufa brasa/.test(name)) {
    if (/familiar|entero/.test(name)) return 1;
    if (/medio|1\/2|dos/.test(name)) return 0.5;
    return 0.25;
  }

  return 0;
}

function itemLineTotal(it) {
  const qty = Number(it.qty) || 1;
  return Number(it.total ?? it.subtotal ?? (Number(it.price) || 0) * qty) || 0;
}

function itemCategory(it) {
  return (it.category || it.categoryName || it.categoria || guessCategoryFromName(it.name) || 'Sin categoría').trim();
}

function guessCategoryFromName(name) {
  const n = String(name || '').toLowerCase();
  if (/oferton|ofertón|familiar/.test(n)) return 'Ofertas Familiares';
  if (/1\/2|medio combo|para dos/.test(n)) return 'Ofertas para Dos';
  if (/1\/4|chaufa brasa|personal/.test(n)) return 'Ofertas Personales';
  if (/coca|inca|fanta|sprite|agua/.test(n)) return 'Bebidas';
  if (/papa|ensalada|pollo solo/.test(n)) return 'Agregados';
  if (/saltado|bistec|chuleta|tallarin|nugget|salchipapa|pechuga/.test(n)) return 'Platos Extras';
  return 'Otros';
}

/** Agrupa ventas por producto en el período. */
export function buildProductRows(orders) {
  const map = new Map();

  (orders || []).forEach((o) => {
    (o.items || []).forEach((it) => {
      const name = (it.name || 'Producto').trim();
      if (!name) return;
      const productId = it.id || it.producto_id || it.productId || null;
      const key = productId || name.toLowerCase();
      const qty = Number(it.qty) || 1;
      const sales = itemLineTotal(it);
      const chicken = chickenEquivalent(it) * qty;
      const category = itemCategory(it);
      const prev = map.get(key) || {
        key,
        productId,
        name,
        category,
        qty: 0,
        sales: 0,
        chicken: 0,
        unitSum: 0,
        unitCount: 0,
      };
      prev.qty += qty;
      prev.sales += sales;
      prev.chicken += chicken;
      const unit = qty ? sales / qty : 0;
      if (unit > 0) {
        prev.unitSum += unit * qty;
        prev.unitCount += qty;
      }
      if (!prev.category || prev.category === 'Sin categoría') prev.category = category;
      map.set(key, prev);
    });
  });

  const rows = [...map.values()].map((r) => ({
    ...r,
    avgPrice: r.unitCount ? r.unitSum / r.unitCount : 0,
  }));

  const totalSales = rows.reduce((s, r) => s + r.sales, 0) || 1;
  rows.forEach((r) => {
    r.participation = Math.round((r.sales / totalSales) * 1000) / 10;
  });

  return rows.sort((a, b) => b.sales - a.sales);
}

/** Clave única visual: misma categoría + mismo nombre = un solo plato. */
function catalogItemKey(category, name) {
  return `${String(category || '').trim().toLowerCase()}::${String(name || '').trim().toLowerCase()}`;
}

/**
 * Une productos repetidos (p. ej. misma bebida en varias sucursales).
 * Conserva todos los IDs para sumar ventas bien.
 */
export function dedupeCatalogProducts(catalog = []) {
  const map = new Map();
  (catalog || []).forEach((p, idx) => {
    const name = String(p.name || '').trim() || 'Producto';
    const category = String(p.categoryName || p.category || 'Sin categoría').trim() || 'Sin categoría';
    const key = catalogItemKey(category, name);
    const id = p.id ? String(p.id) : '';
    const order = Number(p.displayOrder ?? p.display_order ?? idx + 1) || idx + 1;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        ...p,
        name,
        categoryName: category,
        displayOrder: order,
        ids: id ? [id] : [],
        _idx: idx,
      });
      return;
    }
    if (id && !prev.ids.includes(id)) prev.ids.push(id);
    if (order < (Number(prev.displayOrder) || 9999)) prev.displayOrder = order;
    if (prev.available === false && p.available !== false) prev.available = true;
    if (!(Number(prev.price) > 0) && Number(p.price) > 0) prev.price = p.price;
    if (!prev.categoryName && category) prev.categoryName = category;
  });
  return [...map.values()];
}

function sumSoldMatches(soldRows, ids, nameKey) {
  const idSet = new Set((ids || []).map(String).filter(Boolean));
  let qty = 0;
  let sales = 0;
  let unitSum = 0;
  let unitCount = 0;
  const keys = new Set();
  (soldRows || []).forEach((r) => {
    const byId = r.productId && idSet.has(String(r.productId));
    const byName = String(r.name || '').trim().toLowerCase() === nameKey;
    if (!byId && !byName) return;
    if (keys.has(r.key)) return;
    keys.add(r.key);
    qty += r.qty;
    sales += r.sales;
    if (r.avgPrice > 0 && r.qty > 0) {
      unitSum += r.avgPrice * r.qty;
      unitCount += r.qty;
    }
  });
  return {
    qty,
    sales,
    avgPrice: unitCount ? unitSum / unitCount : 0,
    keys,
  };
}

/**
 * Lista tipo Excel: TODOS los platos del catálogo + ventas del período.
 * Si no se vendió → cantidad 0 y total 0.
 * Sin duplicados por nombre+categoría (multi-sucursal).
 */
export function buildCatalogSalesRows(catalog = [], orders = []) {
  const uniqueCatalog = dedupeCatalogProducts(catalog);
  const sold = buildProductRows(orders);
  const usedSoldKeys = new Set();

  const rows = uniqueCatalog.map((p, idx) => {
    const name = String(p.name || '').trim() || 'Producto';
    const nameKey = name.toLowerCase();
    const category = String(p.categoryName || p.category || 'Sin categoría').trim() || 'Sin categoría';
    const ids = p.ids || (p.id ? [String(p.id)] : []);
    const hit = sumSoldMatches(sold, ids, nameKey);
    hit.keys.forEach((k) => usedSoldKeys.add(k));
    const unitPrice = Number(p.price) || Number(hit.avgPrice) || 0;
    return {
      key: catalogItemKey(category, name) || `cat-${idx}-${nameKey}`,
      productId: ids[0] || null,
      order: Number(p.displayOrder ?? p.display_order ?? idx + 1) || idx + 1,
      category,
      name,
      unitPrice,
      qty: hit.qty,
      sales: hit.sales,
      available: p.available !== false,
    };
  });

  // Ítems vendidos fuera del menú (también sin duplicar por nombre+categoría)
  const orphanByKey = new Map();
  sold.forEach((r) => {
    if (usedSoldKeys.has(r.key)) return;
    const category = r.category || 'Sin categoría';
    const name = r.name || 'Producto';
    const key = catalogItemKey(category, name);
    const prev = orphanByKey.get(key);
    if (!prev) {
      orphanByKey.set(key, {
        key: `sold-${key}`,
        productId: r.productId,
        order: 9999,
        category,
        name,
        unitPrice: r.avgPrice || 0,
        qty: r.qty,
        sales: r.sales,
        available: true,
        orphan: true,
      });
      return;
    }
    prev.qty += r.qty;
    prev.sales += r.sales;
  });
  orphanByKey.forEach((row) => rows.push(row));

  return rows;
}

export function sortCatalogSalesRows(rows, sortBy = 'sales_desc') {
  const list = [...(rows || [])];
  const cmp = {
    sales_desc: (a, b) => b.sales - a.sales || a.order - b.order,
    sales_asc: (a, b) => a.sales - b.sales || a.order - b.order,
    qty_desc: (a, b) => b.qty - a.qty || a.order - b.order,
    qty_asc: (a, b) => a.qty - b.qty || a.order - b.order,
    name_asc: (a, b) => a.name.localeCompare(b.name, 'es'),
    name_desc: (a, b) => b.name.localeCompare(a.name, 'es'),
    price_desc: (a, b) => b.unitPrice - a.unitPrice,
    price_asc: (a, b) => a.unitPrice - b.unitPrice,
    category: (a, b) => a.category.localeCompare(b.category, 'es') || a.order - b.order,
    order: (a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'),
  }[sortBy] || ((a, b) => b.sales - a.sales);
  return list.sort(cmp);
}

export function exportCatalogSalesCsv(rows, filename = 'reporte-ventas-platos.csv') {
  const header = ['Orden', 'Categoría', 'Producto', 'Precio unitario', 'Cantidad vendida', 'Total monto'];
  const lines = [header.join(';')];
  (rows || []).forEach((r) => {
    lines.push([
      r.order,
      `"${String(r.category).replace(/"/g, '""')}"`,
      `"${String(r.name).replace(/"/g, '""')}"`,
      Math.round(r.unitPrice),
      r.qty,
      Math.round(r.sales),
    ].join(';'));
  });
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** KPIs del reporte de productos. */
export function buildProductReportKpis(orders, productRows) {
  const sales = productRows.reduce((s, r) => s + r.sales, 0);
  const units = productRows.reduce((s, r) => s + r.qty, 0);
  const chickens = productRows.reduce((s, r) => s + r.chicken, 0);
  const orderCount = (orders || []).length;
  const unique = productRows.length;
  return {
    sales,
    units,
    chickens: Math.round(chickens * 100) / 100,
    ticket: orderCount ? sales / orderCount : 0,
    orders: orderCount,
    unique,
  };
}

/** Desglose de pollos por tipo de plato. */
export function buildChickenBreakdown(productRows) {
  const buckets = {
    personal: { label: 'Personales (1/4)', value: 0, color: '#f59e0b' },
    duo: { label: 'Para dos (1/2)', value: 0, color: '#f97316' },
    family: { label: 'Familiares (1)', value: 0, color: '#c41e1e' },
  };

  productRows.forEach((r) => {
    const perUnit = r.qty ? r.chicken / r.qty : 0;
    if (perUnit >= 0.9) buckets.family.value += r.chicken;
    else if (perUnit >= 0.4) buckets.duo.value += r.chicken;
    else if (perUnit > 0) buckets.personal.value += r.chicken;
  });

  const list = Object.values(buckets).filter((b) => b.value > 0);
  const total = list.reduce((s, b) => s + b.value, 0) || 1;
  return {
    total: Math.round(productRows.reduce((s, r) => s + r.chicken, 0) * 100) / 100,
    list,
    chart: {
      labels: list.map((b) => b.label),
      datasets: [{
        data: list.map((b) => Math.round(b.value * 100) / 100),
        backgroundColor: list.map((b) => b.color),
        borderWidth: 0,
      }],
      percents: list.map((b) => Math.round((b.value / total) * 1000) / 10),
    },
  };
}

/** Serie temporal de ventas por categoría (top 3). */
export function buildCategoryTimeline(orders, periodId) {
  const buckets = [];
  const now = new Date();

  if (periodId === 'today' || periodId === 'custom') {
    for (let h = 0; h < 24; h += 4) {
      buckets.push({
        key: String(h),
        label: `${String(h).padStart(2, '0')}-${String(Math.min(h + 4, 24)).padStart(2, '0')}`,
        items: [],
      });
    }
    orders.forEach((o) => {
      const d = parseDate(o.createdAt);
      if (!d) return;
      const idx = Math.min(Math.floor(d.getHours() / 4), buckets.length - 1);
      buckets[idx].items.push(...(o.items || []));
    });
  } else {
    const days = periodId === 'week' ? 7 : periodId === 'month' ? 8 : periodId === 'year' ? 12 : 10;
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(now);
      if (periodId === 'year') {
        d.setMonth(d.getMonth() - i);
        buckets.push({
          key: `${d.getFullYear()}-${d.getMonth()}`,
          label: d.toLocaleDateString('es-CL', { month: 'short' }),
          items: [],
          match: (od) => od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth(),
        });
      } else {
        const step = periodId === 'month' ? 4 : 1;
        d.setDate(d.getDate() - i * step);
        const key = d.toISOString().slice(0, 10);
        buckets.push({
          key,
          label: d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' }),
          items: [],
          match: (od) => {
            if (periodId === 'month') {
              const end = new Date(d);
              end.setDate(end.getDate() + step - 1);
              return od >= startOfDay(d) && od <= endOfDay(end);
            }
            return od.toISOString().slice(0, 10) === key;
          },
        });
      }
    }
    orders.forEach((o) => {
      const d = parseDate(o.createdAt);
      if (!d) return;
      const b = buckets.find((x) => x.match(d));
      if (b) b.items.push(...(o.items || []));
    });
  }

  const catTotals = {};
  buckets.forEach((b) => {
    b.items.forEach((it) => {
      const c = itemCategory(it);
      catTotals[c] = (catTotals[c] || 0) + itemLineTotal(it);
    });
  });
  const topCats = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c);

  const colors = ['#c41e1e', '#f97316', '#f59e0b', '#3b82f6'];

  return {
    labels: buckets.map((b) => b.label),
    categories: topCats,
    datasets: topCats.map((cat, i) => ({
      label: cat,
      data: buckets.map((b) =>
        b.items
          .filter((it) => itemCategory(it) === cat)
          .reduce((s, it) => s + itemLineTotal(it), 0),
      ),
      borderColor: colors[i],
      backgroundColor: `${colors[i]}22`,
      fill: false,
      tension: 0.35,
      pointRadius: 2,
      borderWidth: 2,
    })),
  };
}

/** Ventas por franja horaria (bloques de 4h). */
export function buildTimeSlotChart(orders, mode = 'amount') {
  const slots = [
    { label: '00-04', from: 0, to: 3 },
    { label: '04-08', from: 4, to: 7 },
    { label: '08-12', from: 8, to: 11 },
    { label: '12-16', from: 12, to: 15 },
    { label: '16-20', from: 16, to: 19 },
    { label: '20-24', from: 20, to: 23 },
  ];
  const data = slots.map((s) => {
    let amount = 0;
    let count = 0;
    orders.forEach((o) => {
      const d = parseDate(o.createdAt);
      if (!d) return;
      const h = d.getHours();
      if (h < s.from || h > s.to) return;
      count += 1;
      (o.items || []).forEach((it) => { amount += itemLineTotal(it); });
    });
    return mode === 'orders' ? count : amount;
  });

  return {
    labels: slots.map((s) => s.label),
    datasets: [{
      label: mode === 'orders' ? 'Pedidos' : 'Monto',
      data,
      backgroundColor: '#c41e1e',
      borderRadius: 3,
      maxBarThickness: 22,
    }],
  };
}

export function compareAvgPrice(currentRows, previousRows) {
  const prevMap = new Map(previousRows.map((r) => [r.key, r.avgPrice]));
  return currentRows.map((r) => {
    const prev = prevMap.get(r.key);
    let trend = 0;
    if (prev && prev > 0) {
      trend = Math.round(((r.avgPrice - prev) / prev) * 100);
    }
    return { ...r, priceTrend: trend };
  });
}

export function formatReportStamp(d = new Date()) {
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(d) {
  if (!d) return '';
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/\./g, '');
}

export function toInputDate(d) {
  if (!d) return '';
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function exportProductRowsCsv(rows, filename = 'reporte-productos.csv') {
  const header = ['#', 'Producto', 'Categoría', 'Cantidad', 'Monto total', 'Cant. pollo', '% Participación', 'Precio prom.'];
  const lines = [header.join(';')];
  rows.forEach((r, i) => {
    lines.push([
      i + 1,
      `"${String(r.name).replace(/"/g, '""')}"`,
      `"${String(r.category).replace(/"/g, '""')}"`,
      r.qty,
      Math.round(r.sales),
      r.chicken,
      `${r.participation}%`,
      Math.round(r.avgPrice),
    ].join(';'));
  });
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function printProductReportSummary({ title, kpis, generatedAt }) {
  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#111}
      h1{margin:0 0 4px;font-size:22px}
      p{margin:0 0 16px;color:#666;font-size:13px}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
      .card{border:1px solid #e5e7eb;border-radius:10px;padding:12px}
      .card span{display:block;font-size:11px;color:#6b7280;text-transform:uppercase}
      .card strong{font-size:18px}
    </style></head><body>
    <h1>${title}</h1>
    <p>Generado: ${generatedAt}</p>
    <div class="grid">
      <div class="card"><span>Ventas totales</span><strong>${money(kpis.sales)}</strong></div>
      <div class="card"><span>Productos vendidos</span><strong>${kpis.units}</strong></div>
      <div class="card"><span>Pollos equivalentes</span><strong>${kpis.chickens}</strong></div>
      <div class="card"><span>Ticket promedio</span><strong>${money(kpis.ticket)}</strong></div>
      <div class="card"><span>Órdenes</span><strong>${kpis.orders}</strong></div>
      <div class="card"><span>Productos únicos</span><strong>${kpis.unique}</strong></div>
    </div>
    <script>window.onload=()=>window.print()</script>
    </body></html>`);
  w.document.close();
}
