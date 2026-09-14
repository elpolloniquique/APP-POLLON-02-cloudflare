import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Flame, MapPin, Phone, Clock, Bike, ChevronRight, ChevronLeft, Plus, Star, Shield, ChefHat,
  MapPinned, ShoppingBag, CreditCard, MessageCircle, PackageSearch,
  CheckCircle2, Radio, LogIn, ShoppingCart, Map, Heart,
} from 'lucide-react';
import { SiteHeader } from '../components/layout/SiteHeader';
import { SiteFooter } from '../components/layout/SiteFooter';
import { WhatsAppFab } from '../components/layout/WhatsAppFab';
import { CartDrawer } from '../components/cart/CartDrawer';
import { CheckoutModal } from '../components/cart/CheckoutModal';
import { ProductModal } from '../components/product/ProductModal';
import { useCart } from '../context/CartContext';
import { useBranch } from '../context/BranchContext';
import { useBranchMenu } from '../context/BranchMenuContext';
import { isBranchOpenNow } from '../services/branchService';
import { money, formatDeliveryCost, resolveMediaUrl, storeCategoryUrl, resolveProductCategoryId } from '../utils/format';
import { getAvailablePaymentMethods, formatPaymentMethodsSummary } from '../utils/paymentMethods';
import { useBestsellers, BESTSELLERS_VISIBLE } from '../hooks/useBestsellers';
import { AdminScrollPanel } from '../components/admin/AdminScrollPanel';

const TRUST_BAR_ITEMS = [
  { icon: Bike, label: 'Delivery rápido' },
  { icon: Shield, label: 'Pago al recibir' },
  { icon: ChefHat, label: 'Pollo fresco del día' },
  { icon: MapPin, label: 'Atención multi-sucursal' },
];

const WHY_US = [
  { icon: ChefHat, title: 'Pollo fresco del día', desc: 'Marinado y cocinado al carbón cada día con receta peruana auténtica.' },
  { icon: Bike, title: 'Delivery rápido y seguro', desc: 'Llegamos caliente a tu puerta según la sucursal que elijas.' },
  { icon: Map, title: 'Seguimiento en mapa en vivo', desc: 'En delivery ves al repartidor y el tiempo estimado desde Mis pedidos.' },
  { icon: Shield, title: 'Pago al recibir', desc: null }, // se completa con métodos de la sucursal
  { icon: Star, title: 'Más de 10.000 clientes', desc: 'La pollería favorita del norte con ofertas familiares todos los días.' },
];

const PAYMENT_CARD_STYLES = {
  cash: {
    box: 'bg-green-50',
    title: 'text-green-900',
    desc: 'text-green-700',
  },
  transfer: {
    box: 'bg-blue-50',
    title: 'text-blue-900',
    desc: 'text-blue-700',
  },
  card: {
    box: 'bg-violet-50',
    title: 'text-violet-900',
    desc: 'text-violet-700',
  },
};

const HOME_ORDER_STEPS = [
  { n: 1, icon: MapPinned, title: 'Elige sucursal', desc: 'Selecciona tu local en el menú superior.' },
  { n: 2, icon: ShoppingBag, title: 'Arma tu pedido', desc: 'Personaliza platos y agrégalos al carrito.' },
  { n: 3, icon: CreditCard, title: 'Confirma tu pedido', desc: 'Completa datos y elige pago al recibir.' },
  { n: 4, icon: MessageCircle, title: 'Recibe tu código', desc: 'Pantalla verde con tu código único; WhatsApp opcional.' },
];

const HOME_TRACK_STEPS = [
  { n: 1, icon: CheckCircle2, title: 'Pedido recibido', desc: 'Al confirmar ves pantalla verde con tu código único.' },
  { n: 2, icon: LogIn, title: 'Inicia sesión o vincula', desc: 'Entra a tu cuenta; si pediste sin cuenta, vincula con código + teléfono.' },
  { n: 3, icon: Radio, title: 'Seguimiento real', desc: 'Mis pedidos → abre el pedido: barra de estados; en delivery, mapa en vivo del repartidor y tiempo estimado.' },
];

/** Flujo real que ve el cliente en seguimiento (modo app / mapa). */
const HOME_CLIENT_TRACK_STEPS = [
  { label: 'Aceptado', active: false },
  { label: 'En cocina', active: true },
  { label: 'En reparto', active: false },
  { label: 'Entregado', active: false },
];

