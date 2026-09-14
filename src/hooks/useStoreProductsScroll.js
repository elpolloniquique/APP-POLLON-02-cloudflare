import { useLayoutEffect, useRef, useCallback } from 'react';

/**
 * Desplaza la vista hasta la grilla de productos (debajo del header y barra de categorías).
 */
export function useStoreProductsScroll({ enabled, behavior = 'auto' }) {
  const timerRef = useRef(null);

  const scrollToProducts = useCallback((scrollBehavior = behavior) => {
    const el = document.getElementById('store-products');
    if (!el) return;
    el.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
  }, [behavior]);

  useLayoutEffect(() => {
    if (!enabled) return undefined;
    timerRef.current = window.setTimeout(() => {
      scrollToProducts(behavior);
    }, 60);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [enabled, behavior, scrollToProducts]);

  return scrollToProducts;
}
