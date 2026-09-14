import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ExternalLink,
  Smartphone,
  LogOut,
  Download,
  AlertTriangle,
  Battery,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  ensureDriverPushSubscription,
  setDriverAppBadge,
  clearDriverAppBadge,
  getDriverWebPushStatus,
  showLocalTrayTestNotification,
  hasVapidPublicKey,
  sendDriverSelfTestPush,
} from '../../services/pushService';
import { getMyDriverSummary, ensureMyDriverProfile, setMyOperationalStatus } from '../../services/driverService';
import { subscribeDispatch } from '../../services/dispatchService';
import {
  openNativeDriverApp,
  getDriverApkDownloadUrl,
  DRIVER_APP_VERSION_NAME,
} from '../../utils/driverNativeConstants';
import { unlockDriverAudio } from '../../utils/orderAlertSound';
import {
  isStandaloneDisplayMode,
} from '../../utils/pwa';
import {
  ensurePwaInstallListeners,
  promptPwaInstall,
} from '../../utils/pwaInstallBridge';

/**
 * App de clientes (PWA): solo avisos tipo WhatsApp en bandeja + badge.
 * Sin aceptar pedidos (eso es la APK nativa).
 */
export function DriverNotifyHome() {
  const { profile, signOut } = useAuth();
  const [pending, setPending] = useState(0);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [standalone, setStandalone] = useState(() => isStandaloneDisplayMode());

  const refresh = useCallback(async () => {
    try {
      await ensureMyDriverProfile().catch(() => {});
      const s = await getMyDriverSummary();
      const n = (s?.pendingOffers || []).length;
      setPending(n);
      if (n > 0) await setDriverAppBadge(n);
      else await clearDriverAppBadge();
    } catch {
      /* ignore */
    }
    try {
      const st = await getDriverWebPushStatus();
      setStatus(st);
      if (st?.ready) {
        await setMyOperationalStatus('available').catch(() => {});
      }
    } catch {
      setStatus({ ready: false, missingVapid: !hasVapidPublicKey() });
    }
    setStandalone(isStandaloneDisplayMode());
  }, []);

  useEffect(() => {
    ensurePwaInstallListeners();
    refresh();
    const unsub = subscribeDispatch(() => refresh());
    const t = setInterval(refresh, 8000);
    const onMsg = (event) => {
      if (event.data?.type === 'DRIVER_NEW_OFFER') {
        refresh();
        if (event.data?.fromClick) {
          setMsg('Abre la app nativa del repartidor para aceptar el pedido.');
        }
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onMsg);
    }
    return () => {
      unsub();
      clearInterval(t);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onMsg);
      }
    };
  }, [refresh]);

  const enablePush = async () => {
    setBusy('enable');
    setMsg('');
    try {
      if (!hasVapidPublicKey()) {
        throw new Error(
          'Falta configurar notificaciones push (VITE_VAPID_PUBLIC_KEY). Avisa al administrador.'
        );
      }
      await unlockDriverAudio();
      const res = await ensureDriverPushSubscription();
      if (res?.deferred && !res?.endpoint) {
        setMsg(res.warn || 'Permiso OK, pero la suscripción quedó pendiente. Pulsa de nuevo en unos segundos.');
      } else {
        await setMyOperationalStatus('available').catch(() => {});
        setMsg('Avisos activos. Te enviamos una prueba a la bandeja…');
        await showLocalTrayTestNotification({
          badgeCount: Math.max(1, pending),
        }).catch(() => {});
        setMsg('Listo. Los pedidos nuevos llegarán a la bandeja con internet (no necesitas GPS).');
      }
      await refresh();
    } catch (err) {
      setMsg(err.message || 'Activa las notificaciones en Ajustes del celular.');
      await refresh();
    } finally {
      setBusy('');
    }
  };

  const testTray = async () => {
    setBusy('test');
    setMsg('');
    try {
      const n = Math.max(1, pending || 1);
      // 1) Prueba local inmediata (bandeja)
      await showLocalTrayTestNotification({ badgeCount: n });
      // 2) Push real por servidor (igual que un pedido / reasignación)
      const remote = await sendDriverSelfTestPush().catch(() => null);
      await setDriverAppBadge(n);
      if (remote?.webSent > 0) {
        setMsg(
          'Listo. Minimiza la app y desliza desde arriba: debe aparecer el aviso. '
          + 'En el ícono del pollito (pantalla de inicio) debe verse el número.',
        );
      } else if (remote?.webConfigured === false) {
        setMsg('Prueba local OK, pero el servidor no tiene VAPID. Avisa al admin.');
      } else {
        setMsg(
          'Prueba local enviada a la bandeja. Si no ves aviso con la app cerrada, pulsa Reconectar avisos y revisa batería de Chrome.',
        );
      }
    } catch (err) {
      setMsg(err.message || 'No se pudo mostrar la prueba.');
    } finally {
      setBusy('');
    }
  };

  const installPwa = async () => {
    setBusy('install');
    try {
      const r = await promptPwaInstall();
      if (r?.outcome === 'accepted' || isStandaloneDisplayMode()) {
        setMsg('App instalada. Ahora activa las notificaciones.');
        setStandalone(true);
      } else {
        setMsg('Si no aparece el diálogo: menú de Chrome (⋮) → “Instalar aplicación” / “Agregar a pantalla de inicio”.');
      }
    } catch {
      setMsg('Usa Chrome → menú ⋮ → Instalar aplicación.');
    } finally {
      setBusy('');
      refresh();
    }
  };

  const name = profile?.fullName || profile?.full_name || 'Repartidor';
  const pushOk = Boolean(status?.ready);
  const missingVapid = Boolean(status?.missingVapid);

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-10">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="bg-black px-4 py-5 text-white">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">Avisos repartidor</p>
          <h1 className="mt-1 text-xl font-black">Bandeja tipo WhatsApp</h1>
          <p className="mt-1.5 text-sm text-white/70">
            Hola {name}. Esta app instalada solo te avisa pedidos nuevos en la bandeja
            (desliza desde arriba). Para aceptar y GPS usa la app nativa.
          </p>
        </div>

        <div className="space-y-3 px-4 py-4">
          {!standalone && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3">
              <p className="text-sm font-bold text-blue-950">1. Instala esta app en el celular</p>
              <p className="mt-0.5 text-xs text-blue-900/80">
                Sin instalar, Android casi no entrega avisos con la pantalla apagada.
                Usa Chrome y pulsa Instalar.
              </p>
              <button
                type="button"
                disabled={busy === 'install'}
                onClick={installPwa}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {busy === 'install' ? 'Abriendo…' : 'Instalar El Pollón'}
              </button>
            </div>
          )}

          {missingVapid && (
            <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Falta configurar VAPID en el servidor. Los avisos de bandeja no pueden activarse hasta que el admin lo corrija.
            </div>
          )}

          <div className={`flex gap-3 rounded-xl border px-3 py-3 ${pushOk ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${pushOk ? 'bg-emerald-500' : 'bg-pollon-red'} text-white`}>
              {pushOk ? <CheckCircle2 className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900">
                {pushOk ? '2. Avisos activos en bandeja' : '2. Activa las notificaciones'}
              </p>
              <p className="mt-0.5 text-xs text-gray-600">
                {pushOk
                  ? 'Suscripción guardada. Pedido nuevo → aviso arriba + número en el ícono.'
                  : 'Permite notificaciones. Así cada pedido llega como un mensaje de WhatsApp.'}
              </p>
              {status && (
                <p className="mt-1 text-[10px] font-medium text-gray-500">
                  Permiso: {status.permission || '—'}
                  {' · '}SW: {status.swActive ? 'OK' : 'pendiente'}
                  {' · '}Suscripción: {status.subscribed ? 'OK' : 'no'}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {!pushOk && (
                  <button
                    type="button"
                    disabled={Boolean(busy) || missingVapid}
                    onClick={enablePush}
                    className="rounded-xl bg-pollon-red px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {busy === 'enable' ? 'Activando…' : 'Activar notificaciones'}
                  </button>
                )}
                {(pushOk || status?.permission === 'granted') && (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={testTray}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-bold text-gray-800 disabled:opacity-50"
                  >
                    {busy === 'test' ? 'Enviando…' : 'Probar bandeja + ícono'}
                  </button>
                )}
                {pushOk && (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={enablePush}
                    className="rounded-xl border border-emerald-300 bg-white px-3 py-2.5 text-xs font-bold text-emerald-800 disabled:opacity-50"
                  >
                    Reconectar avisos
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
            <p className="text-sm font-bold text-gray-900">Dónde ver el aviso (como WhatsApp)</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-gray-600">
              <li>Desliza desde arriba → bandeja del sistema (pedido nuevo).</li>
              <li>En la pantalla de inicio → número rojo sobre el ícono del pollito.</li>
              <li>Aquí dentro de la app no mostramos ese número a propósito.</li>
            </ul>
            {pending > 0 && (
              <p className="mt-2 text-[11px] font-medium text-gray-500">
                Hay pedidos pendientes: el número va al ícono de inicio (no aquí).
              </p>
            )}
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
            <div className="flex items-start gap-2">
              <Battery className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
              <div>
                <p className="text-sm font-bold text-amber-950">3. Para que llegue el aviso web</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-xs text-amber-900/90">
                  <li>Internet (Wi‑Fi o datos)</li>
                  <li>Sesión de repartidor iniciada en esta app</li>
                  <li>Notificaciones Permitir (Chrome / El Pollón)</li>
                  <li>No hace falta GPS ni la app nativa para el aviso</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 px-3 py-3">
            <div className="flex items-start gap-2.5">
              <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-pollon-red" />
              <div>
                <p className="text-sm font-bold text-gray-900">4. Aceptar solo en app nativa</p>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-600">
                  Alarma + Aceptar/Rechazar + GPS vivo: APK repartidor v{DRIVER_APP_VERSION_NAME}.
                </p>
                <button
                  type="button"
                  onClick={() => openNativeDriverApp()}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-black px-3.5 py-2.5 text-sm font-bold text-white"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir app nativa
                </button>
                <a
                  href={getDriverApkDownloadUrl()}
                  className="mt-2 block text-xs font-semibold text-pollon-red underline"
                >
                  Descargar APK si no la tienes
                </a>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-gray-300 px-3 py-3 text-[11px] leading-relaxed text-gray-500">
            <p className="font-bold text-gray-700">Guía rápida (5 pasos)</p>
            <p className="mt-1">1) Instalar PWA · 2) Entrar con correo repartidor · 3) Activar avisos · 4) Batería sin límite · 5) Aceptar pedidos en la APK nativa.</p>
          </div>

          {msg && (
            <p className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700">{msg}</p>
          )}

          <button
            type="button"
            onClick={async () => {
              await clearDriverAppBadge();
              await signOut();
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 py-3 text-sm font-bold text-gray-700"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