const HOME_GUIDE_FEATURES = [
  { icon: Shield, t: 'Pago al recibir', d: 'Según sucursal' },
  { icon: Map, t: 'Mapa en vivo', d: 'Delivery con GPS del repartidor' },
  { icon: MapPin, t: 'Multi-sucursal', d: 'Menú y precios por local' },
];

const TESTIMONIALS = [
  { name: 'María González', text: 'El mejor pollo a la brasa de Iquique, siempre fresco y crujiente. El delivery llegó súper rápido.', stars: 5 },
  { name: 'Carlos Ruiz', text: 'Las ofertas familiares son increíbles. Pedimos cada fin de semana y nunca defraudan.', stars: 5 },
  { name: 'Ana Torres', text: 'Excelente atención por WhatsApp. El combo chaufa es mi favorito, 100% recomendado.', stars: 5 },
];

const DEFAULT_HERO_IMAGE = '/img/oferton%20familiar.png';

function imgSrc(path) {
  return resolveMediaUrl(path);
}

function heroCityLabel(branch) {
  const city = (branch?.city || '').trim();
  if (city) return city.toUpperCase();
  const fromName = (branch?.name || '')
    .replace(/^El Pollón\s*/i, '')
    .split(/[—–-]/)[0]
    .trim();
  return (fromName || 'Elige sucursal').toUpperCase();
}

/** Imagen para círculos 「Explora nuestro menú」: foto de categoría (admin) o primer plato como respaldo. */
function categoryExploreImage(category, productsByCategory) {
  const adminImage = category.imageUrl || category.image;
  if (adminImage) return resolveMediaUrl(adminImage);

  const products = [...(productsByCategory[category.id] || [])]
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const coverProduct = products.find((p) => p.imageUrl || p.image) || products[0];
  const productImage = coverProduct?.imageUrl || coverProduct?.image;
  if (productImage) return resolveMediaUrl(productImage);
  return '/img/todo el menu.png';
}

