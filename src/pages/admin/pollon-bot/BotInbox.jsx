import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listConversations,
  listMessages,
  markConversationRead,
  setConversationMode,
  sendHumanReply,
  subscribeInbox,
  isBotBackendReady,
} from '../../../services/botAdminService';
import { usePollonBot } from './PollonBotContext';

function modeBadge(mode) {
  if (mode === 'human_required') return 'apb-badge apb-badge--off';
  if (mode === 'human') return 'apb-badge apb-badge--warn';
  return 'apb-badge apb-badge--on';
}

export function BotInbox() {
  const { effectiveBranch, profile, flash, setError, loading, setLoading } = usePollonBot();
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef(null);

  const selected = list.find((c) => c.id === selectedId) || null;

  const loadList = useCallback(async () => {
    if (!isBotBackendReady()) return;
    const rows = await listConversations({ branchId: effectiveBranch, q, mode });
    setList(rows);
  }, [effectiveBranch, q, mode]);

  const loadMsgs = useCallback(async (id) => {
    if (!id) {
      setMessages([]);
      return;
    }
    const rows = await listMessages(id);
    setMessages(rows);
  }, []);

  useEffect(() => {
    loadList().catch((err) => setError(err.message));
  }, [loadList, setError]);

  useEffect(() => {
    loadMsgs(selectedId).catch(() => {});
  }, [selectedId, loadMsgs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => subscribeInbox((kind) => {
    loadList().catch(() => {});
    if (kind === 'messages' && selectedId) loadMsgs(selectedId).catch(() => {});
  }), [loadList, loadMsgs, selectedId]);

  async function openConv(row) {
    setSelectedId(row.id);
    try {
      await markConversationRead(row.id);
      await loadList();
    } catch { /* ignore */ }
  }

  async function onSend(e) {
    e?.preventDefault?.();
    if (!selected || !draft.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await sendHumanReply({ conversationId: selected.id, text: draft.trim() });
      setDraft('');
      await Promise.all([loadMsgs(selected.id), loadList()]);
      flash(result.sent ? 'Mensaje enviado por WhatsApp.' : `Guardado en CRM. ${result.warning || ''}`);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="apb-layout apb-inbox">
      <section className="apb-card">
        <div className="apb-toolbar" style={{ marginBottom: '0.7rem' }}>
          <input className="apb-input apb-input--grow" placeholder="Buscar teléfono o texto…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="apb-select" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="">Todos</option>
            <option value="bot">Bot</option>
            <option value="human">Humano</option>
            <option value="human_required">Requiere humano</option>
          </select>
        </div>
        {!list.length && <p className="apb-empty">Aún no hay conversaciones.</p>}
        <div className="apb-list">
          {list.map((row) => (
            <article
              key={row.id}
              className={`apb-row ${selectedId === row.id ? 'is-selected' : ''}`}
              onClick={() => openConv(row)}
            >
              <div className="apb-toolbar" style={{ justifyContent: 'space-between' }}>
                <h3 className="apb-row__title">{row.phone}</h3>
                <span className={modeBadge(row.mode)}>{row.mode}</span>
              </div>
              <p className="apb-row__preview">{row.last_message_preview || '—'}</p>
              <p className="apb-row__meta">
                {row.current_intent || 'sin intent'}
                {row.unread_count > 0 ? ` · ${row.unread_count} sin leer` : ''}
                {row.last_message_at ? ` · ${new Date(row.last_message_at).toLocaleString('es-CL')}` : ''}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="apb-card apb-chat">
        {!selected && <p className="apb-empty">Elige un chat. El bot deja de responder si el modo es humano.</p>}
        {selected && (
          <>
            <div className="apb-chat__head">
              <div>
                <h3 className="apb-row__title">{selected.phone}</h3>
                <p className="apb-row__meta">
                  intent: {selected.current_intent || '—'}
                  {selected.current_order_id ? ` · pedido ${selected.current_order_id}` : ''}
                  {selected.context_json?.profile_name ? ` · ${selected.context_json.profile_name}` : ''}
                </p>
              </div>
              <div className="apb-toolbar">
                <button
                  type="button"
                  className="apb-btn apb-btn--ghost"
                  onClick={async () => {
                    await setConversationMode(selected.id, 'human', profile?.id);
                    flash('Tomaste la conversación. El bot no responde.');
                    await loadList();
                  }}
                >
                  Tomar
                </button>
                <button
                  type="button"
                  className="apb-btn apb-btn--dark"
                  onClick={async () => {
                    await setConversationMode(selected.id, 'bot', null);
                    flash('Devuelto al bot.');
                    await loadList();
                  }}
                >
                  Devolver al bot
                </button>
              </div>
            </div>
            <div className="apb-chat__msgs">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`apb-bubble apb-bubble--${m.direction === 'incoming' ? 'in' : 'out'} apb-bubble--${m.sender_type}`}
                >
                  <p className="apb-bubble__meta">{m.sender_type}{m.intent ? ` · ${m.intent}` : ''}</p>
                  <p className="apb-bubble__text">{m.original_text}</p>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <form className="apb-chat__composer" onSubmit={onSend}>
              <textarea
                className="apb-textarea"
                style={{ minHeight: '4rem' }}
                placeholder="Escribe como humano…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit" className="apb-btn apb-btn--primary" disabled={loading || !draft.trim()}>
                Enviar
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
