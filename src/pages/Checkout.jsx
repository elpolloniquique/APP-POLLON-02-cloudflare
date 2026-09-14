import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

/** Ruta /checkout — abre el modal sobre la tienda */
export function Checkout() {
  const { items, setCheckoutOpen } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (items.length) setCheckoutOpen(true);
    navigate('/tienda', { replace: true });
  }, [items.length, setCheckoutOpen, navigate]);

  return null;
}
