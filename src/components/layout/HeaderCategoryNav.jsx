import { useRef, useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function isNavActive(item, location) {
  if (item.path === '/') return location.pathname === '/';
  if (location.pathname !== '/tienda') return false;
  const params = new URLSearchParams(location.search);
  const cat = params.get('cat');
  return cat === item.categoryId || cat === item.slug;
}

/**
 * Barra de categorías del header (fondo negro) con scroll horizontal y flechas.
 */
export function HeaderCategoryNav({ items }) {
  const location = useLocation();
  const trackRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;

    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', updateArrows);
      ro.disconnect();
    };
  }, [items.length, updateArrows]);

  useEffect(() => {
    if (!trackRef.current) return;
    const activeEl = trackRef.current.querySelector('[data-nav-active="true"]');
    activeEl?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [location.pathname, location.search, items.length]);

  const scrollBy = (dir) => {
    trackRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' });
  };

  if (!items?.length) return null;

  return (
    <nav className="border-b border-white/[0.06] bg-[#0a0a0a]" aria-label="Categorías del menú">
      <div className="relative mx-auto max-w-[1400px] px-2 sm:px-4">
        <div
          className={`header-category-nav__fade header-category-nav__fade--left ${
            canScrollLeft ? 'header-category-nav__fade--visible' : ''
          }`}
          aria-hidden={!canScrollLeft}
        >
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            disabled={!canScrollLeft}
            className="header-category-nav__arrow"
            aria-label="Categorías anteriores"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        <div
          ref={trackRef}
          className="header-category-nav__track category-scroll-track flex gap-0.5 overflow-x-auto overflow-y-hidden pl-1 pr-1 scrollbar-hide scroll-smooth"
        >
          {items.map((item) => {
            const active = isNavActive(item, location);
            return (
              <Link
                key={item.categoryId || 'inicio'}
                to={item.path}
                data-nav-active={active ? 'true' : 'false'}
                className={`header-category-nav__link shrink-0 whitespace-nowrap uppercase antialiased transition ${
                  active
                    ? 'header-category-nav__link--active'
                    : 'text-white hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div
          className={`header-category-nav__fade header-category-nav__fade--right ${
            canScrollRight ? 'header-category-nav__fade--visible' : ''
          }`}
          aria-hidden={!canScrollRight}
        >
          <button
            type="button"
            onClick={() => scrollBy(1)}
            disabled={!canScrollRight}
            className="header-category-nav__arrow"
            aria-label="Más categorías"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </nav>
  );
}