export function Home() {
  const { setIsOpen } = useCart();
  const { branch, branches, setBranch } = useBranch();
  const navigate = useNavigate();
  const { categories, productsByCategory, products: menuProducts } = useBranchMenu();
  const { bestsellers } = useBestsellers(branch?.id, menuProducts);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const menuScrollRef = useRef(null);
  const [canScrollMenuLeft, setCanScrollMenuLeft] = useState(false);
  const [canScrollMenuRight, setCanScrollMenuRight] = useState(false);
  const location = useLocation();

  const branchPaymentMethods = useMemo(
    () => getAvailablePaymentMethods(branch),
    [branch],
  );
  const paymentSummary = useMemo(
    () => formatPaymentMethodsSummary(branch),
    [branch],
  );

  const updateMenuScrollHints = useCallback(() => {
    const el = menuScrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollMenuLeft(el.scrollLeft > 6);
    setCanScrollMenuRight(maxScroll > 6 && el.scrollLeft < maxScroll - 6);
  }, []);

  const scrollMenuCategories = (direction) => {
    menuScrollRef.current?.scrollBy({ left: direction * 150, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!location.hash) return undefined;
    const id = location.hash.replace('#', '');
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [location.hash]);

  const promos = (() => {
    const featured = menuProducts.filter((p) => p.isPromotion || p.isFeatured);
    const list = featured.length
      ? featured.slice(0, 4)
      : (productsByCategory[categories[0]?.id] || []).slice(0, 4);
    return list.map((p) => ({
      ...p,
      categoryId: resolveProductCategoryId(p, productsByCategory, categories),
    }));
  })();
  const menuCircles = categories.slice(0, 8).map((c) => ({
    id: c.id,
    label: c.name,
    img: categoryExploreImage(c, productsByCategory),
  }));

  useEffect(() => {
    const timer = window.setTimeout(updateMenuScrollHints, 80);
    const el = menuScrollRef.current;
    if (!el) return () => window.clearTimeout(timer);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateMenuScrollHints) : null;
    ro?.observe(el);
    window.addEventListener('resize', updateMenuScrollHints);
    return () => {
      window.clearTimeout(timer);
      ro?.disconnect();
      window.removeEventListener('resize', updateMenuScrollHints);
    };
  }, [categories.length, menuCircles.length, updateMenuScrollHints]);

  const openProductModal = (p) => {
    setSelectedProduct({ product: p, categoryId: p.categoryId });
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader onOpenCart={() => setIsOpen(true)} />
      <CartDrawer />
      <CheckoutModal />
      <WhatsAppFab />

      {/* HERO */}
      <main id="contenido-principal">
      <section className="relative min-h-[520px] overflow-hidden md:min-h-[580px]">
        <div
          key={branch?.id || 'hero'}
          className="home-hero-bg"
          style={{ backgroundImage: `url(${JSON.stringify(resolveMediaUrl(branch?.heroImageUrl, DEFAULT_HERO_IMAGE))})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/30" />
        <div className="relative mx-auto flex max-w-[1400px] flex-col justify-center px-4 py-16 md:py-24">
          <span className="mb-4 inline-flex w-fit items-center gap-2 rounded border border-pollon-red/50 bg-pollon-red/20 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-sm">
            <Flame className="h-4 w-4 text-pollon-orange" />
            Pollo a la brasa premium
          </span>
          <h1 className="max-w-3xl font-display text-5xl leading-[0.95] text-white md:text-7xl lg:text-8xl">
            EL SABOR QUE<br /><span className="text-pollon-gold">TE ENCANTA</span>
          </h1>
          <div key={`city-${branch?.id || 'none'}`} className="home-hero-city">
            <span className="home-hero-city__icon" aria-hidden>
              <MapPin className="home-hero-city__pin" strokeWidth={1.75} />
            </span>
            <p className="home-hero-city__name">{heroCityLabel(branch)}</p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/tienda"
              className="inline-flex items-center gap-2 rounded-lg bg-pollon-red px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition hover:bg-pollon-red-dark"
            >
              Pedir ahora <ChevronRight className="h-5 w-5" />
            </Link>
            <Link
              to="/tienda"
              className="inline-flex items-center rounded-lg border-2 border-white px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-white hover:text-pollon-black"
            >
              Ver menú
            </Link>
            <Link
              to="/sucursal"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-white/60 px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:border-white"
            >
              <MapPin className="h-4 w-4" /> Elegir sucursal
            </Link>
          </div>
        </div>
      </section>

      {/* Barra de confianza bajo hero */}
      <div className="home-trust-bar border-b border-gray-200 bg-white py-3 shadow-sm md:py-4">
        <div className="home-trust-bar__fade home-trust-bar__fade--left" aria-hidden />
        <div className="home-trust-bar__fade home-trust-bar__fade--right" aria-hidden />
        <div className="home-trust-bar__track scrollbar-hide">
          {TRUST_BAR_ITEMS.map(({ icon: Icon, label }) => (
            <span key={label} className="home-trust-bar__item">
              <Icon className="home-trust-bar__icon" strokeWidth={2} aria-hidden />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* SUCURSALES */}
      <section className="bg-pollon-cream py-14">
        <div className="mx-auto max-w-[1400px] px-4">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-4xl text-pollon-black md:text-5xl">
                ELIGE TU <span className="text-pollon-red">SUCURSAL</span>
              </h2>
              <p className="mt-1 text-gray-600">Selecciona la sucursal más cercana para ver menú, horarios y delivery</p>
            </div>
            <Link
              to="/sucursal"
              className="rounded-lg border-2 border-pollon-red px-6 py-2.5 text-sm font-bold uppercase text-pollon-red transition hover:bg-pollon-red hover:text-white"
            >
              Ver todas las sucursales
            </Link>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
            {branches.map((b) => (
              <article
                key={b.id}
                className="card-hover w-[300px] shrink-0 snap-start rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold leading-tight text-pollon-black">{b.name}</h3>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                    b.comingSoon ? 'bg-orange-100 text-orange-700' : isBranchOpenNow(b) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {b.comingSoon ? 'Próximamente' : isBranchOpenNow(b) ? 'Abierto' : 'Cerrado'}
                  </span>
                </div>
                <ul className="mt-4 space-y-2 text-xs text-gray-600">
                  <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pollon-red" />{b.address}</li>
                  <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0 text-pollon-red" />{b.phone}</li>
                  <li className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 shrink-0 text-pollon-red" />{b.schedule}</li>
                  <li className="flex items-center gap-2"><Bike className="h-3.5 w-3.5 shrink-0 text-pollon-red" />Delivery {formatDeliveryCost(b.deliveryCost)} · {b.deliveryEta}</li>
                  <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pollon-red" />Zona: {b.deliveryZones}</li>
                </ul>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    disabled={b.comingSoon}
                    onClick={() => { if (!b.comingSoon) { setBranch(b); navigate('/tienda'); } }}
                    className="flex-1 rounded-lg bg-pollon-red py-2 text-xs font-bold uppercase text-white disabled:opacity-40"
                  >
                    Pedir ahora
                  </button>
                  <Link
                    to="/sucursal"
                    className="flex-1 rounded-lg border border-pollon-red py-2 text-center text-xs font-bold uppercase text-pollon-red"
                  >
                    Ver ubicación
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PROMOCIONES DESTACADAS */}
      <section className="bg-pollon-cream py-14">
        <div className="mx-auto max-w-[1400px] px-4">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-4xl text-pollon-black md:text-5xl">
              PROMOCIONES <span className="text-pollon-red">DESTACADAS</span>
            </h2>
            <Link to="/tienda" className="text-sm font-bold text-pollon-red hover:underline">
              Ver todas →
            </Link>
          </div>
          <div className="home-promo-grid">
            {promos.length ? promos.map((p, i) => {
              const categoryId = p.categoryId || resolveProductCategoryId(p, productsByCategory, categories);
              const categoryName = categories.find((c) => c.id === categoryId)?.name;
              return (
              <article key={p.id || p.name + i} className="home-promo-card">
                <div className="home-promo-card__media">
                  <img
                    src={imgSrc(p.image || p.imageUrl)}
                    alt={p.name}
                    className="home-promo-card__img"
                    loading="lazy"
                    onError={(e) => { e.target.src = '/img/todo el menu.png'; }}
                  />
                  <span className="home-promo-card__favorite" title="Plato destacado" aria-label="Plato destacado">
                    <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="currentColor" strokeWidth={0} />
                  </span>
                </div>
                <div className="home-promo-card__body">
                  <h3 className="home-promo-card__title">{p.name}</h3>
                  <p className="home-promo-card__desc">{p.description}</p>
                  {categoryName && (
                    <p className="home-promo-card__cat">{categoryName}</p>
                  )}
                  <div className="home-promo-card__footer">
                    <span className="home-promo-card__price">{money(p.price)}</span>
                    <Link
                      to={storeCategoryUrl(categoryId, branch?.id)}
                      className="home-promo-card__cta"
                      aria-label={categoryName ? `Ver más en ${categoryName}` : 'Ver más en el menú'}
                    >
                      Ver más
                    </Link>
                  </div>
                </div>
              </article>
            );}) : (
              <p className="col-span-full py-8 text-center text-gray-500">
                {branch ? 'Sin promociones cargadas. Configúralas en el panel admin.' : 'Selecciona una sucursal para ver promociones.'}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Descubre nuestros platos — categorías */}
      <section className="home-menu-discover py-14">
        <div className="mx-auto max-w-[1400px] px-4">
          <h2 className="mb-8 text-center font-display text-4xl text-pollon-black md:text-5xl">
            DESCUBRE NUESTROS <span className="text-pollon-red">PLATOS</span>
          </h2>
          <div className="home-menu-discover__wrap">
            <div className="home-menu-discover__fade home-menu-discover__fade--left" aria-hidden />
            <div className="home-menu-discover__fade home-menu-discover__fade--right" aria-hidden />
            <div
              ref={menuScrollRef}
              onScroll={updateMenuScrollHints}
              className="home-menu-discover__track category-scroll-track scrollbar-hide"
            >
              {menuCircles.length ? menuCircles.map((c) => (
                <Link
                  key={c.id}
                  to={storeCategoryUrl(c.id, branch?.id)}
                  className="home-menu-discover__item group"
                >
                  <div className="home-menu-discover__circle">
                    <img src={c.img} alt={c.label} className="h-full w-full object-cover" onError={(e) => { e.target.src = '/img/todo el menu.png'; }} />
                  </div>
                  <span className="home-menu-discover__label">{c.label}</span>
                </Link>
              )) : (
                <p className="w-full py-6 text-center text-gray-500">
                  {branch ? 'Cargando categorías…' : (
                    <>Elige tu <Link to="/sucursal" className="font-bold text-pollon-red underline">sucursal</Link> para ver el menú</>
                  )}
                </p>
              )}
            </div>
            {menuCircles.length > 1 && (
              <div className="home-menu-discover__scroll-hints lg:hidden">
                <button
                  type="button"
                  className="home-menu-discover__scroll-btn"
                  aria-label="Desplazar categorías a la izquierda"
                  disabled={!canScrollMenuLeft}
                  onClick={() => scrollMenuCategories(-1)}
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
                </button>
                <span className="home-menu-discover__scroll-text">Desliza para explorar</span>
                <button
                  type="button"
                  className="home-menu-discover__scroll-btn"
                  aria-label="Desplazar categorías a la derecha"
                  disabled={!canScrollMenuRight}
                  onClick={() => scrollMenuCategories(1)}
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* TESTIMONIOS — sección destacada */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-[1400px] px-4">
          <h2 className="mb-10 text-center font-display text-4xl text-pollon-black md:text-5xl">
            LO QUE DICEN <span className="text-pollon-red">NUESTROS CLIENTES</span>
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <article key={t.name} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pollon-red text-lg font-bold text-white">{t.name[0]}</div>
                  <div>
                    <p className="font-bold">{t.name}</p>
                    <div className="flex gap-0.5">
                      {Array.from({ length: t.stars }).map((_, j) => (
                        <Star key={j} className="h-3.5 w-3.5 fill-pollon-gold text-pollon-gold" />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm italic text-gray-600">&ldquo;{t.text}&rdquo;</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 3 COLUMNAS */}
      <section className="bg-pollon-cream py-14">
        <div className="mx-auto grid max-w-[1400px] gap-8 px-4 lg:grid-cols-3">
          {/* Más vendidos */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-1 border-b-2 border-pollon-red pb-2 font-display text-2xl text-pollon-black">
              MÁS VENDIDOS
            </h3>
            <p className="mb-4 text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Actualizado según ventas de la semana
            </p>
            <AdminScrollPanel maxRows={BESTSELLERS_VISIBLE} variant="card" className="home-bestsellers-scroll rounded-xl">
              <ul className="space-y-4 pr-1">
                {bestsellers.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <img
                      src={imgSrc(p.image || p.imageUrl)}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                      onError={(e) => { e.target.src = '/img/todo el menu.png'; }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{p.name}</p>
                      <p className="truncate text-xs text-gray-500">{p.description?.slice(0, 40)}</p>
                      <p className="font-bold text-pollon-red">{money(p.price)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openProductModal(p)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pollon-red text-white hover:bg-pollon-red-dark"
                      aria-label={`Agregar ${p.name}`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </li>
                ))}
                {!bestsellers.length && (
                  <li className="py-6 text-center text-sm text-gray-500">Sin datos de ventas aún</li>
                )}
              </ul>
            </AdminScrollPanel>
            {bestsellers.length > BESTSELLERS_VISIBLE && (
              <p className="mt-2 text-center text-[10px] font-medium text-gray-400">
                Desplaza para ver más platos ↓
              </p>
            )}
            <Link to="/tienda" className="mt-4 block text-center text-sm font-semibold text-pollon-red hover:underline">
              Ver menú completo →
            </Link>
          </div>

          {/* Por qué elegirnos */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-4 border-b-2 border-pollon-red pb-2 font-display text-2xl text-pollon-black">
              POR QUÉ ELEGIRNOS
            </h3>
            <ul className="space-y-4">
              {WHY_US.map((item) => {
                const desc = item.title === 'Pago al recibir'
                  ? `Pagas al recibir: ${paymentSummary}, según la sucursal.`
                  : item.desc;
                return (
                  <li key={item.title} className="flex gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-pollon-red">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-pollon-black">{item.title}</p>
                      <p className="mt-0.5 text-sm leading-snug text-gray-600">{desc}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Pagos aceptados — según sucursal activa */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-1 border-b-2 border-pollon-red pb-2 font-display text-2xl text-pollon-black">
              MÉTODOS DE PAGO
            </h3>
            <p className="mb-4 text-[11px] font-medium uppercase tracking-wide text-gray-400">
              {branch?.name ? `Disponibles en ${branch.name}` : 'Según la sucursal seleccionada'}
            </p>
            <div className="space-y-3">
              {branchPaymentMethods.map((method) => {
                const style = PAYMENT_CARD_STYLES[method.tone] || PAYMENT_CARD_STYLES.cash;
                return (
                  <div
                    key={method.id}
                    className={`flex items-start gap-3 rounded-xl p-4 ${style.box}`}
                  >
                    <span className="text-2xl" aria-hidden>{method.icon}</span>
                    <div>
                      <p className={`font-bold ${style.title}`}>{method.label}</p>
                      <p className={`text-sm ${style.desc}`}>{method.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Todos los pagos son al recibir el pedido. No hay cobro online.
            </p>
          </div>
        </div>
      </section>

      {/* Guía: pedir y seguimiento en tiempo real */}
      <section id="guia-pedido" className="home-order-guide relative scroll-mt-28 overflow-hidden bg-pollon-red py-10 text-white md:scroll-mt-32 md:py-12">
        <div className="pointer-events-none absolute -right-20 top-0 h-64 w-64 rounded-full bg-pollon-gold/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 bottom-0 h-56 w-56 rounded-full bg-black/20 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4">
          <header className="home-order-guide__header mb-7 text-center lg:mb-8 lg:text-left">
            <span className="home-order-guide__badge">Guía rápida · 100% web</span>
            <h2 className="home-order-guide__title mt-2 font-display">
              PIDE Y SIGUE TU PEDIDO <span className="text-pollon-gold">EN POCOS PASOS</span>
            </h2>
            <p className="home-order-guide__subtitle mx-auto mt-2 max-w-2xl lg:mx-0">
              Sin descargar apps. Estados en vivo y mapa del repartidor desde el navegador.
            </p>
          </header>

          <div className="home-order-guide__layout">
            {/* Cómo pedir */}
            <article className="home-order-guide__card">
              <h3 className="home-order-guide__card-title">
                <ShoppingBag className="h-5 w-5 shrink-0 text-pollon-gold" aria-hidden />
                Cómo hacer tu pedido
              </h3>
              <ol className="home-order-guide__steps home-order-guide__steps--grid mt-4">
                {HOME_ORDER_STEPS.map((s) => (
                  <li key={s.n} className="home-order-guide__step home-order-guide__step--compact">
                    <span className="home-order-guide__step-num">{s.n}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <s.icon className="h-3.5 w-3.5 shrink-0 text-white/80" aria-hidden />
                        <p className="home-order-guide__step-title">{s.title}</p>
                      </div>
                      <p className="home-order-guide__step-desc">{s.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link to="/tienda" className="home-order-guide__cta home-order-guide__cta--primary mt-4">
                Pedir ahora <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </article>

            {/* Confirmación y seguimiento */}
            <article className="home-order-guide__card">
              <h3 className="home-order-guide__card-title">
                <PackageSearch className="h-5 w-5 shrink-0 text-pollon-gold" aria-hidden />
                Confirmación y seguimiento
              </h3>
              <p className="home-order-guide__card-lead mt-2">
                Tu código al instante. Estados en vivo. En delivery: mapa del repartidor + ETA.
              </p>
              <ol className="home-order-guide__steps mt-3">
                {HOME_TRACK_STEPS.map((s) => (
                  <li key={s.n} className="home-order-guide__step home-order-guide__step--compact">
                    <span className="home-order-guide__step-num home-order-guide__step-num--gold">{s.n}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <s.icon className="h-3.5 w-3.5 shrink-0 text-white/80" aria-hidden />
                        <p className="home-order-guide__step-title">{s.title}</p>
                      </div>
                      <p className="home-order-guide__step-desc">{s.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link to="/cuenta/pedidos" className="home-order-guide__cta home-order-guide__cta--outline mt-4">
                Ver mis pedidos
              </Link>
            </article>

            {/* Showcase: carrito + estados cliente + mapa en vivo */}
            <div className="home-order-guide__showcase">
              <div className="home-order-guide__showcase-col">
                <div className="home-order-guide__showcase-head">
                  <span className="home-order-guide__showcase-tag">Paso 2 · Menú</span>
                  <h4 className="home-order-guide__showcase-title">Agrega al carrito</h4>
                  <p className="home-order-guide__showcase-desc">
                    Elige un plato, personaliza opciones y pulsa «Agregar al carrito». El ícono del carrito muestra tus items.
                  </p>
                </div>
                <div className="home-order-guide__phone">
                  <div className="home-order-guide__phone-screen">
                    <div className="home-order-guide__phone-bar">EL POLLÓN · TIENDA</div>
                    <div className="home-order-guide__phone-product">
                      <div className="home-order-guide__phone-img" aria-hidden />
                      <p className="home-order-guide__phone-name">Combo Familiar</p>
                      <p className="home-order-guide__phone-price">$23.500</p>
                    </div>
                    <div className="home-order-guide__phone-action">
                      <p className="home-order-guide__phone-hint">Toca el plato → personaliza</p>
                      <span className="home-order-guide__phone-btn">
                        <ShoppingCart className="h-3.5 w-3.5" aria-hidden />
                        Agregar al carrito
                      </span>
                    </div>
                    <div className="home-order-guide__phone-footer">
                      <ShoppingCart className="h-3.5 w-3.5" aria-hidden />
                      Carrito · 2 items
                    </div>
                  </div>
                </div>
              </div>

              <div className="home-order-guide__showcase-col home-order-guide__showcase-col--status">
                <p className="home-order-guide__panel-label">Seguimiento del cliente</p>
                <ul className="home-order-guide__status-list">
                  {HOME_CLIENT_TRACK_STEPS.map((st, i) => (
                    <li
                      key={st.label}
                      className={`home-order-guide__status-item${st.active ? ' is-active' : ''}`}
                    >
                      <span className="home-order-guide__status-dot">{i + 1}</span>
                      <span>{st.label}</span>
                    </li>
                  ))}
                </ul>
                <p className="home-order-guide__status-chip">
                  <Map className="h-3 w-3 shrink-0" aria-hidden />
                  En delivery aparece mapa + ETA
                </p>
                <p className="home-order-guide__status-note">
                  Sin app del repartidor: Confirmado → Cocina → Reparto → Entregado
                </p>
              </div>

              <div className="home-order-guide__showcase-col">
                <div className="home-order-guide__showcase-head">
                  <span className="home-order-guide__showcase-tag">Paso 4 · Mapa en vivo</span>
                  <h4 className="home-order-guide__showcase-title">Código y mapa</h4>
                  <p className="home-order-guide__showcase-desc">
                    En Mis pedidos ves estados; en delivery el mapa del repartidor en tiempo real.
                  </p>
                </div>
                <div className="home-order-guide__phone">
                  <div className="home-order-guide__phone-screen home-order-guide__phone-screen--track">
                    <div className="home-order-guide__phone-bar">EL POLLÓN · SEGUIMIENTO</div>
                    <div className="home-order-guide__live-head">
                      <p className="home-order-guide__phone-code">#000142</p>
                      <span className="home-order-guide__live-badge">
                        <Radio className="h-2.5 w-2.5" aria-hidden />
                        En vivo en mapa
                      </span>
                    </div>
                    <div className="home-order-guide__mini-map" aria-hidden>
                      <img
                        src="/img/guide-live-map.png"
                        alt=""
                        className="home-order-guide__mini-map-img"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <div className="home-order-guide__phone-track home-order-guide__phone-track--live">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">En reparto</p>
                      <p className="text-sm font-bold text-gray-900">Llega en ~12 min</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <ul className="home-order-guide__features-bar">
              {HOME_GUIDE_FEATURES.map(({ icon: Icon, t, d }) => (
                <li key={t} className="home-order-guide__feature">
                  <Icon className="h-5 w-5 shrink-0 text-pollon-gold" aria-hidden />
                  <div>
                    <p className="home-order-guide__feature-title">{t}</p>
                    <p className="home-order-guide__feature-desc">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      </main>

      {selectedProduct && (
        <ProductModal
          product={{ ...selectedProduct.product, image: selectedProduct.product.image || selectedProduct.product.imageUrl }}
          category={selectedProduct.categoryId}
          categoryName={categories.find((c) => c.id === selectedProduct.categoryId)?.name}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      <SiteFooter />
    </div>
  );
}
