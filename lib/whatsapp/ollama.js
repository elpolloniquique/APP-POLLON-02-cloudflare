/**
 * Ollama 100% local (Fase 2). OFF por defecto.
 * Nunca inventa precios: solo reescribe fallback con hechos reales.
 * Vercel no puede hablar con localhost: OLLAMA_URL debe ser alcanzable
 * (misma VM que Evolution, IP pública o túnel).
 */
import { env } from './supabaseAdmin.js';

export function ollamaUrl() {
  return String(env('OLLAMA_URL') || '').replace(/\/+$/, '');
}

export function ollamaConfigured() {
  return Boolean(ollamaUrl());
}

export function defaultOllamaModel() {
  return env('OLLAMA_MODEL') || 'llama3.2';
}

const SYSTEM = `Eres el anfitrión de WhatsApp de Pollería El Pollón (Chile).
Reglas INQUEBRANTABLES:
- Responde en español chileno, cálido, corto (máx. 8 líneas).
- NUNCA inventes precios, platos, horarios, stock ni tarifas de delivery.
- NUNCA armes un pedido ni pidas cobro/transferencia por chat. La venta es en la web.
- Usa SOLO los HECHOS del usuario (sucursal, horario, menú con precios, links).
- Si no está en los hechos: dilo y ofrece menú, horario, estado de pedido o pasar a una persona.
- No digas que eres una IA salvo que te lo pregunten.
- Emojis con medida: 🍗 ✅ 📍 🛵 🙏`;

function menuFacts(products, limit = 18) {
  return (products || []).slice(0, limit).map((p) => {
    const old = p.oldPrice ? ` (antes ${p.oldPrice})` : '';
    return `- ${p.name}: ${p.price}${old}`;
  }).join('\n');
}

export function buildOllamaUserPrompt({ text, branch, settings, products, fallback, loyalty }) {
  const openHint = branch ? `${branch.name} · ${branch.city || ''} · horario ${branch.schedule || 'n/d'}` : '';
  return `HECHOS DE LA SUCURSAL:
${openHint}
Link web: ${settings?.link_web || 'https://www.el-pollon.cl/'}
Fidelización (si aplica): ${loyalty?.text || 'ninguna'}

MENÚ DISPONIBLE (precios reales, no inventes otros):
${menuFacts(products) || '(sin menú cargado)'}

MENSAJE DEL CLIENTE:
${String(text || '').slice(0, 500)}

RESPUESTA BASE DEL SISTEMA (puedes suavizar el tono, no cambies hechos ni precios):
${fallback}

Escribe SOLO el mensaje final para WhatsApp.`;
}

/**
 * @returns {Promise<{ ok: boolean, text?: string, error?: string, model?: string }>}
 */
export async function ollamaChat({ prompt, model, timeoutMs = 6500 }) {
  const base = ollamaUrl();
  if (!base) return { ok: false, error: 'OLLAMA_URL no configurado' };

  const mdl = model || defaultOllamaModel();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: mdl,
        stream: false,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: prompt },
        ],
        options: { temperature: 0.25, num_predict: 220 },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json?.error || `Ollama ${res.status}`, model: mdl };
    }
    const text = String(json?.message?.content || json?.response || '').trim();
    if (!text) return { ok: false, error: 'Ollama sin texto', model: mdl };
    return { ok: true, text, model: mdl };
  } catch (err) {
    const msg = err?.name === 'AbortError' ? 'timeout' : (err?.message || String(err));
    return { ok: false, error: msg, model: mdl };
  } finally {
    clearTimeout(timer);
  }
}

export async function pingOllama(model) {
  const base = ollamaUrl();
  if (!base) return { ok: false, configured: false, error: 'Falta OLLAMA_URL' };
  const r = await ollamaChat({
    prompt: 'Responde exactamente: OK Pollón',
    model,
    timeoutMs: 5000,
  });
  return { ...r, configured: true, urlHost: (() => { try { return new URL(base).host; } catch { return base; } })() };
}
