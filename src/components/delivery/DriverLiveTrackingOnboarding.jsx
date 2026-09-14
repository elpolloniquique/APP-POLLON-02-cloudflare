import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  MapPin,
  CheckCircle2,
  Settings,
  Radio,
  Battery,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { unlockDriverAudio } from '../../utils/orderAlertSound';
import {
  evaluateDriverLiveTrackingReady,
  completeDriverLiveTrackingSetup,
  markDriverOnboardingComplete,
} from '../../services/driverOnboardingService';
import { ensureNativePushRegistration, markNativeNotifOk, kickoffNativePushRegistration } from '../../services/fcmService';
import {
  ensureDriverPushSubscription,
  hasVapidPublicKey,
  getDriverWebPushStatus,
} from '../../services/pushService';
import {
  openNativeLocationSettings,
  openNativeAppSettings,
  requestAlwaysLocationPermission,
  checkLocationPermissionSnapshot,
  isNativeDriverApp,
} from '../../services/backgroundGpsService';
import { isDriverRole } from '../../services/authService';
import {
  DRIVER_APP_VERSION_NAME,
  DRIVER_APP_VERSION_CODE,
  getDriverApkDownloadUrl,
} from '../../utils/driverNativeConstants';
import '../../styles/driver-native.css';

/**
 * Onboarding repartidor: notificaciones + GPS, luego panel.
 * PWA de clientes y APK nativa (mismo correo).
 */
