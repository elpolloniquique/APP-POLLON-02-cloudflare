import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart, Phone, User, MapPin, ChevronDown, Menu, X,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useBranch } from '../../context/BranchContext';
import { useBranchMenu, prefetchBranchMenus } from '../../context/BranchMenuContext';
import { useAuth } from '../../context/AuthContext';
import { isBranchOpenNow } from '../../services/branchService';
import { money, storeCategoryUrl } from '../../utils/format';
import { AuthModal } from '../auth/AuthModal';
import { HeaderCategoryNav } from './HeaderCategoryNav';

function selectBranchWithCartConfirm(b, branch, setBranch, resetForBranch, items, cartBranchId, onDone, syncBranchUrl) {
  if (!b || b.comingSoon) return;
  if (b.id === branch?.id) { onDone?.(); return; }
  if (items.length > 0 && cartBranchId && cartBranchId !== b.id) {
    if (!window.confirm('Al cambiar de sucursal se vaciará tu carrito actual. ¿Deseas continuar?')) return;
    resetForBranch(b.id);
  }
  setBranch(b);
  syncBranchUrl?.(b);
  prefetchBranchMenus([b.id]);
  onDone?.();
}

const NAV_HOME = { label: 'INICIO', path: '/', categoryId: null };

/** Subtítulo siempre ≤ ancho de "El Pollón" (autoajuste de tamaño). */
function HeaderBrandText() {
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);

  useEffect(() => {
    const titleEl = titleRef.current;
    const subtitleEl = subtitleRef.current;
    if (!titleEl || !subtitleEl) return undefined;

    const fitSubtitle = () => {
      const titleW = titleEl.getBoundingClientRect().width;
      if (!titleW) return;

      // Medir con el tamaño base del CSS
      subtitleEl.style.fontSize = '';
      subtitleEl.style.width = 'max-content';

      const subW = subtitleEl.scrollWidth;
      if (subW > titleW && subW > 0) {
        const computed = window.getComputedStyle(subtitleEl);
        const basePx = parseFloat(computed.fontSize) || 12;
        // Un pelín más chico que el ratio exacto para no rozar el borde
        const nextPx = Math.max(basePx * (titleW / subW) * 0.98, 7.5);
        subtitleEl.style.fontSize = `${nextPx}px`;
      }
      subtitleEl.style.width = `${titleW}px`;
    };

    const scheduleFit = () => {
      window.requestAnimationFrame(fitSubtitle);
    };

    scheduleFit();
    const ro = new ResizeObserver(scheduleFit);
    ro.observe(titleEl);
    window.addEventListener('resize', scheduleFit);
    document.fonts?.ready?.then(scheduleFit).catch(() => {});

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', scheduleFit);
    };
  }, []);

  return (
    <div className="header-brand__text">
      <p ref={titleRef} className="header-brand__title">El Pollón</p>
      <p ref={subtitleRef} className="header-brand__subtitle">Restaurante Pollería</p>
    </div>
  );
}

function buildNavMenu(categories, branchId) {
  return [
    NAV_HOME,
    ...categories.map((c) => ({
      label: c.name,
      path: storeCategoryUrl(c.id, branchId),
      categoryId: c.id,
      slug: c.slug,
    })),
  ];
}

function formatSchedule(branch) {
  const raw = branch?.schedule || branch?.opening_hours;
  if (raw && raw.length > 10) {
    return raw.replace('Lun-Dom:', 'Lun – Dom:').replace('11:30 - 23:00', '11:30 a.m. – 11:00 p.m.');
  }
  return 'Lun – Dom: 11:30 a.m. – 11:00 p.m.';
}

/** Solo el local/ciudad: "Iquique", "Alto Hospicio" (sin guiones al inicio) */
function branchPlaceName(branch) {
  const city = String(branch?.city || '').trim();
  let place = String(branch?.name || '')
    .replace(/^El\s*Poll[oó]n\s*/i, '')
    .replace(/^Poll[oó]n\s*/i, '')
    .trim();

  // Quitar rayas/underscores/guiones al comienzo (_, -, –, —)
  place = place.replace(/^[\s_|·•./\\-–—−‐‑]+/u, '').trim();
  place = place.replace(/\s+/g, ' ').trim();

  if (!place || /^[\s_\-–—]+$/u.test(place)) {
    place = city;
  }
  return place || city || 'Sucursal';
}

