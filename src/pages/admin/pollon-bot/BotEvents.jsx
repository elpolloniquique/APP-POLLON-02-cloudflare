import { useCallback, useEffect, useState } from 'react';
import { listEvents, listNotifyQueue, isBotBackendReady } from '../../../services/botAdminService';
import { usePollonBot } from './PollonBotContext';

function badge(status) {
  if (status === 'sent') return 'apb-badge apb-badge--on';
  if (status === 'failed') return 'apb-badge apb-badge--off';
  if (status === 'pending' || status === 'processing') return 'apb-badge apb-badge--warn';
  return 'apb-badge apb-badge--info';
}

export function BotEvents() {
  const { effectiveBranch, setError } = usePollonBot();
  const [status, setStatus] = useState('');
  const [events, setEvents] = useState([]);
  const [queue, setQueue] = useState([]);

  const load = useCallback(async () => {
    if (!isBotBackendReady()) return;
    const [ev, q] = await Promise.all([
      listEvents({ status, limit: 80 }),
      listNotifyQueue({ branchId: effectiveBranch }),
    ]);
    setEvents(ev);
    setQueue(q);
  }, [status, effectiveBranch]);

  useEffect(() => { load().catch((err) => setError(err.message)); }, [load, setError]);

  return (
    <div className="apb-layout">
      <section className="apb-card">
        <div className="apb-toolbar" style={{ marginBottom: '0.7rem' }}>
          <h3 className="apb-row__title" style={{ marginRight: 'auto' }}>bot_events (idempotencia)</h3>
          <select className="apb-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="pending">pending</option>
            <option value="sent">sent</option>
            <option value="failed">failed</option>
            <option value="skipped">skipped</option>
          </select>
        </div>
        {!events.length && <p className="apb-empty">Sin eventos.</p>}
        <div className="apb-list">
          {events.map((row) => (
            <article key={row.id} className="apb-row" style={{ cursor: 'default' }}>
              <div className="apb-toolbar" style={{ justifyContent: 'space-between' }}>
                <h3 className="apb-row__title">{row.event_key}</h3>
                <span className={badge(row.status)}>{row.status}</span>
              </div>
              <p className="apb-row__meta">{row.event_type} · {row.phone || '—'} · {row.created_at ? new Date(row.created_at).toLocaleString('es-CL') : ''}</p>
              {row.last_error && <p className="apb-row__preview">{row.last_error}</p>}
            </article>
          ))}
        </div>
      </section>
      <section className="apb-card">
        <h3 className="apb-row__title">Cola de avisos</h3>
        {!queue.length && <p className="apb-empty">Cola vacía.</p>}
        <div className="apb-list">
          {queue.map((row) => (
            <article key={row.id} className="apb-row" style={{ cursor: 'default' }}>
              <div className="apb-toolbar" style={{ justifyContent: 'space-between' }}>
                <h3 className="apb-row__title">{row.type} · #{row.payload?.codigo_pedido || row.order_id}</h3>
                <span className={badge(row.status)}>{row.status}</span>
              </div>
              <p className="apb-row__meta">{row.phone} · intentos {row.attempts}/{row.max_attempts}</p>
              {row.last_error && <p className="apb-row__preview">{row.last_error}</p>}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