export function DriverLiveTrackingOnboarding({ onReadyChange }) {
  const { user, profile, role } = useAuth();
  const userId = user?.id || profile?.id || 'anon';
  const driverRole = isDriverRole(role || profile?.rol || profile?.role);

  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [stepBusy, setStepBusy] = useState('');

  const refresh = useCallback(async () => {
    try {
      const s = await evaluateDriverLiveTrackingReady(userId);
      setState(s);
      onReadyChange?.(s.ready);
      if (s.ready) {
        markDriverOnboardingComplete(userId, { alwaysOk: s.alwaysOk, pushOk: s.notifOk });
      }
      return s;
    } catch (err) {
      console.warn('[Pollón][DriverNative] onboarding evaluate:', err);
      setState({
        ready: false,
        installed: true,
        needsInstall: false,
        mustNative: false,
        native: isNativeDriverApp(),
        notifOk: false,
        gpsOk: false,
        apkUrl: getDriverApkDownloadUrl(),
        versionName: DRIVER_APP_VERSION_NAME,
        versionCode: DRIVER_APP_VERSION_CODE,
      });
      onReadyChange?.(false);
      return null;
    }
  }, [userId, onReadyChange]);

  useEffect(() => {
    if (!driverRole) {
      onReadyChange?.(true);
      return undefined;
    }
    let cancelled = false;
    refresh();
    const onVis = () => {
      if (document.visibilityState === 'visible' && !cancelled) refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refresh, driverRole, onReadyChange]);

  if (!driverRole) return null;

  const runNotif = async () => {
    setStepBusy('notif');
    setMsg('Si Android muestra el diálogo, toca Permitir…');
    // Auto-liberar el botón sí o sí (evita “Espera…” eterno en v1.2.2 y OEM rotos)
    const unlockBtn = setTimeout(() => setStepBusy(''), 3500);
    try {
      if (isNativeDriverApp()) {
        const res = await Promise.race([
          ensureNativePushRegistration(),
          new Promise((resolve) => setTimeout(() => resolve({ softTimeout: true }), 3000)),
        ]);
        markNativeNotifOk();
        kickoffNativePushRegistration();
        if (res?.reason === 'denied' && !res?.softTimeout && res?.permission?.receive === 'denied') {
          setMsg('Notificaciones bloqueadas. Ábrelas en Ajustes o pulsa “Ya las activé”.');
        } else if (res?.ok || res?.permissionGranted) {
          setMsg(res.token ? 'Notificaciones listas.' : 'Permiso OK. El aviso push se completa en segundo plano.');
        } else {
          setMsg('Si no viste el diálogo: Ajustes → El Pollón → Notificaciones → Activar, luego “Ya las activé”.');
        }
      } else {
        if (!hasVapidPublicKey()) {
          setMsg('Falta configurar VAPID en el servidor. Los avisos de bandeja no pueden activarse.');
          await refresh();
          return;
        }
        const res = await Promise.race([
          ensureDriverPushSubscription(),
          new Promise((resolve) => setTimeout(() => resolve({ softTimeout: true }), 8000)),
        ]);
        const st = await getDriverWebPushStatus().catch(() => null);
        if (st?.ready || res?.endpoint) {
          setMsg('Avisos activos. Pedido nuevo → bandeja del sistema (tipo WhatsApp).');
        } else if (res?.deferred) {
          setMsg(res.warn || 'Permiso OK, pero la suscripción quedó pendiente. Pulsa de nuevo en unos segundos.');
        } else if (res?.softTimeout) {
          setMsg('Sigue activando… Si no aparece el diálogo: Ajustes → Chrome → Notificaciones.');
        } else if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
          setMsg('Notificaciones bloqueadas. Ajustes → Chrome / El Pollón → Notificaciones → Permitir.');
        } else {
          setMsg('Permite las notificaciones cuando Android lo pida.');
        }
      }
      await refresh();
    } catch (err) {
      if (isNativeDriverApp()) markNativeNotifOk();
      setMsg(err.message || 'Revisa notificaciones en Ajustes y pulsa “Ya las activé”.');
      await refresh();
    } finally {
      clearTimeout(unlockBtn);
      setStepBusy('');
    }
  };

  const confirmNotifManual = async () => {
    try {
      localStorage.setItem(`pollon_driver_notif_confirmed_${userId}`, '1');
    } catch {
      /* ignore */
    }
    markNativeNotifOk();
    if (isNativeDriverApp()) kickoffNativePushRegistration();
    else void ensureDriverPushSubscription().catch(() => {});
    setMsg('Notificaciones confirmadas. Puedes entrar al panel.');
    await refresh();
  };

  const runGps = async () => {
    setStepBusy('gps');
    setMsg('');
    try {
      await unlockDriverAudio();
      const res = await requestAlwaysLocationPermission();
      if (!res.ok) throw new Error(res.error || 'GPS denegado');
      if (isNativeDriverApp() && !res.alwaysOk) {
        setMsg('Casi listo: Ajustes → El Pollón → Ubicación → “Permitir todo el tiempo”.');
      } else {
        setMsg(isNativeDriverApp() ? 'Ubicación “Siempre” autorizada.' : 'Ubicación autorizada.');
      }
      await refresh();
    } catch (err) {
      setMsg(err.message || 'Activa la ubicación del celular');
    } finally {
      setStepBusy('');
    }
  };

  const confirmAlwaysManual = async () => {
    try {
      localStorage.setItem(`pollon_driver_always_confirmed_${userId}`, '1');
    } catch {
      /* ignore */
    }
    setMsg('Confirmado. Verificando…');
    await refresh();
  };

  const verifyAfterSettings = async () => {
    setStepBusy('verify');
    setMsg('');
    try {
      const snap = await checkLocationPermissionSnapshot();
      if (isNativeDriverApp() && !snap.alwaysOk) {
        setMsg('Aún no está en “Siempre”. Ábrelo en Ajustes o confirma si ya lo cambiaste.');
        await refresh();
        return;
      }
      const done = await completeDriverLiveTrackingSetup(userId);
      if (!done.ok) throw new Error(done.error || 'No completado');
      setMsg('Listo. Ya puedes recibir pedidos.');
      await refresh();
    } catch (err) {
      setMsg(err.message || 'Verifica el permiso e inténtalo de nuevo');
    } finally {
      setStepBusy('');
    }
  };

  const finishAll = async () => {
    setBusy(true);
    setMsg('');
    try {
      await unlockDriverAudio();
      const done = await completeDriverLiveTrackingSetup(userId);
      if (!done.ok) setMsg(done.error || 'Completa los pasos');
      else setMsg('Configuración completa.');
      await refresh();
    } catch (err) {
      setMsg(err.message || 'Error al completar');
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return (
      <div className="driver-native-gate">
        <p className="driver-native-gate__loading">Verificando cuenta de repartidor…</p>
        <button
          type="button"
          className="driver-native-gate__cta"
          style={{ marginTop: 16, maxWidth: 280 }}
          onClick={() => refresh()}
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (state.ready) return null;

  const native = isNativeDriverApp();
  const steps = [
    {
      id: 'notif',
      ok: state.notifOk,
      icon: Bell,
      title: 'Notificaciones',
      body: native
        ? 'Permiso del sistema para avisos de pedido nuevo (bandeja, con pantalla apagada).'
        : 'Avisos en la bandeja tipo WhatsApp, con detalle del pedido y número en el ícono. Aquí no se aceptan pedidos.',
      action: runNotif,
      actionLabel: 'Activar notificaciones',
    },
  ];
  if (native) {
    steps.push({
      id: 'gps',
      ok: state.gpsOk,
      icon: MapPin,
      title: 'Ubicación · Permitir todo el tiempo',
      body: 'Obligatorio “Siempre”. Acepta también “Sin restricciones de batería” para no perder el GPS al apagar la pantalla o abrir otra app.',
      action: runGps,
      actionLabel: 'Autorizar ubicación',
    });
  }

  return (
    <div className="driver-native-gate driver-native-gate--onboard">
      <div className="driver-native-gate__card">
        <img src="/img/logo pollon.png" alt="" className="driver-native-gate__logo driver-native-gate__logo--sm" />
        <p className="driver-native-gate__brand">EL POLLÓN</p>
        <p className="driver-native-gate__badge">
          {native ? 'Configuración obligatoria' : 'Avisos de pedidos'}
        </p>
        <h1 className="driver-native-gate__title">
          {native ? 'Listo para salir a ruta' : 'Activa notificaciones'}
        </h1>
        <p className="driver-native-gate__lead">
          {native
            ? `App nativa · v${state.versionName || DRIVER_APP_VERSION_NAME}`
            : 'App de clientes · solo bandeja (tipo WhatsApp)'}
          {state.evaluateTimedOut ? ' · (reintento de permisos disponible)' : ''}
        </p>

        {!native && !hasVapidPublicKey() && (
          <div className="driver-native-gate__hint" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>
            <p>
              Falta VITE_VAPID_PUBLIC_KEY en el build. No se pueden activar avisos de bandeja hasta que el admin lo corrija y redespliegue.
            </p>
          </div>
        )}

        <div className="driver-native-gate__hint">
          <Radio className="h-4 w-4 shrink-0" />
          <p>
            {native
              ? 'Al conectar Disponible, el local verá tu GPS en vivo. Completa notificaciones y ubicación “Siempre”.'
              : 'Con la sesión de repartidor, cada pedido nuevo llega a la bandeja. Para aceptar usa la app nativa.'}
          </p>
        </div>

        <ol className="driver-native-steps">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            return (
              <li key={s.id} className={`driver-native-step ${s.ok ? 'is-ok' : ''}`}>
                <span className="driver-native-step__icon">
                  {s.ok ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="driver-native-step__title">{idx + 1}. {s.title}</p>
                  <p className="driver-native-step__body">{s.body}</p>
                  {!s.ok && s.id === 'notif' && (
                    <>
                      <button
                        type="button"
                        className="driver-native-step__btn"
                        disabled={stepBusy === 'notif' || busy || (!native && !hasVapidPublicKey())}
                        onClick={s.action}
                      >
                        {stepBusy === s.id ? 'Espera…' : s.actionLabel}
                      </button>
                      <div className="driver-native-gate__oem-actions" style={{ marginTop: 10 }}>
                        {native && (
                          <button type="button" onClick={() => openNativeAppSettings()}>
                            Abrir ajustes
                          </button>
                        )}
                        <button type="button" onClick={confirmNotifManual}>
                          Ya las activé
                        </button>
                      </div>
                    </>
                  )}
                  {!s.ok && s.id !== 'notif' && (
                    <button
                      type="button"
                      className="driver-native-step__btn"
                      disabled={Boolean(stepBusy) || busy}
                      onClick={s.action}
                    >
                      {stepBusy === s.id ? 'Espera…' : s.actionLabel}
                    </button>
                  )}
                  {s.ok && <p className="driver-native-step__done">Completado</p>}
                </div>
              </li>
            );
          })}
        </ol>

        {native && state.locationOk && !state.alwaysOk && (
          <div className="driver-native-gate__oem">
            <Settings className="h-4 w-4" />
            <div>
              <p>Ajustes → El Pollón → Ubicación → <strong>Permitir todo el tiempo</strong></p>
              <div className="driver-native-gate__oem-actions">
                <button type="button" onClick={() => openNativeLocationSettings()}>
                  Abrir ajustes
                </button>
                <button type="button" onClick={confirmAlwaysManual}>
                  Ya lo cambié
                </button>
                <button type="button" disabled={stepBusy === 'verify'} onClick={verifyAfterSettings}>
                  Verificar
                </button>
              </div>
            </div>
          </div>
        )}

        {native && (
          <div className="driver-native-gate__oem driver-native-gate__oem--battery">
            <Battery className="h-4 w-4" />
            <p>
              Xiaomi / Huawei / Samsung: desactiva la optimización de batería para El Pollón
              (si no, el GPS puede pausarse).
            </p>
          </div>
        )}

        <button
          type="button"
          className="driver-native-gate__cta"
          disabled={busy || !state.notifOk || (native && !state.gpsOk)}
          onClick={finishAll}
        >
          <ShieldCheck className="h-5 w-5" />
          {busy
            ? 'Guardando…'
            : (native ? 'Entrar al panel repartidor' : 'Listo · recibir avisos')}
        </button>

        {msg && <p className="driver-native-gate__msg">{msg}</p>}
      </div>
    </div>
  );
}
