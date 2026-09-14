# Guía completa desde cero — El Pollón Platform
## Supabase + Vercel + usuarios (cliente y admin)

**Para quién es:** primera vez configurando este proyecto.  
**Objetivo:** que la web en Vercel funcione al **100%** con base de datos, menú, pedidos, login de clientes y panel admin.

---

## Estado de tu código (revisión)

| Revisión | Resultado |
|----------|-----------|
| Compilación (`npm run build`) | ✅ Sin errores |
| Conexión Supabase (`supabaseClient.js`) | ✅ Correcta |
| Variables necesarias | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STORAGE_BUCKET` |
| Deploy Vercel (`vercel.json`) | ✅ Rutas SPA configuradas |

**Importante:** el código está bien. Lo que falta es **configurar Supabase en orden** y **poner las claves en Vercel**.

---

# PARTE 1 — Qué vas a conectar (mapa mental)

```
[GitHub]  →  guarda tu código
     ↓
[Vercel]  →  publica la web (lee código de GitHub)
     ↓
[Supabase] →  base de datos + login + imágenes
```

La web **no guarda** productos en GitHub. Los productos viven en **Supabase**.  
GitHub solo tiene el **programa** (React). Vercel **ejecuta** ese programa y lee las claves de Supabase.

---

# PARTE 2 — Antes de empezar (checklist)

- [ ] Cuenta en [supabase.com](https://supabase.com)
- [ ] Proyecto Supabase creado (ej: `el-pollon-db`)
- [ ] Cuenta en [vercel.com](https://vercel.com)
- [ ] Proyecto en GitHub con carpeta `el-pollon`
- [ ] Proyecto en Vercel conectado a ese repo

**Anota en un bloc de notas:**
- URL de Vercel: `https://________________.vercel.app`
- Tu email de administrador: `________________@`

---

# PARTE 3 — SUPABASE (base de datos) — ORDEN OBLIGATORIO

> ⚠️ **Nunca ejecutes `schema-multi-sucursal.sql` primero.**  
> Ese archivo necesita que existan `pedidos` y `administradores` (se crean en el paso 1).

Abre Supabase → menú izquierdo **SQL Editor** (icono `</>`).

Cada paso: **+ New query** → copiar archivo completo → **Run** → esperar **Success** (verde).

---

## PASO 3.1 — Tablas base (SIEMPRE PRIMERO)

**Archivo en tu PC:**
```
C:\APP POLLON\el-pollon\supabase\schema-es.sql
```

**Qué hace:**
- Crea `pedidos`, `detalle_pedidos` (pedidos de la tienda)
- Crea `administradores` (compatibilidad admin)
- Crea tablas en español (`categorias`, `productos`) — la app principal usa las tablas nuevas del paso 2
- Activa seguridad (RLS) y realtime en pedidos

**Cómo:**
1. Abre el archivo en VS Code.
2. `Ctrl+A` (seleccionar todo) → `Ctrl+C` (copiar).
3. En Supabase SQL Editor → pegar → botón **Run** (abajo derecha).
4. Mensaje esperado: **Success. No rows returned** (es normal).

**Comprobar:**
- Menú **Table Editor** (icono tabla).
- Debes ver: `pedidos`, `administradores`, `categorias`, `productos`, etc.

Si hay error rojo → copia el texto y no sigas al siguiente paso.

---

## PASO 3.2 — Menú multi-sucursal

**Archivo:**
```
C:\APP POLLON\el-pollon\supabase\schema-multi-sucursal.sql
```

**Qué hace:**
- Crea `branches` (sucursales)
- Crea `categories`, `products` (menú **independiente por sucursal**)
- Crea `promotions`, `delivery_zones`, `settings`, `audit_logs`
- Agrega columnas `branch_id` a pedidos y administradores

**Run** → Success.

**Comprobar en Table Editor:**
- Tabla `branches` existe (puede estar vacía hasta el paso 3.3).

---

## PASO 3.3 — Datos iniciales (4 sucursales + menús)

**Archivo (MUY GRANDE, ~4800 líneas):**
```
C:\APP POLLON\el-pollon\supabase\seed-multi-sucursal.sql
```

