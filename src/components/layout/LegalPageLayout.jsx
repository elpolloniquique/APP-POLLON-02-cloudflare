import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { WhatsAppFab } from './WhatsAppFab';
import { CartDrawer } from '../cart/CartDrawer';
import { useCart } from '../../context/CartContext';

export function LegalPageLayout({ title, subtitle, children }) {
  const { setIsOpen } = useCart();

  return (
    <div className="flex min-h-screen flex-col bg-pollon-cream">
      <SiteHeader variant="compact" onOpenCart={() => setIsOpen(true)} />
      <CartDrawer />
      <WhatsAppFab />

      <div className="bg-pollon-red py-10 text-white md:py-12">
        <div className="mx-auto max-w-3xl px-4">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-white/75 transition hover:text-white">
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Volver al inicio
          </Link>
          <h1 className="mt-4 font-display text-4xl leading-tight md:text-5xl">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-white/80 md:text-base">{subtitle}</p>}
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 md:py-12">
        <article className="legal-page prose-pollon rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 md:p-8">
          {children}
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
