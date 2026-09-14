import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Barra de categorías en una sola fila con scroll horizontal y flechas.
 */
export function CategoryScrollBar({ items, activeId, onSelect, className = '' }) {
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
    if (!activeId || !trackRef.current) return;
    const btn = trackRef.current.querySelector(`[data-cat-id="${activeId}"]`);
    btn?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeId, items.length]);

  const scrollBy = (dir) => {
    trackRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });
  };

  if (!items?.length) return null;

  return (
    <div className={`relative px-9 sm:px-11 ${className}`}>
      {/* Flecha izquierda + degradado */}
      <div
        className={`pointer-events-none absolute left-0 top-0 z-10 flex h-full w-9 items-center sm:w-11 ${
          canScrollLeft
            ? 'bg-gradient-to-r from-white via-white/95 to-transparent'
            : 'opacity-0'
        }`}
        aria-hidden={!canScrollLeft}
      >
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          disabled={!canScrollLeft}
          className={`pointer-events-auto ml-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:border-pollon-red hover:text-pollon-red sm:h-9 sm:w-9 ${
            canScrollLeft ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          aria-label="Categorías anteriores"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>

      {/* Carril de categorías — una sola fila */}
      <div
        ref={trackRef}
        className="category-scroll-track flex gap-2 overflow-x-auto overflow-y-hidden py-1 pl-1 pr-1 scrollbar-hide scroll-smooth"
        role="tablist"
        aria-label="Categorías del menú"
      >
        {items.map((cat) => {
          const active = activeId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              data-cat-id={cat.id}
              aria-selected={active}
              onClick={() => onSelect(cat)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition-all sm:px-5 sm:py-2.5 sm:text-[15px] ${
                active
                  ? 'bg-pollon-red text-white shadow-md ring-2 ring-pollon-red/30'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Flecha derecha + degradado */}
      <div
        className={`pointer-events-none absolute right-0 top-0 z-10 flex h-full w-9 items-center justify-end sm:w-11 ${
          canScrollRight
            ? 'bg-gradient-to-l from-white via-white/95 to-transparent'
            : 'opacity-0'
        }`}
        aria-hidden={!canScrollRight}
      >
        <button
          type="button"
          onClick={() => scrollBy(1)}
          disabled={!canScrollRight}
          className={`pointer-events-auto mr-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:border-pollon-red hover:text-pollon-red sm:h-9 sm:w-9 ${
            canScrollRight ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          aria-label="Más categorías"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
