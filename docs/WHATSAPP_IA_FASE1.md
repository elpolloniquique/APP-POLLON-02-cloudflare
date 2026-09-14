# EL POLLÓN IA — FASE 1: Análisis del proyecto existente

Fecha: 2026-08-08  
Regla: ampliar el sistema, no reemplazarlo. Sin PC 24/7. Sin trycloudflare/ngrok como pieza principal.

---

## 1. Arquitectura actual

| Capa | Qué hay hoy |
|------|-------------|
| Front | React 19 + Vite 8 + Tailwind 4 + React Router 7 |
| Hosting web | Vercel + dominio `el-pollon.cl` + GitHub `elpolloniquique/APP-POLLON` |
| Backend “API” | Funciones serverless en `el-pollon/api/*.js` (Vercel). **No hay Supabase Edge Functions todavía.** |
| Datos | Supabase PostgreSQL + Auth + Realtime + Storage |
| Auth / roles | `profiles` + `roles` + `ROLE_PERMISSIONS` (`super_admin`, `admin_sucursal`, cajera, cocina, delivery, cliente) |
| Pedidos | Tabla `pedidos` + `detalle_pedidos` + Realtime. Estados: `pendiente → aceptado → confirmado → preparando → en_delivery → entregado` (+ `cancelado`, legacy `listo`) |
| Delivery GPS | Módulo `ep_*` (repartidores, ofertas, tarifas `ep_quote_delivery`) |
| WhatsApp hoy | Concierge **Evolution/Baileys** en `lib/whatsapp/*` + `api/wa-*.js` + panel `/admin/whatsapp` |

### Por qué el WhatsApp actual no sirve como arquitectura principal

Evolution mantiene un **socket 24/7**. Vercel es serverless y se apaga. Por eso falló `trycloudflare` / IP del PC.  
El nuevo diseño **no puede depender de Evolution como canal principal**.

### Canal WhatsApp objetivo (Fase 4+)

**Opción principal:** WhatsApp Cloud API (Meta) → webhook HTTPS → **Supabase Edge Function o Vercel `/api`** → BotEngine → PostgreSQL → respuesta Cloud API.

**Adapter:** `WhatsAppProvider` con `MetaWhatsAppProvider` (principal) y `EvolutionWhatsAppProvider` (opcional, apagado, por si algún día hay VPS). El motor **no** llama a Evolution ni a Meta directo.

**Costo (transparencia):** Cloud API no requiere PC. Meta da un cupo mensual de conversaciones; al superarlo cobra. No hay alternativa oficial 100 % ilimitada y serverless. No se conectará OpenAI/ChatGPT de pago en silencio; la IA (Fase 10) irá detrás de `AIProvider` con fallback reglas+DB.

---

## 2. Tablas encontradas (fuente de verdad)

### Núcleo tienda (usar SIEMPRE para precios / sucursal / pedido)

| Tabla | Uso para el bot |
|-------|-----------------|
| `branches` | Nombre, dirección, `whatsapp`, `opening_hours`, delivery/retiro, ETA |
| `categories` / `products` | Menú **por sucursal**, precio, `is_available`, promo, imagen |
| `product_extras` | Extras reales |
| `promotions` | Promos (si hay filas) |
| `delivery_zones` | Zonas/precio (si se usa) |
| `ep_pricing_rules` + `ep_quote_delivery()` | Tarifa delivery por km/tramos |
| `pedidos` | `cliente_telefono`, `cliente_nombre`, `branch_id`, `customer_id`, `estado`, `total`, `datos_json` (items, `wa_avisos`) |
| `detalle_pedidos` | Ítems del pedido |
| `order_status_history` | Historial de estados |
| `profiles` | Cliente/staff: `phone`, `role`, `branch_id` |
| `customer_addresses` | Direcciones |
| `customer_marketing_preferences` | `accepts_whatsapp_promotions` |
| `settings` | Config JSON por sucursal/global |
| `marketing_campaigns` | No usar para spam WA |

### WhatsApp actual (reutilizar / evolucionar, no DROP)

