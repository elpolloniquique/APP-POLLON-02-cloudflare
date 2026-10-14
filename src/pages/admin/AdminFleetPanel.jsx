import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, RefreshCw } from 'lucide-react';
import { Loader } from '../../components/ui/Loader';
import { Button } from '../../components/ui/Button';
import { WhatsAppIcon } from '../../components/ui/WhatsAppIcon';
import { openWhatsappToCustomer } from '../../utils/format';
import {
  loadFleetHome,
  createFleetMoto,
  assignFleetJob,
} from '../../services/fleetService';
import { subscribeDispatch } from '../../services/dispatchService';
import { getSupabase } from '../../services/supabaseClient';
import {
  updateDriverAdminStatus,
  updateDriverMaxOrders,
  updateDriverCommission,
  normalizeCommissionPercent,
} from '../../services/driverService';
import '../../styles/admin-fleet.css';

const MAX_ORDER_OPTIONS = [2, 3, 4];
const EMPTY_MOTO = { fullName: '', email: '', password: '', phone: '', plate: '' };

function driverPhone(d) {
  return d?.profiles?.phone || d?.phone || d?.profiles?.telefono || '';
}

function driverFirstName(d) {
  const full = String(d?.profiles?.full_name || d?.profiles?.email || 'repartidor').trim();
  return full.split(/\s+/)[0] || 'repartidor';
}

