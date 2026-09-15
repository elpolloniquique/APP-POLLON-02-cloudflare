# Conectar Cloudflare al mismo Supabase (El Pollón)

**No se crea otra base de datos.** El proyecto de Supabase (`https://xxxxx.supabase.co`) sigue siendo el único. Cloudflare solo reemplaza a Vercel: sirve la web y ejecuta `/api/*`.

El front y las Functions hablan con Supabase por HTTPS (URL + keys). No hay “conector” extra, ni VPN, ni migración SQL.

```
Navegador / APK  --VITE_SUPABASE_URL + ANON-->  Supabase (Auth, REST, Realtime, Storage)
Cloudflare /api  --SUPABASE_URL + SERVICE_ROLE-->  Supabase (RPCs admin, FCM tokens, bot)
```

---

## 1. Dónde sacar las claves (Supabase, igual que antes)

En [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto **existente** → **Project Settings → API**:

| Dato | Variable en Cloudflare | Quién la usa |
|------|------------------------|--------------|
| Project URL | `VITE_SUPABASE_URL` y `SUPABASE_URL` | Front + Functions |
| `anon` `public` | `VITE_SUPABASE_ANON_KEY` y `SUPABASE_ANON_KEY` | Front + Functions (validar JWT) |
| `service_role` **secret** | `SUPABASE_SERVICE_ROLE_KEY` | **Solo Functions** (nunca en el front) |

Copia los **mismos valores** que tenías en Vercel / `.env`. No regeneres keys.

---

## 2. Pegarlas en Cloudflare Pages

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → crear proyecto **Pages** (`el-pollon`).
2. Conecta el repo GitHub **o** despliega con `npm run deploy:cf`.
3. **Settings → Environment variables** → entorno **Production** (y Preview si quieres).

### Build (se meten en el JS del navegador)

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...                                 ← anon, no service_role
VITE_STORAGE_BUCKET=product-images
VITE_WHATSAPP_DEFAULT=...
VITE_OSRM_URL=https://router.project-osrm.org
VITE_VAPID_PUBLIC_KEY=...
VITE_PUBLIC_SITE_URL=https://www.el-pollon.cl
VITE_LEGACY_ADMIN_PASSWORD=   (si la usas)
```

Marca estas como disponibles en **Build** y **Runtime**.

### Solo servidor (Functions `/api/*`) — Encrypt / secret

```
SUPABASE_URL=           (misma URL que VITE_SUPABASE_URL)
SUPABASE_ANON_KEY=      (misma anon)
SUPABASE_SERVICE_ROLE_KEY=
VAPID_PRIVATE_KEY=
VAPID_PUBLIC_KEY=
VAPID_SUBJECT=mailto:contacto@el-pollon.cl
FIREBASE_SERVICE_ACCOUNT_JSON=
CRON_SECRET=
EP_WA_WEBHOOK_SECRET=
BOT_DISPATCH_SECRET=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE_NAME=pollon-bot
```

Si pegas `VITE_SUPABASE_URL` pero olvidas `SUPABASE_URL`, el adapter copia `VITE_*` → `SUPABASE_*` en runtime. Aun así, **pon las dos** para no depender de eso.

Build command: `npm run build`  
Install command: `npm install --include=dev`  
Output directory: `dist`  
Node.js version: `22`  
Compatibility: `nodejs_compat` (ya está en `wrangler.toml`).

---

## 3. Qué tocar en Supabase (Auth URLs, no la DB)

**Authentication → URL Configuration:**

- **Site URL:** `https://www.el-pollon.cl`
- **Redirect URLs** (añade, no borres las actuales):
  - `https://www.el-pollon.cl/**`
  - `https://el-pollon.cl/**`
  - `https://el-pollon.pages.dev/**`
  - `http://localhost:5173/**`

No hace falta abrir puertos ni whitelist de IP. El cliente JS y las Functions llaman `https://<proyecto>.supabase.co`.

**Webhooks y pg_cron:** si el dominio sigue siendo `https://www.el-pollon.cl`, **no cambies nada**. Cuando el DNS apunte a Cloudflare, las mismas URLs (`/api/bot-order-hook`, `/api/cron-retry-driver-offers`, etc.) llegan a Pages Functions.

---

## 4. Crear el proyecto Pages (primera vez)

1. Cloudflare → Pages → **Create** → conectar GitHub (rama `main`).
2. Framework preset: Vite. Build: `npm run build`. Output: `dist`.
3. Pega las variables del paso 2 **antes** del primer deploy.
4. Deploy. Anota la URL `https://el-pollon.pages.dev`.
5. Prueba: `https://el-pollon.pages.dev/` y `https://el-pollon.pages.dev/admin/login`.
6. Dominio: Pages → **Custom domains** → `www.el-pollon.cl` y `el-pollon.cl`.
7. DNS: apunta A/CNAME a Cloudflare (naranja). **No borres Vercel hasta 48 h estables.**

### Crons de backup (opcional; pg_cron ya hace el de 1 min)

```bash
npx wrangler secret put CRON_SECRET -c wrangler.cron.toml
npx wrangler deploy -c wrangler.cron.toml
```

---

## 5. Checklist rápido

- [ ] Mismas tres keys de Supabase (URL, anon, service_role) en Pages
- [ ] Login admin funciona (Auth + `profiles`)
- [ ] Tienda carga productos (tabla `products`)
- [ ] POST `/api/notify-driver-offers` no responde 500 por falta de vars
- [ ] GPS ping nativo sigue en `https://www.el-pollon.cl/api/driver-gps-ping?k=`
- [ ] Webhooks Evolution / pg_cron sin cambiar de host

Detalle de cada `/api` y el APK: [PROMPT-MIGRACION-CLOUDFLARE.md](./PROMPT-MIGRACION-CLOUDFLARE.md)
