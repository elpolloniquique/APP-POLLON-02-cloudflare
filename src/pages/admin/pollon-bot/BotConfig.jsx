import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import {
  listSettings, settingsToMap, upsertSetting, SETTING_TEMPLATE_KEYS, isBotBackendReady,
} from '../../../services/botAdminService';
import { usePollonBot } from './PollonBotContext';

function asBool(v, fallback = true) {
  if (v === false || v === 'false') return false;
  if (v === true || v === 'true') return true;
  return fallback;
}

function greetingText(templates) {
  const g = templates?.greeting;
  if (Array.isArray(g)) return g.join('\n---\n');
  return String(g || '');
}

export function BotConfig() {
  const { effectiveBranch, profile, flash, setError, loading, setLoading, isSuper } = usePollonBot();
  const [form, setForm] = useState({
    bot_enabled: true,
    bot_name: 'Pollito',
    website_url: 'https://www.el-pollon.cl/',
    support_phone: '+56986925310',
    support_message: '',
    minimum_confidence: 0.8,
    rate_limit_per_min: 4,
    order_created_enabled: true,
    order_status_enabled: true,
    human_support_enabled: true,
    unknown_response: '',
    how_to_buy: '',
    evolution_instance: 'pollon-bot',
    greeting: '',
    templates: {},
  });

  const load = useCallback(async () => {
    if (!isBotBackendReady()) return;
    const rows = await listSettings(effectiveBranch);
    const map = settingsToMap(rows, effectiveBranch);
    const templates = (map.templates && typeof map.templates === 'object') ? map.templates : {};
    setForm({
      bot_enabled: asBool(map.bot_enabled, true),
      bot_name: map.bot_name || 'Pollito',
      website_url: map.website_url || 'https://www.el-pollon.cl/',
      support_phone: map.support_phone || '',
      support_message: map.support_message || '',
      minimum_confidence: Number(map.minimum_confidence) || 0.8,
      rate_limit_per_min: Number(map.rate_limit_per_min) || 4,
      order_created_enabled: asBool(map.order_created_enabled, true),
      order_status_enabled: asBool(map.order_status_enabled, true),
      human_support_enabled: asBool(map.human_support_enabled, true),
      unknown_response: map.unknown_response || '',
      how_to_buy: map.how_to_buy || '',
      evolution_instance: map.evolution_instance || 'pollon-bot',
      greeting: greetingText(templates),
      templates,
    });
  }, [effectiveBranch]);

  useEffect(() => { load().catch((err) => setError(err.message)); }, [load, setError]);

  async function saveKey(key, value) {
    await upsertSetting({ key, value, branchId: effectiveBranch, profileId: profile?.id });
  }

  async function onSave(e) {
    e?.preventDefault?.();
    setLoading(true);
    setError('');
    try {
      const templates = {
        ...(form.templates || {}),
        greeting: form.greeting.split(/\n---\n/).map((s) => s.trim()).filter(Boolean),
      };
      for (const k of SETTING_TEMPLATE_KEYS) {
        if (form.templates?.[k] != null) templates[k] = form.templates[k];
      }
      await Promise.all([
        saveKey('bot_enabled', form.bot_enabled),
        saveKey('bot_name', form.bot_name),
        saveKey('website_url', form.website_url),
        saveKey('support_phone', form.support_phone),
        saveKey('support_message', form.support_message),
        saveKey('minimum_confidence', Number(form.minimum_confidence) || 0.8),
        saveKey('rate_limit_per_min', Number(form.rate_limit_per_min) || 4),
        saveKey('order_created_enabled', form.order_created_enabled),
        saveKey('order_status_enabled', form.order_status_enabled),
        saveKey('human_support_enabled', form.human_support_enabled),
        saveKey('unknown_response', form.unknown_response),
        saveKey('how_to_buy', form.how_to_buy),
        saveKey('evolution_instance', form.evolution_instance),
        saveKey('templates', templates),
      ]);
      flash(effectiveBranch ? 'Config de sucursal guardada.' : 'Config global guardada. El bot la lee al instante.');
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  function setTpl(key, value) {
    setForm((prev) => ({ ...prev, templates: { ...prev.templates, [key]: value } }));
  }

  return (
    <form className="apb-form apb-config" onSubmit={onSave}>
      <section className="apb-card">
        <h3 className="apb-row__title">General {isSuper && !effectiveBranch ? '(global)' : ''}</h3>
        <p className="apb-hint">Nada crítico queda hardcodeado: todo vive en `bot_settings`.</p>
        <label className="apb-label" style={{ display: 'flex', gap: '0.4rem', textTransform: 'none' }}>
          <input type="checkbox" checked={form.bot_enabled} onChange={(e) => setForm({ ...form, bot_enabled: e.target.checked })} /> Bot activo
        </label>
        <label className="apb-label">Nombre del bot</label>
        <input className="apb-input" value={form.bot_name} onChange={(e) => setForm({ ...form, bot_name: e.target.value })} />
        <label className="apb-label">Sitio web</label>
        <input className="apb-input" value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} />
        <label className="apb-label">Teléfono soporte</label>
        <input className="apb-input" value={form.support_phone} onChange={(e) => setForm({ ...form, support_phone: e.target.value })} />
        <label className="apb-label">Mensaje de soporte</label>
        <textarea className="apb-textarea" style={{ minHeight: '4rem' }} value={form.support_message} onChange={(e) => setForm({ ...form, support_message: e.target.value })} />
        <label className="apb-label">Umbral de confianza (0–1)</label>
        <input className="apb-input" type="number" step="0.05" min="0" max="1" value={form.minimum_confidence} onChange={(e) => setForm({ ...form, minimum_confidence: e.target.value })} />
        <label className="apb-label">Rate limit (msgs/min)</label>
        <input className="apb-input" type="number" min="1" max="20" value={form.rate_limit_per_min} onChange={(e) => setForm({ ...form, rate_limit_per_min: e.target.value })} />
        <label className="apb-label">Instancia Evolution</label>
        <input className="apb-input" value={form.evolution_instance} onChange={(e) => setForm({ ...form, evolution_instance: e.target.value })} />
        <label className="apb-label" style={{ display: 'flex', gap: '0.4rem', textTransform: 'none' }}>
          <input type="checkbox" checked={form.order_created_enabled} onChange={(e) => setForm({ ...form, order_created_enabled: e.target.checked })} /> Aviso pedido nuevo
        </label>
        <label className="apb-label" style={{ display: 'flex', gap: '0.4rem', textTransform: 'none' }}>
          <input type="checkbox" checked={form.order_status_enabled} onChange={(e) => setForm({ ...form, order_status_enabled: e.target.checked })} /> Avisos de estado
        </label>
        <label className="apb-label" style={{ display: 'flex', gap: '0.4rem', textTransform: 'none' }}>
          <input type="checkbox" checked={form.human_support_enabled} onChange={(e) => setForm({ ...form, human_support_enabled: e.target.checked })} /> Permitir derivar a humano
        </label>
      </section>

      <section className="apb-card">
        <h3 className="apb-row__title">Textos del bot</h3>
        <label className="apb-label">Cómo comprar</label>
        <textarea className="apb-textarea" value={form.how_to_buy} onChange={(e) => setForm({ ...form, how_to_buy: e.target.value })} />
        <label className="apb-label">Respuesta si no entiende</label>
        <textarea className="apb-textarea" value={form.unknown_response} onChange={(e) => setForm({ ...form, unknown_response: e.target.value })} />
        <label className="apb-label">Saludos (separa variantes con ---)</label>
        <textarea className="apb-textarea" value={form.greeting} onChange={(e) => setForm({ ...form, greeting: e.target.value })} />
        {SETTING_TEMPLATE_KEYS.map((key) => (
          <div key={key}>
            <label className="apb-label">{key}</label>
            <textarea
              className="apb-textarea"
              style={{ minHeight: '4.2rem' }}
              value={form.templates?.[key] || ''}
              onChange={(e) => setTpl(key, e.target.value)}
            />
          </div>
        ))}
        <button type="submit" className="apb-btn apb-btn--primary" disabled={loading}><Save className="h-4 w-4" /> Guardar configuración</button>
      </section>
    </form>
  );
}
