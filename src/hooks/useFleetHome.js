import { useCallback, useEffect, useState } from 'react';
import { loadFleetHome } from '../services/fleetService';
import { subscribeDispatch } from '../services/dispatchService';
import { getSupabase } from '../services/supabaseClient';

export function useFleetHome() {
  const [drivers, setDrivers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [fleet, setFleet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await loadFleetHome();
      setFleet(data.fleet || null);
      setDrivers(data.drivers || []);
      setJobs(data.jobs || []);
    } catch (err) {
      setError(err.message || 'No se pudo cargar tu flota.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    let debounce = null;
    const refreshSilent = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => { load(true); }, 250);
    };
    const unsub = subscribeDispatch(refreshSilent);
    const sb = getSupabase();
    let pedidosCh = null;
    if (sb) {
      pedidosCh = sb
        .channel('fleet-boss-pedidos')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, refreshSilent)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos' }, refreshSilent)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ep_driver_profiles' }, refreshSilent)
        .subscribe();
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') load(true);
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    const poll = setInterval(() => load(true), 8000);
    return () => {
      clearTimeout(debounce);
      clearInterval(poll);
      unsub();
      if (sb && pedidosCh) sb.removeChannel(pedidosCh);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [load]);

  return {
    drivers,
    setDrivers,
    jobs,
    setJobs,
    fleet,
    loading,
    error,
    setError,
    flash,
    setFlash,
    load,
  };
}
