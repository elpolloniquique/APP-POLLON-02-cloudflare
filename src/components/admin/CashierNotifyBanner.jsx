import { useCallback, useEffect, useState } from 'react';
import { Bell, BellRing, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isCashierRole } from '../../services/authService';
import {
  ensureCashierPushSubscription,
  getDriverWebPushStatusSync,
  isPushRememberedForUser,
  hasVapidPublicKey,
  sendCashierSelfTestPush,
  remindCashierPendingPush,
  showLocalTrayTestNotification,
} from '../../services/pushService';

export function CashierNotifyBanner() {
  const { profile, user, role } = useAuth();
  const cashier = isCashierRole(role || profile?.role || profile?.rol);
  const userId = user?.id || profile?.authUserId || '';
  const branchId = profile?.branchId || profile?.branch_id || '';
  const [status, setStatus] = useState(() => getDriverWebPushStatusSync(userId));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(() => {
    setStatus(getDriverWebPushStatusSync(userId));
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!cashier || !userId) return undefined;
    if (isPushRememberedForUser(userId) || (typeof Notification !== 'undefined' && Notification.permission === 'granted')) {
      ensureCashierPushSubscription({ force: false, userId }).then(refresh).catch(() => {});
    }
    const remind = () => {
      if (!isPushRememberedForUser(userId)) return;
      remindCashierPendingPush()
        .then(async (r) => {
          if (Number(r?.webSent) > 0) return;
          const notices = Array.isArray(r?.notices) ? r.notices : [];
          for (const order of notices) {
            if (!order?.title) continue;
            await showLocalTrayTestNotification({
              title: order.title,
              body: order.body,
              badgeCount: notices.length,
              tag: order.tag,
              url: '/admin/pedidos',
            }).catch(() => {});
          }
        })
        .catch(() => {});
    };
    const t = setInterval(remind, 60_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') remind();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [cashier, userId, refresh]);

  if (!cashier) return null;
  if (!branchId) return null;

  const ready = Boolean(status?.ready);

  const activate = async () => {
    setBusy(true);
    setMsg('');
    try {
      if (!hasVapidPublicKey()) {
        setMsg('Falta configurar avisos en el servidor. Avisa al administrador.');
        return;
      }
      const res = await ensureCashierPushSubscription({ force: true, userId });
      refresh();
      if (res?.deferred) {
        setMsg(res.warn || 'Permiso OK. Reintenta en unos segundos.');
        return;
      }
      const test = await sendCashierSelfTestPush().catch((err) => ({ ok: false, error: err?.message }));
      if (test?.ok) setMsg('Avisos activos. Debes ver una prueba en la bandeja.');
      else setMsg(test?.error || 'Activado. Los pedidos nuevos de tu sucursal llegarán a la bandeja.');
    } catch (err) {
      setMsg(err?.message || 'No se pudieron activar los avisos.');
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <div className={`admin-shell__push ${ready ? 'is-on' : ''}`}>
      <div className="admin-shell__push-copy">
        {ready ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        <div>
          <p className="admin-shell__push-title">
            {ready ? 'Avisos de bandeja ON' : 'Activar avisos de pedidos nuevos'}
          </p>
          <p className="admin-shell__push-sub">
            {ready
              ? 'Solo pedidos nuevos de tu sucursal, aunque la pantalla esté apagada.'
              : 'Igual que el pollito: suena en la bandeja del celular, solo de tu sucursal.'}
          </p>
          {msg ? <p className="admin-shell__push-msg">{msg}</p> : null}
        </div>
      </div>
      <button
        type="button"
        className="admin-shell__push-btn"
        onClick={activate}
        disabled={busy}
      >
        {busy ? 'Activando…' : ready ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Probar aviso
          </>
        ) : 'Activar'}
      </button>
    </div>
  );
}
