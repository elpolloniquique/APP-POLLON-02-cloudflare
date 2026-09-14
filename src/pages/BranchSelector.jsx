import { useNavigate } from 'react-router-dom';
import { SiteHeader } from '../components/layout/SiteHeader';
import { SiteFooter } from '../components/layout/SiteFooter';
import { WhatsAppFab } from '../components/layout/WhatsAppFab';
import { CartDrawer } from '../components/cart/CartDrawer';
import { useBranch } from '../context/BranchContext';
import { useCart } from '../context/CartContext';
import { MapPin, Phone, Clock, Bike } from 'lucide-react';
import { formatDeliveryCost } from '../utils/format';

export function BranchSelector() {
  const { branches, branch, setBranch } = useBranch();
  const { setIsOpen, items, cartBranchId, resetForBranch } = useCart();
  const navigate = useNavigate();

  const select = (b) => {
    if (b.comingSoon) return;
    if (items.length > 0 && cartBranchId && cartBranchId !== b.id) {
      if (!window.confirm('Al cambiar de sucursal se vaciará tu carrito. ¿Continuar?')) return;
      resetForBranch(b.id);
    }
    setBranch(b);
    navigate('/tienda');
  };

  return (
    <div className="flex min-h-screen flex-col bg-pollon-cream">
      <SiteHeader onOpenCart={() => setIsOpen(true)} variant="compact" />
      <CartDrawer />
      <WhatsAppFab />

      <div className="bg-pollon-red py-8 text-white">
        <div className="mx-auto max-w-[1400px] px-4 text-center">
          <h1 className="font-display text-5xl">ELIGE TU SUCURSAL</h1>
          <p className="mt-2 text-white/80">Menú, delivery y horarios según tu ubicación</p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <div className="space-y-4">
          {branches.map((b) => (
            <article
              key={b.id}
              className={`rounded-2xl border-2 bg-white p-6 shadow-md transition ${
                branch?.id === b.id ? 'border-pollon-red ring-2 ring-pollon-red/20' : 'border-gray-200'
              } ${b.comingSoon ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-pollon-red/50'}`}
              onClick={() => select(b)}
              role="button"
              tabIndex={b.comingSoon ? -1 : 0}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-lg font-bold">{b.name}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                  b.comingSoon ? 'bg-orange-100 text-orange-700' : b.isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100'
                }`}>
                  {b.comingSoon ? 'Próximamente' : b.isOpen ? 'Abierto' : 'Cerrado'}
                </span>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-pollon-red" /> {b.address}</p>
                <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-pollon-red" /> {b.schedule}</p>
                <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-pollon-red" /> {b.phone}</p>
                <p className="flex items-center gap-2"><Bike className="h-4 w-4 text-pollon-red" /> Delivery: {formatDeliveryCost(b.deliveryCost)} · {b.deliveryEta}</p>
              </div>
              {!b.comingSoon && (
                <button
                  type="button"
                  className="mt-5 w-full rounded-lg bg-pollon-red py-3 text-sm font-bold uppercase text-white sm:w-auto sm:px-8"
                  onClick={(e) => { e.stopPropagation(); select(b); }}
                >
                  Pedir en esta sucursal
                </button>
              )}
            </article>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
