/**
 * Alertas sonoras — Web Audio (sin archivos).
 * Repartidor: 1 campanada por pedido/ronda (loops=1).
 */

let sharedCtx = null;
let unlockBound = false;

function getAudioContext() {
  const AudioCtx = typeof window !== 'undefined'
    ? (window.AudioContext || window.webkitAudioContext)
    : null;
  if (!AudioCtx) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AudioCtx();
  }
  return sharedCtx;
}

/** Desbloquea audio en iOS/Android PWA (llamar en el primer toque). */
export async function unlockDriverAudio() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const buffer = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
    unlockBound = true;
    return true;
  } catch {
    return false;
  }
}

export function isDriverAudioUnlocked() {
  return unlockBound && sharedCtx && sharedCtx.state === 'running';
}

function scheduleTone(ctx, master, { freq, start, duration, type = 'sine', peak = 0.92 }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.04);
}

function scheduleBell(ctx, master, freq, start, duration = 0.55, peak = 0.95) {
  scheduleTone(ctx, master, { freq, start, duration, type: 'sine', peak });
  scheduleTone(ctx, master, { freq: freq * 2.01, start, duration: duration * 0.65, type: 'sine', peak: peak * 0.35 });
  scheduleTone(ctx, master, { freq: freq * 3.02, start, duration: duration * 0.4, type: 'triangle', peak: peak * 0.15 });
}

function playPattern(ctx, volume = 0.85) {
  const master = ctx.createGain();
  master.gain.setValueAtTime(volume, ctx.currentTime);
  master.connect(ctx.destination);

  const t = ctx.currentTime + 0.02;
  const gap = 0.11;
  const notes = [659.25, 783.99, 987.77, 1174.66];
  notes.forEach((freq, i) => {
    scheduleBell(ctx, master, freq, t + i * gap, 0.48, 0.98);
  });
  scheduleBell(ctx, master, 880, t + notes.length * gap + 0.06, 0.72, 1);
  scheduleBell(ctx, master, 1174.66, t + notes.length * gap + 0.18, 0.85, 1);
}

/** Alarma cocina / admin */
export function playNewOrderAlert() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const run = () => playPattern(ctx, 0.9);
    if (ctx.state === 'suspended') ctx.resume().then(run).catch(() => {});
    else run();
  } catch {
    /* ignore */
  }
}

/**
 * Alarma repartidor — por defecto 1 sola vez.
 * @returns {() => void} stop
 */
export function playDriverOrderAlarm({ loops = 1 } = {}) {
  let stopped = false;
  let timer = null;
  let count = 0;

  const stop = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const beat = async () => {
    if (stopped || count >= loops) {
      stop();
      return;
    }
    count += 1;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch { /* ignore */ }
      }
      playPattern(ctx, 1);
      if (count < loops) {
        timer = window.setTimeout(() => {
          if (!stopped) beat();
        }, 1600);
      } else {
        stop();
      }
    } catch {
      /* ignore */
    }
  };

  unlockDriverAudio().finally(() => {
    if (!stopped) beat();
  });

  return stop;
}

/** @deprecated Usar playNewOrderAlert */
export const playNewOrderBeep = playNewOrderAlert;
