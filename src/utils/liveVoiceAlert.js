/**
 * Alerta de voz en vivo (Web Speech API) — cola secuencial, es-CL.
 * Voz clara / nítida (pitch más agudo), volumen y velocidad configurables.
 */

const STORAGE_KEY = 'ep_live_voice_alert_on';

export function loadVoiceAlertEnabled() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v == null) return true;
    return v === '1' || v === 'true';
  } catch {
    return true;
  }
}

export function saveVoiceAlertEnabled(on) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function firstName(fullName) {
  const n = String(fullName || 'Repartidor').trim();
  return n.split(/\s+/)[0] || 'Repartidor';
}

/** Resume items de un pedido en frase corta para TTS */
export function summarizeOrderItems(items = []) {
  if (!items.length) return 'pedido sin detalle';
  return items
    .map((it) => {
      const name = String(it.name || '').trim();
      const qty = Number(it.qty) || 1;
      return qty > 1 ? `${qty} ${name}` : name;
    })
    .filter(Boolean)
    .join(' y ');
}

/**
 * "Repartidor Akiles llega en 5 minutos. Pedido 01, Oferta…. Pedido 02, …"
 */
export function buildApproachingSpeech({ driverName, etaMin = 5, orders = [] }) {
  const name = firstName(driverName);
  const mins = Math.max(1, Math.round(Number(etaMin) || 5));
  const parts = [`Repartidor ${name} llega en ${mins} minutos`];
  if (!orders.length) {
    parts.push('con pedidos pendientes de recojo');
  } else {
    orders.forEach((o, i) => {
      const num = String(o.index ?? i + 1).padStart(2, '0');
      const detail = summarizeOrderItems(o.items);
      parts.push(`Pedido ${num}, ${detail}`);
    });
  }
  return `${parts.join('. ')}.`;
}

/** "Repartidor Akiles llegó, tiene 3 pedidos." */
export function buildArrivedSpeech({ driverName, orderCount }) {
  const name = firstName(driverName);
  const n = Math.max(0, Number(orderCount) || 0);
  const label = n === 1 ? '1 pedido' : `${n} pedidos`;
  return `Repartidor ${name} llegó, tiene ${label}.`;
}

/** Firma estable del viaje (cambia si acepta nuevos pedidos) */
export function tripSignature(driverId, assignmentIds = []) {
  const ids = [...assignmentIds].map(String).sort().join(',');
  return `${driverId}:${ids}`;
}

let queue = Promise.resolve();

/** Algunos navegadores exigen un gesto del usuario antes de hablar */
export function unlockSpeech() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    const warm = new SpeechSynthesisUtterance(' ');
    warm.volume = 0;
    warm.lang = 'es-CL';
    window.speechSynthesis.speak(warm);
  } catch {
    /* ignore */
  }
}

/**
 * Prefiere voces en español claras (femeninas / nítidas) sobre tonos graves.
 */
export function pickClearSpanishVoice() {
  try {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    if (!voices.length) return null;

    const score = (v) => {
      const label = `${v.name || ''} ${v.lang || ''}`;
      let s = 0;
      if (/^es/i.test(v.lang)) s += 10;
      if (/es(-|_)CL/i.test(v.lang)) s += 8;
      if (/es(-|_)MX/i.test(v.lang)) s += 6;
      if (/es(-|_)ES/i.test(v.lang)) s += 5;
      // Voces típicamente más claras / menos “gruesas”
      if (/sabina|paulina|helena|luc[ií]a|elena|m[oó]nica|dalia|paloma|google.*espa[nñ]ol/i.test(label)) s += 12;
      if (/female|femen|mujer|woman/i.test(label)) s += 8;
      if (/male|hombre|david|jorge|pablo|raul|jorge/i.test(label)) s -= 6;
      if (/premium|enhanced|neural|natural/i.test(label)) s += 3;
      return s;
    };

    return [...voices].sort((a, b) => score(b) - score(a))[0] || null;
  } catch {
    return null;
  }
}

export function normalizeSpeechOptions(opts = {}) {
  const volPct = Number(opts.volume);
  const rate = Number(opts.rate);
  const pitch = Number(opts.pitch);
  return {
    // Web Speech volume 0–1
    volume: Math.min(1, Math.max(0.2, Number.isFinite(volPct)
      ? (volPct > 1 ? volPct / 100 : volPct)
      : 1)),
    rate: Math.min(1.4, Math.max(0.7, Number.isFinite(rate) ? rate : 1)),
    // Pitch > 1 = más agudo / “delgado” / nítido
    pitch: Math.min(1.6, Math.max(0.8, Number.isFinite(pitch) ? pitch : 1.25)),
  };
}

/**
 * Encola una frase; se reproducen en orden (varios repartidores).
 * @param {string} text
 * @param {{ volume?: number, rate?: number, pitch?: number }} [opts]
 *   volume: 0–1 o 0–100; rate ~0.7–1.4; pitch ~0.8–1.6 (más alto = más nítido)
 * @returns {Promise<void>}
 */
export function speakAlert(text, opts = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return Promise.resolve();
  }
  const phrase = String(text || '').trim();
  if (!phrase) return Promise.resolve();

  const speech = normalizeSpeechOptions(opts);

  queue = queue.then(() => new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(phrase);
    utter.lang = 'es-CL';
    utter.rate = speech.rate;
    utter.pitch = speech.pitch;
    utter.volume = speech.volume;
    const voice = pickClearSpanishVoice();
    if (voice) {
      utter.voice = voice;
      if (voice.lang) utter.lang = voice.lang;
    }

    const done = () => resolve();
    utter.onend = done;
    utter.onerror = done;

    try {
      // Chrome a veces necesita getVoices() ya cargado
      window.speechSynthesis.getVoices();
      window.speechSynthesis.speak(utter);
    } catch {
      done();
    }
  })).catch(() => {});

  return queue;
}

export function stopVoiceAlerts() {
  queue = Promise.resolve();
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

export function isSpeechSupported() {
  return typeof window !== 'undefined' && !!window.speechSynthesis;
}