function ticketLabel(job) {
  const raw = String(job?.ticket_code || job?.codigo_pedido || '').replace(/^#/, '').trim();
  if (!raw) return 'el pedido';
  const padded = /^\d+$/.test(raw) ? raw.padStart(6, '0') : raw;
  return `#${padded}`;
}

function fleetAssignWhatsappMessage(driver, job) {
  return `Hola ${driverFirstName(driver)}, por favor acepte el pedido ${ticketLabel(job)} desde su app Pollón.`;
}

const STATUS_LABELS = {
  pending: { label: 'Pendiente', cls: 'fleet-chip--amber' },
  approved: { label: 'Aprobado', cls: 'fleet-chip--green' },
  rejected: { label: 'Rechazado', cls: 'fleet-chip--red' },
  suspended: { label: 'Suspendido', cls: 'fleet-chip--orange' },
  blocked: { label: 'Bloqueado', cls: 'fleet-chip--red' },
};

function normalizeMaxOrders(value) {
  const n = Number(value);
  return MAX_ORDER_OPTIONS.includes(n) ? n : 2;
}

function motoAssignStatus(d) {
  const max = Math.max(1, Number(d?.live_max ?? d?.max_orders) || 2);
  const active = Number(d?.live_active) || 0;
  const delivering = Boolean(d?.live_delivering)
    || String(d?.operational_status || '').toLowerCase() === 'delivering';
  return { max, active, delivering, available: !delivering && active < max };
}

function motoAvailHint(st) {
  if (st.available) {
    return st.active > 0
      ? `${st.active} de ${st.max} · aún no recoge`
      : 'Sin pedido en curso';
  }
  if (st.delivering) return 'Va hacia el cliente';
  return `Cupo lleno ${st.active}/${st.max}`;
}

export function AdminFleetPanel() {
  const navigate = useNavigate();
  const [view, setView] = useState('home');
  const [drivers, setDrivers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [fleet, setFleet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [motoForm, setMotoForm] = useState(EMPTY_MOTO);
  const [jobToAssign, setJobToAssign] = useState(null);
  const [assignedDriverId, setAssignedDriverId] = useState(null);
  const [editDriver, setEditDriver] = useState(null);
  const [editDraft, setEditDraft] = useState({ max_orders: 2, commission_percent: '5' });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await loadFleetHome();
      setFleet(data.fleet || null);
      setDrivers(data.drivers || []);
      setJobs(data.jobs || []);
    } catch (err) {
      setError(err.message || 'No se pudo cargar tu flota.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    let debounce = null;
    const refreshSilent = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => { load(true); }, 250);
    };
    const unsub = subscribeDispatch(refreshSilent);
    const sb = getSupabase();
    let pedidosCh = null;
    if (sb) {
      pedidosCh = sb
        .channel('fleet-boss-pedidos')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, refreshSilent)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos' }, refreshSilent)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ep_driver_profiles' }, refreshSilent)
        .subscribe();
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') load(true);
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    const poll = setInterval(() => load(true), 8000);
    return () => {
      clearTimeout(debounce);
      clearInterval(poll);
      unsub();
      if (sb && pedidosCh) sb.removeChannel(pedidosCh);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [load]);

  const goHome = () => {
    setView('home');
    setJobToAssign(null);
    setAssignedDriverId(null);
    setEditDriver(null);
    setError('');
  };

  const motosOnline = useMemo(
    () => drivers.filter((d) => d.admin_status === 'approved'),
    [drivers],
  );

  const openAssign = (job) => {
    setJobToAssign(job);
    setAssignedDriverId(null);
    setView('assign');
    setError('');
    setFlash('');
  };

  const openEdit = (d) => {
    setEditDriver(d);
    setEditDraft({
      max_orders: normalizeMaxOrders(d.max_orders),
      commission_percent: String(normalizeCommissionPercent(d.commission_percent, 5)),
    });
    setView('edit');
    setError('');
    setFlash('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await createFleetMoto(motoForm);
      setFlash(`Moto creada: ${motoForm.email}. Entra a la app nativa con ese correo.`);
      setMotoForm(EMPTY_MOTO);
      await load(true);
      setView('home');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleAssign = async (driverId) => {
    if (!jobToAssign) return;
    setBusyId(driverId);
    setError('');
    try {
      await assignFleetJob(jobToAssign.id, driverId);
      setAssignedDriverId(driverId);
      setFlash('Asignado. Avisa a esa moto por WhatsApp para que acepte en la app.');
      setJobs((prev) => prev.filter((j) => j.id !== jobToAssign.id));
      setDrivers((prev) => prev.map((d) => {
        if (d.id !== driverId) return d;
        const max = Math.max(1, Number(d.live_max ?? d.max_orders) || 2);
        const active = (Number(d.live_active) || 0) + 1;
        const delivering = Boolean(d.live_delivering);
        return {
          ...d,
          live_active: active,
          live_max: max,
          live_delivering: delivering,
          live_available: !delivering && active < max,
        };
      }));
      void load(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editDriver) return;
    setBusyId(editDriver.id);
    setError('');
    try {
      const nextMax = normalizeMaxOrders(editDraft.max_orders);
      const nextComm = normalizeCommissionPercent(editDraft.commission_percent, 5);
      const ops = [];
      if (nextMax !== normalizeMaxOrders(editDriver.max_orders)) {
        ops.push(updateDriverMaxOrders(editDriver.id, nextMax));
      }
      if (nextComm !== normalizeCommissionPercent(editDriver.commission_percent, 5)) {
        ops.push(updateDriverCommission(editDriver.id, nextComm));
      }
      if (ops.length) await Promise.all(ops);
      setFlash('Guardado.');
      await load(true);
      goHome();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = async (id, status) => {
    setBusyId(id);
    setError('');
    try {
      await updateDriverAdminStatus(id, status);
      await load(true);
      goHome();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const title = view === 'create'
    ? 'Nueva moto'
    : view === 'assign'
      ? 'Asignar pedido'
      : view === 'edit'
        ? 'Editar moto'
        : (fleet?.name || 'Mi flota');

  return (
    <div className="admin-page fleet-page">
      <header className="fleet-top">
        {view !== 'home' ? (
          <button type="button" className="fleet-back" onClick={goHome}>
            <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
            Atrás
          </button>
        ) : (
          <p className="fleet-kicker">Jefe de repartidores</p>
        )}
        <h1 className="fleet-title">{title}</h1>
        {view === 'home' && (
          <div className="fleet-top__actions">
            <button type="button" className="fleet-icon-btn" onClick={() => load()} aria-label="Actualizar">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" className="fleet-icon-btn fleet-icon-btn--red" onClick={() => { setView('create'); setError(''); }}>
              <Plus className="h-4 w-4" />
              Moto
            </button>
          </div>
        )}
      </header>

      {error && <div className="fleet-banner fleet-banner--err">{error}</div>}
      {flash && (view === 'home' || view === 'assign') && (
        <div className="fleet-banner fleet-banner--ok">{flash}</div>
      )}

      {loading && view === 'home' ? (
        <Loader text="Cargando flota…" />
      ) : view === 'create' ? (
        <form className="fleet-form" onSubmit={handleCreate}>
          <p className="fleet-hint">Cada moto entra a la app nativa con su propio correo y clave.</p>
          <label>
            <span>Nombre</span>
            <input required value={motoForm.fullName} onChange={(e) => setMotoForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Ej. Juan Pérez" />
          </label>
          <label>
            <span>Correo</span>
            <input required type="email" inputMode="email" autoComplete="off" value={motoForm.email} onChange={(e) => setMotoForm((f) => ({ ...f, email: e.target.value }))} placeholder="moto@el-pollon.cl" />
          </label>
          <label>
            <span>Clave (mín. 6)</span>
            <input required type="password" minLength={6} autoComplete="new-password" value={motoForm.password} onChange={(e) => setMotoForm((f) => ({ ...f, password: e.target.value }))} />
          </label>
          <label>
            <span>Teléfono WhatsApp</span>
            <input inputMode="tel" value={motoForm.phone} onChange={(e) => setMotoForm((f) => ({ ...f, phone: e.target.value }))} placeholder="56912345678" />
          </label>
          <label>
            <span>Patente</span>
            <input value={motoForm.plate} onChange={(e) => setMotoForm((f) => ({ ...f, plate: e.target.value }))} />
          </label>
          <div className="fleet-form__actions">
            <button type="button" className="fleet-btn fleet-btn--ghost" onClick={goHome}>Atrás</button>
            <Button type="submit" disabled={creating}>{creating ? 'Creando…' : 'Crear moto'}</Button>
          </div>
        </form>
      ) : view === 'assign' && jobToAssign ? (
        <div className="fleet-stack">
          <div className="fleet-card">
            <p className="fleet-card__title">#{jobToAssign.ticket_code || '—'} · {jobToAssign.customer_name || 'Cliente'}</p>
            <p className="fleet-card__sub">{jobToAssign.customer_address || 'Sin dirección'}</p>
          </div>
          <p className="fleet-hint">Tú no necesitas asignártelo: acéptalo en la app nativa. Aquí eliges una moto.</p>
          {assignedDriverId && (
            <p className="fleet-hint fleet-hint--ok">Pedido asignado. Pulsa el icono verde de WhatsApp para avisar a esa moto.</p>
          )}
          {motosOnline.length === 0 ? (
            <p className="fleet-empty">No hay motos aprobadas.</p>
          ) : motosOnline.map((d) => {
            const assigned = assignedDriverId === d.id;
            const phone = driverPhone(d);
            const st = motoAssignStatus(d);
            const canAssign = st.available && !busyId && !assignedDriverId;
            return (
              <div
                key={d.id}
                className={`fleet-pick ${assigned ? 'is-assigned' : ''} ${st.available ? 'is-free' : 'is-busy'}`}
              >
                <strong>{d.profiles?.full_name || d.profiles?.email || 'Moto'}</strong>
                <span className="fleet-pick__meta">
                  {d.operational_status === 'offline' ? 'Offline' : 'En línea'}
                  {d.is_fleet_boss ? ' · tú' : ''}
                  {assigned ? ' · asignado' : ''}
                </span>
                <span
                  className={`fleet-avail ${st.available ? 'is-ok' : 'is-no'}`}
                  title={motoAvailHint(st)}
                >
                  {st.available ? 'Disponible' : 'No disponible'}
                </span>
                <div className="fleet-pick__actions">
                  {assigned ? (
                    <button
                      type="button"
                      className="fleet-wa-btn"
                      title={phone ? `WhatsApp a ${driverFirstName(d)}` : 'Esta moto no tiene teléfono'}
                      aria-label={`Enviar WhatsApp a ${driverFirstName(d)}`}
                      onClick={() => {
                        try {
                          openWhatsappToCustomer(phone, fleetAssignWhatsappMessage(d, jobToAssign));
                        } catch {
                          setError('Esta moto no tiene un teléfono WhatsApp. Edítala y agrégale el número.');
                        }
                      }}
                    >
                      <WhatsAppIcon className="h-5 w-5" title="" />
                    </button>
                  ) : (
                    <em>
                      <button
                        type="button"
                        className="fleet-assign-btn"
                        disabled={!canAssign}
                        title={st.available ? 'Asignar a esta moto' : motoAvailHint(st)}
                        onClick={() => handleAssign(d.id)}
                      >
                        {busyId === d.id ? 'Asignando…' : 'Asignar'}
                      </button>
                    </em>
                  )}
                </div>
              </div>
            );
          })}
          <button type="button" className="fleet-btn fleet-btn--ghost" onClick={goHome}>Atrás</button>
        </div>
      ) : view === 'edit' && editDriver ? (
        <div className="fleet-form">
          <p className="fleet-card__title">{editDriver.profiles?.full_name || 'Moto'}</p>
          <p className="fleet-card__sub">{editDriver.profiles?.email}</p>
          <label>
            <span>Cupo máximo</span>
            <select value={editDraft.max_orders} onChange={(e) => setEditDraft((d) => ({ ...d, max_orders: normalizeMaxOrders(e.target.value) }))}>
              {MAX_ORDER_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} pedidos</option>
              ))}
            </select>
          </label>
          <label>
            <span>Comisión %</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              inputMode="decimal"
              value={editDraft.commission_percent}
              onChange={(e) => setEditDraft((d) => ({ ...d, commission_percent: e.target.value }))}
            />
          </label>
          <div className="fleet-form__actions">
            <button type="button" className="fleet-btn fleet-btn--ghost" onClick={goHome}>Atrás</button>
            <Button type="button" disabled={busyId === editDriver.id} onClick={handleSaveEdit}>
              {busyId === editDriver.id ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
          <div className="fleet-form__actions">
            {editDriver.admin_status !== 'approved' && (
              <Button type="button" disabled={busyId === editDriver.id} onClick={() => setStatus(editDriver.id, 'approved')}>Aprobar</Button>
            )}
            {editDriver.admin_status === 'approved' && !editDriver.is_fleet_boss && (
              <button type="button" className="fleet-btn fleet-btn--ghost" disabled={busyId === editDriver.id} onClick={() => setStatus(editDriver.id, 'suspended')}>Suspender</button>
            )}
          </div>
        </div>
      ) : (
        <div className="fleet-stack">
          <section className="fleet-block">
            <h2>Pedidos nuevos</h2>
            <p className="fleet-hint">Te llegan a la app nativa con tu mismo correo. Acepta ahí si los llevas tú. Aquí solo asignas a una moto.</p>
            {jobs.length === 0 ? (
              <p className="fleet-empty">No hay pedidos nuevos sin moto.</p>
            ) : jobs.map((job) => (
              <article key={job.id} className="fleet-card fleet-card--job">
                <div>
                  <p className="fleet-card__title">#{job.ticket_code || '—'} · {job.customer_name || 'Cliente'}</p>
                  <p className="fleet-card__sub">{job.customer_address || 'Sin dirección'}</p>
                </div>
                <Button className="!px-3 !py-2 text-xs" onClick={() => openAssign(job)}>Asignar moto</Button>
              </article>
            ))}
          </section>

          <section className="fleet-block">
            <div className="fleet-block__head">
              <h2>Tu flota</h2>
              <button type="button" className="fleet-link" onClick={() => navigate('/admin/repartidores/reportes')}>Reportes</button>
            </div>
            {drivers.length === 0 ? (
              <p className="fleet-empty">Aún no tienes motos. Pulsa + Moto.</p>
            ) : drivers.map((d) => {
              const st = STATUS_LABELS[d.admin_status] || STATUS_LABELS.pending;
              return (
                <button key={d.id} type="button" className="fleet-card fleet-card--tap" onClick={() => openEdit(d)}>
                  <div>
                    <p className="fleet-card__title">
                      {d.profiles?.full_name || d.profiles?.email || 'Moto'}
                      {d.is_fleet_boss ? ' · tú' : ''}
                    </p>
                    <p className="fleet-card__sub">{d.profiles?.email}{d.vehicle_plate ? ` · ${d.vehicle_plate}` : ''}</p>
                  </div>
                  <span className={`fleet-chip ${st.cls}`}>{st.label}</span>
                </button>
              );
            })}
          </section>
        </div>
      )}
    </div>
  );
}
