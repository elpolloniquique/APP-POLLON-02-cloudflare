import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { listSynonyms, saveSynonym, deleteSynonym, isBotBackendReady } from '../../../services/botAdminService';
import { usePollonBot } from './PollonBotContext';

const EMPTY = { id: null, canonical: '', aliases: '', category: 'general', active: true };

export function BotSynonyms() {
  const { flash, setError, loading, setLoading } = usePollonBot();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    if (!isBotBackendReady()) return;
    setRows(await listSynonyms());
  }, []);

  useEffect(() => { load().catch((err) => setError(err.message)); }, [load, setError]);

  async function onSave(e) {
    e?.preventDefault?.();
    setLoading(true);
    setError('');
    try {
      await saveSynonym(form);
      setForm(EMPTY);
      await load();
      flash('Sinónimo guardado. El detector lo usa al instante.');
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
          <button type="button" className="apb-btn apb-btn--dark" onClick={() => setForm(EMPTY)}><Plus className="h-4 w-4" /> Nuevo</button>
        </div>
        {!rows.length && <p className="apb-empty">No hay sinónimos.</p>}
        <div className="apb-list">
          {rows.map((row) => (
            <article key={row.id} className={`apb-row ${form.id === row.id ? 'is-selected' : ''}`} onClick={() => setForm({ ...row, aliases: (row.aliases || []).join(', ') })}>
              <div className="apb-toolbar" style={{ justifyContent: 'space-between' }}>
                <h3 className="apb-row__title">{row.canonical}</h3>
                <span className={row.active ? 'apb-badge apb-badge--on' : 'apb-badge apb-badge--off'}>{row.active ? 'Activo' : 'Off'}</span>
              </div>
              <p className="apb-row__meta">{row.category}</p>
              <p className="apb-row__preview">{(row.aliases || []).join(', ')}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="apb-card">
        <form className="apb-form" onSubmit={onSave}>
          <h3 className="apb-row__title">{form.id ? 'Editar sinónimo' : 'Nuevo sinónimo'}</h3>
          <label className="apb-label">Palabra canónica</label>
          <input className="apb-input" required value={form.canonical} onChange={(e) => setForm({ ...form, canonical: e.target.value })} placeholder="delivery" />
          <label className="apb-label">Alias (coma)</label>
          <textarea className="apb-textarea" style={{ minHeight: '5rem' }} value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} placeholder="despacho, envío, reparto" />
          <label className="apb-label">Categoría</label>
          <input className="apb-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <label className="apb-label" style={{ display: 'flex', gap: '0.4rem', textTransform: 'none' }}>
            <input type="checkbox" checked={form.active !== false} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Activo
          </label>
          <div className="apb-toolbar">
            <button type="submit" className="apb-btn apb-btn--primary" disabled={loading}><Save className="h-4 w-4" /> Guardar</button>
            {form.id && (
              <button type="button" className="apb-btn apb-btn--danger" onClick={async () => { if (!window.confirm('¿Eliminar?')) return; await deleteSynonym(form.id); setForm(EMPTY); await load(); }}>
                <Trash2 className="h-4 w-4" /> Eliminar
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
