import { memo, useMemo, useState } from 'react';
import { money, optimizeMediaUrl } from '../../utils/format';
import { ShoppingCart } from 'lucide-react';

const FALLBACK_IMG = '/img/todo el menu.png';

export const ProductCard = memo(function ProductCard({ product, onSelect, priority = false }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const img = useMemo(
    () => (failed ? FALLBACK_IMG : optimizeMediaUrl(product.image || product.imageUrl, { width: 480, quality: 78 })),
    [product.image, product.imageUrl, failed],
  );

  const handleAddClick = (e) => {
    e.stopPropagation();
    onSelect?.(product);
  };

  const showPromo = product.promotion || product.isPromotion;

  return (
    <article className="product-card">
      <div className="product-card__media">
        {!loaded && !failed && (
          <div className="product-card__skeleton absolute inset-0" aria-hidden />
        )}
        <img
          src={img}
          alt={product.name}
          width={480}
          height={360}
          className={`product-card__img ${loaded || failed ? 'is-loaded' : ''}`}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            setFailed(true);
            setLoaded(true);
            e.currentTarget.src = FALLBACK_IMG;
          }}
        />
        <div className="product-card__media-fade" aria-hidden />
        {showPromo && (
          <span className="product-card__badge">Promo</span>
        )}
        {product.isFeatured && !showPromo && (
          <span className="product-card__badge product-card__badge--gold">Destacado</span>
        )}
      </div>

      <div className="product-card__body">
        <h3 className="product-card__title">{product.name}</h3>
        {product.description && (
          <p className="product-card__desc">{product.description}</p>
        )}
        <div className="product-card__footer">
          <div className="product-card__price-wrap">
            <span className="product-card__price-label">Desde</span>
            <span className="product-card__price">{money(product.price)}</span>
          </div>
          <button
            type="button"
            onClick={handleAddClick}
            aria-label={`Agregar ${product.name} al carrito`}
            className="product-card__cta"
          >
            <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.25} />
            <span>Agregar</span>
          </button>
        </div>
      </div>
    </article>
  );
});