**Qué hace:**
- Inserta 4 sucursales (Iquique, Alto Hospicio, Arica x2)
- Inserta categorías y productos de cada sucursal

**Cómo:**
1. Copia TODO el archivo (puede tardar unos segundos en copiar).
2. Pega en SQL Editor.
3. **Run** y **espera** (10–60 segundos).
4. Success.

**Comprobar:**
- `branches` → 4 filas.
- `categories` → muchas filas.
- `products` → muchas filas.

---

## PASO 3.4 — Clientes, perfiles y seguimiento

**Archivo:**
```
C:\APP POLLON\el-pollon\supabase\schema-auth.sql
```

**Qué hace:**
- Tabla `profiles` (clientes + personal)
- Tabla `roles` (super_admin, cliente, cocina, etc.)
- Direcciones, marketing, historial de estados de pedido
- Al registrarse un usuario en Auth → se crea perfil automático tipo `cliente`

**Run** → Success.

**Comprobar:**
- Tablas `profiles`, `roles`, `customer_addresses`, etc.

---

## PASO 3.5 — Storage (imágenes de productos)

### Opción A — Desde la interfaz (más fácil)

1. Menú **Storage**.
2. **New bucket**.
3. Name: `product-images`
4. **Public bucket**: ON ✅
5. **Create bucket**.

### Opción B — SQL (políticas de subida)

**Archivo:**
```
C:\APP POLLON\el-pollon\supabase\storage.sql
```

Ejecutar en SQL Editor **después** de crear el bucket (o el SQL crea el bucket si no existe).

---

## PASO 3.6 — Copiar claves API de Supabase

1. **Project Settings** (engranaje abajo izquierda).
2. **API**.
3. Copia y guarda en bloc de notas:

| Nombre en Supabase | Variable en Vercel / .env |
|--------------------|---------------------------|
| Project URL | `VITE_SUPABASE_URL` |
| anon public | `VITE_SUPABASE_ANON_KEY` |

⚠️ **Nunca subas** la `service_role` key a GitHub ni a Vercel como variable pública. Solo la **anon**.

---

# PARTE 4 — VERCEL (conectar la web con Supabase)

## PASO 4.1 — Variables de entorno en Vercel

