/**
 * Handlers Web Push — bandeja del sistema aunque la app esté cerrada / pantalla apagada.
 * Estilo WhatsApp: notificación insistente + badge de pedidos nuevos.
 * La PWA solo avisa; aceptar es en la app nativa.
 */
/* eslint-disable no-undef */

async function updateAppBadge(count) {
  try {
    if (typeof self.navigator?.setAppBadge === 'function') {
      const n = Number(count);
      if (n > 0) await self.navigator.setAppBadge(n);
      else if (typeof self.navigator.clearAppBadge === 'function') await self.navigator.clearAppBadge();
    }
  } catch {
    /* ignore */
  }
}

self.addEventListener('push', (event) => {
  let payload = {
    title: 'El Pollón · Nuevo pedido',
    body: 'Tienes un nuevo pedido de delivery. Ábrelo en la app nativa para aceptar.',
    url: '/repartidor',
    tag: 'pollon-driver-offer',
    badgeCount: 1,
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch {
    try {
      const text = event.data?.text?.();
      if (text) payload.body = text;
    } catch {
      /* ignore */
    }
  }

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      try {
        client.postMessage({
          type: 'DRIVER_NEW_OFFER',
          offerId: payload.offerId || null,
          jobId: payload.jobId || null,
          title: payload.title,
          body: payload.body,
          badgeCount: payload.badgeCount || 1,
        });
      } catch {
        /* ignore */
      }
    }

    let badgeN = Math.max(1, Number(payload.badgeCount) || 1);
    await updateAppBadge(badgeN);

    const stableTag = payload.jobId
      ? `pollon-job-${payload.jobId}`
      : (payload.offerId ? `pollon-offer-${payload.offerId}` : (payload.tag || 'pollon-driver-offer'));

    const bodyText = payload.body
      || [
        payload.ticket ? `Pedido Nº ${payload.ticket}` : null,
        payload.customerName || null,
        payload.address || payload.customerAddress || null,
        'Acepta en app nativa',
      ].filter(Boolean).join(' · ')
      || 'Nuevo pedido · Ábrelo en la app nativa para aceptar';

    await self.registration.showNotification(payload.title || 'El Pollón · Nuevo pedido', {
      body: bodyText,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [280, 120, 280, 120, 400],
      tag: stableTag,
      renotify: true,
      requireInteraction: true,
      silent: false,
      timestamp: Date.now(),
      actions: [
        { action: 'open', title: 'Ver aviso' },
        { action: 'dismiss', title: 'Cerrar' },
      ],
      data: {
        url: payload.url || '/repartidor',
        offerId: payload.offerId || null,
        jobId: payload.jobId || null,
        badgeCount: badgeN,
      },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  if (action === 'dismiss') {
    event.notification.close();
    return;
  }
  event.notification.close();
  const target = event.notification?.data?.url || '/repartidor';
  const absolute = new URL(target, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          await client.focus();
          try {
            client.postMessage({ type: 'DRIVER_NEW_OFFER', fromClick: true });
          } catch {
            /* ignore */
          }
          if ('navigate' in client) {
            try {
              await client.navigate(absolute);
            } catch {
              /* ignore */
            }
          }
          return;
        }
      }
      if (clients.openWindow) {
        await clients.openWindow(absolute);
      }
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'DRIVER_CLEAR_BADGE') return;
  event.waitUntil(updateAppBadge(0));
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(Promise.resolve());
});
