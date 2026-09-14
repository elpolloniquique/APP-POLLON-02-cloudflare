import { useCallback, useEffect, useState } from 'react';
import { Bell, MapPin, Smartphone, Share, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  isStandaloneDisplayMode,
  isIosSafari,
  isAndroidChrome,
} from '../../utils/pwa';
import {
  checkDriverReadyPermissions,
  ensureDriverPushSubscription,
  isPushConfigured,
  requestGpsFix,
} from '../../services/pushService';
import {
  isNativeDriverApp,
  requestAlwaysLocationPermission,
  openNativeLocationSettings,
} from '../../services/backgroundGpsService';
import { unlockDriverAudio } from '../../utils/orderAlertSound';

/**
 * Onboarding obligatorio: instalar app + notificaciones + GPS (Siempre en nativo).
 * Sin esto el repartidor no puede ponerse Disponible.
 */
export function DriverPermissionsGate({ onReadyChange }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [gpsOk, setGpsOk] = useState(false);
  const native = isNativeDriverApp();
  const installed = isStandaloneDisplayMode() || native;
  const ios = isIosSafari();
  const android = isAndroidChrome();

  const refresh = useCallback(async () => {
    const s = await checkDriverReadyPermissions();
    setStatus(s);
    if (s.geoGranted) setGpsOk(true);
    return s;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (status?.notificationsGranted && !status?.hasPushSubscription && isPushConfigured()) {
      ensureDriverPushSubscription()
        .then(() => refresh())
        .catch(() => {});
    }
  }, [status?.notificationsGranted, status?.hasPushSubscription, refresh]);

  const enableNotifications = async () => {
    setBusy(true);
    setMsg('');
    try {
      await unlockDriverAudio();
      const res = await ensureDriverPushSubscription();
      if (res?.localOnly || res?.nativeLocal) {
        setMsg(
          native
            ? 'Listo. En la app Android recibirás los pedidos aquí (alarma + tarjeta). Mantén la sesión iniciada.'
            : 'Notificaciones locales activadas.'
        );
      } else {
        setMsg('Notificaciones activadas.');
      }
      await refresh();
    } catch (err) {
      setMsg(err.message || 'No se pudieron activar las notificaciones');
    } finally {
      setBusy(false);
    }
  };

  const enableGps = async () => {
    setBusy(true);
    setMsg('');
    try {
      await unlockDriverAudio();
      if (native) {
        const res = await requestAlwaysLocationPermission();
        if (!res.ok) throw new Error(res.error || 'GPS denegado');
        setGpsOk(true);
        if (res.needsSettings) {
          setMsg(
            'GPS activado. Para que el local te vea con la pantalla apagada, en Ajustes elige ubicación “Siempre” / “Permitir todo el tiempo”.'
          );
        } else {
          setMsg('GPS “Siempre” listo. Al aceptar un pedido se rastrea aunque salgas de la app.');
        }
      } else {
        const res = await requestGpsFix();
        if (!res.ok) throw new Error(res.error || 'GPS denegado');
        setGpsOk(true);
        setMsg('GPS activado. Para seguimiento con pantalla apagada usa la app Android de El Pollón.');
      }
      await refresh();
    } catch (err) {
      setGpsOk(false);
      setMsg(err.message || 'Activa la ubicación del celular');
    } finally {
      setBusy(false);
    }
  };

  const notifOk = Boolean(
    status?.notificationsGranted
    && (status?.hasPushSubscription || !status?.pushConfigured || native)
  );
  const installOk = installed || (!ios && !android) || native;
  const mustInstall = !native && (ios || android) && !installed;
  const allReady = Boolean(notifOk && gpsOk && !mustInstall);

  useEffect(() => {
    onReadyChange?.(allReady);
  }, [allReady, onReadyChange]);

  if (allReady) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-bold">Listo para trabajar</p>
          <p className="text-xs opacity-90">
            {native
              ? 'Notificaciones y GPS listos. Al aceptar un pedido se activa el rastreo en segundo plano.'
              : 'Notificaciones y GPS activos. Ya puedes pulsar Disponible.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
      <div className="border-b border-amber-100 bg-amber-50 px-3.5 py-3">
        <p className="text-sm font-bold text-amber-900">Activa permisos obligatorios</p>
        <p className="mt-0.5 text-xs text-amber-800/90">
          Sin esto no puedes ponerte Disponible ni recibir pedidos con la pantalla apagada.
        </p>
      </div>

      <ol className="space-y-3 px-3.5 py-3.5">
        <li className="flex gap-3">
          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${installOk ? 'bg-emerald-500 text-white' : 'bg-pollon-red text-white'}`}>
            <Smartphone className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">1. Instalar la app</p>
            {native ? (
              <p className="text-xs text-emerald-700">App nativa El Pollón ✓</p>
            ) : installed ? (
              <p className="text-xs text-emerald-700">App instalada ✓</p>
            ) : ios ? (
              <p className="mt-1 text-xs leading-relaxed text-gray-600">
                En iPhone: toca <Share className="inline h-3.5 w-3.5" /> Compartir → <strong>Agregar a pantalla de inicio</strong>.
                Luego ábrela desde el ícono (no desde Safari).
              </p>
            ) : android ? (
              <p className="mt-1 text-xs leading-relaxed text-gray-600">
                En Android: instala la <strong>APK de El Pollón</strong> (GPS con pantalla apagada) o menú ⋮ → Instalar app.
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-600">En PC puedes continuar; en el celular del repartidor sí debes instalarla.</p>
            )}
          </div>
        </li>

        <li className="flex gap-3">
          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${notifOk ? 'bg-emerald-500 text-white' : 'bg-pollon-red text-white'}`}>
            <Bell className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">2. Notificaciones del sistema</p>
            <p className="mt-0.5 text-xs text-gray-600">
              Como WhatsApp: llegan a la bandeja aunque la pantalla esté apagada.
            </p>
            {!notifOk && (
              <button
                type="button"
                disabled={busy}
                onClick={enableNotifications}
                className="mt-2 rounded-xl bg-pollon-red px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                Activar notificaciones
              </button>
            )}
            {notifOk && <p className="mt-1 text-xs font-semibold text-emerald-700">Activadas ✓</p>}
          </div>
        </li>

        <li className="flex gap-3">
          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${gpsOk ? 'bg-emerald-500 text-white' : 'bg-pollon-red text-white'}`}>
            <MapPin className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">
              3. GPS {native ? '“Siempre” / segundo plano' : '/ ubicación en vivo'}
            </p>
            <p className="mt-0.5 text-xs text-gray-600">
              {native
                ? 'Elige “Permitir todo el tiempo” o “Siempre” para que el local te vea hasta Entregado, aunque salgas de la app.'
                : 'Obligatoria para que el local vea tu ubicación al llevar pedidos.'}
            </p>
            {!gpsOk && (
              <button
                type="button"
                disabled={busy}
                onClick={enableGps}
                className="mt-2 rounded-xl bg-pollon-red px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {native ? 'Activar GPS Siempre' : 'Activar GPS'}
              </button>
            )}
            {gpsOk && <p className="mt-1 text-xs font-semibold text-emerald-700">GPS listo ✓</p>}
            {native && (
              <button
                type="button"
                disabled={busy}
                onClick={() => openNativeLocationSettings()}
                className="mt-2 block text-xs font-semibold text-pollon-red underline"
              >
                Abrir ajustes de ubicación
              </button>
            )}
          </div>
        </li>
      </ol>

      {msg && (
        <div className={`mx-3.5 mb-3.5 flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${
          msg.includes('listo') || msg.includes('activadas') || msg.includes('activado')
            ? 'bg-emerald-50 text-emerald-800'
            : 'bg-red-50 text-red-700'
        }`}>
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{msg}</span>
        </div>
      )}
    </div>
  );
}
