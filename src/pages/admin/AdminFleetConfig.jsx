import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isFleetBossRole } from '../../services/authService';
import { Loader } from '../../components/ui/Loader';
import { Button } from '../../components/ui/Button';
import { createFleetMoto } from '../../services/fleetService';
import {
  updateDriverAdminStatus,
  updateDriverMaxOrders,
  updateDriverCommission,
  normalizeCommissionPercent,
} from '../../services/driverService';
import { useFleetHome } from '../../hooks/useFleetHome';
import {
  MAX_ORDER_OPTIONS,
  EMPTY_MOTO,
  STATUS_LABELS,
  normalizeMaxOrders,
} from '../../utils/fleetUi';
import '../../styles/admin-fleet.css';

export function AdminFleetConfig() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { drivers, fleet, loading, error, setError, flash, setFlash, load } = useFleetHome();
  const [view, setView] = useState('list');
  const [busyId, setBusyId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [motoForm, setMotoForm] = useState(EMPTY_MOTO);
  const [editDriver, setEditDriver] = useState(null);
  const [editDraft, setEditDraft] = useState({ max_orders: 2, commission_percent: '5' });

  if (!isFleetBossRole(profile?.role || profile?.rol)) {
    return <Navigate to="/admin/repartidores" replace />;
  }

  const goList = () => {
    setView('list');
    setEditDriver(null);
    setError('');
  };

  const openCreate = () => {
    setMotoForm(EMPTY_MOTO);
    setView('create');
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
      setView('list');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
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
      goList();
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
      goList();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const title = view === 'create'
    ? 'Nueva moto'
    : view === 'edit'
      ? 'Editar moto'
      : (fleet?.name || 'Tu flota');

  return (
    <div className="admin-page fleet-page">
      <header className="fleet-top">
        {view !== 'list' ? (
          <button type="button" className="fleet-back" onClick={goList}>
            <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
            Atrás
          </button>
        ) : (
          <p className="fleet-kicker">Configuración de flota</p>
        )}
        <h1 className="fleet-title">{title}</h1>
        {view === 'list' && (
          <div className="fleet-top__actions">
            <button type="button" className="fleet-link" onClick={() => navigate('/admin/repartidores/reportes')}>
              Reportes
            </button>
            <button type="button" className="fleet-icon-btn fleet-icon-btn--red" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Moto
            </button>
          </div>
        )}
      </header>

      {error && <div className="fleet-banner fleet-banner--err">{error}</div>}
      {flash && view === 'list' && (
        <div className="fleet-banner fleet-banner--ok">{flash}</div>
      )}

      {loading && view === 'list' ? (
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
            <button type="button" className="fleet-btn fleet-btn--ghost" onClick={goList}>Atrás</button>
            <Button type="submit" disabled={creating}>{creating ? 'Creando…' : 'Crear moto'}</Button>
          </div>
        </form>
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
            <button type="button" className="fleet-btn fleet-btn--ghost" onClick={goList}>Atrás</button>
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
        <section className="fleet-block">
          <div className="fleet-block__head">
            <h2>Tu flota</h2>
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
      )}
    </div>
  );
}
