/**
 * Bandeja tipo WhatsApp + badge del ícono (app nativa).
 * FCM muestra la bandeja con la app cerrada; esto cubre app abierta / primer plano.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { isNativeDriverApp } from './backgroundGpsService';

const OFFER_CHANNEL_ID = 'pollon_driver_alarm_v3';
const OFFER_NOTIF_BASE = 71001;

const DriverBadge = registerPlugin('DriverBadge', {
  web: {
    set: async () => {},
    clear: async () => {},
    stopOfferAlarm: async () => {},
  },
});

let localTapBound = false;

export async function bindDriverTrayTap() {
  if (localTapBound) return;
  const LocalNotifications = await getLocalNotifications();
  if (!LocalNotifications?.addListener) return;
  localTapBound = true;
  try {
    await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const data = action?.notification?.extra || {};
      try {
        window.dispatchEvent(new CustomEvent('pollon-driver-push-action', { detail: data }));
      } catch {
        /* ignore */
      }
      const path = String(data.deepLink || data.url || '/repartidor');
      if (path.startsWith('/')) {
        window.history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    });
  } catch {
    localTapBound = false;
  }
}

function offerNotifId(offerId) {
  const s = String(offerId || '0');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return OFFER_NOTIF_BASE + (h % 8000);
}

async function getLocalNotifications() {
  if (!isNativeDriverApp() || !Capacitor.isPluginAvailable('LocalNotifications')) return null;
  try {
    const mod = await import('@capacitor/local-notifications');
    return mod.LocalNotifications;
  } catch {
    return null;
  }
}

export async function ensureDriverOfferChannel() {
  const LocalNotifications = await getLocalNotifications();
  if (!LocalNotifications?.createChannel) return;
  try {
    await LocalNotifications.createChannel({
      id: OFFER_CHANNEL_ID,
      name: 'Pedidos nuevos · alarma',
      description: 'Suena aunque la pantalla esté apagada o estés en otra app',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#E11D48',
    });
  } catch {
    /* canal ya existe */
  }
}

export async function stopNativeOfferAlarm() {
  if (!isNativeDriverApp()) return;
  try {
    await DriverBadge.stopOfferAlarm();
  } catch {
    /* ignore */
  }
}

export async function setNativeLauncherBadge(count) {
  const n = Math.max(0, Number(count) || 0);
  if (!isNativeDriverApp()) return;
  try {
    if (n > 0) await DriverBadge.set({ count: n });
    else await DriverBadge.clear();
  } catch {
    /* OEM sin badge */
  }
}

export async function showDriverOfferTray({
  offerId,
  title,
  body,
  ticket,
  customerName,
  address,
  fee,
  badgeCount = 1,
} = {}) {
  if (!isNativeDriverApp()) return { ok: false };
  const LocalNotifications = await getLocalNotifications();
  if (!LocalNotifications) return { ok: false };

  await ensureDriverOfferChannel();
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm?.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
  } catch {
    /* ignore */
  }

  const id = offerNotifId(offerId);
  const text = String(body || [
    ticket ? `Nº ${ticket}` : null,
    customerName || null,
    address || null,
    fee ? `Delivery ${fee}` : null,
    'Acepta en app nativa',
  ].filter(Boolean).join(' · '));

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: title || 'El Pollón · Pedido nuevo',
          body: text,
          channelId: OFFER_CHANNEL_ID,
          smallIcon: 'ic_stat_pollon',
          iconColor: '#E11D48',
          autoCancel: false,
          ongoing: false,
          extra: {
            type: 'driver_offer',
            offerId: String(offerId || ''),
            deepLink: '/repartidor',
          },
        },
      ],
    });
  } catch (err) {
    console.warn('[Pollón] tray local:', err?.message || err);
  }

  await setNativeLauncherBadge(badgeCount);
  return { ok: true, id };
}

export async function cancelDriverOfferTray(offerId) {
  const LocalNotifications = await getLocalNotifications();
  if (!LocalNotifications) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: offerNotifId(offerId) }] });
  } catch {
    /* ignore */
  }
}

export async function clearDriverOfferTrays() {
  const LocalNotifications = await getLocalNotifications();
  if (!LocalNotifications) {
    await setNativeLauncherBadge(0);
    return;
  }
  try {
    const pending = await LocalNotifications.getDeliveredNotifications();
    const ids = (pending?.notifications || [])
      .filter((n) => Number(n.id) >= OFFER_NOTIF_BASE)
      .map((n) => ({ id: n.id }));
    if (ids.length) await LocalNotifications.cancel({ notifications: ids });
  } catch {
    /* ignore */
  }
  await setNativeLauncherBadge(0);
}
