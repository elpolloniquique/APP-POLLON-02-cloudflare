# Crear administradores por sucursal (`admin_sucursal`)

Guía para crear **4 cuentas** (una por sucursal) en Supabase con rol **admin_sucursal**.

| Sucursal | Slug en BD | Correo sugerido |
|----------|------------|-----------------|
| Iquique - Vivar | `iquique-vivar` | `admin.iquique@elpollon.cl` |
| Alto Hospicio | `alto-hospicio` | `admin.altohospicio@elpollon.cl` |
| Arica Santa María | `arica-santa-maria` | `admin.arica.sm@elpollon.cl` |
| Arica Saucache | `arica-saucache` | `admin.saucache@elpollon.cl` |

Puedes usar otros correos (Gmail, etc.); solo deben coincidir en Auth y en el script SQL.

---

## Qué puede hacer `admin_sucursal`

- Entrar al panel: `/admin/login`
- Gestionar **menú, pedidos, cocina, caja, clientes y campañas** de **su sucursal**
- **No** puede crear otras sucursales (solo `super_admin`)

---

## Requisitos previos

1. SQL ya ejecutado: `schema-es.sql` → `schema-multi-sucursal.sql` → `seed-multi-sucursal.sql` → `schema-auth.sql`
2. Tabla **`branches`** con las 4 sucursales (ver en Table Editor)
3. Tu usuario principal con rol **`super_admin`** (`fix-perfil-admin.sql`)

---

## Paso 1 — Crear el correo en Supabase Auth (repetir 4 veces)

1. Abre [Supabase](https://supabase.com) → tu proyecto **el-pollon-db**
2. Menú izquierdo → **Authentication** → **Users**
3. Clic en **Add user** → **Create new user**
4. Completa:
   - **Email:** por ejemplo `admin.iquique@elpollon.cl`
   - **Password:** una contraseña segura (mín. 6 caracteres; anótala)
   - Activa **Auto Confirm User** (importante: si no, no podrán entrar hasta confirmar email)
5. **Create user**
6. Repite para los otros 3 correos de la tabla de arriba

> No hace falta dominio real `@elpollon.cl` si aún no lo tienes: puedes usar  
> `admin.iquique@gmail.com`, `admin.altohospicio@gmail.com`, etc.  
> Si cambias el correo, edítalo también en `crear-admins-sucursal.sql`.

---

## Paso 2 — Asignar rol y sucursal con SQL

1. **SQL Editor** → **New query**
2. Abre el archivo `supabase/crear-admins-sucursal.sql`
3. Si usaste correos distintos, reemplázalos en el script
4. **Run** → debe decir **Success**
5. Abajo verás una tabla con 4 filas: `role = admin_sucursal` y el nombre de cada sucursal

Si una fila no aparece, ese usuario **no existe en Auth** o el email del script no coincide.

---

## Paso 3 — Probar el acceso

1. Abre la tienda en incógnito: `https://app-pollon.vercel.app/admin/login`
2. Email: `admin.iquique@elpollon.cl` (o el que creaste)
3. Contraseña: la que pusiste en el Paso 1
4. Deberías entrar al panel
5. En el menú lateral verás **Menú por sucursal**, **Pedidos**, etc., pero **no** “Sucursales”
6. Abajo del menú debe decir `admin_sucursal` y tu email

---

## Paso 4 — Entregar credenciales al encargado de cada local

Por cada sucursal envía:

- URL: `https://app-pollon.vercel.app/admin/login`
- Email y contraseña
- Indicar que solo administran **su** local

Recomendación: que cambien la contraseña después del primer acceso (desde Supabase tú puedes **Reset password** en Authentication → Users).

---

## Solución de problemas

| Problema | Solución |
|----------|----------|
| **“Database error creating new user”** | Ejecuta **`supabase/ `** en SQL Editor y vuelve a crear el usuario |
| “Esta cuenta es de cliente” | Ejecuta de nuevo `crear-admins-sucursal.sql` |
| Login colgado en “Entrando…” | Revisa variables en Vercel y `fix-perfil-admin.sql` para super_admin |
| Script no asigna sucursal | Confirma que `branches` tiene datos (`seed-multi-sucursal.sql`) |
| Error en `administradores` | Ejecuta `schema-multi-sucursal.sql` (columna `branch_id`) |

---

## Resumen del flujo

```
Authentication (crear 4 usuarios)
        ↓
crear-admins-sucursal.sql (rol + branch_id en profiles)
        ↓
/admin/login con cada correo
```

Archivo SQL: **`supabase/crear-admins-sucursal.sql`**
