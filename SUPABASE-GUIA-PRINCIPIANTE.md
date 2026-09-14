# Guía Supabase para principiantes — El Pollón (proyecto nuevo)

Tu error **`administradores does not exist`** pasa porque ejecutaste **`schema-multi-sucursal.sql` primero**.

Ese archivo **no crea** `administradores` ni `pedidos`: solo los **modifica** al final.  
En un proyecto vacío debes crear la base **en este orden**.

---

## Resumen visual (orden obligatorio)

```
PASO 0  → Copiar claves API a Vercel y .env
PASO 1  → schema-es.sql          (pedidos, administradores, tablas base)
PASO 2  → schema-multi-sucursal.sql   (sucursales, menú por sucursal)
PASO 3  → seed-multi-sucursal.sql     (datos de prueba: 4 sucursales + menús)
PASO 4  → schema-auth.sql        (clientes, perfiles, campañas, seguimiento)
PASO 5  → Storage bucket
PASO 6  → Authentication (usuarios)
PASO 7  → Realtime
PASO 8  → Probar la web
```

---

## PASO 0 — Claves de Supabase (antes de SQL)

1. Entra a [supabase.com](https://supabase.com) → tu proyecto **el-pollon-db**.
2. Menú izquierdo: **Project Settings** (engranaje) → **API**.
3. Copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

### En Vercel
1. Tu proyecto → **Settings** → **Environment Variables**.
2. Agrega las dos variables (Production).
3. **Redeploy** el sitio.

### En tu PC (archivo local)
En la carpeta `el-pollon`, archivo `.env`:

```env
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_STORAGE_BUCKET=product-images
VITE_WHATSAPP_DEFAULT=56986925310
```

---

## PASO 1 — Tablas base (OBLIGATORIO PRIMERO)

1. Supabase → **SQL Editor** (icono `</>`).
2. Botón **+ New query**.
3. En tu PC abre el archivo:  
   `el-pollon/supabase/schema-es.sql`
4. **Selecciona TODO** el contenido (`Ctrl+A`) y **cópialo**.
5. Pégalo en el editor de Supabase.
6. Clic en **Run** (o `Ctrl+Enter`).
7. Debe decir **Success** (sin errores rojos).

### Qué crea este paso
- `pedidos`, `detalle_pedidos` (pedidos de clientes)
- `administradores` (panel admin legacy)
- `categorias`, `productos` (tablas viejas en español; la app usa sobre todo las nuevas)
- `configuracion_tienda`, etc.

### Comprobar
**Table Editor** → deberías ver tablas como `pedidos`, `administradores`.

---

## PASO 2 — Menú multi-sucursal

1. **Nueva query** en SQL Editor.
2. Abre y copia TODO: `el-pollon/supabase/schema-multi-sucursal.sql`
3. Pegar → **Run** → **Success**.

### Qué crea
- `branches` (sucursales)
- `categories`, `products` (menú por sucursal)
- `promotions`, `delivery_zones`, `settings`, `audit_logs`
- Agrega `branch_id` a `pedidos` y `administradores` (si existen)

---

## PASO 3 — Datos iniciales (menús de las 4 sucursales)

⚠️ Este archivo es **grande** (~4800 líneas). Puede tardar 10–30 segundos.

1. Nueva query.
2. Abre: `el-pollon/supabase/seed-multi-sucursal.sql`
3. Copia TODO → Pegar → **Run**.
4. Espera hasta ver **Success**.

### Comprobar
**Table Editor** → `branches` → deberías ver 4 sucursales.  
`categories` y `products` con muchos registros.

Si falla por timeout: ejecuta de nuevo solo la parte de `branches` o contacta soporte; en plan free a veces hay límite de tiempo.

---

## PASO 4 — Cuentas de clientes y auth

1. Nueva query.
2. Copia TODO: `el-pollon/supabase/schema-auth.sql`
3. Run → **Success**.

### Qué crea
- `profiles`, `roles` (cliente, super_admin, cocina, etc.)
- `customer_addresses`, marketing, `order_status_history`
- Trigger: al registrarse un usuario en Auth se crea perfil `cliente`

**Requisito:** Los pasos 1 y 2 ya deben estar hechos (`pedidos` y `branches` existen).

---

## PASO 5 — Storage (imágenes de productos)

1. Menú **Storage**.
2. **New bucket**.
3. Nombre: `product-images`
4. **Public bucket**: activado (ON).
5. Create bucket.

Así el admin puede subir fotos desde **Menú por sucursal**.

---

## PASO 6 — Authentication

### 6.1 URLs de tu sitio
**Authentication** → **URL Configuration**:

| Campo | Valor |
|--------|--------|
| Site URL | `https://TU-APP.vercel.app` |
| Redirect URLs | `https://TU-APP.vercel.app/**` |

(Sustituye por tu URL real de Vercel.)

### 6.2 Email / contraseña
**Authentication** → **Providers** → **Email** → habilitado.

### 6.3 Confirmar email (recomendación principiantes)
**Authentication** → **Providers** → Email →  
Desactiva **Confirm email** al principio (así el registro funciona al instante).

### 6.4 Crear tu usuario administrador

1. **Authentication** → **Users** → **Add user**.
2. Email: tu correo (ej. `tutacanehuillca@gmail.com`).
3. Password: una contraseña segura.
4. Create user.

### 6.5 Dar rol Super Admin

**SQL Editor** → nueva query → pega y cambia el email:

```sql
UPDATE profiles
SET role = 'super_admin',
    branch_id = NULL,
    full_name = 'Administrador Principal'
WHERE email = 'TU_CORREO@gmail.com';
```

Si no existe fila en `profiles`, créala:

```sql
INSERT INTO profiles (auth_user_id, full_name, email, role, is_active)
SELECT id, 'Administrador Principal', email, 'super_admin', true
FROM auth.users
WHERE email = 'TU_CORREO@gmail.com'
ON CONFLICT (auth_user_id) DO UPDATE
SET role = 'super_admin', is_active = true;
```

También puedes ejecutar `supabase/crear-admin.sql` (cambia el email dentro del archivo) **después** del paso 1.

---

## PASO 7 — Realtime (seguimiento de pedidos en vivo)

1. **Database** → **Publications** (o **Replication** según tu panel).
2. Tabla `supabase_realtime` / publication **supabase_realtime**.
3. Activa:
   - `pedidos`
   - `order_status_history`

O en SQL Editor:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
ALTER PUBLICATION supabase_realtime ADD TABLE order_status_history;
```

(Si dice que ya existe, está bien.)

---

## PASO 8 — Probar que todo funciona

| Prueba | Dónde | Qué esperar |
|--------|--------|-------------|
| Tienda | Tu URL Vercel `/` | Ves sucursales y menú |
| Registro cliente | Header → Registrarse | Crea cuenta, entra a `/cuenta` |
| Pedido | `/tienda` → carrito → checkout | Nuevo registro en `pedidos` |
| Admin | `/admin/login` | Entra con tu usuario super_admin |
| Menú admin | `/admin/menu` | Ves categorías/productos por sucursal |

---

## Si ya ejecutaste scripts en orden incorrecto

### Opción A — Proyecto nuevo (más fácil)
1. Supabase → **Project Settings** → **General** → **Reset database** (borra todo).
2. Sigue esta guía desde **PASO 1**.

### Opción B — Sin borrar
1. Ejecuta **solo PASO 1** (`schema-es.sql`) ahora.
2. Luego **PASO 2**, 3, 4 en orden.
3. Si algún paso dice "already exists", normalmente puedes continuar.

---

## Archivos del proyecto (referencia)

| Archivo | Cuándo |
|---------|--------|
| `schema-es.sql` | **1º** siempre |
| `schema-multi-sucursal.sql` | **2º** |
| `seed-multi-sucursal.sql` | **3º** (opcional pero recomendado) |
| `schema-auth.sql` | **4º** |
| `crear-admin.sql` | Después de crear usuario en Auth |
| `schema-enterprise.sql` | Opcional (caja/inventario extra) |

**NO ejecutes** `schema-multi-sucursal.sql` sin haber ejecutado `schema-es.sql` antes.

---

## Checklist final ✅

- [ ] PASO 1 `schema-es.sql` → Success  
- [ ] PASO 2 `schema-multi-sucursal.sql` → Success  
- [ ] PASO 3 `seed-multi-sucursal.sql` → Success  
- [ ] PASO 4 `schema-auth.sql` → Success  
- [ ] Bucket `product-images` público  
- [ ] Variables en Vercel + redeploy  
- [ ] Usuario admin con `role = super_admin` en `profiles`  
- [ ] Realtime en `pedidos`  
- [ ] Site URL de Vercel en Authentication  

Cuando todo esté marcado, el proyecto queda operativo al **100%** en Supabase.
