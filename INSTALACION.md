# Pollería El Pollón — Instalación (React + Vite + Supabase)

## Requisitos

- Node.js 18+
- Cuenta [Supabase](https://supabase.com) (plan gratuito) — **la misma de siempre, no se migra**
- Cuenta [Cloudflare](https://dash.cloudflare.com) para despliegue (Pages + Functions)

## 1. Instalar y ejecutar en local

```bash
cd el-pollon
npm install
cp .env.example .env
# Edita .env con tu URL y anon key de Supabase
npm run dev
```

Abre http://localhost:5173

## 2. Configurar Supabase

1. Crea un proyecto en Supabase.
2. En **SQL Editor**, ejecuta en orden:
   - `supabase/schema-es.sql` (desde COPIA_01 o copia en este proyecto)
   - `supabase/schema-enterprise.sql` (sucursales, caja, inventario)
   - `supabase/seed-productos-es.sql` (opcional, productos)
   - `supabase/crear-admin.sql` (crear usuario admin)
3. En **Authentication → Users**, crea un usuario admin.
4. En **Storage**, crea bucket `product-images` (público).
5. Copia **Project URL** y **anon key** al archivo `.env`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

## 3. Sin Supabase (modo demo)

Si no configuras `.env`, la app funciona con:

- Menú local (`src/data/fallbackProducts.js`)
- Pedidos en `localStorage`
- Panel admin requiere Supabase Auth

## 4. Desplegar en Cloudflare Pages

Guía completa (conectar el **mismo** Supabase): [INSTALACION-CLOUDFLARE.md](./INSTALACION-CLOUDFLARE.md)

```bash
npm run build
npx wrangler pages deploy dist --project-name=el-pollon
```

En el dashboard de Cloudflare Pages pega las mismas variables que tenías en Vercel. Supabase no cambia: mismas URL y keys.

Dominio de producción: **https://www.el-pollon.cl**

Vercel se puede dejar 48 h como respaldo y luego apagarlo.

## Rutas principales

| Ruta | Descripción |
|------|-------------|
| `/` | Landing |
| `/tienda` | Menú y carrito |
| `/sucursal` | Selector multi-sucursal |
| `/checkout` | Confirmar pedido |
| `/admin/login` | Login administrador |
| `/admin` | Dashboard |
| `/admin/cocina` | Cocina digital |
| `/admin/pedidos` | Pedidos tiempo real |

## Estructura

Ver carpeta `src/` — componentes, páginas, servicios, contextos según arquitectura empresarial.
