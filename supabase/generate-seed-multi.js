/**
 * Genera seed SQL para menús multi-sucursal
 * Ejecutar: node supabase/generate-seed-multi.js > supabase/seed-multi-sucursal.sql
 */
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BRANCHES = [
  {
    slug: 'iquique-vivar',
    name: 'Pollón Iquique - Vivar',
    city: 'Iquique',
    address: 'Calle Vivar 1086, Iquique',
    phone: '+56 9 8692 5310',
    whatsapp: '56986925310',
    delivery_cost: 2000,
    order: 1,
    categories: 7,
    productsPerCat: 15,
    catNames: [
      'Ofertas Familiares', 'Ofertas para Dos', 'Ofertas Personales',
      'Pollos a la Brasa', 'Platos Extras', 'Bebidas', 'Descartables',
    ],
  },
  {
    slug: 'alto-hospicio',
    name: 'Pollón Alto Hospicio',
    city: 'Alto Hospicio',
    address: 'Alto Hospicio, Tarapacá',
    phone: '+56 9 0000 0004',
    whatsapp: '56900000004',
    delivery_cost: 3000,
    order: 2,
    categories: 8,
    productsPerCat: 15,
    catNames: [
      'Ofertas Familiares', 'Ofertas para Dos', 'Ofertas Personales',
      'Pollos a la Brasa', 'Platos Extras', 'Agregados', 'Bebidas', 'Descartables',
    ],
  },
  {
    slug: 'arica-santa-maria',
    name: 'Pollón Arica - Santa María',
    city: 'Arica',
    address: 'Santa María, Arica',
    phone: '+56 9 0000 0001',
    whatsapp: '56900000001',
    delivery_cost: 2500,
    order: 3,
    categories: 9,
    productsPerCat: 16,
    catNames: [
      'Ofertas Familiares', 'Ofertas para Dos', 'Ofertas Personales',
      'Pollos a la Brasa', 'Parrillas', 'Platos Extras', 'Agregados', 'Bebidas', 'Descartables',
    ],
  },
  {
    slug: 'arica-saucache',
    name: 'Pollón Arica - Saucache',
    city: 'Arica',
    address: 'Saucache, Arica',
    phone: '+56 9 0000 0002',
    whatsapp: '56900000002',
    delivery_cost: 2500,
    order: 4,
    categories: 9,
    productsPerCat: 17,
    catNames: [
      'Ofertas Familiares', 'Ofertas para Dos', 'Ofertas Personales',
      'Pollos a la Brasa', 'Parrillas', 'Platos Extras', 'Agregados', 'Bebidas', 'Descartables',
    ],
  },
];

const esc = (s) => String(s).replace(/'/g, "''");

let sql = `-- Seed multi-sucursal — generado automáticamente\n\n`;

for (const b of BRANCHES) {
  const branchVar = b.slug.replace(/-/g, '_');
  sql += `-- ${b.name}\n`;
  sql += `INSERT INTO branches (slug, name, city, address, phone, whatsapp, delivery_cost, display_order, is_active)\n`;
  sql += `VALUES ('${esc(b.slug)}', '${esc(b.name)}', '${esc(b.city)}', '${esc(b.address)}', '${esc(b.phone)}', '${esc(b.whatsapp)}', ${b.delivery_cost}, ${b.order}, true)\n`;
  sql += `ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, city = EXCLUDED.city, address = EXCLUDED.address,\n`;
  sql += `  phone = EXCLUDED.phone, whatsapp = EXCLUDED.whatsapp, delivery_cost = EXCLUDED.delivery_cost, is_active = true;\n\n`;

  const names = b.catNames.length >= b.categories
    ? b.catNames.slice(0, b.categories)
    : [...b.catNames, ...Array.from({ length: b.categories - b.catNames.length }, (_, i) => `Categoría ${i + 1}`)];

  for (let c = 0; c < b.categories; c++) {
    const catName = names[c] || `Categoría ${c + 1}`;
    sql += `INSERT INTO categories (branch_id, name, description, display_order, is_active)\n`;
    sql += `SELECT id, '${esc(catName)}', 'Menú ${esc(catName)} — ${esc(b.name)}', ${c + 1}, true FROM branches WHERE slug = '${esc(b.slug)}'\n`;
    sql += `ON CONFLICT DO NOTHING;\n\n`;
  }

  for (let c = 0; c < b.categories; c++) {
    const catName = names[c] || `Categoría ${c + 1}`;
    for (let p = 1; p <= b.productsPerCat; p++) {
      const prodName = `${catName} — Plato ${p}`;
      const price = 5000 + (c * 500) + (p * 200) + (b.order * 100);
      const desc = `Delicioso ${prodName.toLowerCase()} preparado al momento en ${b.name}.`;
      sql += `INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)\n`;
      sql += `SELECT br.id, cat.id, '${esc(prodName)}', '${esc(desc)}', ${price}, true, ${p}, ${p <= 2 && c === 0}\n`;
      sql += `FROM branches br\n`;
      sql += `JOIN categories cat ON cat.branch_id = br.id AND cat.name = '${esc(catName)}'\n`;
      sql += `WHERE br.slug = '${esc(b.slug)}'\n`;
      sql += `AND NOT EXISTS (\n`;
      sql += `  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = '${esc(prodName)}'\n`;
      sql += `);\n\n`;
    }
  }

  sql += `INSERT INTO delivery_zones (branch_id, zone_name, delivery_price, estimated_time, is_active)\n`;
  sql += `SELECT id, 'Zona principal', ${b.delivery_cost}, '30-45 min', true FROM branches WHERE slug = '${esc(b.slug)}'\n`;
  sql += `AND NOT EXISTS (SELECT 1 FROM delivery_zones dz WHERE dz.branch_id = branches.id AND dz.zone_name = 'Zona principal');\n\n`;
}

sql += `-- Configuración global\n`;
sql += `INSERT INTO settings (key, value, branch_id) VALUES\n`;
sql += `  ('site_name', '"Pollería El Pollón"', NULL),\n`;
sql += `  ('payment_methods', '["efectivo","transferencia"]', NULL)\n`;
sql += `ON CONFLICT (key, branch_id) DO NOTHING;\n`;

const outPath = join(__dirname, 'seed-multi-sucursal.sql');
writeFileSync(outPath, sql, 'utf8');
console.log(`Generado: ${outPath}`);
