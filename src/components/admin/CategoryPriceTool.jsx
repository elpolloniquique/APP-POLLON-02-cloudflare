import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, CalendarClock, CheckSquare, Save, Square } from 'lucide-react';
import { adminListProducts } from '../../services/menuService';
import {
  adminApplyProductPriceDelta,
  adminCancelPriceJob,
  adminListPriceJobs,
  adminScheduleCategoryPrices,
  applyDueMenuPriceJobs,
  computeNextPrice,
  describePriceChange,
} from '../../services/menuPriceJobsService';
import { money } from '../../utils/format';
import { AdminScrollPanel } from './AdminScrollPanel';

const MODES = [
  { id: 'add', label: 'Aumentar $' },
  { id: 'subtract', label: 'Bajar $' },
  { id: 'percent', label: 'Porcentaje %' },
];

function chileDateParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value || '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

function scheduleToIso(date, time) {
  return new Date(`${date}T${time || '00:00'}:00`).toISOString();
}

function formatWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CategoryPriceTool({
  branchId,
  categories,
  user,
  canManage,
  onApplied,
  show,
}) {
  const today = chileDateParts();
  const [categoryId, setCategoryId] = useState('');
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('add');
  const [amount, setAmount] = useState('1000');
  const [when, setWhen] = useState('now');
  const [date, setDate] = useState(today.date);
  const [time, setTime] = useState('00:00');
  const [jobs, setJobs] = useState([]);

  const category = categories.find((c) => c.id === categoryId) || null;

  const loadJobs = useCallback(async () => {
    if (!branchId) return;
    try {
      await applyDueMenuPriceJobs();
      const list = await adminListPriceJobs(branchId);
      setJobs(list);
    } catch {
      setJobs([]);
    }
  }, [branchId]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (!categoryId && categories.length) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  useEffect(() => {
    if (!branchId || !categoryId) {
      setProducts([]);
      setSelected(new Set());
      return;
    }
    let cancelled = false;
    setLoading(true);
    adminListProducts(branchId, { categoryId })
      .then((list) => {
        if (cancelled) return;
        setProducts(list);
        setSelected(new Set());
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([]);
          setSelected(new Set());
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [branchId, categoryId]);

  const allSelected = products.length > 0 && selected.size === products.length;
  const someSelected = selected.size > 0 && selected.size < products.length;
  const amountNum = Math.round(Number(amount) || 0);
  const rows = useMemo(
    () => products.map((p) => ({
      ...p,
      next: computeNextPrice(p.price, mode, amountNum),
    })),
    [products, mode, amountNum],
  );
  const chosen = rows.filter((p) => selected.has(p.id));
  const deltaTotal = chosen.reduce((sum, p) => sum + (p.next - p.price), 0);

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(products.map((p) => p.id)));
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!canManage || !branchId || !chosen.length || !amountNum) return;
    const label = describePriceChange(mode, amountNum);
    const whenLabel = when === 'now'
      ? 'ahora'
      : `el ${formatWhen(scheduleToIso(date, time))}`;
    const ok = window.confirm(
      `¿Guardar ${label} en ${chosen.length} plato(s) de "${category?.name || 'esta categoría'}" ${whenLabel}?`,
    );
    if (!ok) return;
    setSaving(true);
    try {
      if (when === 'now') {
        await adminApplyProductPriceDelta({
          branchId,
          productIds: chosen.map((p) => p.id),
          mode,
          amount: amountNum,
          user,
          categoryName: category?.name || '',
        });
        onApplied?.();
        const list = await adminListProducts(branchId, { categoryId });
        setProducts(list);
        setSelected(new Set());
        show?.(`Precios guardados: ${chosen.length} plato(s) de ${category?.name}.`);
      } else {
        await adminScheduleCategoryPrices({
          branchId,
          categoryId,
          categoryName: category?.name || '',
          productIds: chosen.map((p) => p.id),
          mode,
          amount: amountNum,
          applyAt: scheduleToIso(date, time),
          user,
        });
        await loadJobs();
        setSelected(new Set());
        show?.(`Cambio programado para ${formatWhen(scheduleToIso(date, time))}.`);
      }
    } catch (err) {
      show?.(err.message || 'No se pudieron guardar los precios');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelJob = async (job) => {
    if (!window.confirm(`¿Cancelar el cambio programado de "${job.category_name}"?`)) return;
    try {
      await adminCancelPriceJob(job.id, user);
      await loadJobs();
      show?.('Cambio programado cancelado');
    } catch (err) {
      show?.(err.message);
    }
  };

  const pendingJobs = jobs.filter((j) => j.status === 'pending');
  const recentJobs = jobs.filter((j) => j.status !== 'pending').slice(0, 6);
  const saveDisabled = !canManage || saving || !chosen.length || !amountNum || !branchId;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white shadow-sm md:col-span-2">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-stone-900">
            <Banknote className="h-5 w-5 text-pollon-red" />
            Precios por categoría
          </h3>
          <p className="mt-1 max-w-xl text-sm text-stone-500">
            Elige una categoría, marca los platos (o todos) y sube o baja el precio de una vez.
            También puedes programar la fecha en que se aplica.
          </p>
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="min-w-[220px] rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold"
        >
          {!categories.length && <option value="">Sin categorías</option>}
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </header>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 border-b border-stone-100 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-stone-800">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={toggleAll}
                disabled={!products.length}
              />
              Seleccionar todo
            </label>
            <p className="text-xs text-stone-500">
              {selected.size} de {products.length} plato{products.length === 1 ? '' : 's'}
            </p>
          </div>
          <AdminScrollPanel maxRows={8} variant="card" className="mx-3 mb-3 rounded-xl border border-stone-100">
            {loading ? (
              <p className="p-6 text-center text-sm text-stone-500">Cargando platos…</p>
            ) : !products.length ? (
              <p className="p-6 text-center text-sm text-stone-500">Esta categoría no tiene platos.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {rows.map((p) => {
                  const on = selected.has(p.id);
                  const changed = on && p.next !== p.price;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => toggleOne(p.id)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm ${on ? 'bg-red-50/70' : 'hover:bg-stone-50'}`}
                      >
                        {on
                          ? <CheckSquare className="h-4 w-4 shrink-0 text-pollon-red" />
                          : <Square className="h-4 w-4 shrink-0 text-stone-400" />}
                        <span className="min-w-0 flex-1 truncate font-medium text-stone-900">{p.name}</span>
                        <span className="shrink-0 font-semibold text-stone-600">{money(p.price)}</span>
                        <span className={`w-24 shrink-0 text-right font-bold ${changed ? 'text-pollon-red' : 'text-stone-400'}`}>
                          → {money(on ? p.next : p.price)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </AdminScrollPanel>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">Tipo de cambio</p>
            <div className="mt-2 grid grid-cols-1 gap-1.5">
              {MODES.map((m) => (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${mode === m.id ? 'border-pollon-red bg-red-50 text-pollon-red' : 'border-stone-200 text-stone-700'}`}
                >
                  <input type="radio" name="price-mode" checked={mode === m.id} onChange={() => setMode(m.id)} />
                  {m.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="cat-price-amount" className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
              {mode === 'percent' ? 'Porcentaje' : 'Monto en pesos'}
            </label>
            <input
              id="cat-price-amount"
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-lg font-bold text-pollon-red"
              placeholder={mode === 'percent' ? '10' : '1000'}
            />
            <p className="mt-1 text-xs text-stone-500">
              Ejemplo: {mode === 'percent' ? '10 sube 10% a cada plato marcado' : '1000 suma $1.000 a cada plato marcado'}.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">Cuándo aplicar</p>
            <div className="mt-2 space-y-1.5">
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${when === 'now' ? 'border-pollon-red bg-red-50 text-pollon-red' : 'border-stone-200'}`}>
                <input type="radio" name="price-when" checked={when === 'now'} onChange={() => setWhen('now')} />
                Ahora
              </label>
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${when === 'later' ? 'border-pollon-red bg-red-50 text-pollon-red' : 'border-stone-200'}`}>
                <input type="radio" name="price-when" checked={when === 'later'} onChange={() => setWhen('later')} />
                Programar fecha
              </label>
            </div>
            {when === 'later' && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input type="date" value={date} min={today.date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border px-2 py-2 text-sm" />
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-lg border px-2 py-2 text-sm" />
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-stone-200 bg-stone-50 px-5 py-3">
        <p className="text-sm text-stone-600">
          {chosen.length
            ? (
              <>
                <strong>{chosen.length}</strong> plato(s) · {describePriceChange(mode, amountNum)}
                {deltaTotal ? <> · total {deltaTotal > 0 ? '+' : ''}{money(deltaTotal)}</> : null}
              </>
            )
            : 'Marca los platos o pulsa Seleccionar todo'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={!selected.size || saving}
            className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-bold text-stone-700 disabled:opacity-40"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveDisabled}
            className="inline-flex items-center gap-2 rounded-xl bg-pollon-red px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Guardando…' : (when === 'now' ? 'Guardar precios' : 'Guardar y programar')}
          </button>
        </div>
      </footer>

      {(pendingJobs.length > 0 || recentJobs.length > 0) && (
        <div className="border-t border-stone-100 px-5 py-4">
          <h4 className="flex items-center gap-2 text-sm font-bold text-stone-800">
            <CalendarClock className="h-4 w-4 text-pollon-red" />
            Cambios programados
          </h4>
          {pendingJobs.length === 0 && (
            <p className="mt-2 text-xs text-stone-500">No hay cambios pendientes.</p>
          )}
          <ul className="mt-2 space-y-2">
            {pendingJobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                <span>
                  <strong>{job.category_name || 'Categoría'}</strong>
                  {' · '}{describePriceChange(job.mode, job.amount)}
                  {' · '}{(job.product_ids || []).length} plato(s)
                  {' · '}{formatWhen(job.apply_at)}
                </span>
                {canManage && (
                  <button type="button" onClick={() => handleCancelJob(job)} className="text-xs font-bold text-pollon-red">
                    Cancelar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
