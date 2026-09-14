import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { logAudit } from './auditService';
import { CORE_CATEGORY_NAMES, sortStoreCategories } from '../utils/constants';

function sb() {
  const client = getSupabase();
  if (!client) throw new Error('Supabase no configurado');
  return client;
}

function mapCategory(row) {
  return {
    id: row.id,
    branchId: row.branch_id,
    name: row.name,
    description: row.description || '',
    imageUrl: row.image_url || '',
    displayOrder: row.display_order ?? 0,
    isActive: row.is_active !== false,
    slug: row.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || row.id,
  };
}

function parseGalleryUrls(raw) {
  if (Array.isArray(raw)) return raw.map((u) => String(u || '').trim()).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((u) => String(u || '').trim()).filter(Boolean);
    } catch {
      return [raw.trim()];
    }
  }
  return [];
}

export function normalizeProductImageUrls(imageUrl, galleryUrls) {
  const gallery = parseGalleryUrls(galleryUrls);
  const primary = (imageUrl || '').trim();
  if (gallery.length) {
    const ordered = primary && !gallery.includes(primary)
      ? [primary, ...gallery]
      : primary
        ? [primary, ...gallery.filter((u) => u !== primary)]
        : gallery;
    const unique = [...new Set(ordered)];
    return { imageUrl: unique[0] || '', imageUrls: unique };
  }
  return { imageUrl: primary, imageUrls: primary ? [primary] : [] };
}

function mapProduct(row) {
  const images = normalizeProductImageUrls(row.image_url, row.gallery_urls);
  return {
    id: row.id,
    branchId: row.branch_id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description || '',
    image: images.imageUrl,
    imageUrl: images.imageUrl,
    imageUrls: images.imageUrls,
    price: Number(row.price) || 0,
    oldPrice: row.old_price ? Number(row.old_price) : null,
    available: row.is_available !== false,
    isFeatured: !!row.is_featured,
    isPromotion: !!row.is_promotion,
    displayOrder: row.display_order ?? 0,
    preparationTime: row.preparation_time ?? 15,
    drinkEnabled: row.drink_enabled === true,
    drinkRequired: row.drink_required === true,
    bagEnabled: row.bag_enabled === true,
    bagRequired: row.bag_required === true,
    bagPrice: Number(row.bag_price ?? 200) || 200,
    bagUnitsPerBag: Math.max(1, Math.floor(Number(row.bag_units_per_bag ?? 1) || 1)),
  };
}

