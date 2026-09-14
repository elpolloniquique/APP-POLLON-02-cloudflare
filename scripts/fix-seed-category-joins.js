import fs from 'fs';

const path = 'supabase/seed-multi-sucursal.sql';
let content = fs.readFileSync(path, 'utf8');
const re = /JOIN categories cat ON cat\.branch_id = br\.id AND cat\.name = '([^']+)'/g;
let n = 0;
content = content.replace(re, (_, catName) => {
  n += 1;
  return `CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = '${catName}'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat`;
});
fs.writeFileSync(path, content);
console.log(`Replaced ${n} category joins`);
