import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useBranch } from './BranchContext';
import { loadBranchMenu, subscribeBranchMenu } from '../services/menuService';
import { preloadProductImages } from '../utils/media';

const EMPTY_MENU = { categories: [], productsByCategory: {}, products: [], source: 'empty' };

/** Caché en memoria por sucursal — cambio instantáneo al volver a una sucursal ya visitada */
const menuCache = new Map();
const pendingLoads = new Map();

const BranchMenuContext = createContext(null);

function readCache(branchId) {
  if (!branchId) return null;
  const cached = menuCache.get(branchId);
  return cached?.categories ? cached : null;
}

function writeCache(branchId, data) {
  if (!branchId || !data) return;
  menuCache.set(branchId, data);
  preloadProductImages(data.products, 32);
}

async function fetchMenu(branchId, { force = false } = {}) {
  if (!branchId) return EMPTY_MENU;
  if (!force) {
    const cached = readCache(branchId);
    if (cached) return cached;
  }

  if (!force && pendingLoads.has(branchId)) {
    return pendingLoads.get(branchId);
  }

  const promise = loadBranchMenu(branchId)
    .then((data) => {
      writeCache(branchId, data);
      return data;
    })
    .finally(() => {
      pendingLoads.delete(branchId);
    });

  pendingLoads.set(branchId, promise);
  return promise;
}

/** Precarga menús de otras sucursales en segundo plano */
export function prefetchBranchMenus(branchIds) {
  const ids = [...new Set((branchIds || []).filter(Boolean))];
  ids.forEach((id) => {
    if (readCache(id) || pendingLoads.has(id)) return;
    fetchMenu(id).catch(() => {});
  });
}

function isStoreSurface(pathname = '') {
  return !pathname.startsWith('/admin') && !pathname.startsWith('/repartidor');
}

export function BranchMenuProvider({ children }) {
  const { branch, branches } = useBranch();
  const { pathname } = useLocation();
  const storeSurface = isStoreSurface(pathname);
  const branchId = branch?.id ?? null;

  const cachedInitial = readCache(branchId) || EMPTY_MENU;
  const [menu, setMenu] = useState(cachedInitial);
  const [menuBranchId, setMenuBranchId] = useState(branchId);
  const [loading, setLoading] = useState(storeSurface && !readCache(branchId));
  const requestRef = useRef(0);

  const applyMenu = useCallback((id, data) => {
    setMenu(data);
    setMenuBranchId(id);
  }, []);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!storeSurface || !branchId) {
      applyMenu(null, EMPTY_MENU);
      setLoading(false);
      return;
    }

    const reqId = ++requestRef.current;
    const hasCache = Boolean(readCache(branchId));

    if (!silent && !hasCache) setLoading(true);

    try {
      const data = await fetchMenu(branchId, { force: silent });
      if (reqId !== requestRef.current) return;
      applyMenu(branchId, data);
    } catch {
      if (reqId !== requestRef.current) return;
      if (!readCache(branchId)) applyMenu(branchId, EMPTY_MENU);
    } finally {
      if (reqId === requestRef.current) setLoading(false);
    }
  }, [branchId, applyMenu, storeSurface]);

  useEffect(() => {
    if (!storeSurface) {
      requestRef.current += 1;
      applyMenu(null, EMPTY_MENU);
      setLoading(false);
      return undefined;
    }

    if (!branchId) {
      requestRef.current += 1;
      applyMenu(null, EMPTY_MENU);
      setLoading(false);
      return undefined;
    }

    const reqId = ++requestRef.current;
    const cached = readCache(branchId);

    if (cached) {
      applyMenu(branchId, cached);
      setLoading(false);
      refresh({ silent: true });
    } else {
      applyMenu(null, EMPTY_MENU);
      setLoading(true);
      refresh();
    }

    const unsub = subscribeBranchMenu(branchId, () => {
      menuCache.delete(branchId);
      refresh({ silent: true });
    });

    return () => {
      if (reqId === requestRef.current) requestRef.current += 1;
      unsub();
    };
  }, [branchId, applyMenu, refresh, storeSurface]);

  useEffect(() => {
    if (!storeSurface || !branches?.length) return;
    const others = branches.map((b) => b.id).filter((id) => id && id !== branchId);
    prefetchBranchMenus(others);
  }, [branches, branchId, storeSurface]);

  const menuReady = menuBranchId === branchId && !loading;

  return (
    <BranchMenuContext.Provider value={{ ...menu, loading, menuBranchId, menuReady, refresh }}>
      {children}
    </BranchMenuContext.Provider>
  );
}

export function useBranchMenu() {
  const ctx = useContext(BranchMenuContext);
  if (!ctx) throw new Error('useBranchMenu debe usarse dentro de BranchMenuProvider');
  return ctx;
}