| Tabla | Hoy | En el nuevo diseño |
|-------|-----|-------------------|
| `ep_wa_settings` | Toggle, plantillas, fidelización, Evolution instance | Config bot + plantillas de estados. Añadir campos Meta (phone_number_id, verify) **sin guardar tokens** |
| `ep_wa_kb` | FAQ keywords | Base de conocimiento reglas. RAG/embeddings después (`bot_knowledge` o columnas nuevas) |
| `ep_wa_sessions` | `phone+branch`, mode bot/human, last_order, intent | = conversación. Ampliar status/assigned_user/resumen |
| `ep_wa_messages` | in/out, intent | Historial. Ampliar message_type, whatsapp_message_id, sender_type |
| `ep_wa_outbox` | Idempotencia avisos pedido (`order_id+event`) | Base de `bot_events` / cola |
| `ep_wa_alerts` | Quejas / desconexión | Inbox “requiere humano” |

### No usar como fuente del bot

- Caja / stock localStorage o tablas POS locales  
- `productos`/`categorias` legacy (el live usa `products`/`categories`)  
- Evolution `.env` del PC (`c:\APP POLLON\evolution-api`)

---

## 3. Módulos de código encontrados

| Módulo | Ruta | Reutilizar |
|--------|------|------------|
| Pedidos | `src/services/orderService.js` | `saveOrder` / `updateOrder` / Realtime / `wa_avisos` |
| Menú | `src/services/menuService.js` → `loadBranchMenu` | Precios reales |
| Sucursales | `src/services/branchService.js` → `isBranchOpenNow` | Horario real |
| Clientes | `src/services/customerService.js` | Pedidos por cliente, marketing WA |
| Delivery | `ep_quote_delivery`, `orderDeliveryService.js` | Tarifas |
| Teléfono | `lib/whatsapp/phone.js` | `normalizeWhatsappPhone` (Chile 56) |
| Intents + motor | `lib/whatsapp/intents.js`, `engine.js` | Nivel 1–2 (reglas + DB). Extraer a `BotEngine` sin acoplar Evolution |
| Texto CLP | `lib/whatsapp/text.js` | `$12.990` |
| Notify estados | `lib/whatsapp/notify.js` + `api/wa-order-notify.js` | Lógica de avisos + idempotencia outbox |
| Panel WA | `src/pages/admin/AdminWhatsApp.jsx` `/admin/whatsapp` perm `whatsapp_ai` | Evolucionar a CRM (inbox), no tirar la ruta |
| APIs Vercel | `api/wa-evolution-webhook.js`, `wa-order-notify.js`, `wa-evolution-admin.js` | Reemplazar webhook Evolution por Cloud API; keep notify vía DB webhook |

**No existe:** `supabase/functions/`, pgvector en migraciones, `WhatsAppProvider`, `AIProvider`, inbox Realtime tipo CRM.

---

## 4. Qué reutilizaremos vs qué crearemos

### Reutilizar (no reescribir)

- Toda la tienda, checkout, cocina, caja, delivery GPS, auth, RLS de pedidos  
- Tablas `branches`, `products`, `pedidos`, `profiles`, marketing prefs  
- Permiso `whatsapp_ai` y nav `/admin/whatsapp`  
- Normalización de teléfono, intents de reglas, plantillas de estado, outbox idempotente  
- Checkout “activar avisos” + `datos_json.wa_avisos`  
- Compra **en la web** (esta fase no arma carrito en WhatsApp)

### Evolucionar (ALTER / refactor, sin DROP)

- `ep_wa_*` → modelo conversacional + humano + logs  
- `engine.js` → `BotEngine` (reglas → DB → RAG → IA)  
- `evolution.js` → un provider detrás de interfaz  
- Panel Conexión: credenciales Cloud API (no QR/túnel)  
- `api/wa-order-notify.js` o Edge `bot-order-*` disparado por Database Webhook

### Crear (nuevo)

| Pieza | Fase |
|-------|------|
| `WhatsAppProvider` + `MetaWhatsAppProvider` | 3–4 |
| Edge Functions: `whatsapp-webhook`, `bot-process-message`, `bot-order-created`, `bot-order-status-changed` | 3–7 |
| Tablas nuevas solo si hace falta: `bot_events`, `bot_logs`, `notification_queue`, `bot_knowledge` (RAG) | 2, 7, 9 |
| Inbox CRM Realtime + dashboard + settings + knowledge | 11–13 |
| `AIProvider` + embeddings pgvector | 9–10 |
| Docs `WHATSAPP_BOT_ARCHITECTURE.md` + `.env.example` Cloud API | 16 |

