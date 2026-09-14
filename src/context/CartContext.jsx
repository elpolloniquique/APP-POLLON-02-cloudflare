import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { BAG_PRICE, CART_KEY } from '../utils/constants';
import { calcBagQty } from '../utils/productOptions';
import { deliveryCostAsNumber } from '../utils/format';
import { useBranch } from './BranchContext';

const CartContext = createContext(null);

function loadCartState() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return { branchId: null, items: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { branchId: null, items: parsed };
    return { branchId: parsed.branchId || null, items: parsed.items || [] };
  } catch {
    return { branchId: null, items: [] };
  }
}

export function CartProvider({ children }) {
  const [cartState, setCartState] = useState(loadCartState);
  const [isOpen, setIsOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { branch } = useBranch();

  const items = cartState.items;
  const cartBranchId = cartState.branchId;

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cartState));
  }, [cartState]);

  useEffect(() => {
    if (branch?.id && cartBranchId && cartBranchId !== branch.id && items.length > 0) {
      /* no auto-clear — el componente que cambia sucursal debe confirmar */
    }
  }, [branch?.id, cartBranchId, items.length]);

  const subtotal = useMemo(() => items.reduce((s, i) => s + (i.total || 0), 0), [items]);
  const deliveryFee = useMemo(() => {
    if (!branch || items.length === 0) return 0;
    return deliveryCostAsNumber(branch.deliveryCost);
  }, [branch, items.length]);

  const addItem = useCallback((item) => {
    if (!branch?.id) return { ok: false, error: 'Selecciona una sucursal primero' };
    if (!item.available && item.available !== undefined) {
      return { ok: false, error: 'Producto no disponible' };
    }
    if (cartBranchId && cartBranchId !== branch.id && items.length > 0) {
      return { ok: false, error: 'branch_mismatch' };
    }
    const entry = {
      ...item,
      branchId: branch.id,
      cartId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    setCartState((prev) => ({
      branchId: branch.id,
      items: [...(prev.branchId === branch.id ? prev.items : []), entry],
    }));
    setIsOpen(true);
    return { ok: true };
  }, [branch?.id, cartBranchId, items.length]);

  const removeItem = useCallback((cartId) => {
    setCartState((prev) => ({ ...prev, items: prev.items.filter((i) => i.cartId !== cartId) }));
  }, []);

  const updateQty = useCallback((cartId, delta) => {
    setCartState((prev) => ({
      ...prev,
      items: prev.items
        .map((i) => {
          if (i.cartId !== cartId) return i;
          const qty = Math.max(1, (i.qty || 1) + delta);
          const unit = i.unitPrice ?? Math.round((i.total || 0) / (i.qty || 1));
          const includeBag = i.includeBag ?? (i.bagQty > 0);
          const bagPrice = i.bagPrice ?? BAG_PRICE;
          const bagUnitsPerBag = Math.max(1, Math.floor(Number(i.bagUnitsPerBag ?? 1) || 1));
          const bagQty = calcBagQty(qty, includeBag, bagUnitsPerBag);
          let drinks = i.drinks?.length ? [...i.drinks] : (i.drink ? i.drink.split(' · ').map((s) => s.replace(/^#\d+:\s*/, '')) : []);
          while (drinks.length < qty) drinks.push(drinks[drinks.length - 1] || '');
          drinks = drinks.slice(0, qty);
          const drink = drinks.filter(Boolean).join(' · ') || i.drink;
          return {
            ...i,
            qty,
            bagQty,
            bagUnitsPerBag,
            drinks,
            drink,
            total: unit * qty + bagPrice * bagQty,
          };
        })
        .filter((i) => (i.qty || 1) > 0),
    }));
  }, []);

  const clearCart = useCallback(() => setCartState({ branchId: branch?.id || null, items: [] }), [branch?.id]);

  const resetForBranch = useCallback((newBranchId) => {
    setCartState({ branchId: newBranchId, items: [] });
  }, []);

  const itemCount = useMemo(() => items.reduce((s, i) => s + (i.qty || 1), 0), [items]);

  const value = {
    items,
    cartBranchId,
    subtotal,
    deliveryFee,
    total: subtotal,
    itemCount,
    isOpen,
    setIsOpen,
    checkoutOpen,
    setCheckoutOpen,
    addItem,
    removeItem,
    updateQty,
    clearCart,
    resetForBranch,
    BAG_PRICE,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider');
  return ctx;
}
