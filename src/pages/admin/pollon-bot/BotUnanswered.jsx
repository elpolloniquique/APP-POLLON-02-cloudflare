import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import {
  listUnanswered, ignoreUnanswered, trainFromUnanswered, subscribeUnanswered, isBotBackendReady,
} from '../../../services/botAdminService';
import { usePollonBot } from './PollonBotContext';

function statusBadge(status) {
  if (status === 'answered') return 'apb-badge apb-badge--on';
  if (status === 'ignored') return 'apb-badge apb-badge--off';
  if (status === 'pending') return 'apb-badge apb-badge--warn';
  return 'apb-badge apb-badge--info';
}

export function BotUnanswered() {
  const { effectiveBranch, profile, flash, setError, loading, setLoading } = usePollonBot();
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState([]);
  const [train, setTrain] = useState({ item: null, answer: '', variants: '' });

  const load = useCallback(async () => {
    if (!isBotBackendReady()) return;
    setRows(await listUnanswered({ status, branchId: effectiveBranch }));
  }, [status, effectiveBranch]);

  useEffect(() => { load().catch((err) => setError(err.message)); }, [load, setError]);
  useEffect(() => subscribeUnanswered(() => { load().catch(() => {}); }), [load]);

  async function onTrain(e) {
    e?.preventDefault?.();
    if (!train.item) return;
    setLoading(true);
    setError('');
    try {
      await trainFromUnanswered({
        unanswered: train.item,
        answer: train.answer,
        variantsText: train.variants,
        profileId: profile?.id,
        branchId: effectiveBranch,
      });
      setTrain({ item: null, answer: '', variants: '' });
      await load();
      flash('Entrenado. Sin redeploy: el bot ya responde eso.');
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="apb-layout">
      <section className="apb-card">
        <div className="apb-toolbar" style={{ marginBottom: '0.7rem' }}>
          <select className="apb-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">Pendientes</option>
            <option value="answered">Entrenadas</option>
            <option value="ignored">Ignoradas</option>
            <option value="all">Todas</option>
          </select>
        </div>
        {!rows.length && <p className="apb-empty">No hay preguntas en esta cola.</p>}
        <div className="apb-list">
          {rows.map((row) => (
            <article
              key={row.id}
              className={`apb-row ${train.item?.id === row.id ? 'is-selected' : ''}`}
              onClick={() => setTrain({ item: row, answer: row.answer || '', variants: row.original_question || '' })}
            >
              <div className="apb-toolbar" style={{ justifyContent: 'space-between' }}>
                <h3 className="apb-row__title">{row.original_question}</h3>
                <span className={statusBadge(row.status)}>{row.status}</span>
              </div>
              <p className="apb-row__meta">{row.occurrences || 1} vez(es) · {row.phone || 'sin teléfono'}{row.detected_intent ? ` · ${row.detected_intent}` : ''}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="apb-card">
        {!train.item && <p className="apb-empty">Elige una pregunta para entrenar al bot.</p>}
        {train.item && (
          <form className="apb-form" onSubmit={onTrain}>
            <h3 className="apb-row__title">Guardar y entrenar</h3>
            <p className="apb-hint">Pregunta original: {train.item.original_question}</p>
            <label className="apb-label">Respuesta que debe dar el bot</label>
            <textarea className="apb-textarea" required value={train.answer} onChange={(e) => setTrain({ ...train, answer: e.target.value })} />
            <label className="apb-label">Otras formas de preguntarlo</label>
            <textarea className="apb-textarea" style={{ minHeight: '4.5rem' }} value={train.variants} onChange={(e) => setTrain({ ...train, variants: e.target.value })} />
            <div className="apb-toolbar">
              <button type="submit" className="apb-btn apb-btn--primary" disabled={loading}><Save className="h-4 w-4" /> Guardar y entrenar</button>
              {train.item.status === 'pending' && (
                <button type="button" className="apb-btn apb-btn--ghost" onClick={async () => { await ignoreUnanswered(train.item.id); setTrain({ item: null, answer: '', variants: '' }); await load(); }}>
                  Ignorar
                </button>
              )}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
