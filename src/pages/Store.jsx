import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { SiteHeader } from '../components/layout/SiteHeader';
import { SiteFooter } from '../components/layout/SiteFooter';
import { WhatsAppFab } from '../components/layout/WhatsAppFab';
import { CartDrawer } from '../components/cart/CartDrawer';
import { CheckoutModal } from '../components/cart/CheckoutModal';
import { ProductCard } from '../components/product/ProductCard';
import { ProductModal } from '../components/product/ProductModal';
import { useCart } from '../context/CartContext';
import { useBranch } from '../context/BranchContext';
import { useBranchMenu } from '../context/BranchMenuContext';
import { useStoreProductsScroll } from '../hooks/useStoreProductsScroll';
import { Search } from 'lucide-react';

export function Store() {
  const [searchParams, setSearchParams] = useSearchParams();
  const catParam = searchParams.get('cat');
  const branchParam = searchParams.get('branch');
  const qParam = searchParams.get('q') || '';

  const { categories, productsByCategory, loading: menuLoading, menuBranchId } = useBranchMenu();
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState(qParam);
  const [selected, setSelected] = useState(null);
  const { setIsOpen } = useCart();
  const { branch, branchOpen, loading: branchLoading, branches, setBranch } = useBranch();

  useEffect(() => {
    if (!branchParam || !branches?.length || !branch?.id) return;
    if (branchParam === branch.id) return;
    const target = branches.find((b) => b.id === branchParam);
    if (target) setBranch(target, { force: true });
  }, [branchParam, branches, branch?.id, setBranch]);

  useEffect(() => {
    if (!branch?.id || branchParam) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('branch', branch.id);
      return next;
    }, { replace: true });
  }, [branch?.id, branchParam, setSearchParams]);

  useEffect(() => {
    if (!categories.length) {
      setCategoryId('');
      return;
    }
    const match = catParam
      ? categories.find((c) => c.id === catParam || c.slug === catParam)
      : null;
    if (match) {
      setCategoryId(match.id);
      return;
    }
    setCategoryId((prev) => {
      if (prev && categories.some((c) => c.id === prev)) return prev;
      return categories[0]?.id || '';
    });
  }, [categories, catParam]);

  useEffect(() => { setSearch(qParam); }, [qParam]);

  const currentProducts = useMemo(() => {
    const list = productsByCategory[categoryId] || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((p) => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
  }, [productsByCategory, categoryId, search]);

  const allFiltered = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return categories.flatMap((cat) =>
      (productsByCategory[cat.id] || [])
        .filter((p) => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
        .map((p) => ({ ...p, __categoryId: cat.id, __categoryName: cat.name }))
    );
  }, [categories, productsByCategory, search]);

  const menuReady = menuBranchId === branch?.id;
  const loading = branchLoading || (menuLoading && !menuReady);
  const currentCat = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId],
  );
  const hasCategoryFocus = Boolean(catParam && categoryId && !search.trim());

  const scrollToProducts = useStoreProductsScroll({
    enabled: Boolean(branch && hasCategoryFocus && !loading && categories.length > 0),
    behavior: 'auto',
  });

  if (branchLoading) {
    return <div className="flex min-h-screen items-center justify-center">Cargando sucursal…</div>;
  }

  if (!branch) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-pollon-cream p-8 text-center">
        <p className="text-lg font-semibold">Selecciona una sucursal para ver el menú</p>
        <Link to="/sucursal" className="mt-4 rounded-lg bg-pollon-red px-6 py-3 font-bold text-white">Elegir sucursal</Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-pollon-cream">
      <SiteHeader onOpenCart={() => setIsOpen(true)} />
      <WhatsAppFab />

      <div className={`bg-pollon-red text-white transition-all ${hasCategoryFocus ? 'py-3 md:py-4' : 'py-6'}`}>
        <div className="mx-auto max-w-[1400px] px-4">
          {hasCategoryFocus ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-white/75 md:text-sm">{branch.name}</p>
              <h1 className="font-display text-2xl md:text-4xl">{currentCat?.name || 'Menú'}</h1>
            </>
          ) : (
            <>
              <h1 className="font-display text-4xl md:text-5xl">NUESTRO MENÚ</h1>
              <p className="mt-1 text-white/80">{branch.name}</p>
            </>
          )}
          {!branchOpen && (
            <p className="mt-2 inline-block rounded-lg bg-black/30 px-3 py-1 text-sm">Sucursal cerrada — pedidos pueden no estar disponibles</p>
          )}
        </div>
      </div>

      <div className="sticky top-0 z-30 border-b bg-white shadow-sm">
        <div className="mx-auto max-w-[1400px] px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                const q = search.trim();
                if (q) next.set('q', q);
                else next.delete('q');
                if (branch?.id) next.set('branch', branch.id);
                return next;
              });
            }}
            className="relative"
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Buscar en el menú…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-base outline-none focus:border-pollon-red focus:ring-2 focus:ring-pollon-red/20"
              enterKeyHint="search"
              autoComplete="off"
            />
          </form>
        </div>
      </div>

      <main id="store-products" className="mx-auto w-full max-w-[1400px] flex-1 scroll-mt-32 px-4 py-8 lg:scroll-mt-36">
        {loading ? (
          <div className="store-menu-loading py-20 text-center" aria-busy="true" aria-live="polite">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-pollon-red/20 border-t-pollon-red" />
            <p className="text-gray-500">Cargando menú de {branch.name}…</p>
          </div>
        ) : !categories.length ? (
          <div className="py-20 text-center">
            <p className="text-gray-600">Esta sucursal aún no tiene menú configurado.</p>
            <p className="mt-2 text-sm text-gray-500">Configúralo en Admin → Menú por sucursal</p>
          </div>
        ) : allFiltered?.length ? (
          <>
            <h2 className="mb-4 text-xl font-bold">Resultados: &quot;{search}&quot;</h2>
            <div className="store-product-grid">
              {allFiltered.map((p, i) => (
                <ProductCard
                  key={p.id}
                  priority={i < 8}
                  product={{ ...p, image: p.image || p.imageUrl, price: p.price }}
                  onSelect={() => setSelected({ product: p, categoryId: p.__categoryId })}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            {!hasCategoryFocus && (
              <h2 className="mb-6 font-display text-3xl text-pollon-black">{currentCat?.name}</h2>
            )}
            <div className="store-product-grid">
              {currentProducts.map((p, i) => (
                <ProductCard
                  key={p.id}
                  priority={i < 8}
                  product={{ ...p, image: p.image || p.imageUrl }}
                  onSelect={() => setSelected({ product: p, categoryId })}
                />
              ))}
            </div>
            {!currentProducts.length && <p className="py-12 text-center text-gray-500">Sin productos en esta categoría</p>}
          </>
        )}
      </main>

      {selected && (
        <ProductModal
          product={selected.product}
          category={selected.categoryId}
          categoryName={categories.find((c) => c.id === selected.categoryId)?.name}
          onClose={() => setSelected(null)}
        />
      )}

      <CartDrawer />
      <CheckoutModal />

      <SiteFooter />
    </div>
  );
}
