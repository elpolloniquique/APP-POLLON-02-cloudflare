import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCircle2, MapPin, Radio, Settings, ShieldCheck, Smartphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { unlockDriverAudio } from '../../utils/orderAlertSound';
import {
  evaluateDriverLiveTrackingReady,
  completeDriverLiveTrackingSetup,
  markDriverOnboardingComplete,
  getDriverOnboardingRecord,
} from '../../services/driverOnboardingService';
import {
  ensureDriverPushSubscription,
  hasVapidPublicKey,
} from '../../services/pushService';
import {
  isNativeDriverApp,
  openNativeLocationSettings,
  requestAlwaysLocationPermission,
} from '../../services/backgroundGpsService';
import { isDriverRole } from '../../services/authService';
import '../../styles/driver-native.css';

/**
 * Capa de primer ingreso: permiso de notificaciones (tipo WhatsApp).
 * Si ya está concedido en este dispositivo, entra directo al panel.
 */
export function DriverLiveTrackingOnboarding({ onReadyChange }) {
  const { user, profile, role } = useAuth();
  const userId = user?.id || profile?.authUserId || profile?.id || 'anon';
  const driverRole = isDriverRole(role || profile?.rol || profile?.role);
  const native = isNativeDriverApp();

  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async ({ soft = false } = {}) => {
    const saved = getDriverOnboardingRecord(userId, [profile?.id, profile?.authUserId, user?.id]);
    if (saved?.completedAt) onReadyChange?.(true);
    try {
      const s = await evaluateDriverLiveTrackingReady(userId);
      setState(s);
      const ready = Boolean(s.ready || saved?.completedAt);
      onReadyChange?.(ready);
      if (ready) {
        markDriverOnboardingComplete(userId, { pushOk: true });
      }
      return s;
    } catch (err) {
      console.warn('[Pollón] onboarding:', err);
      if (saved?.completedAt) {
        onReadyChange?.(true);
        return { ready: true };
      }
      if (!soft) {
        setState({
          ready: false,
          notifOk: false,
          native,
        });
        onReadyChange?.(false);
      }
      return null;
    }
  }, [userId, onReadyChange, native]);

  useEffect(() => {
    if (!driverRole) {
      onReadyChange?.(true);
      return undefined;
    }
    let cancelled = false;
    refresh();
    return () => {
      cancelled = true;
    };
  }, [refresh, driverRole, onReadyChange]);

  if (!driverRole) return null;

  const activateAndEnter = async () => {
    setBusy(true);
    setMsg('');
    try {
      await unlockDriverAudio();
      if (!native && !hasVapidPublicKey()) {
        setMsg('Falta configurar avisos en el servidor. Avisa al administrador.');
        return;
      }
      if (native) {
        const gps = await requestAlwaysLocationPermission();
        if (!gps?.ok && !gps?.locationOk) {
          setMsg(gps?.error || 'Permite la ubicación. Elige Siempre / Permitir todo el tiempo.');
          await refresh();
          return;
        }
        if (gps?.needsSettings) {
          setMsg('Falta “Siempre / Permitir todo el tiempo”. Ábrelo en Ajustes y vuelve.');
        }
      }
      const res = await ensureDriverPushSubscription({ force: false, userId });
      const done = await completeDriverLiveTrackingSetup(userId);
      const granted = typeof Notification === 'undefined' || Notification.permission === 'granted' || done.ok;
      if (!granted) {
        setMsg(done.error || 'Debes tocar Permitir en el aviso del navegador.');
        await refresh();
        return;
      }
      if (res?.deferred) {
        setMsg('Permiso listo. El aviso en bandeja se completa solo.');
      }
      onReadyChange?.(true);
      await refresh();
    } catch (err) {
      const denied = typeof Notification !== 'undefined' && Notification.permission === 'denied';
      setMsg(
        denied
          ? 'Notificaciones bloqueadas. En el navegador: Ajustes → Notificaciones → Permitir, y vuelve a entrar.'
          : (err.message || 'Permite las notificaciones cuando el navegador lo pida.'),
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return (
      <div className="driver-native-gate">
        <p className="driver-native-gate__loading">Preparando panel de repartidor…</p>
      </div>
    );
  }

  if (state.ready) return null;

  return (
    <div className="driver-native-gate" role="dialog" aria-labelledby="driver-notify-title">
      <div className="driver-native-gate__card">
        <img src="/img/logo pollon.png" alt="" className="driver-native-gate__logo driver-native-gate__logo--sm" />
        <p className="driver-native-gate__brand">EL POLLÓN</p>
        <p className="driver-native-gate__badge">Repartidor</p>
        <h1 id="driver-notify-title" className="driver-native-gate__title">
          {native ? 'Avisos y GPS en segundo plano' : 'Activa avisos de pedidos nuevos'}
        </h1>
        <p className="driver-native-gate__lead">
          {native
            ? 'Primera vez: permite notificaciones (igual que WhatsApp) y ubicación Siempre. Así llegan pedidos y el GPS sigue con pantalla apagada o la app cerrada.'
            : 'Primera vez: permite las notificaciones, igual que WhatsApp. Esta app del pollito solo avisa. Aceptas el pedido en la app nativa de repartidor.'}
        </p>

        <div className="driver-native-gate__hint">
          <Radio className="h-4 w-4 shrink-0" />
          <p>
            {native
              ? 'Cuando llegue un delivery, te llega a la bandeja aunque estés en otra pantalla.'
              : 'Instala El Pollón (ícono pollito) y permite avisos. Así el pedido nuevo llega a la bandeja aunque cierres la app, igual que WhatsApp. Aceptas en la app nativa.'}
          </p>
        </div>

        <div className="driver-native-steps" style={{ marginTop: 16 }}>
          <div className="driver-native-step">
            <span className="driver-native-step__icon">
              {state.notifOk ? <CheckCircle2 className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="driver-native-step__title">1. Notificaciones del sistema</p>
              <p className="driver-native-step__body">
                Toca el botón y elige <strong>Permitir</strong>.
              </p>
            </div>
          </div>
          {native && (
            <div className="driver-native-step">
              <span className="driver-native-step__icon">
                {state.alwaysOk || state.locationOk ? <CheckCircle2 className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="driver-native-step__title">2. Ubicación · Siempre</p>
                <p className="driver-native-step__body">
                  Elige <strong>Siempre</strong> o <strong>Permitir todo el tiempo</strong>. Si solo das “mientras usas la app”, el GPS se apaga al bloquear.
                </p>
              </div>
            </div>
          )}
          {native && (
            <div className="driver-native-step">
              <span className="driver-native-step__icon">
                <Smartphone className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="driver-native-step__title">3. Xiaomi, Huawei, Samsung, OPPO</p>
                <p className="driver-native-step__body">
                  Ajustes → Autostart / Inicio automático → El Pollón ON. Batería → Sin restricciones.
                </p>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="driver-native-gate__cta"
          disabled={busy}
          onClick={activateAndEnter}
        >
          <ShieldCheck className="h-5 w-5" />
          {busy ? 'Activando…' : (native ? 'Permitir avisos, GPS y entrar' : 'Permitir avisos de pedidos nuevos')}
        </button>

        {native && state.canOpenSettings && (
          <button
            type="button"
            className="driver-native-gate__cta"
            style={{ marginTop: 8, background: 'transparent', color: 'inherit', border: '1px solid currentColor' }}
            onClick={() => { void openNativeLocationSettings(); }}
          >
            <Settings className="h-5 w-5" />
            Abrir ajustes de ubicación
          </button>
        )}

        {msg && <p className="driver-native-gate__msg">{msg}</p>}
      </div>
    </div>
  );
}
