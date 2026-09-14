import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { money } from '../../utils/format';
import { Button } from '../ui/Button';

export function CartDrawer() {
  const { items, isOpen, setIsOpen, setCheckoutOpen, subtotal, itemCount, removeItem, updateQty } = useCart();

  if (!isOpen) return null;

  const hasItems = items.length > 0;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-end bg-black/40 p-3 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={() => setIsOpen(false)}
      role="presentation"
    >
      <aside
        className={`cart-drawer flex w-[min(72vw,340px)] flex-col overflow-hidden bg-white shadow-2xl ring-1 ring-black/5 sm:w-[min(58vw,400px)] md:max-w-md ${
          hasItems ? 'cart-drawer--filled' : 'cart-drawer--empty'
        }`}
        onClick={(e) => e.stopPropagation()}
        aria-label="Carrito de compras"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <ShoppingBag className="h-5 w-5 shrink-0 text-pollon-red" />
            <h2 className="truncate text-base font-bold sm:text-lg">
              Tu pedido ({itemCount})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="shrink-0 rounded-full p-2 hover:bg-gray-100"
            aria-label="Cerrar carrito"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="cart-drawer-body min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
          {!hasItems ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ShoppingBag className="mb-3 h-12 w-12 text-gray-200" />
              <p className="text-sm text-gray-500">Tu carrito está vacío</p>
              <p className="mt-1 text-xs text-gray-400">Agrega productos desde el menú</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((it) => (
                <li key={it.cartId} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug">{it.name}</p>
                      {it.drink && <p className="mt-0.5 truncate text-xs text-gray-500">🥤 {it.drink}</p>}
                      {it.bagQty > 0 && <p className="text-xs text-gray-500">♻️ Bolsa x{it.bagQty}</p>}
                      {it.notes && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">📝 {it.notes}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(it.cartId)}
                      className="shrink-0 rounded-lg p-1 text-red-500 hover:bg-red-50"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center rounded-lg border border-gray-200 bg-white">
                      <button type="button" className="p-1.5 hover:bg-gray-50" onClick={() => updateQty(it.cartId, -1)}>
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-[1.5rem] px-2 text-center text-sm font-bold">{it.qty}</span>
                      <button type="button" className="p-1.5 hover:bg-gray-50" onClick={() => updateQty(it.cartId, 1)}>
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-pollon-red">{money(it.total)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {hasItems && (
          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3.5">
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="text-base font-bold text-pollon-black">{money(subtotal)}</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 rounded-full border border-pollon-black/15 bg-white py-3 text-sm font-bold text-pollon-red transition hover:bg-gray-50"
              >
                Seguir Comprando
              </button>
              <Button
                className="flex-1"
                onClick={() => {
                  setIsOpen(false);
                  setCheckoutOpen(true);
                }}
              >
                Confirmar
              </Button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
