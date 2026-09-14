import { useEffect, useState, useCallback, useRef } from 'react';
import * as orderService from '../services/orderService';
import { playNewOrderAlert } from '../utils/orderAlertSound';

export { playNewOrderAlert, playNewOrderBeep } from '../utils/orderAlertSound';

const FOCUS_REFRESH_MIN_MS = 90_000;

export function useOrders(options = {}) {
  const { alarmEnabled = false } = options;
  const [orders, setOrders] = useState([]);
  const [ready, setReady] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');
  const prevIds = useRef(new Set());
  const initialLoad = useRef(true);
  const alarmEnabledRef = useRef(alarmEnabled);
  const lastFocusRefresh = useRef(0);

  alarmEnabledRef.current = alarmEnabled;

  const sync = useCallback((list, meta = {}) => {
    setOrders([...list].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    setReady(true);
    setRealtimeStatus(meta.realtimeStatus || (orderService.isBackendReady() ? 'live' : 'local'));
  }, []);

  useEffect(() => {
    const unsub = orderService.subscribeOrders((list, meta) => {
      sync(list, meta);
    });
    return unsub;
  }, [sync]);

  useEffect(() => {
    const refreshOnFocus = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastFocusRefresh.current < FOCUS_REFRESH_MIN_MS) return;
      // Si Realtime está vivo, no hace falta bajar todo el listado al volver a la pestaña
      if (orderService.isBackendReady() && realtimeStatus === 'live') {
        lastFocusRefresh.current = now;
        return;
      }
      lastFocusRefresh.current = now;
      orderService.fetchOrdersAdmin().then((list) => {
        sync(list, { realtimeStatus: orderService.isBackendReady() ? 'live' : 'local' });
      });
    };
    document.addEventListener('visibilitychange', refreshOnFocus);
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      document.removeEventListener('visibilitychange', refreshOnFocus);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [sync, realtimeStatus]);

  useEffect(() => {
    if (!ready) return;
    const currentIds = new Set(orders.map((o) => o.id));
    if (initialLoad.current) {
      initialLoad.current = false;
      prevIds.current = currentIds;
      return;
    }
    const hasNewOrder = orders.some((o) => !prevIds.current.has(o.id));
    if (alarmEnabledRef.current && hasNewOrder) {
      playNewOrderAlert();
    }
    prevIds.current = currentIds;
  }, [orders, ready]);

  return {
    orders,
    ready,
    realtimeStatus,
    refresh: () => orderService.fetchOrdersAdmin().then((list) => {
      sync(list, { realtimeStatus: orderService.isBackendReady() ? 'live' : 'local' });
    }),
    saveOrder: orderService.saveOrder,
    updateOrder: orderService.updateOrder,
    isBackendReady: orderService.isBackendReady,
  };
}
