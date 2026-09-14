import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import {
  listKnowledge, saveKnowledge, setKnowledgeActive, deleteKnowledge,
  KNOWLEDGE_CATEGORIES, isBotBackendReady,
} from '../../../services/botAdminService';
import { usePollonBot } from './PollonBotContext';

const EMPTY = {
  id: null, title: '', question: '', answer: '', category: 'faq',
  keywords: '', variants: '', priority: 100, active: true, branch_id: null,
};

function joinArr(v) {
  return Array.isArray(v) ? v.join(', ') : String(v || '');
}

export function BotMemoria() {
  const { effectiveBranch, profile, flash, setError, loading, setLoading } = usePollonBot();
  const [q, setQ] = useState('');
  const [knowledge, setKnowledge] = useState([]);
  const [form, setForm] = useState({ ...EMPTY, branch_id: effectiveBranch });

  const load = useCallback(async () => {
    if (!isBotBackendReady()) return;
    setKnowledge(await listKnowledge({ q, branchId: effectiveBranch }));
  }, [q, effectiveBranch]);

  useEffect(() => { load().catch((err) => setError(err.message)); }, [load, setError]);

  async function onSave(e) {
    e?.preventDefault?.();
    setLoading(true);
    setError('');
    try {
      await saveKnowledge({ ...form, branch_id: form.branch_id || effectiveBranch }, profile?.id);
      setForm({ ...EMPTY, branch_id: effectiveBranch });
      await load();
      flash('Memoria guardada. El bot ya puede usarla.');
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
          <input className="apb-input apb-input--grow" placeholder="Buscar memoria…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" className="apb-btn apb-btn--dark" onClick={() => setForm({ ...EMPTY, branch_id: effectiveBranch })}>
            <Plus className="h-4 w-4" /> Nueva
          </button>
        </div>
        {!knowledge.length && <p className="apb-empty">Aún no hay memoria.</p>}
        <div className="apb-list">
          {knowledge.map((row) => (
            <article
              key={row.id}
              className={`apb-row ${form.id === row.id ? 'is-selected' : ''}`}
              onClick={() => setForm({ ...row, keywords: joinArr(row.keywords), variants: (row.variants || []).join('\n') })}
            >
              <div className="apb-toolbar" style={{ justifyContent: 'space-between' }}>
                <h3 className="apb-row__title">{row.title || row.question}</h3>
                <span className={row.active ? 'apb-badge apb-badge--on' : 'apb-badge apb-badge--off'}>
                  {row.active ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <p className="apb-row__meta">{row.category} · prioridad {row.priority} · usada {row.times_used || 0} veces</p>
              <p className="apb-row__preview">{row.answer}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="apb-card">
        <form className="apb-form" onSubmit={onSave}>
          <h3 className="apb-row__title">{form.id ? 'Editar memoria' : 'Nueva memoria'}</h3>
          <label className="apb-label">Pregunta</label>
          <input className="apb-input" required value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value, title: e.target.value })} />
          <label className="apb-label">Respuesta del bot</label>
          <textarea className="apb-textarea" required value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
          <label className="apb-label">Categoría</label>
          <select className="apb-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {KNOWLEDGE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="apb-label">Palabras clave (coma)</label>
          <input className="apb-input" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
          <label className="apb-label">Variantes (una por línea)</label>
          <textarea className="apb-textarea" style={{ minHeight: '4.5rem' }} value={form.variants} onChange={(e) => setForm({ ...form, variants: e.target.value })} />
          <label className="apb-label">Prioridad</label>
          <input className="apb-input" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 100 })} />
          <label className="apb-label" style={{ display: 'flex', gap: '0.4rem', textTransform: 'none', alignItems: 'center' }}>
            <input type="checkbox" checked={form.active !== false} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Activa
          </label>
          <div className="apb-toolbar">
            <button type="submit" className="apb-btn apb-btn--primary" disabled={loading}><Save className="h-4 w-4" /> Guardar</button>
            {form.id && (
              <>
                <button type="button" className="apb-btn apb-btn--ghost" onClick={async () => { await setKnowledgeActive(form.id, !form.active); setForm({ ...form, active: !form.active }); await load(); }}>
                  {form.active ? 'Desactivar' : 'Activar'}
                </button>
                <button type="button" className="apb-btn apb-btn--danger" onClick={async () => { if (!window.confirm('¿Eliminar?')) return; await deleteKnowledge(form.id); setForm({ ...EMPTY, branch_id: effectiveBranch }); await load(); }}>
                  <Trash2 className="h-4 w-4" /> Eliminar
                </button>
              </>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
