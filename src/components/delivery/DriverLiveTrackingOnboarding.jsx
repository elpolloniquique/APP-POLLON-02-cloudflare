import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCircle2, Radio, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { unlockDriverAudio } from '../../utils/orderAlertSound';
import {
  evaluateDriverLiveTrackingReady,
  completeDriverLiveTrackingSetup,
  markDriverOnboardingComplete,
} from '../../services/driverOnboardingService';
import {
  ensureDriverPushSubscription,
  hasVapidPublicKey,
} from '../../services/pushService';
import { isNativeDriverApp } from '../../services/backgroundGpsService';
import { isDriverRole } from '../../services/authService';
import '../../styles/driver-native.css';

/**
 * Capa de primer ingreso: permiso de notificaciones (tipo WhatsApp).
 * Si ya está concedido en este dispositivo, entra directo al panel.
 */
export function DriverLiveTrackingOnboarding({ onReadyChange }) {
  const { user, profile, role } = useAuth();
  const userId = user?.id || profile?.id || 'anon';
  const driverRole = isDriverRole(role || profile?.rol || profile?.role);
  const native = isNativeDriverApp();

  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    try {
      const s = await evaluateDriverLiveTrackingReady(userId);
      setState(s);
      onReadyChange?.(s.ready);
      if (s.ready) {
        markDriverOnboardingComplete(userId, { pushOk: true });
      }
      return s;
    } catch (err) {
      console.warn('[Pollón] onboarding:', err);
      setState({
        ready: false,
        notifOk: false,
        native,
      });
      onReadyChange?.(false);
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

  const activateAndEnter = async () => {
    setBusy(true);
    setMsg('');
    try {
      await unlockDriverAudio();
      if (!native && !hasVapidPublicKey()) {
        setMsg('Falta configurar avisos en el servidor. Avisa al administrador.');
        return;
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
          Activa avisos de pedidos nuevos
        </h1>
        <p className="driver-native-gate__lead">
          Primera vez en este celular o PC: permite las notificaciones, igual que WhatsApp.
          Luego entras al panel y ves los pedidos nuevos.
        </p>

        <div className="driver-native-gate__hint">
          <Radio className="h-4 w-4 shrink-0" />
          <p>
            Cuando llegue un delivery, te llega a la bandeja aunque estés en otra pantalla.
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
                Toca el botón y elige <strong>Permitir</strong> en el recuadro del navegador.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="driver-native-gate__cta"
          disabled={busy}
          onClick={activateAndEnter}
        >
          <ShieldCheck className="h-5 w-5" />
          {busy ? 'Activando…' : 'Permitir avisos y entrar al panel'}
        </button>

        {msg && <p className="driver-native-gate__msg">{msg}</p>}
      </div>
    </div>
  );
}