1. Entra a [vercel.com](https://vercel.com) → tu proyecto.
2. **Settings** → **Environment Variables**.
3. Agrega **una por una**:

| Key | Value | Environment |
|-----|--------|-------------|
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` (tu URL) | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbG...` (tu anon key completa) | Production, Preview, Development |
| `VITE_STORAGE_BUCKET` | `product-images` | Production, Preview, Development |
| `VITE_WHATSAPP_DEFAULT` | `56986925310` (o tu número) | Production, Preview, Development |

4. **Save** cada una.

## PASO 4.2 — Configuración de build (si no está)

**Settings** → **General** → **Build & Development Settings**:

| Campo | Valor |
|-------|--------|
| Framework Preset | Vite |
| Root Directory | `el-pollon` (si tu repo tiene la carpeta `el-pollon` adentro) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

Si el repo **solo** contiene el contenido de `el-pollon` en la raíz, Root Directory déjalo **vacío**.

## PASO 4.3 — Redeploy (obligatorio después de variables)

1. Pestaña **Deployments**.
2. En el último deploy → menú **⋯** → **Redeploy**.
3. Espera que termine en **Ready**.

Sin redeploy, la web **no** ve las variables nuevas.

---

# PARTE 5 — Probar en tu PC (opcional pero recomendado)

## PASO 5.1 — Archivo `.env` local

En la carpeta `C:\APP POLLON\el-pollon` crea o edita `.env`:

```env
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_STORAGE_BUCKET=product-images
VITE_WHATSAPP_DEFAULT=56986925310
```

(Reemplaza con tus valores reales de Supabase → API.)

⚠️ El archivo `.env` **no** debe subirse a GitHub (ya está en `.gitignore`).

## PASO 5.2 — Ejecutar en local

Abre terminal en VS Code (`Ctrl + ñ`):

```powershell
cd "C:\APP POLLON\el-pollon"
npm install
npm run dev
```

Abre: `http://localhost:5173`

Si ves sucursales y productos → Supabase conectado ✅

---

# PARTE 6 — AUTHENTICATION en Supabase (usuarios)

## PASO 6.1 — URLs de tu sitio (muy importante)

**Authentication** → **URL Configuration**:

| Campo | Qué poner |
|-------|-----------|
| **Site URL** | `https://tu-proyecto.vercel.app` |
| **Redirect URLs** | Agrega: `https://tu-proyecto.vercel.app/**` |

Si tienes dominio propio, agrégalo también: `https://tudominio.cl/**`

Sin esto, recuperar contraseña y algunos logins fallan.

## PASO 6.2 — Email habilitado

**Authentication** → **Providers** → **Email** → debe estar **Enabled**.

## PASO 6.3 — Confirmación de email (recomendado para empezar)

**Authentication** → **Providers** → **Email**:

- Para probar rápido: desactiva **Confirm email** (el usuario entra al instante).
- En producción seria: puedes activarlo después.

---

# PARTE 7 — Crear usuario ADMINISTRADOR (panel /admin)

## PASO 7.1 — Crear usuario en Auth

1. **Authentication** → **Users**.
2. **Add user** → **Create new user**.
3. Email: `tu-correo@gmail.com` (el que usarás).
4. Password: una contraseña segura (anótala).
5. ✅ **Auto Confirm User** (marcado) si existe la opción.
6. **Create user**.

## PASO 7.2 — Dar rol Super Admin en la base de datos

**SQL Editor** → New query → pega (cambia el email):

```sql
-- Perfil super admin (método recomendado)
INSERT INTO profiles (auth_user_id, full_name, email, role, is_active)
SELECT
  id,
  'Administrador Principal',  
  email,
  'super_admin',
  true
FROM auth.users
WHERE email = 'TU_CORREO@gmail.com'
ON CONFLICT (auth_user_id) DO UPDATE SET
  role = 'super_admin',
  branch_id = NULL,
  is_active = true,
  full_name = 'Administrador Principal';
```

**Run** → Success.

**Comprobar:**
```sql
SELECT email, role, is_active FROM profiles WHERE email = 'TU_CORREO@gmail.com';
```
Debe mostrar `super_admin` y `true`.

## PASO 7.3 — Probar login admin

1. Abre: `https://tu-proyecto.vercel.app/admin/login`
2. Email y contraseña del paso 7.1.
3. Debes entrar al panel `/admin`.
4. Prueba: `/admin/menu` → seleccionar sucursal → ver categorías/productos.

---

# PARTE 8 — Crear usuario CLIENTE (tienda)

Los clientes **no** se crean en el panel admin. Se registran solos en la web.

## PASO 8.1 — Registro desde la web

1. Abre tu web en Vercel.
2. Arriba: **Iniciar sesión / Registrarse**.
3. Pestaña **Registrarse**.
4. Completa: nombre, teléfono, email, contraseña.
5. Crear cuenta.

## PASO 8.2 — Qué pasa en Supabase

Automáticamente (por `schema-auth.sql`):
- Nuevo usuario en **Authentication → Users**.
- Nueva fila en **profiles** con `role = cliente`.

**Comprobar en Supabase:**
```sql
SELECT email, role, full_name FROM profiles ORDER BY created_at DESC LIMIT 5;
```

## PASO 8.3 — Probar cuenta cliente

- Entra a **Mi cuenta** (`/cuenta`).
- Ver perfil, direcciones, mis pedidos.
- Haz un pedido de prueba en `/tienda` → checkout.
- En **Table Editor → pedidos** debe aparecer un pedido nuevo.

---

# PARTE 9 — Realtime (seguimiento de pedido en vivo)

1. **Database** → **Publications** (o **Replication**).
2. Busca publicación `supabase_realtime`.
3. Activa tablas:
   - `pedidos`
   - `order_status_history`

O en SQL Editor:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
ALTER PUBLICATION supabase_realtime ADD TABLE order_status_history;
```

(Si dice que ya existe, está bien.)

---

# PARTE 10 — Roles de personal (opcional, después)

Cuando tengas más empleados, crea usuario en Auth y asigna rol:

```sql
-- Admin de una sucursal (copia UUID de branches)
UPDATE profiles
SET role = 'admin_sucursal',
    branch_id = 'UUID-DE-LA-SUCURSAL'
WHERE email = 'admin.arica@elpollon.cl';

-- Cajera
UPDATE profiles SET role = 'cajera', branch_id = 'UUID-SUCURSAL' WHERE email = '...';

-- Cocina
UPDATE profiles SET role = 'cocina', branch_id = 'UUID-SUCURSAL' WHERE email = '...';

-- Delivery
UPDATE profiles SET role = 'delivery', branch_id = 'UUID-SUCURSAL' WHERE email = '...';
```

Para ver UUID de sucursales:
```sql
SELECT id, name, city FROM branches;
```

---

# PARTE 11 — Checklist final 100% funcionando

Marca cada ítem cuando esté hecho:

### Supabase
- [ ] PASO 3.1 `schema-es.sql` → Success
- [ ] PASO 3.2 `schema-multi-sucursal.sql` → Success
- [ ] PASO 3.3 `seed-multi-sucursal.sql` → Success
- [ ] PASO 3.4 `schema-auth.sql` → Success
- [ ] Bucket `product-images` público
- [ ] `storage.sql` ejecutado (opcional)
- [ ] Realtime en `pedidos`

### Vercel
- [ ] Variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- [ ] Variable `VITE_STORAGE_BUCKET=product-images`
- [ ] Redeploy después de variables

### Auth
- [ ] Site URL = tu dominio Vercel
- [ ] Usuario admin creado + `role = super_admin` en profiles
- [ ] Cliente de prueba registrado en la web

### Pruebas web
- [ ] `/` carga sucursales
- [ ] `/tienda` muestra menú al elegir sucursal
- [ ] Checkout guarda pedido en tabla `pedidos`
- [ ] `/admin/login` funciona
- [ ] `/admin/menu` edita productos

---

# PARTE 12 — Solución de problemas

| Problema | Solución |
|----------|----------|
| `administradores does not exist` | Ejecutaste mal el orden. Haz **PASO 3.1** primero (`schema-es.sql`). |
| Web sin productos | Falta **seed** (paso 3.3) o variables mal en Vercel → **Redeploy**. |
| Admin no entra | Falta `profiles` con `super_admin` (PASO 7.2). |
| "Supabase no configurado" en admin | URL o anon key vacías en Vercel; no uses `tu-proyecto` en la URL. |
| Imágenes no suben | Bucket `product-images` público + `storage.sql` + usuario logueado. |
| Registro cliente falla | Revisa Site URL en Auth; desactiva confirm email al probar. |

---

# PARTE 13 — Archivos SQL (referencia rápida)

| Orden | Archivo | ¿Obligatorio? |
|-------|---------|----------------|
| 1 | `schema-es.sql` | ✅ Sí |
| 2 | `schema-multi-sucursal.sql` | ✅ Sí |
| 3 | `seed-multi-sucursal.sql` | ✅ Recomendado |
| 4 | `schema-auth.sql` | ✅ Sí |
| 5 | `storage.sql` | Recomendado |
| — | `schema-enterprise.sql` | Opcional (caja extra) |
| — | `seed-productos-es.sql` | No usar (menú viejo en español) |
| — | `crear-admin.sql` | Alternativa al SQL del paso 7.2 |

---

# PARTE 14 — Rutas importantes de tu app

| URL | Para qué |
|-----|----------|
| `/` | Inicio |
| `/tienda` | Menú y compra |
| `/sucursal` | Elegir sucursal |
| `/checkout` | Pagar pedido |
| `/cuenta` | Área cliente (logueado) |
| `/admin/login` | Login personal |
| `/admin` | Panel administración |
| `/admin/menu` | Menú por sucursal |

---

## Siguiente paso para ti (ahora mismo)

1. Abre Supabase → SQL Editor.
2. Ejecuta **solo** `schema-es.sql` (PASO 3.1).
3. Si sale **Success**, continúa con 3.2, 3.3, 3.4 en orden.
4. Configura variables en Vercel y **Redeploy**.
5. Crea tu usuario admin (PARTE 7).
6. Regístrate como cliente en la web (PARTE 8).

Cuando termines el paso 3.1, puedes escribirme **"paso 3.1 listo"** y te guío con el siguiente si algo falla.

---

*Guía creada para el proyecto El Pollón — carpeta `el-pollon`*
