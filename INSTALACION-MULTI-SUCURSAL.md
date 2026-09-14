# El Pollón — Multi-sucursal (menú independiente)

## 1. Ejecutar en Supabase (en orden)

1. `supabase/schema-es.sql` — pedidos y auth (si proyecto nuevo)
2. **`supabase/schema-multi-sucursal.sql`** — tablas branches, categories, products, etc.

   **Al ejecutar:** abre el archivo → **Ctrl+A** (seleccionar todo) → **Run** (una vez).
   Si sale `ERROR 42601 unterminated dollar-quoted string` ejecutaste solo un **fragmento** del archivo, no el script completo.
3. **`supabase/seed-multi-sucursal.sql`** — datos iniciales (~4878 líneas; puede tardar 30–60 s):

   **Resultado normal en Supabase:** `Success. No rows returned` y `0 row` en muchos INSERT — **no es error**.
   Al final del script verás una tabla con: `sucursales`, `categorias`, `productos` (esperado: 4, 30+, 500+).
   El punto rojo junto a **Retry** suele ser de un intento anterior; si dice **Success**, está bien.
   Para comprobar después: ejecuta `supabase/verificar-seed.sql`.

   - Iquique Vivar: 7 categorías × 15 productos
   - Alto Hospicio: 8 × 15
   - Arica Santa María: 9 × 16
   - Arica Saucache: 9 × 17

Regenerar seed: `node supabase/generate-seed-multi.js`

## 2. Variables .env

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_STORAGE_BUCKET=product-images
```

## 3. Panel Admin — Menú por sucursal

Ruta: **`/admin/menu`**

- Crear/editar categorías y productos por sucursal
- Duplicar categoría o copiar menú completo
- Aumento masivo de precios %
- Desactivar todos los productos
- Historial de cambios (audit_logs)
- Vista previa del menú cliente

## 4. Reglas del cliente

- Menú cargado solo de la sucursal seleccionada
- Carrito ligado a una sucursal
- Cambiar sucursal vacía el carrito (con confirmación)
- Pagos: solo **efectivo** y **transferencia**

## 5. Roles

| Rol | Acceso |
|-----|--------|
| super_admin | Todas las sucursales |
| administrador | Su sucursal (`branch_id` en tabla administradores) |
| cajero / cocina / repartidor | Según permisos en `ROLE_PERMISSIONS` |

### Problemas frecuentes admin

**Login se queda en "Entrando…"**
- Revisa variables en Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) y redeploy.
- Proyecto Supabase no debe estar pausado.
- Ejecuta `supabase/fix-perfil-admin.sql` (rol en tabla `profiles`).

**No puedo agregar sucursales**
- Solo `super_admin` tiene permiso `branches`.
- Debe existir tabla `branches` (`schema-multi-sucursal.sql`).
- Ejecuta `fix-perfil-admin.sql` si el rol quedó como `cliente` en `profiles`.

## 6. Editar datos bancarios transferencia

`src/utils/constants.js` → `TRANSFER_BANK_INFO`