/** Menú público por sucursal */
export async function loadBranchMenu(branchId) {
  if (!branchId || !isSupabaseConfigured()) {
    return { categories: [], productsByCategory: {}, products: [], source: 'empty' };
  }

  const client = sb();
  const [catsRes, prodsRes] = await Promise.all([
    client
      .from('categories')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    client
      .from('products')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_available', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true }),
  ]);
  if (catsRes.error) throw catsRes.error;
  if (prodsRes.error) throw prodsRes.error;
  const cats = catsRes.data;
  const prods = prodsRes.data;

  const rawCategories = (cats || []).map(mapCategory);
  const categories = sortStoreCategories(dedupeCategories(rawCategories));
  const aliasToKeeper = buildCategoryAliasMap(rawCategories, categories);
  const categoryNameById = Object.fromEntries(rawCategories.map((c) => [c.id, c.name.trim().toLowerCase()]));

  const products = dedupeProducts(
    (prods || []).map((row) => {
      const p = mapProduct(row);
      return { ...p, categoryId: aliasToKeeper.get(p.categoryId) || p.categoryId };
    }),
    categoryNameById,
  );
  const productsByCategory = {};
  categories.forEach((c) => { productsByCategory[c.id] = []; });
  products.forEach((p) => {
    if (!productsByCategory[p.categoryId]) productsByCategory[p.categoryId] = [];
    productsByCategory[p.categoryId].push(p);
  });
  const sortByOrder = (a, b) =>
    (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || (a.name || '').localeCompare(b.name || '', 'es');
  categories.forEach((c) => {
    if (productsByCategory[c.id]?.length) productsByCategory[c.id].sort(sortByOrder);
  });

  return { categories, productsByCategory, products, source: 'supabase' };
}

/** Elimina duplicados visuales (mismo nombre en la misma sucursal) */
function dedupeCategories(categories) {
  const byKey = new Map();
  for (const c of categories) {
    const key = `${c.branchId}:${(c.name || '').trim().toLowerCase()}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...c });
      continue;
    }
    const pick = (c.displayOrder ?? 0) < (prev.displayOrder ?? 0) ? c : prev;
    const other = pick === c ? prev : c;
    byKey.set(key, {
      ...pick,
      imageUrl: pick.imageUrl || other.imageUrl || '',
      description: pick.description || other.description || '',
    });
  }
  return [...byKey.values()].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}

function productDedupeScore(p) {
  return (
    (p.imageUrl ? 0 : 10)
    + (p.available ? 0 : 5)
    + (p.displayOrder ?? 0) * 0.01
  );
}

/** Elimina productos duplicados por sucursal + categoría + nombre */
function dedupeProducts(products, categoryNameById = {}) {
  const byKey = new Map();
  for (const p of products) {
    const catKey = categoryNameById[p.categoryId]
      || categoryNameById[p.categoryId?.toLowerCase?.()]
      || p.categoryId;
    const key = `${p.branchId}:${catKey}:${(p.name || '').trim().toLowerCase()}`;
    const prev = byKey.get(key);
    if (!prev || productDedupeScore(p) < productDedupeScore(prev)) {
      byKey.set(key, p);
    }
  }
  return [...byKey.values()].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || (a.name || '').localeCompare(b.name || '', 'es'),
  );
}

function buildCategoryAliasMap(rawCategories, dedupedCategories) {
  const keeperByName = new Map();
  for (const c of dedupedCategories) {
    keeperByName.set(`${c.branchId}:${(c.name || '').trim().toLowerCase()}`, c.id);
  }
  const aliasToKeeper = new Map();
  for (const c of rawCategories) {
    const keeper = keeperByName.get(`${c.branchId}:${(c.name || '').trim().toLowerCase()}`);
    if (keeper) aliasToKeeper.set(c.id, keeper);
  }
  return aliasToKeeper;
}

/** Admin: categorías de una sucursal (incluye inactivas, sin duplicados por nombre) */
export async function adminListCategories(branchId) {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await sb()
    .from('categories')
    .select('*')
    .eq('branch_id', branchId)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return sortStoreCategories(dedupeCategories((data || []).map(mapCategory)));
}

export async function adminCountProductsInCategory(categoryId) {
  const { count, error } = await sb()
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', categoryId);
  if (error) throw error;
  return count ?? 0;
}

export async function adminUpsertCategory(category, user) {
  const name = (category.name || '').trim();
  if (!name) throw new Error('El nombre de la categoría es obligatorio');

  const { data: duplicate } = await sb()
    .from('categories')
    .select('id')
    .eq('branch_id', category.branchId)
    .eq('name', name)
    .maybeSingle();

  if (duplicate && duplicate.id !== category.id) {
    throw new Error(`Ya existe la categoría "${name}" en esta sucursal`);
  }

  const isCore = CORE_CATEGORY_NAMES.some((n) => n.toLowerCase() === name.toLowerCase());
  let displayOrder = category.displayOrder ?? 0;
  if (!category.id && !isCore) {
    const coreIdx = CORE_CATEGORY_NAMES.findIndex((n) => n.toLowerCase() === name.toLowerCase());
    if (coreIdx < 0) {
      const { data: maxRow } = await sb()
        .from('categories')
        .select('display_order')
        .eq('branch_id', category.branchId)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      displayOrder = Math.max(4, (maxRow?.display_order ?? 3) + 1);
    }
  } else if (isCore) {
    const coreIdx = CORE_CATEGORY_NAMES.findIndex((n) => n.toLowerCase() === name.toLowerCase());
    displayOrder = coreIdx + 1;
  }

  const row = {
    id: category.id || undefined,
    branch_id: category.branchId,
    name,
    description: category.description || '',
    image_url: category.imageUrl || '',
    display_order: displayOrder,
    is_active: category.isActive !== false,
  };
  const { data, error } = await sb().from('categories').upsert(row).select().single();
  if (error) {
    if (error.code === '23505') {
      throw new Error(`Ya existe la categoría "${name}" en esta sucursal`);
    }
    throw error;
  }
  await logAudit({ user, branchId: category.branchId, entityType: 'category', entityId: data.id, action: category.id ? 'update' : 'create', newData: data });
  return mapCategory(data);
}

export async function adminDeleteCategory(id, branchId, user) {
  const count = await adminCountProductsInCategory(id);
  const { error } = await sb().from('categories').delete().eq('id', id);
  if (error) throw error;
  await logAudit({
    user,
    branchId,
    entityType: 'category',
    entityId: id,
    action: 'delete',
    oldData: { productsDeleted: count },
  });
  return count;
}

export async function adminReorderCategory(id, displayOrder) {
  const { error } = await sb().from('categories').update({ display_order: displayOrder }).eq('id', id);
  if (error) throw error;
}

function normalizeDisplayOrder(value, fallback = 1) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

/** Siguiente número de orden sugerido para una categoría */
export async function adminSuggestProductDisplayOrder(branchId, categoryId) {
  if (!branchId || !categoryId || !isSupabaseConfigured()) return 1;
  const { data, error } = await sb()
    .from('products')
    .select('display_order')
    .eq('branch_id', branchId)
    .eq('category_id', categoryId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return normalizeDisplayOrder((data?.display_order ?? 0) + 1, 1);
}

/** Actualiza solo el orden de un producto (desde la tabla admin) */
export async function adminSetProductDisplayOrder(productId, displayOrder, user) {
  const order = normalizeDisplayOrder(displayOrder, 1);
  const { data, error } = await sb()
    .from('products')
    .update({ display_order: order })
    .eq('id', productId)
    .select('branch_id')
    .single();
  if (error) throw error;
  await logAudit({
    user,
    branchId: data.branch_id,
    entityType: 'product',
    entityId: productId,
    action: 'reorder',
    newData: { display_order: order },
  });
  return order;
}

/** Admin: productos (sin duplicados por nombre en la misma categoría) */
export async function adminListProducts(branchId, filters = {}) {
  if (!isSupabaseConfigured()) return [];
  let q = sb().from('products').select('*, categories(id, name)').eq('branch_id', branchId);

  if (filters.categoryId) {
    const { data: cat } = await sb()
      .from('categories')
      .select('name')
      .eq('id', filters.categoryId)
      .maybeSingle();
    if (cat?.name) {
      const { data: siblingCats } = await sb()
        .from('categories')
        .select('id')
        .eq('branch_id', branchId)
        .eq('name', cat.name);
      const ids = (siblingCats || []).map((c) => c.id);
      q = ids.length ? q.in('category_id', ids) : q.eq('category_id', filters.categoryId);
    } else {
      q = q.eq('category_id', filters.categoryId);
    }
  }

  if (filters.available === true) q = q.eq('is_available', true);
  if (filters.available === false) q = q.eq('is_available', false);
  if (filters.search) q = q.ilike('name', `%${filters.search}%`);
  const { data, error } = await q.order('display_order', { ascending: true }).order('name', { ascending: true });
  if (error) throw error;

  const mapped = (data || []).map((r) => ({
    ...mapProduct(r),
    categoryName: r.categories?.name,
  }));
  const categoryNameById = Object.fromEntries(
    mapped.map((p) => [p.categoryId, (p.categoryName || '').trim().toLowerCase()]),
  );
  return dedupeProducts(mapped, categoryNameById);
}

export async function adminUpsertProduct(product, user) {
  const name = (product.name || '').trim();
  if (!name) throw new Error('El nombre del producto es obligatorio');

  const { data: duplicate } = await sb()
    .from('products')
    .select('id')
    .eq('branch_id', product.branchId)
    .eq('category_id', product.categoryId)
    .eq('name', name)
    .maybeSingle();

  if (duplicate && duplicate.id !== product.id) {
    throw new Error(`Ya existe el producto "${name}" en esta categoría`);
  }

  const images = normalizeProductImageUrls(
    product.imageUrl || product.image,
    product.imageUrls,
  );
  const row = {
    id: product.id || undefined,
    branch_id: product.branchId,
    category_id: product.categoryId,
    name,
    description: product.description || '',
    image_url: images.imageUrl,
    gallery_urls: images.imageUrls,
    price: product.price,
    old_price: product.oldPrice || null,
    is_available: product.available !== false,
    is_featured: !!product.isFeatured,
    is_promotion: !!product.isPromotion,
    display_order: normalizeDisplayOrder(product.displayOrder, 1),
    preparation_time: product.preparationTime ?? 15,
    drink_enabled: !!product.drinkEnabled,
    drink_required: !!product.drinkRequired,
    bag_enabled: !!product.bagEnabled,
    bag_required: !!product.bagRequired,
    bag_price: Number(product.bagPrice ?? 200) || 200,
    bag_units_per_bag: Math.max(1, Math.floor(Number(product.bagUnitsPerBag ?? 1) || 1)),
  };
  const { data, error } = await sb().from('products').upsert(row).select().single();
  if (error) {
    if (error.code === '23505') {
      throw new Error(`Ya existe el producto "${name}" en esta categoría`);
    }
    throw error;
  }
  await logAudit({ user, branchId: product.branchId, entityType: 'product', entityId: data.id, action: product.id ? 'update' : 'create', newData: { price: data.price, name: data.name } });
  return mapProduct(data);
}

export async function adminDeleteProduct(id, user) {
  const { error } = await sb().from('products').delete().eq('id', id);
  if (error) throw error;
  await logAudit({ user, entityType: 'product', entityId: id, action: 'delete' });
}

export async function adminBulkSetUnavailable(branchId) {
  const { error } = await sb().from('products').update({ is_available: false }).eq('branch_id', branchId);
  if (error) throw error;
}

export async function adminBulkPriceIncrease(branchId, percent, user) {
  const { data: products, error } = await sb().from('products').select('id, price').eq('branch_id', branchId);
  if (error) throw error;
  const factor = 1 + (Number(percent) || 0) / 100;
  for (const p of products || []) {
    const newPrice = Math.round(Number(p.price) * factor);
    await sb().from('products').update({ price: newPrice, old_price: p.price }).eq('id', p.id);
    await logAudit({ user, branchId, entityType: 'product', entityId: p.id, action: 'price_increase', oldData: { price: p.price }, newData: { price: newPrice } });
  }
}

/** Duplicar producto a otra sucursal/categoría */
export async function adminDuplicateProduct(productId, targetBranchId, targetCategoryId, user) {
  const { data: src, error } = await sb().from('products').select('*').eq('id', productId).single();
  if (error) throw error;
  const nextOrder = await adminSuggestProductDisplayOrder(targetBranchId, targetCategoryId);
  const { data, error: insErr } = await sb().from('products').insert({
    branch_id: targetBranchId,
    category_id: targetCategoryId,
    name: src.name,
    description: src.description,
    image_url: src.image_url,
    gallery_urls: src.gallery_urls || (src.image_url ? [src.image_url] : []),
    price: src.price,
    old_price: src.old_price,
    is_available: src.is_available,
    is_featured: false,
    is_promotion: false,
    display_order: nextOrder,
    preparation_time: src.preparation_time,
    drink_enabled: src.drink_enabled ?? false,
    drink_required: src.drink_required ?? false,
    bag_enabled: src.bag_enabled ?? false,
    bag_required: src.bag_required ?? false,
    bag_price: src.bag_price ?? 200,
    bag_units_per_bag: Math.max(1, Math.floor(Number(src.bag_units_per_bag ?? 1) || 1)),
  }).select().single();
  if (insErr) throw insErr;
  await logAudit({ user, branchId: targetBranchId, entityType: 'product', entityId: data.id, action: 'duplicate', newData: { from: productId } });
  return mapProduct(data);
}

/** Copiar menú completo de una sucursal a otra */
export async function adminCopyMenuFromBranch(sourceBranchId, targetBranchId, user) {
  const cats = await adminListCategories(sourceBranchId);
  const catMap = {};
  for (const c of cats) {
    const newCat = await adminUpsertCategory({
      branchId: targetBranchId,
      name: c.name,
      description: c.description,
      imageUrl: c.imageUrl,
      displayOrder: c.displayOrder,
      isActive: c.isActive,
    }, user);
    catMap[c.id] = newCat.id;
  }
  const products = await adminListProducts(sourceBranchId);
  for (const p of products) {
    await sb().from('products').insert({
      branch_id: targetBranchId,
      category_id: catMap[p.categoryId],
      name: p.name,
      description: p.description,
      image_url: p.imageUrl || p.image,
      gallery_urls: p.imageUrls?.length ? p.imageUrls : (p.imageUrl ? [p.imageUrl] : []),
      price: p.price,
      old_price: p.oldPrice,
      is_available: p.available,
      is_featured: p.isFeatured,
      is_promotion: p.isPromotion,
      display_order: p.displayOrder,
      preparation_time: p.preparationTime,
      drink_enabled: !!p.drinkEnabled,
      drink_required: !!p.drinkRequired,
      bag_enabled: !!p.bagEnabled,
      bag_required: !!p.bagRequired,
      bag_price: Number(p.bagPrice ?? 200) || 200,
      bag_units_per_bag: Math.max(1, Math.floor(Number(p.bagUnitsPerBag ?? 1) || 1)),
    });
  }
  await logAudit({ user, branchId: targetBranchId, entityType: 'menu', action: 'copy_from_branch', newData: { sourceBranchId } });
}

/** Duplicar categoría con todos sus productos */
export async function adminDuplicateCategory(categoryId, targetBranchId, user) {
  const { data: cat, error } = await sb().from('categories').select('*').eq('id', categoryId).single();
  if (error) throw error;
  const newCat = await adminUpsertCategory({
    branchId: targetBranchId,
    name: `${cat.name} (copia)`,
    description: cat.description,
    imageUrl: cat.image_url,
    displayOrder: cat.display_order,
    isActive: cat.is_active,
  }, user);
  const products = await adminListProducts(cat.branch_id, { categoryId: categoryId });
  for (const p of products) {
    await adminDuplicateProduct(p.id, targetBranchId, newCat.id, user);
  }
  return newCat;
}

/** Suscripción en tiempo real al menú de una sucursal */
export function subscribeBranchMenu(branchId, onSync) {
  if (!branchId || !isSupabaseConfigured()) return () => {};
  const client = getSupabase();
  if (!client) return () => {};
  const channel = client
    .channel(`menu-${branchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'categories', filter: `branch_id=eq.${branchId}` },
      onSync,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products', filter: `branch_id=eq.${branchId}` },
      onSync,
    )
    .subscribe();
  return () => { client.removeChannel(channel); };
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif']);
const EXT_TO_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
};

function fileExtension(name) {
  return (name.split('.').pop() || '').toLowerCase();
}

export function isImageFile(file) {
  if (!file) return false;
  if (file.type?.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.has(fileExtension(file.name));
}

function resolveContentType(file) {
  if (file.type?.startsWith('image/')) return file.type;
  return EXT_TO_MIME[fileExtension(file.name)] || 'image/jpeg';
}

function mapStorageError(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('bucket') && msg.includes('not found')) {
    return 'Bucket de imágenes no configurado. Ejecuta storage.sql en Supabase.';
  }
  if (msg.includes('row-level security') || msg.includes('policy')) {
    return 'Sin permiso para subir. Cierra sesión, vuelve a entrar al admin e intenta de nuevo.';
  }
  if (msg.includes('payload too large') || msg.includes('file size')) {
    return 'La imagen es muy pesada. Máximo 5 MB por archivo.';
  }
  if (msg.includes('mime') || msg.includes('invalid')) {
    return 'Formato no permitido. Usa JPG, PNG, WebP o GIF.';
  }
  return error?.message || 'Error al subir la imagen';
}

export async function uploadProductImage(file, branchId) {
  if (!isImageFile(file)) {
    throw new Error(`"${file.name}" no es una imagen válida (JPG, PNG, WebP, GIF)`);
  }

  const client = sb();
  const { data: { session } } = await client.auth.getSession();
  if (!session) {
    throw new Error('Sesión expirada. Vuelve a iniciar sesión en el panel admin.');
  }

  const bucket = import.meta.env.VITE_STORAGE_BUCKET || 'product-images';
  const ext = fileExtension(file.name) || 'jpg';
  const safeExt = IMAGE_EXTENSIONS.has(ext) ? ext : 'jpg';
  const path = `${branchId || 'general'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
  const contentType = resolveContentType(file);

  const { error } = await client.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType,
  });
  if (error) throw new Error(mapStorageError(error));

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadProductImages(files, branchId) {
  const list = [...files].filter(isImageFile);
  if (!list.length) {
    throw new Error('Ningún archivo válido. Selecciona JPG, PNG, WebP o GIF desde tu carpeta.');
  }
  const skipped = files.length - list.length;
  const urls = await Promise.all(list.map((f) => uploadProductImage(f, branchId)));
  if (skipped > 0 && urls.length) {
    return { urls, warning: `${skipped} archivo(s) ignorado(s) por formato no válido` };
  }
  return { urls, warning: null };
}

export { isSupabaseConfigured };
