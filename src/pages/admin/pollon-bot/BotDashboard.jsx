import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadBotDashboard, isBotBackendReady } from '../../../services/botAdminService';
import { usePollonBot } from './PollonBotContext';

export function BotDashboard() {
  const { effectiveBranch, setError } = usePollonBot();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!isBotBackendReady()) {
      setError('Supabase no está configurado.');
      return;
    }
    loadBotDashboard(effectiveBranch).then(setStats).catch((err) => setError(err.message));
  }, [effectiveBranch, setError]);

  if (!stats) return <p className="apb-empty">Cargando dashboard…</p>;

  const cards = [
    { label: 'Chats 24 h', value: stats.conversations24h, to: '/admin/whatsapp/inbox' },
    { label: 'Humanos abiertos', value: stats.humanOpen, to: '/admin/whatsapp/inbox' },
    { label: 'Sin respuesta', value: stats.unansweredPending, to: '/admin/whatsapp/sin-respuesta' },
    { label: 'Memoria activa', value: stats.knowledgeActive, to: '/admin/whatsapp/memoria' },
    { label: 'Cola avisos', value: stats.queuePending, to: '/admin/whatsapp/eventos' },
    { label: 'Avisos fallidos', value: stats.queueFailed, to: '/admin/whatsapp/eventos' },
  ];

  return (
    <div className="apb-dash">
      <div className="apb-stat-grid">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="apb-stat">
            <p className="apb-stat__value">{c.value}</p>
            <p className="apb-stat__label">{c.label}</p>
          </Link>
        ))}
      </div>
      <section className="apb-card">
        <h3 className="apb-row__title">Últimos logs</h3>
        {!stats.logs.length && <p className="apb-empty">Sin logs todavía.</p>}
        <div className="apb-list">
          {stats.logs.map((row) => (
            <article key={row.id} className="apb-row" style={{ cursor: 'default' }}>
              <p className="apb-row__title">
                <span className={`apb-badge ${row.level === 'error' ? 'apb-badge--off' : row.level === 'warning' ? 'apb-badge--warn' : 'apb-badge--info'}`}>
                  {row.level}
                </span>
                {' '}{row.event_type}
              </p>
              <p className="apb-row__preview">{row.message}</p>
              <p className="apb-row__meta">{row.created_at ? new Date(row.created_at).toLocaleString('es-CL') : ''}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
