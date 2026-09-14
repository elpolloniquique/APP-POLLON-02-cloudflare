import { useCallback, useEffect, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import {
  listDocuments, uploadBotDocument, processBotDocument, setDocumentActive, deleteDocument,
  KNOWLEDGE_CATEGORIES, isBotBackendReady,
} from '../../../services/botAdminService';
import { usePollonBot } from './PollonBotContext';

function statusBadge(status) {
  if (status === 'processed') return 'apb-badge apb-badge--on';
  if (status === 'error') return 'apb-badge apb-badge--off';
  if (status === 'pending') return 'apb-badge apb-badge--warn';
  return 'apb-badge apb-badge--info';
}

export function BotDocuments() {
  const { effectiveBranch, profile, flash, setError, loading, setLoading } = usePollonBot();
  const [docs, setDocs] = useState([]);
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState('documento');

  const load = useCallback(async () => {
    if (!isBotBackendReady()) return;
    setDocs(await listDocuments(effectiveBranch));
  }, [effectiveBranch]);

  useEffect(() => { load().catch((err) => setError(err.message)); }, [load, setError]);

  async function onUpload(e) {
    e?.preventDefault?.();
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const row = await uploadBotDocument({ file, category, branchId: effectiveBranch, profileId: profile?.id });
      await processBotDocument(row.id);
      setFile(null);
      await load();
      flash('Documento procesado y agregado a la memoria.');
    } catch (err) {
      setError(err.message || String(err));
      await load().catch(() => {});
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="apb-layout">
      <section className="apb-card">
        {!docs.length && <p className="apb-empty">No hay documentos. Sube un PDF, TXT o DOCX.</p>}
        <div className="apb-list">
          {docs.map((row) => (
            <article key={row.id} className="apb-row" style={{ cursor: 'default' }}>
              <div className="apb-toolbar" style={{ justifyContent: 'space-between' }}>
                <h3 className="apb-row__title">{row.file_name}</h3>
                <span className={statusBadge(row.status)}>{row.status}</span>
              </div>
              <p className="apb-row__meta">{row.category} · {row.chunk_count || 0} fragmentos {row.error_text ? `· ${row.error_text}` : ''}</p>
              <div className="apb-toolbar" style={{ marginTop: '0.4rem' }}>
                <button type="button" className="apb-btn apb-btn--ghost" onClick={async () => { setLoading(true); try { await processBotDocument(row.id); await load(); flash('Reprocesado.'); } catch (err) { setError(err.message); } finally { setLoading(false); } }}>Reprocesar</button>
                <button type="button" className="apb-btn apb-btn--ghost" onClick={async () => { await setDocumentActive(row.id, !row.active, row.status); await load(); }}>{row.active === false ? 'Activar' : 'Desactivar'}</button>
                <button type="button" className="apb-btn apb-btn--danger" onClick={async () => { if (!window.confirm('¿Eliminar documento?')) return; await deleteDocument(row.id, row.storage_path); await load(); }}><Trash2 className="h-4 w-4" /> Eliminar</button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="apb-card">
        <form className="apb-form" onSubmit={onUpload}>
          <h3 className="apb-row__title">Subir documento</h3>
          <p className="apb-hint">PDF, TXT o DOCX. Parser OSS. Sin APIs de pago.</p>
          <input className="apb-input" type="file" accept=".pdf,.txt,.md,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <label className="apb-label">Categoría</label>
          <select className="apb-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {KNOWLEDGE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="submit" className="apb-btn apb-btn--primary" disabled={loading || !file}>
            <Upload className="h-4 w-4" /> Subir y procesar
          </button>
        </form>
      </section>
    </div>
  );
}
