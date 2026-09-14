import { useState } from 'react';
import { Play } from 'lucide-react';
import { simulateBot } from '../../../services/botAdminService';
import { usePollonBot } from './PollonBotContext';

export function BotSimulate() {
  const { effectiveBranch, setError, loading, setLoading } = usePollonBot();
  const [phone, setPhone] = useState('+56912345678');
  const [message, setMessage] = useState('');
  const [out, setOut] = useState(null);

  async function onSubmit(e) {
    e?.preventDefault?.();
    setLoading(true);
    setError('');
    try {
      const result = await simulateBot({ phone, message, branchId: effectiveBranch });
      setOut(result);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="apb-layout">
      <section className="apb-card">
        <form className="apb-form" onSubmit={onSubmit}>
          <h3 className="apb-row__title">Simulador (no envía WhatsApp)</h3>
          <label className="apb-label">Teléfono</label>
          <input className="apb-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <label className="apb-label">Mensaje del cliente</label>
          <textarea className="apb-textarea" required value={message} onChange={(e) => setMessage(e.target.value)} />
          <button type="submit" className="apb-btn apb-btn--primary" disabled={loading}>
            <Play className="h-4 w-4" /> Probar
          </button>
        </form>
      </section>
      <section className="apb-card">
        {!out && <p className="apb-empty">Aquí verás la respuesta determinista del bot.</p>}
        {out && (
          <div>
            <p className="apb-row__meta" style={{ marginBottom: '0.5rem' }}>
              intent: {out.intent || '—'} · confianza: {out.confidence ?? '—'}
              {out.reason ? ` · ${out.reason}` : ''}
            </p>
            <pre className="apb-sim-out">{out.reply || out.text || JSON.stringify(out, null, 2)}</pre>
          </div>
        )}
      </section>
    </div>
  );
}