/** PC: siempre "El Pollón _ Iquique" / "El Pollón _ Alto Hospicio" */
function branchDesktopLabel(branch) {
  if (!branch?.name && !branch?.city) return 'Seleccionar';
  return `El Pollón _ ${branchPlaceName(branch)}`;
}

/** Móvil (campo cerrado): solo el lugar, sin raya — prioriza ciudad */
function branchMobileLabel(branch) {
  const city = String(branch?.city || '').trim();
  if (city) return city;
  return branchPlaceName(branch);
}

function isNavActive(item, location) {
  if (item.path === '/') return location.pathname === '/';
  if (location.pathname !== '/tienda') return false;
  const params = new URLSearchParams(location.search);
  const cat = params.get('cat');
  return cat === item.categoryId || cat === item.slug;
}

function BranchDropdown({
  branch, branches, branchLabel, branchOpen, setBranchOpen,
  items, cartBranchId, setBranch, resetForBranch, syncBranchUrl,
  variant = 'desktop',
}) {
  const isMobile = variant === 'mobile';

  return (
    <div className={`relative ${isMobile ? 'w-full min-w-0' : 'max-w-[320px] xl:max-w-sm'}`}>
      {isMobile ? (
        <p className="mb-1 text-center text-[11px] font-bold uppercase tracking-wider text-pollon-red">
          Elige tu sucursal
        </p>
      ) : (
        <p className="mb-1 text-xs font-semibold text-gray-600">Sucursal actual:</p>
      )}
      <button
        type="button"
        onClick={() => {
          const next = !branchOpen;
          setBranchOpen(next);
          if (next) prefetchBranchMenus(branches.map((x) => x.id));
        }}
        className={`flex w-full items-center rounded-lg border border-gray-200 bg-white text-left shadow-sm transition hover:border-pollon-red/40 ${
          isMobile ? 'gap-1.5 px-2.5 py-2' : 'gap-2 px-3.5 py-2'
        }`}
      >
        <MapPin className={`shrink-0 text-pollon-red ${isMobile ? 'h-4 w-4' : 'h-4 w-4'}`} strokeWidth={2.5} />
        <span className={`min-w-0 flex-1 truncate font-bold text-gray-900 ${isMobile ? 'text-xs' : 'text-sm'}`}>
          {branchLabel}
        </span>
        <ChevronDown className={`shrink-0 text-gray-400 transition ${branchOpen ? 'rotate-180' : ''} ${isMobile ? 'h-4 w-4' : 'h-4 w-4'}`} />
      </button>
      {!isMobile && (
        <Link
          to="/sucursal"
          onClick={() => setBranchOpen(false)}
          className="mt-1 inline-block text-xs font-semibold text-pollon-red hover:underline"
        >
          Cambiar sucursal
        </Link>
      )}
      {branchOpen && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setBranchOpen(false)} aria-hidden />
          <div className={`absolute left-0 right-0 top-full z-[70] mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-100 bg-white py-1 shadow-2xl ${isMobile ? 'min-w-[200px]' : ''}`}>
            {branches.map((b) => (
              <button
                key={b.id}
                type="button"
                disabled={b.comingSoon}
                onClick={() => selectBranchWithCartConfirm(
                  b, branch, setBranch, resetForBranch, items, cartBranchId,
                  () => setBranchOpen(false),
                  syncBranchUrl,
                )}
                className={`block w-full px-4 py-3 text-left text-base hover:bg-red-50 disabled:opacity-40 ${
                  branch?.id === b.id ? 'bg-red-50 font-bold text-pollon-red' : 'text-gray-800'
                }`}
              >
                {branchDesktopLabel(b)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function cartBtnClass(hasItems, justAdded, extra = '') {
  return [
    'header-cart-btn',
    extra,
    hasItems && 'header-cart-btn--active',
    justAdded && 'header-cart-btn--added',
  ]
    .filter(Boolean)
    .join(' ');
}

function HeaderCartButton({ onClick, itemCount, subtotal, variant = 'desktop' }) {
  const hasItems = itemCount > 0;
  const [justAdded, setJustAdded] = useState(false);
  const prevCountRef = useRef(itemCount);

  useEffect(() => {
    if (itemCount > prevCountRef.current) {
      setJustAdded(true);
      const timer = window.setTimeout(() => setJustAdded(false), 720);
      prevCountRef.current = itemCount;
      return () => window.clearTimeout(timer);
    }
    prevCountRef.current = itemCount;
    return undefined;
  }, [itemCount]);

  const badge = hasItems ? (
    <span className="header-cart-btn__badge" aria-hidden>
      {itemCount > (variant === 'mobile' ? 9 : 99) ? (variant === 'mobile' ? '9+' : '99+') : itemCount}
    </span>
  ) : null;

  if (variant === 'mobile') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cartBtnClass(hasItems, justAdded, 'header-cart-btn--icon-only')}
        aria-label={hasItems ? `Mi pedido, ${itemCount} productos` : 'Mi pedido'}
      >
        <span className="header-cart-btn__motion">
          <ShoppingCart className="header-cart-btn__icon text-pollon-red" strokeWidth={2} />
          {badge}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cartBtnClass(hasItems, justAdded)}
      aria-label={hasItems ? `Mi pedido, ${itemCount} productos, ${money(subtotal)}` : 'Mi pedido'}
    >
      <span className="header-cart-btn__motion">
        <ShoppingCart className="header-cart-btn__icon header-main-bar__cart-icon text-pollon-red" strokeWidth={2} />
        {badge}
      </span>
      <div className="header-cart-btn__copy text-left">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">Mi pedido</p>
        <p className="header-cart-btn__total text-sm font-bold leading-tight text-gray-900">{money(subtotal)}</p>
      </div>
    </button>
  );
}

export function SiteHeader({ onOpenCart, variant = 'full' }) {
  const { itemCount, subtotal, items, cartBranchId, resetForBranch } = useCart();
  const { branch, branches, setBranch } = useBranch();
  const { categories } = useBranchMenu();
  const navMenu = buildNavMenu(categories, branch?.id);
  const { isAuthenticated, isCustomer, isStaff, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [now, setNow] = useState(new Date());
  const [branchOpen, setBranchOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState('login');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (location.state?.openAuth) {
      setAuthOpen(true);
      setAuthTab('login');
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setBranchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const dateStrDesktop = now.toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const dateStrMobile = now.toLocaleDateString('es-CL', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
  const timeStr = now.toLocaleTimeString('es-CL', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const isOpen = branch ? isBranchOpenNow(branch) : false;
  const branchLabelDesktop = branchDesktopLabel(branch);
  const branchLabelMobile = branchMobileLabel(branch);
  const scheduleText = formatSchedule(branch);
  const phoneDisplay = branch?.phone || '+56 9 8692 5310';
  const showNav = variant === 'full';

  const handleAccountClick = (tab = 'login') => {
    if (isAuthenticated && isCustomer) {
      navigate('/cuenta');
      setMobileOpen(false);
      return;
    }
    if (isAuthenticated && isStaff) {
      navigate('/admin');
      setMobileOpen(false);
      return;
    }
    setAuthTab(tab);
    setAuthOpen(true);
    setMobileOpen(false);
  };

  const statusBadgeClass = (mobile) =>
    `header-top-bar__status shrink-0 rounded-full font-extrabold uppercase tracking-wide ${
      isOpen ? 'bg-[#4ade80] text-black shadow-sm' : 'bg-white/20 text-white'
    } ${mobile ? 'header-top-bar__status--mobile' : ''}`;

  const syncBranchUrl = useCallback((b) => {
    if (!b?.id || location.pathname !== '/tienda') return;
    const params = new URLSearchParams(location.search);
    if (params.get('branch') === b.id) return;
    params.set('branch', b.id);
    navigate(
      { pathname: '/tienda', search: params.toString(), hash: location.hash },
      { replace: true },
    );
  }, [location.pathname, location.search, location.hash, navigate]);

  const branchDropdownProps = {
    branch,
    branches,
    branchOpen,
    setBranchOpen,
    items,
    cartBranchId,
    setBranch,
    resetForBranch,
    syncBranchUrl,
  };

  return (
    <>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultTab={authTab} />
      <header className="header-text-crisp sticky top-0 z-50 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">

        {/* ═══════════════ MÓVIL: barra superior ═══════════════ */}
        <div className="bg-pollon-red text-white lg:hidden">
          <div className="header-top-bar flex items-center justify-between gap-1.5 px-3 text-xs leading-snug sm:text-[13px]">
            <div className="flex min-w-0 shrink-0 items-center gap-1.5 tabular-nums font-medium">
              <span className="capitalize">{dateStrMobile}</span>
              <span className="text-white/50">|</span>
              <span className="font-bold">{timeStr}</span>
            </div>
            <p className="min-w-0 flex-1 truncate px-1 text-center text-[10px] font-medium text-white sm:text-xs">
              Horario: {scheduleText}
            </p>
            <span className={statusBadgeClass(true)}>
              {isOpen ? 'ABIERTO' : 'CERRADO'}
            </span>
          </div>
        </div>

        {/* ═══════════════ PC: barra superior ═══════════════ */}
        <div className="hidden bg-pollon-red text-white lg:block">
          <div className="header-top-bar mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 text-[13px] font-medium lg:text-sm">
            <div className="flex items-center gap-3">
              <span className="capitalize">{dateStrDesktop}</span>
              <span className="text-white/40">|</span>
              <span className="font-bold tabular-nums">{timeStr}</span>
            </div>
            <p className="flex-1 text-center text-sm lg:text-base">
              <span className="text-white/80">Horario de atención: </span>
              <span className="font-semibold">{scheduleText}</span>
            </p>
            <span className={statusBadgeClass(false)}>
              {isOpen ? 'ABIERTO' : 'CERRADO'}
            </span>
          </div>
        </div>

        {/* ═══════════════ MÓVIL: barra principal (logo | sucursal | carrito+menú) ═══════════════ */}
        <div className="border-b border-gray-100 bg-white lg:hidden">
          <div className="flex items-stretch gap-1.5 px-2 py-2.5">
            <Link to="/" className="header-brand header-brand--mobile flex shrink-0 items-center">
              <img
                src={branch?.logoUrl || '/img/logo pollon.png'}
                alt={branch?.name || 'El Pollón'}
                className="header-brand__logo"
                width={72}
                height={72}
                decoding="async"
              />
              <HeaderBrandText />
            </Link>

            <div className="flex min-w-0 flex-1 items-center justify-center px-0.5">
              <BranchDropdown
                {...branchDropdownProps}
                branchLabel={branchLabelMobile}
                variant="mobile"
              />
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <HeaderCartButton onClick={onOpenCart} itemCount={itemCount} subtotal={subtotal} variant="mobile" />
              {showNav && (
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-800 shadow-sm"
                  aria-label="Abrir menú"
                >
                  <Menu className="h-5 w-5" strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════ PC: barra principal blanca ═══════════════ */}
        <div className="hidden border-b border-gray-100 bg-white lg:block">
          <div className="header-main-bar mx-auto flex max-w-[1400px] items-center px-4">
            <Link to="/" className="header-main-bar__brand header-brand flex shrink-0 items-center gap-3">
              <img
                src={branch?.logoUrl || '/img/logo pollon.png'}
                alt={branch?.name || 'El Pollón'}
                className="header-brand__logo header-brand__logo--lg"
                width={88}
                height={88}
                decoding="async"
              />
              <HeaderBrandText />
            </Link>

            <div className="hidden min-w-0 flex-1 justify-center px-3 lg:flex">
              <BranchDropdown
                {...branchDropdownProps}
                branchLabel={branchLabelDesktop}
                variant="desktop"
              />
            </div>

            <a href={`tel:${phoneDisplay.replace(/\s/g, '')}`} className="header-main-bar__phone hidden shrink-0 items-center gap-2.5 lg:flex">
              <span className="header-main-bar__phone-ring flex items-center justify-center rounded-full border-2 border-pollon-red text-pollon-red">
                <Phone className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              <div>
                <p className="text-sm font-bold leading-tight text-gray-900">{phoneDisplay}</p>
                <p className="text-xs text-gray-600">Llámanos o escríbenos</p>
              </div>
            </a>

            <div className="header-main-bar__actions ml-auto flex items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <User className="h-6 w-6 shrink-0 text-gray-700" strokeWidth={1.5} />
                {isAuthenticated && isCustomer ? (
                  <button
                    type="button"
                    onClick={() => handleAccountClick('login')}
                    className="text-left text-sm font-semibold text-pollon-red hover:underline"
                  >
                    {profile?.fullName || 'Mi cuenta'}
                  </button>
                ) : (
                  <div className="flex flex-col text-xs leading-snug">
                    <button type="button" onClick={() => handleAccountClick('login')} className="text-left font-semibold text-gray-800 hover:text-pollon-red">
                      Iniciar sesión
                    </button>
                    <button type="button" onClick={() => handleAccountClick('register')} className="text-left font-medium text-gray-600 hover:text-pollon-red">
                      Registrarse
                    </button>
                  </div>
                )}
              </div>

              <HeaderCartButton onClick={onOpenCart} itemCount={itemCount} subtotal={subtotal} />
            </div>
          </div>
        </div>

        {showNav && <HeaderCategoryNav items={navMenu} />}
      </header>

      {/* Menú hamburguesa (móvil / tablet < lg) */}
      {showNav && mobileOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          />
          <aside className="absolute right-0 top-0 flex h-full w-[min(100%,320px)] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b bg-pollon-red px-4 py-4 text-white">
              <p className="font-brand text-lg font-bold">Menú</p>
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-1 hover:bg-white/10">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <a
                href={`tel:${phoneDisplay.replace(/\s/g, '')}`}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-pollon-red text-pollon-red">
                  <Phone className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold">{phoneDisplay}</p>
                  <p className="text-xs text-gray-500">Llámanos o escríbenos</p>
                </div>
              </a>

              <p className="mt-6 mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Categorías</p>
              <nav className="space-y-0.5">
                {navMenu.map((item) => {
                  const active = isNavActive(item, location);
                  return (
                    <Link
                      key={item.categoryId || 'inicio'}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={`font-brand block rounded-lg px-3 py-3 text-[15px] font-semibold ${
                        active ? 'bg-pollon-red text-white' : 'text-gray-800 hover:bg-red-50'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-6 space-y-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => handleAccountClick('login')}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left text-sm font-semibold"
                >
                  <User className="h-5 w-5 text-pollon-red" />
                  {isAuthenticated && isCustomer ? 'Mi cuenta' : 'Iniciar sesión'}
                </button>
                {!isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => handleAccountClick('register')}
                    className="w-full rounded-xl bg-pollon-red py-3 text-sm font-bold text-white"
                  >
                    Registrarse
                  </button>
                )}
                <Link
                  to="/sucursal"
                  onClick={() => setMobileOpen(false)}
                  className="block text-center text-sm font-semibold text-pollon-red"
                >
                  Ver todas las sucursales
                </Link>
              </div>
            </div>

            <div className="border-t p-4">
              <button
                type="button"
                onClick={() => { onOpenCart(); setMobileOpen(false); }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-pollon-red py-3.5 font-bold text-white"
              >
                <ShoppingCart className="h-5 w-5" />
                Mi pedido · {money(subtotal)}
                {itemCount > 0 && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-pollon-red">{itemCount}</span>
                )}
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
