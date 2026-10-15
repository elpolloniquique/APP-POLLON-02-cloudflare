import { useMemo, useState } from 'react';
import { ChevronLeft, Bike, RefreshCw, UserRound } from 'lucide-react';
import { Loader } from '../../components/ui/Loader';
import { WhatsAppIcon } from '../../components/ui/WhatsAppIcon';
import { openWhatsappToCustomer } from '../../utils/format';
import { assignFleetJob } from '../../services/fleetService';
import { useAuth } from '../../context/AuthContext';
import { useFleetHome } from '../../hooks/useFleetHome';
import {
  driverPhone,
  driverFirstName,
  ticketLabel,
  fleetAssignWhatsappMessage,
  motoAssignStatus,
  motoAvailHint,
  jobAddressLine,
  jobPriority,
  bossDisplayName,
} from '../../utils/fleetUi';
import '../../styles/admin-fleet.css';

export function AdminFleetPanel() {
  const { profile } = useAuth();
  const {
    drivers, setDrivers, jobs, setJobs, loading, error, setError, flash, setFlash, load,
  } = useFleetHome();
  const [view, setView] = useState('home');
  const [busyId, setBusyId] = useState(null);
  const [jobToAssign, setJobToAssign] = useState(null);
  const [assignedDriverId, setAssignedDriverId] = useState(null);

  const motosOnline = useMemo(
    () => drivers.filter((d) => d.admin_status === 'approved'),
    [drivers],
  );

  const motosStats = useMemo(() => {
    const disponible = motosOnline.filter((d) => motoAssignStatus(d).available).length;
    return { total: motosOnline.length, disponible, ocupado: motosOnline.length - disponible };
  }, [motosOnline]);

  const sortedJobs = useMemo(() => (
    [...jobs].sort((a, b) => {
      const ta = new Date(a.created_at || a.updated_at || 0).getTime();
      const tb = new Date(b.created_at || b.updated_at || 0).getTime();
      return ta - tb;
    })
  ), [jobs]);

  const goHome = () => {
    setView('home');
    setJobToAssign(null);
    setAssignedDriverId(null);
    setError('');
  };

  const openAssign = (job) => {
    setJobToAssign(job);
    setAssignedDriverId(null);
    setView('assign');
    setError('');
    setFlash('');
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

  const bossName = bossDisplayName(profile, drivers.find((d) => d.is_fleet_boss)?.profiles?.full_name);

  return (
    <div className="admin-page fleet-page">
      {view !== 'home' && (
        <header className="fleet-top">
          <button type="button" className="fleet-back" onClick={goHome}>
            <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
            Atrás
          </button>
          <h1 className="fleet-title">Asignar pedido</h1>
        </header>
      )}

      {error && <div className="fleet-banner fleet-banner--err">{error}</div>}
      {flash && (view === 'home' || view === 'assign') && (
        <div className="fleet-banner fleet-banner--ok">{flash}</div>
      )}

      {loading && view === 'home' ? (
        <Loader text="Cargando flota…" />
      ) : view === 'assign' && jobToAssign ? (
        <div className="fleet-stack">
          <div className="fleet-card">
            <p className="fleet-card__title">{ticketLabel(jobToAssign)} · {jobToAssign.customer_name || 'Cliente'}</p>
            <p className="fleet-card__sub">{jobAddressLine(jobToAssign)}</p>
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
      ) : (
        <div className="fleet-dash">
          <p className="fleet-dash__kicker">Jefe de repartidores</p>
          <div className="fleet-identity">
            <span className="fleet-avatar" aria-hidden="true">
              <UserRound strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="fleet-identity__name">Repartidor {bossName}</h2>
              <p className="fleet-identity__role">Jefe de Repartidores</p>
            </div>
          </div>

          <div className="fleet-stats" role="status">
            <span className="fleet-stats__motos">
              <Bike className="h-4 w-4" strokeWidth={2.2} />
              Motos
            </span>
            <span className="fleet-stats__pill is-ok">
              Disponible <strong>{motosStats.disponible}</strong>
            </span>
            <span className="fleet-stats__pill is-busy">
              Ocupado <strong>{motosStats.ocupado}</strong>
            </span>
            <button
              type="button"
              className="fleet-stats__refresh"
              onClick={() => load()}
              aria-label="Actualizar"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <section className="fleet-block">
            <h2>Pedidos nuevos</h2>
            <p className="fleet-hint">
              Te llegan a la app nativa con tu mismo correo. Acepta ahí si los llevas tú. Aquí solo asignas a una moto.
            </p>
            {sortedJobs.length === 0 ? (
              <p className="fleet-empty">No hay pedidos nuevos sin moto.</p>
            ) : sortedJobs.map((job) => {
              const pri = jobPriority(job);
              return (
                <article key={job.id} className={`fleet-job fleet-job--${pri.key}`}>
                  <span className="fleet-job__badge">{pri.label}</span>
                  <div className="fleet-job__body">
                    <p className="fleet-job__title">Pedido {ticketLabel(job)} · {job.customer_name || 'Cliente'}</p>
                    <p className="fleet-job__addr">{jobAddressLine(job)}</p>
                  </div>
                  <button
                    type="button"
                    className="fleet-job__cta"
                    onClick={() => openAssign(job)}
                  >
                    <Bike className="h-5 w-5" strokeWidth={2.2} />
                    <span>Asignar<br />Moto</span>
                  </button>
                </article>
              );
            })}
          </section>
        </div>
      )}
    </div>
  );
}
