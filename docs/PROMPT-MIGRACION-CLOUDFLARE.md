# PROMPT LISTO — Migración El Pollón de Vercel a Cloudflare

Copia y pega el bloque de abajo en un chat nuevo (o en este mismo) cuando quieras ejecutar la migración. No cambies el contrato de URLs `/api/...` ni el dominio `https://www.el-pollon.cl`.

---

## PROMPT PARA EL AGENTE

```
Eres un ingeniero senior. Debes MIGRAR por completo el proyecto El Pollón (React 19 + Vite 8 + Tailwind 4 + Supabase + PWA + Capacitor Android) de Vercel a Cloudflare SIN PERDER NINGUNA FUNCIONALIDAD.

Repo: APP-POLLON-02-cloudflare
Dominio de producción que debe seguir funcionando: https://www.el-pollon.cl
App nativa Android: cl.elpollon.app (Capacitor, webDir dist, versión 1.3.1 / code 14)

REGLA DE ORO
- No cambies el comportamiento de negocio.
- Conserva las mismas URLs públicas: /api/*, /DESCARGAR-APK/*, /sw.js, /manifest.json, sitemaps, SPA React Router.
- El POST nativo de GPS DEBE seguir siendo HTTPS absoluto a https://www.el-pollon.cl/api/driver-gps-ping?k=<uuid> (NO capacitor://localhost).
- No subas secretos a Git. Distingue VITE_* (cliente) vs vars solo servidor.
- No rompas el APK: el GPS background y FCM dependen del servidor.
- Caja e inventario del UI usan localStorage (no migrar a Supabase ahora).
- /admin/whatsapp/* hoy redirige a /admin/pedidos, PERO las APIs de WhatsApp Inteligente y Pollón Bot DEBEN seguir existiendo (webhooks Evolution + DB webhooks + cron cola).

============================================================
QUÉ HACE VERCEL HOY (inventario obligatorio a replicar)
============================================================

A) HOSTING SPA (Vite dist)
- Sirve el frontend React (landing, tienda, checkout, cuenta, admin, cocina, caja, stock, reportes, campañas, sucursales, usuarios, config, módulo repartidores admin, app repartidor PWA).
- SPA fallback: cualquier ruta que no sea /api/, robots.txt, sitemap.xml, sitemap-vercel.xml, manifest.json, sw.js, workbox-*, ni archivo con extensión → /index.html
- Headers:
  - Permissions-Policy: geolocation=(self) en todo
  - /DESCARGAR-APK/* : Content-Type application/vnd.android.package-archive, Cache-Control 300s, Content-Disposition attachment
  - /sw.js : no-cache + Service-Worker-Allowed: /
  - /workbox-* : no-cache
  - /manifest.json : application/manifest+json, cache 24h
  - /admin*, /cuenta*, /checkout, /pedido/* : X-Robots-Tag noindex,nofollow
  - robots.txt y sitemaps: text/plain o application/xml + cache
- .vercelignore excluye APK pesado, android/build, node_modules, dist (Vercel reconstruye). En Cloudflare hay que decidir cómo publicar el APK (R2 o Pages asset, no GitHub).
- CI: .github/workflows/deploy-vercel.yml (vercel pull/build/deploy --prebuilt en push a main). Reemplazar por Wrangler / Cloudflare Pages Git o GitHub Actions wrangler.

B) 12 FUNCIONES SERVERLESS EN api/ (Node, estilo Vercel handler req/res)
Portar a Cloudflare Workers o Pages Functions manteniendo path y métodos. Helpers en api/_lib/ no son URLs.

1) POST /api/notify-driver-offers
   - Avisa a repartidores con oferta pendiente.
   - Prioridad: FCM HTTP v1 (FIREBASE_SERVICE_ACCOUNT_JSON) → FCM legacy → Web Push VAPID.
   - Auth: Bearer JWT Supabase (staff del job o selfTest del repartidor).
   - Lo llama: pushService.notifyDriversForJob, sendDriverSelfTestPush, dispatchService, orderDeliveryService, DriverNotifyHome.
   - CRÍTICO para: push con app cerrada (APK FCM y PWA Web Push).

2) POST /api/driver-gps-ping?k=<uuid>
   - NO es un archivo aparte: vercel.json rewrite → /api/notify-driver-offers.
   - Detectado por api/_lib/gpsPing.js (token UUID en query).
   - Body: latitude/lat + longitude/lng.
   - RPC Supabase: ep_upsert_driver_location_by_ping.
   - Side-effect: retryAndNotifyOffers (re-oferta + push).
   - Lo llama: Android nativo @capgo/background-geolocation (pantalla apagada / FGS).
   - URL hardcodeada: src/utils/driverNativeConstants.js → https://www.el-pollon.cl/api/driver-gps-ping?k=
   - CRÍTICO para: GPS en vivo con pantalla apagada.

3) GET|POST /api/cron-retry-driver-offers
   - Reintenta búsquedas de repartidor + reenvía push (retryAndNotifyOffers force).
   - Auth: CRON_SECRET (Bearer, ?secret=, x-cron-secret) o header x-vercel-cron.
   - Cron Vercel backup: 0 12 * * * UTC.
   - Reloj REAL de 1 minuto: Supabase pg_cron → https://www.el-pollon.cl/api/cron-retry-driver-offers?secret=
     (supabase/fix-pg-cron-retry-driver-offers.sql).
   - En Cloudflare: Cron Trigger + SEGUIR aceptando pg_cron de Supabase.

4) POST /api/admin-staff-user
   - CRUD staff: create / update / setPassword (Auth Admin + profiles, opcional ep_driver_profiles).
   - Auth: JWT super_admin o admin_sucursal.
   - Lo llama: AdminUsers.jsx vía staffUserService.
   - CRÍTICO para: crear cajeras, cocina, admins de sucursal, repartidores.

5) POST /api/bot-process-document
   - Parsea PDF/TXT/DOCX del Pollón Bot → bot_knowledge + chunks.
   - Auth: JWT staff (lib/bot/auth.js requireStaff).
   - Lo llama: BotDocuments.jsx.

6) POST /api/bot-simulate
   - Simula BotEngine sin enviar WhatsApp.
   - Auth: JWT staff o BOT_SIMULATE_SECRET / EP_WA_WEBHOOK_SECRET.
   - Rate limit 30/min.

7) POST /api/bot-human-reply
   - Respuesta humana desde inbox CRM → Evolution sendText.
   - Auth: requireStaff.

8) POST /api/bot-order-hook
   - Webhook INSERT/UPDATE pedidos → encola avisos WhatsApp + drena cola.
   - Auth: webhook secret, JWT staff cocina/caja/admin, o match phone+codigo_pedido (checkout anónimo, rate-limited).
   - Lo llama: Supabase Database Webhook + orderService.pingWaOrderNotify (backup al crear/actualizar pedido).
   - URL documentada: https://www.el-pollon.cl/api/bot-order-hook?secret=EP_WA_WEBHOOK_SECRET

9) GET|POST /api/bot-dispatch-queue
   - Drena bot_notification_queue → envío WhatsApp Evolution.
   - Auth: CRON_SECRET + webhook secrets (NO confiar solo en x-vercel-cron).
   - Cron Vercel: 0 15 * * * UTC.
   - También se llama inline desde bot-order-hook.

10) POST /api/bot-wa-inbound
    - Evolution → Pollón BotEngine → respuesta WhatsApp.
    - Auth: EP_WA_WEBHOOK_SECRET o header apikey = EVOLUTION_API_KEY.
    - Vercel config maxDuration: 20.
    - URL: https://www.el-pollon.cl/api/bot-wa-inbound?secret=EP_WA_WEBHOOK_SECRET

11) POST /api/wa-evolution-webhook
    - Evolution → WhatsApp Inteligente (lib/whatsapp/engine.js), stack paralelo/legacy.
    - Auth: X-EP-WA-SECRET / apikey / ?secret=
    - maxDuration: 20.

12) POST /api/wa-evolution-admin
    - Proxy admin Evolution: status, qr, pairing, logout, restart, simulate, retry_outbox, set_human, set_bot, mark_alerts_read, metrics, ping_ollama, ping_evolution.
    - Auth: JWT super_admin (todo) o admin_sucursal (su sucursal).
    - Construye webhookPublicUrl = {VITE_PUBLIC_SITE_URL}/api/wa-evolution-webhook?secret=

13) POST /api/wa-order-notify
    - Avisos de estado de pedido del stack WhatsApp Inteligente.
    - Auth similar a bot-order-hook.
    - Lo llama: Database Webhook legacy; funciones client definidas pero poco usadas (el flujo activo de pedidos bot es bot-order-hook). IGUAL hay que portarlo.

Librerías servidor a portar (Node):
- api/_lib/fcmSend.js (OAuth Google + FCM HTTP v1)
- api/_lib/gpsPing.js
- api/_lib/retryAndNotify.js (RPC ep_retry_stale_driver_searches + FCM/Web Push)
- lib/bot/* (engine, auth, queue, provider, parseDocument, handlers, etc.)
- lib/whatsapp/* (engine, evolution, notify, ollama, supabaseAdmin)
- Dependencia npm web-push (puede requerir polyfills en Workers; si no cabe, usar Node compatibility de Cloudflare o un Worker con nodejs_compat)

C) CRONS VERCEL → Cloudflare Cron Triggers
- 0 12 * * *  /api/cron-retry-driver-offers
- 0 15 * * *  /api/bot-dispatch-queue
Mantener además Supabase pg_cron cada 1 min hacia la misma URL de cron-retry.

D) VARIABLES DE ENTORNO (NO copiar valores; replicar NOMBRES)

Cliente (build Vite, Cloudflare Pages):
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_STORAGE_BUCKET
VITE_WHATSAPP_DEFAULT
VITE_LEGACY_ADMIN_PASSWORD
VITE_OSRM_URL
VITE_VAPID_PUBLIC_KEY
VITE_PUBLIC_SITE_URL=https://www.el-pollon.cl

Solo servidor (Workers / Pages Functions):
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
VAPID_PRIVATE_KEY
VAPID_PUBLIC_KEY
VAPID_SUBJECT
FIREBASE_SERVICE_ACCOUNT_JSON (o GOOGLE_SERVICE_ACCOUNT_JSON)
FCM_SERVER_KEY / FIREBASE_SERVER_KEY (fallback)
CRON_SECRET
EP_WA_WEBHOOK_SECRET
BOT_DISPATCH_SECRET
BOT_SIMULATE_SECRET
BOT_WA_INBOUND_SECRET
EVOLUTION_API_URL
EVOLUTION_API_KEY
EVOLUTION_INSTANCE_NAME
BOT_EVOLUTION_INSTANCE
EP_PUBLIC_SITE_URL
OLLAMA_URL
OLLAMA_MODEL
BOT_STORAGE_BUCKET

En código, lib/bot/auth.js usa process.env.VERCEL para isProdRuntime(). Reemplazar por CF_PAGES / WORKERS o NODE_ENV=production.

E) INTEGRACIONES EXTERNAS QUE APUNTAN A VERCEL HOY
Actualizar URLs al mismo path en el mismo dominio (si el dominio no cambia, solo DNS):
- DNS el-pollon.cl / www → Cloudflare
- Evolution webhook bot: /api/bot-wa-inbound?secret=
- Evolution webhook WA inteligente: /api/wa-evolution-webhook?secret=
- Supabase Database Webhook: /api/bot-order-hook?secret=  (y legacy /api/wa-order-notify)
- Supabase pg_cron: /api/cron-retry-driver-offers?secret=
- Android GPS: https://www.el-pollon.cl/api/driver-gps-ping?k=
- Descarga APK: https://www.el-pollon.cl/DESCARGAR-APK/El-Pollon-repartidor.apk

============================================================
QUÉ NO DEPENDE DE VERCEL (NO reimplementar; sigue en Supabase/cliente)
============================================================
- Auth, RLS, Realtime, Storage, menú, pedidos, checkout, cuenta, tracking cliente, cocina, dashboard, reportes, campañas, sucursales, config, caja UI (localStorage), stock UI (localStorage), mapas (MapLibre/OSRM/CARTO), impresora térmica LAN.
- RPCs delivery: ep_accept_delivery_offer, ep_reject_delivery_offer, ep_confirm_pickup, ep_confirm_delivery, ep_set_my_operational_status, ep_upsert_driver_location, ep_ensure_driver_profile, ep_ensure_my_gps_ping_token, ep_upsert_my_fcm_token, ep_quote_delivery, ep_start_driver_search, etc.
- Si desaparece el servidor: el repartidor AÚN puede aceptar/rechazar/entregar CON LA APP ABIERTA (poll + Realtime). Pierde: push con app muerta, GPS con pantalla apagada, crear staff, WhatsApp bot.

============================================================
APP NATIVA REPARTIDOR — FUNCIONES A NO ROMPER
============================================================
Modos:
- APK nativo: UI 5 pestañas, aceptar/rechazar, GPS FGS, FCM + alarma nativa, badge OEM.
- PWA Chrome: SOLO notificar (DriverNotifyHome); no acepta pedidos.

Rutas: /repartidor, /mapa, /historial, /ingresos, /perfil
Login: Supabase Auth, role delivery|repartidor, admin_status approved.
Online/offline: RPC ep_set_my_operational_status (GPS obligatorio en nativo).
Ofertas: Realtime + poll; accept/reject vía RPCs (no Vercel).
Push envío: SÍ Vercel/CF → FCM v1 → legacy → Web Push.
Recepción nativa: PollonMessagingService.java + OfferAlarmPlayer + DriverBadgePlugin, canal pollon_driver_alarm_v3.
GPS dual:
  A) JS foreground → ep_upsert_driver_location
  B) Capgo FGS POST → /api/driver-gps-ping
Pickup/entrega: RPCs + sync estado pedido.
Mapa: MapLibre + OSRM; navegación Google Maps externa.
Ingresos/historial/perfil: solo Supabase.
Plugins Capacitor: app, geolocation, @capgo/background-geolocation, push-notifications, local-notifications, haptics, splash-screen, status-bar, plugin custom DriverBadge.
Java: MainActivity, PollonMessagingService, DriverBadgePlugin, BadgeHelper, OfferAlarmPlayer.
Deep link: elpollon://repartidor
APK público: /DESCARGAR-APK/El-Pollon-repartidor.apk con headers MIME.

============================================================
PLAN DE IMPLEMENTACIÓN EXIGIDO
============================================================
1) Inventariar y adaptar handlers Vercel (req, res, req.query, req.body, res.setHeader) a Cloudflare (Request/Response o adapter). Preferir un adapter único para no reescribir 12 veces.
2) wrangler.toml + proyecto Cloudflare Pages (SPA Vite) + Functions/Workers para /api/*.
3) Replicar rewrites, headers, crons.
4) nodejs_compat si hace falta para web-push, crypto FCM, unpdf/mammoth en bot-process-document.
5) Sustituir process.env.VERCEL por detección Cloudflare/producción.
6) Build: npm run build; Pages sirve dist; Functions no deben ir en el bundle cliente.
7) GitHub Actions: reemplazar deploy-vercel.yml por deploy Cloudflare (wrangler pages deploy + secrets).
8) Checklist de prueba OBLIGATORIO antes de cambiar DNS:
   - / /tienda /checkout /admin/login /repartidor
   - POST notify-driver-offers (self-test push)
   - POST driver-gps-ping con token de prueba
   - admin-staff-user create (staging)
   - bot-simulate
   - bot-wa-inbound ping
   - bot-order-hook ping
   - cron-retry-driver-offers con CRON_SECRET
   - bot-dispatch-queue con secret
   - Headers APK, sw.js, SPA deep link /admin/pedidos
   - PWA install
9) Cutover DNS: dominio a Cloudflare; actualizar webhooks Evolution/Supabase/pg_cron SOLO si cambia el host (si www.el-pollon.cl se mantiene, DNS basta).
10) No borrar Vercel hasta 48h de producción estable en Cloudflare.
11) Documentar en INSTALACION.md el deploy Cloudflare y deprecar pasos Vercel.

NO hagas un “hello world”. Porta TODOS los endpoints. Si un paquete Node no corre en Workers, usa el runtime Node de Cloudflare (nodejs_compat / Pages Functions con Node) o un Worker dedicado, no dejes el endpoint muerto.

Empieza por el adapter de handlers + wrangler + port de notify-driver-offers + gps-ping (los más críticos del APK), luego staff, luego todo el bot/WhatsApp, luego crons/headers/CI.
```

---

## Cómo usar este prompt

1. Abre un chat nuevo en Cursor (contexto limpio, más tokens).
2. Pega el bloque de arriba.
3. Ten a mano: cuenta Cloudflare, dominio, vars de `.env` (no las pegues en el chat si no hace falta; el agente puede leer `.env.example`).
4. Después del código, sigue el **paso a paso de cutover** (DNS, webhooks, prueba APK) que está en el análisis del chat.