### No crear ahora

- Carrito/checkout dentro de WhatsApp  
- Speech-to-text, visión, GPS delivery desde pin WA (solo guardar metadata)  
- Campañas masivas WA  
- Dependencia de PC/Oracle/Evolution como canal principal  
- OpenAI de pago sin documentar costo

---

## 5. Flujo objetivo (sin servidor fijo)

```
Cliente WhatsApp
    → Cloud API (Meta)
    → Webhook HTTPS (Edge Function o /api)
    → BotEngine (reglas → Supabase → RAG → IA)
    → PostgreSQL (productos, pedidos, sucursales, memoria)
    → Cloud API send
    → WhatsApp

Pedido web (INSERT/UPDATE pedidos)
    → Database Webhook
    → Edge Function (idempotencia bot_events / ep_wa_outbox)
    → WhatsApp (ventana 24h o plantilla HSM)
```

Panel admin: React + Vercel + Supabase Realtime (inbox).

---

## 6. Variables (sin secretos en repo)

Hoy: `VITE_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `EVOLUTION_*`, `EP_WA_WEBHOOK_SECRET`.

Nuevas (Fase 4, solo backend / Supabase secrets):

- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN` / app secret (firma)
- `WHATSAPP_PROVIDER=meta` (default)
- `AI_API_KEY` / `AI_MODEL` (Fase 10, opcional)

---

## 7. Plan de fases (sin caos)

| Fase | Contenido | Estado |
|------|-----------|--------|
| **1** | Este análisis | Hecha |
| **2** | Migraciones SQL aditivas (`ep_wa_*` + eventos/logs/cola) | SQL listo: `supabase/fase2-pollon-ia.sql` (ejecutar en Supabase) |
| **3** | `WhatsAppProvider` + `BotEngine` desacoplado | |
| **4** | Webhook Cloud API (verify + firma) | |
| **5** | Saludo / gracias / humano (reglas) | |
| **6** | Productos, sucursal, horario, delivery reales | |
| **7** | Pedidos + estados automáticos + anti-duplicado | |
| **8** | Memoria conversacional (últimos msgs + resumen) | |
| **9** | RAG + `bot_knowledge` + pgvector | |
| **10** | `AIProvider` solo si reglas+DB no alcanzan | |
| **11** | Panel CRM inbox | |
| **12** | Transferencia humano / reactivar bot | |
| **13** | Analytics + config plantillas | |
| **14** | RLS, rate limit, no secretos en front | |
| **15** | Tests casos 1–13 del prompt | |
| **16** | Docs + deploy (Vercel + secrets Meta + DB webhook) | |

---

## 8. Decisiones técnicas (donde el prompt no fija un solo camino)

1. **Webhook runtime:** empezar con **Vercel `/api/wa-cloud-webhook`** (ya hay producción) y/o **Edge Function** equivalente. Misma firma `WhatsAppProvider`. Si Edge Functions no están habilitadas en el proyecto, no bloquear Fases 3–7.  
2. **Tablas:** no crear un segundo universo `whatsapp_*` paralelo; **ampliar `ep_wa_*`** y añadir `bot_events` / `bot_logs` / `notification_queue` / `bot_knowledge`.  
3. **Clientes WA:** `profiles.phone` si hay cuenta; si no, fila de sesión/contacto en `ep_wa_sessions` (hoy ya es el contacto).  
4. **IA:** Fase 10. Hasta entonces 0 llamadas LLM. Fallback: plantillas + KB.  
5. **Evolution:** código queda como adapter apagado; el panel deja de exigir QR/túnel.

---

## 9. Cómo ejecutar la Fase 2

1. Abre Supabase → SQL Editor.
2. Pega y ejecuta **todo** `el-pollon/supabase/fase2-pollon-ia.sql`.
3. Si `pgvector` no está habilitado, verás un NOTICE: el resto de tablas igual se crea. Embeddings se completan en Fase 9.

No hace falta PC, Evolution ni túnel.

---

## 10. Criterio de éxito del producto (mismo del prompt, al final)

Cliente: hola → menú/precio real → delivery real → pide en el-pollon.cl → avisos de estado → historial visible en admin. Sin PC encendida.
