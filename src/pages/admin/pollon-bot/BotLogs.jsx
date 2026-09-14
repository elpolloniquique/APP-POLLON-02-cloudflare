import { useCallback, useEffect, useState } from 'react';
import { listLogs, isBotBackendReady } from '../../../services/botAdminService';
import { usePollonBot } from './PollonBotContext';

function badge(level) {
  if (level === 'error') return 'apb-badge apb-badge--off';
  if (level === 'warning') return 'apb-badge apb-badge--warn';
  return 'apb-badge apb-badge--info';
}

export function BotLogs() {
  const { setError } = usePollonBot();
  const [level, setLevel] = useState('');
  const [rows, setRows] = useState([]);

  const load = useCallback(async () => {
    if (!isBotBackendReady()) return;
    setRows(await listLogs({ level, limit: 120 }));
  }, [level]);

  useEffect(() => { load().catch((err) => setError(err.message)); }, [load, setError]);

  return (
    <section className="apb-card">
      <div className="apb-toolbar" style={{ marginBottom: '0.7rem' }}>
        <h3 className="apb-row__title" style={{ marginRight: 'auto' }}>Logs (sin secretos)</h3>
        <select className="apb-select" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">Todos</option>
          <option value="info">info</option>
          <option value="warning">warning</option>
          <option value="error">error</option>
        </select>
      </div>
      {!rows.length && <p className="apb-empty">Sin logs.</p>}
      <div className="apb-list">
        {rows.map((row) => (
          <article key={row.id} className="apb-row" style={{ cursor: 'default' }}>
            <div className="apb-toolbar" style={{ justifyContent: 'space-between' }}>
              <h3 className="apb-row__title">{row.event_type || row.event || 'log'}</h3>
              <span className={badge(row.level)}>{row.level}</span>
            </div>
            <p className="apb-row__preview">{row.message}</p>
            <p className="apb-row__meta">
              {row.order_id ? `pedido ${row.order_id} · ` : ''}
              {row.created_at ? new Date(row.created_at).toLocaleString('es-CL') : ''}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
