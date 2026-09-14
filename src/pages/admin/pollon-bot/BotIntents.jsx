import { useCallback, useEffect, useState } from 'react';
import { Plus, Save } from 'lucide-react';
import {
  listIntents, saveIntent, setIntentActive, BOT_HANDLERS, isBotBackendReady,
} from '../../../services/botAdminService';
import { usePollonBot } from './PollonBotContext';

const EMPTY = {
  id: null, code: '', label: '', keywords: '', patterns: '', examples: '',
  priority: 100, handler: 'handleKnowledgeSearch', active: true,
};

export function BotIntents() {
  const { flash, setError, loading, setLoading } = usePollonBot();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    if (!isBotBackendReady()) return;
    setRows(await listIntents());
  }, []);

  useEffect(() => { load().catch((err) => setError(err.message)); }, [load, setError]);

  async function onSave(e) {
    e?.preventDefault?.();
    setLoading(true);
    setError('');
    try {
      await saveIntent(form);
      setForm(EMPTY);
      await load();
      flash('Intención guardada. El detector la usa al instante.');
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
          <button type="button" className="apb-btn apb-btn--dark" onClick={() => setForm(EMPTY)}><Plus className="h-4 w-4" /> Nueva</button>
        </div>
        <div className="apb-list">
          {rows.map((row) => (
            <article key={row.id} className={`apb-row ${form.id === row.id ? 'is-selected' : ''}`} onClick={() => setForm({
              ...row,
              keywords: (row.keywords || []).join(', '),
              patterns: (row.patterns || []).join('\n'),
              examples: (row.examples || []).join('\n'),
            })}>
              <div className="apb-toolbar" style={{ justifyContent: 'space-between' }}>
                <h3 className="apb-row__title">{row.code} · {row.label}</h3>
                <span className={row.active ? 'apb-badge apb-badge--on' : 'apb-badge apb-badge--off'}>{row.active ? 'On' : 'Off'}</span>
              </div>
              <p className="apb-row__meta">prioridad {row.priority} · {row.handler}</p>
              <p className="apb-row__preview">{(row.keywords || []).slice(0, 8).join(', ')}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="apb-card">
        <form className="apb-form" onSubmit={onSave}>
          <h3 className="apb-row__title">{form.id ? 'Editar intención' : 'Nueva intención'}</h3>
          <label className="apb-label">Código</label>
          <input className="apb-input" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={Boolean(form.id)} />
          <label className="apb-label">Etiqueta</label>
          <input className="apb-input" required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <label className="apb-label">Keywords (coma)</label>
          <textarea className="apb-textarea" style={{ minHeight: '4rem' }} value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
          <label className="apb-label">Patrones (una por línea)</label>
          <textarea className="apb-textarea" style={{ minHeight: '3.5rem' }} value={form.patterns} onChange={(e) => setForm({ ...form, patterns: e.target.value })} />
          <label className="apb-label">Ejemplos (una por línea)</label>
          <textarea className="apb-textarea" style={{ minHeight: '3.5rem' }} value={form.examples} onChange={(e) => setForm({ ...form, examples: e.target.value })} />
          <label className="apb-label">Prioridad (menor = antes)</label>
          <input className="apb-input" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 100 })} />
          <label className="apb-label">Handler</label>
          <select className="apb-select" value={form.handler} onChange={(e) => setForm({ ...form, handler: e.target.value })}>
            {BOT_HANDLERS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <div className="apb-toolbar">
            <button type="submit" className="apb-btn apb-btn--primary" disabled={loading}><Save className="h-4 w-4" /> Guardar</button>
            {form.id && (
              <button type="button" className="apb-btn apb-btn--ghost" onClick={async () => { await setIntentActive(form.id, !form.active); setForm({ ...form, active: !form.active }); await load(); }}>
                {form.active ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </div>
          <p className="apb-hint">No borres intenciones de sistema: desactívalas. Umbral de confianza se edita en Config.</p>
        </form>
      </section>
    </div>
  );
}
