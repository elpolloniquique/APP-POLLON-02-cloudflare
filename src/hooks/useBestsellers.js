import { useEffect, useState } from 'react';
import {
  buildTopProductItems,
  resolveBestsellerProducts,
} from '../utils/dashboardAnalytics';
import { fetchBranchOrdersForPeriod } from '../services/orderService';

/** Período alineado con el filtro por defecto del dashboard admin (semana). */
export const BESTSELLERS_PERIOD = 'week';
/** Platos visibles en el panel; el resto se ve con scroll. */
export const BESTSELLERS_VISIBLE = 4;
/** Total de platos más vendidos cargados (top ventas). */
export const BESTSELLERS_LIMIT = 6;

function fallbackProducts(menuProducts, limit = BESTSELLERS_LIMIT) {
  return (menuProducts || []).filter((p) => p.available !== false).slice(0, limit);
}

export function useBestsellers(branchId, menuProducts, periodId = BESTSELLERS_PERIOD) {
  const [bestsellers, setBestsellers] = useState(() => fallbackProducts(menuProducts));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!branchId || !menuProducts?.length) {
      setBestsellers(fallbackProducts(menuProducts));
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const orders = await fetchBranchOrdersForPeriod(branchId, periodId);
        const topItems = buildTopProductItems(orders, BESTSELLERS_LIMIT * 2);
        const matched = resolveBestsellerProducts(topItems, menuProducts, BESTSELLERS_LIMIT);
        if (!cancelled) {
          setBestsellers(matched.length ? matched : fallbackProducts(menuProducts));
        }
      } catch {
        if (!cancelled) setBestsellers(fallbackProducts(menuProducts));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [branchId, menuProducts, periodId]);

  return { bestsellers, loading };
}
