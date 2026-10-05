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
    title: 'NUEVO PEDIDO',
    body: 'Nuevo pedido de delivery. Ábrelo en la app nativa para aceptar.',
    url: '/repartidor',
    tag: 'pollon-driver-offer',
    badgeCount: 1,
    renotify: true,
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
    const isCashier = String(payload.type || '').startsWith('cashier_');
    const defaultUrl = isCashier ? '/admin/pedidos' : '/repartidor';
    const msgType = isCashier ? 'CASHIER_NEW_ORDER' : 'DRIVER_NEW_OFFER';

    for (const client of clientsList) {
      try {
        client.postMessage({
          type: msgType,
          offerId: payload.offerId || null,
          jobId: payload.jobId || null,
          orderId: payload.orderId || null,
          title: payload.title,
          body: payload.body,
          tag: payload.tag,
          badgeCount: payload.badgeCount || 1,
        });
      } catch {
        /* ignore */
      }
    }

    let badgeN = Math.max(1, Number(payload.badgeCount) || 1);
    await updateAppBadge(badgeN);

    const stableTag = payload.tag
      || (payload.orderId ? `pollon-cashier-${payload.orderId}` : null)
      || (payload.jobId ? `pollon-job-${payload.jobId}` : null)
      || (payload.offerId ? `pollon-offer-${payload.offerId}` : (isCashier ? 'pollon-cashier-order' : 'pollon-driver-offer'));

    const titleText = payload.title
      || (payload.ticket ? `NUEVO PEDIDO Nº ${payload.ticket}` : 'NUEVO PEDIDO');

    const bodyText = payload.body
      || [
        payload.ticket ? `Nº ${payload.ticket}` : null,
        payload.address || payload.customerAddress || null,
        payload.fee ? `Delivery ${payload.fee}` : null,
      ].filter(Boolean).join(' · ')
      || (isCashier ? 'Nuevo pedido de tu sucursal' : 'Nuevo pedido · Ábrelo en la app nativa para aceptar');

    const opts = {
      body: bodyText,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [280, 120, 280, 120, 400],
      tag: stableTag,
      renotify: true,
      requireInteraction: true,
      silent: false,
      timestamp: Date.now(),
      data: {
        url: payload.url
          || (payload.offerId ? `/repartidor/oferta/${payload.offerId}` : defaultUrl),
        offerId: payload.offerId || null,
        jobId: payload.jobId || null,
        orderId: payload.orderId || null,
        ticket: payload.ticket || null,
        badgeCount: badgeN,
      },
    };

    try {
      await self.registration.showNotification(titleText, {
        ...opts,
        actions: [
          { action: 'open', title: 'Ver aviso' },
          { action: 'dismiss', title: 'Cerrar' },
        ],
      });
    } catch {
      await self.registration.showNotification(titleText, opts);
    }
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
  const clickType = String(target).includes('/admin') ? 'CASHIER_NEW_ORDER' : 'DRIVER_NEW_OFFER';

  event.waitUntil(
    (async () => {
      const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          await client.focus();
          try {
            client.postMessage({ type: clickType, fromClick: true });
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
  if (data?.type === 'DRIVER_CLEAR_BADGE') {
    event.waitUntil(updateAppBadge(0));
    return;
  }
  if (data?.type === 'DRIVER_POLL_ALERTS') {
    event.waitUntil(pollPendingOffers());
  }
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of list) {
      try {
        client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGE' });
      } catch {
        /* ignore */
      }
    }
  })());
});

async function showOfferList(offers) {
  for (const offer of offers || []) {
    const tag = offer.tag || (offer.jobId ? `pollon-job-${offer.jobId}` : 'pollon-driver-offer');
    const title = offer.title || 'NUEVO PEDIDO';
    const body = offer.body || 'Nuevo pedido · Ábrelo en la app nativa para aceptar';
    try {
      await self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag,
        renotify: true,
        requireInteraction: true,
        data: {
          url: offer.offerId ? `/repartidor/oferta/${offer.offerId}` : '/repartidor',
          offerId: offer.offerId || null,
          jobId: offer.jobId || null,
        },
      });
    } catch {
      /* ignore */
    }
  }
}

async function pollPendingOffers() {
  try {
    const sub = await self.registration.pushManager.getSubscription();
    if (!sub) return;
    const json = sub.toJSON();
    const res = await fetch('/api/driver-alert-poll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        auth: json.keys?.auth,
      }),
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    await showOfferList(data.offers || []);
  } catch {
    /* Chrome/Xiaomi sin red */
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'pollon-driver-alerts') {
    event.waitUntil(pollPendingOffers());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'pollon-driver-alerts') {
    event.waitUntil(pollPendingOffers());
  }
});
