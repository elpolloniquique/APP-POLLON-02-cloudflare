import { optimizeMediaUrl } from './format';

const preloaded = new Set();

/** Precarga imágenes de productos en segundo plano para render más rápido */
export function preloadProductImages(products, limit = 24) {
  if (!products?.length || typeof window === 'undefined') return;

  products.slice(0, limit).forEach((product) => {
    const url = optimizeMediaUrl(product.image || product.imageUrl, { width: 480 });
    if (!url || preloaded.has(url)) return;
    preloaded.add(url);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
  });
}
