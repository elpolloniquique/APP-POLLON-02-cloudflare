/**
 * Compatibilidad — usar menuService para menú por sucursal
 */
import { loadBranchMenu, isSupabaseConfigured } from './menuService';
import { FALLBACK_PRODUCTS } from '../data/fallbackProducts';

/** @deprecated Usar loadBranchMenu(branchId) */
export async function loadProducts(branchId) {
  if (branchId) {
    const menu = await loadBranchMenu(branchId);
    if (menu.categories.length) {
      const products = {};
      menu.categories.forEach((c) => {
        products[c.slug || c.id] = (menu.productsByCategory[c.id] || []).map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          image: p.image || p.imageUrl,
          available: p.available,
        }));
      });
      return { products, categories: menu.categories, source: menu.source };
    }
  }
  return { products: JSON.parse(JSON.stringify(FALLBACK_PRODUCTS)), categories: [], source: 'fallback' };
}

export { loadBranchMenu, isSupabaseConfigured };
