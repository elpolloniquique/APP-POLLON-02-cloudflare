# EL POLLÓN BOT — Documentación

Bot de WhatsApp **sin IA generativa**. Cerebro: **Supabase**. Costo extra de APIs: **$0**.

Documentos relacionados:

- Diagnóstico: `docs/WHATSAPP_BOT_FASE0_DIAGNOSTICO.md`
- Plan por fases: `docs/WHATSAPP_BOT_IMPLEMENTATION_PLAN.md`
- Host Evolution $0: `docs/WHATSAPP_BOT_FASE15_HOST.md`
- Producción: `docs/WHATSAPP_BOT_PRODUCCION.md`

---

## Principio

```
WhatsApp → WhatsAppProvider (Evolution OSS, $0)
        → webhook / Edge o /api
        → BotEngine (reglas + PostgreSQL)
        → Cerebro 1: productos, pedidos, sucursales, delivery
        → Cerebro 2: memoria entrenable (bot_knowledge)
        → plantillas
        → WhatsApp
```

**Prohibido:** OpenAI, Gemini, Groq, Claude, embeddings de pago, Meta Cloud API, Twilio, WATI, 360dialog.

**Búsqueda “inteligente”:** `pg_trgm` + full-text (`tsvector`) + sinónimos + intenciones + umbral de confianza.

**Autoentrenamiento:** pregunta desconocida → panel → admin escribe respuesta → GUARDAR Y ENTRENAR → memoria. Sin LLM.

---

## Tracking

Reutilizar **`pedidos.codigo_pedido`** (ej. `001548`, UI `#001548`).  
URL cliente: `/cuenta/seguimiento/{id}`.  
No crear otro código tipo `EP-1548` en base de datos.

---

## Estados reales (no inventar)

`pendiente` → `aceptado` → `confirmado` → `preparando` → `en_delivery` → `entregado`  
(+ `cancelado`; `listo` solo legacy).

En mensajes, `en_delivery` se muestra como “en camino / en reparto”.

---

## Teléfono (FASE 6)

Función única: `lib/bot/phone.js` → `normalizeChilePhone()`.

| Entrada | Salida |
|---------|--------|
| `925586256` | `+56925586256` |
| `09 2558 6256` | `+56925586256` |
| `56925586256` | `+56925586256` |
| `+56 9 2558 6256` | `+56925586256` |
| `+51987654321` | `+51987654321` (no se convierte a Chile) |

- Pedidos nuevos: `cliente_telefono` se guarda en E.164 (`+569…`).
- `wa.me` / Evolution: `toWhatsappDigits()` → `569…` (sin +).
- Match: `phonesMatch()` trata `569` y `+569` como el mismo número.
- SQL: `public.normalize_chile_phone()` (`fase6-normalize-chile-phone.sql`).
- Tests: `npm run test:phone`

---

## Intenciones (FASE 7)

Detector determinista (`lib/bot/intents.js`), sin IA.

Orden: código de pedido → queja → humano → delivery+precio → score de `bot_intents` (keywords/patrones/ejemplos) → productos del menú → saludo corto → UNKNOWN.

Un “hola ¿cuánto sale el cuarto?” **no** se trata solo como saludo.

Tests: `npm run test:bot`

---

## Búsqueda PostgreSQL (FASE 8)

Ejecutar: `supabase/fase7-8-intents-search.sql`

| Función | Uso |
|---------|-----|
| `bot_expand_query(text)` | Expande sinónimos |
| `bot_search_knowledge(query, branch_id, limit, min_score)` | FTS `tsvector` + `pg_trgm` |
| `bot_search_chunks(...)` | Fragmentos de documentos |
| `bot_find_similar_unanswered(...)` | Agrupa preguntas parecidas |

El motor llama estas RPC; si aún no existen, usa el score en JavaScript.

---

## BotEngine (FASE 5)

Código: `lib/bot/` — **sin IA**.

```
processInbound({ phone, message, profileName, branchId, messageId })
  → normalizeChilePhone
  → dedupe / rate-limit
  → cliente + conversación
  → intención (reglas + bot_intents)
  → productos / pedidos / sucursal (Supabase)
  → memoria bot_knowledge
  → plantilla
  → guardar bot_messages
```

Si no entiende: guarda `bot_unanswered_questions` (no inventa).  
Si pide humano/queja: `conversation.mode = human_required` y el bot deja de responder.

Simulador (no WhatsApp): `POST /api/bot-simulate`  
Auth: `X-EP-WA-SECRET` o JWT staff (`super_admin` / `admin_sucursal`).

```json
{ "phone": "+56912345678", "message": "hola", "branchId": "uuid-opcional" }
```

---

## Panel admin (FASE 16–18)

Ruta: **`/admin/whatsapp`** (nav: “WhatsApp Bot”, perm `whatsapp_ai`).  
Subrutas: dashboard, inbox, memoria, sin-respuesta, documentos, sinonimos, intenciones, config, eventos, logs, probar, conexion.

| Ruta | Qué hace |
|------|----------|
| `/dashboard` | Métricas 24 h, humanos abiertos, cola, logs |
| `/inbox` | CRM Realtime (`bot_conversations` + `bot_messages`). Tomar / devolver / responder humano |
| `/memoria` | CRUD `bot_knowledge` |
| `/sin-respuesta` | Cola Realtime. **Guardar y entrenar** |
| `/documentos` | PDF / TXT / DOCX OSS |
| `/sinonimos` | Diccionario `bot_synonyms` |
| `/intenciones` | `bot_intents` (keywords, patrones, handler, prioridad) |
| `/config` | `bot_settings` key/value (nada crítico hardcodeado) |
| `/eventos` | `bot_events` + cola de avisos |
| `/logs` | `bot_logs` |
| `/probar` | `/api/bot-simulate` |
| `/conexion` | Evolution legado (no se borra) |

Inbox humano: `POST /api/bot-human-reply`. Si el modo es `human` / `human_required`, el BotEngine no responde.

Al guardar memoria, config, sinónimos o intenciones **no hace falta redeploy**.

---

## Avisos de pedido (FASE 13–14)

Fuente de verdad: **trigger SQL** en `pedidos` → `bot_events` (idempotencia) → `bot_notification_queue`.  
El checkout/admin solo hacen ping de respaldo a `/api/bot-order-hook` (no envían WhatsApp desde el browser).

| Evento | `event_key` | Plantilla |
|--------|-------------|-----------|
| Pedido nuevo | `order:{id}:created` | `templates.order_created` (ítems + `#codigo_pedido`) |
| Cambio de estado | `order:{id}:status:{estado}` | `pendiente` … `en_delivery` … `entregado` / `cancelado` |

Estados reales: `pendiente` → `aceptado` → `confirmado` → `preparando` → `en_delivery` → `entregado`.  
`en_delivery` se muestra como “en camino”. `listo` es legacy.

SQL: `supabase/fase13-15-order-notify.sql`  
APIs: `/api/bot-order-hook`, `/api/bot-dispatch-queue`

Si tenías Database Webhook a `/api/wa-order-notify`, desactívalo para no duplicar.

---

## Conector WhatsApp (FASE 15)

`WhatsAppProvider` (`lib/bot/provider.js`): Evolution OSS o *noop* si no hay host.

- Inbound: `POST /api/bot-wa-inbound` → BotEngine → `provider.sendText`
- Outbound avisos: cola → `provider.sendText`
- **No** Meta Cloud API · **No** trycloudflare en producción

Host persistente $0 (Oracle Always Free, etc.): `docs/WHATSAPP_BOT_FASE15_HOST.md`

---

## Tablas FASE 4 (`supabase/fase4-pollon-bot.sql`)

| Tabla | Uso |
|-------|-----|
| `bot_settings` | Config key/value (saludo, soporte, umbral, plantillas de estados) |
| `bot_synonyms` | Diccionario |
| `bot_intents` | Intenciones + keywords + handler |
| `bot_knowledge` | Memoria entrenable (pregunta/respuesta/variantes/FTS) |
| `bot_documents` | Metadatos de PDF/TXT/DOCX en Storage |
| `bot_knowledge_chunks` | Fragmentos + `tsvector` |
| `bot_conversations` | Contexto CRM |
| `bot_messages` | Historial incoming/outgoing |
| `bot_unanswered_questions` | Cola “sin respuesta” |
| `bot_events` | Idempotencia (`event_key` UNIQUE) |
| `bot_notification_queue` | Reintentos WhatsApp |
| `bot_logs` | Logs (sin secretos) |

Funciones: `bot_normalize_text()`, `normalize_chile_phone()` → `+569…`  
Storage: bucket privado `bot-documents`.  
`bot_ai_usage` (si existe) **no se usa**.

---

## Seguridad (FASE 19)

SQL: `supabase/fase19-bot-security.sql`

- `SUPABASE_SERVICE_ROLE_KEY`, `EVOLUTION_API_KEY`, `EP_WA_WEBHOOK_SECRET` **solo backend**. Nunca `VITE_*`.
- RLS: `anon` sin `bot_*`. Super admin todo; admin sucursal su sucursal (settings global = solo lectura).
- Webhooks: secret obligatorio en producción. Cron no se autentica solo con `x-vercel-cron`.
- Rate limit: inbound, simulador, order-hook, dispatch, human-reply.
- Idempotencia: `bot_events.event_key` UNIQUE.
- Cola: `bot_notification_queue` + reintentos (no quema intentos si Evolution no está).
- Auditoría: `bot_logs` (textos sanitizados, sin JWT/keys) + triggers en settings/knowledge.
- Auth APIs: `lib/bot/auth.js`.

## APIs

| Ruta | Uso |
|------|-----|
| `POST /api/bot-simulate` | Probar motor (no WA) |
| `POST /api/bot-wa-inbound` | Evolution → BotEngine |
| `POST /api/bot-order-hook` | Pedidos INSERT/UPDATE |
| `GET/POST /api/bot-dispatch-queue` | Drenar cola de avisos |
| `POST /api/bot-human-reply` | Inbox humano |
| `POST /api/bot-process-document` | Parser OSS documentos |

## Tests (FASE 20)

```
npm run test:bot
npm run build
```

Casos: saludo, precio, delivery, pedido `#codigo`, estados, webhook duplicado (`event_key`), humano (bot no responde), desconocido → entrenar → similar, rate limit, sanitize logs.

## Producción (FASE 21)

Checklist completo: **`docs/WHATSAPP_BOT_PRODUCCION.md`**.  
Env vacío: `.env.example`. Host WA: `docs/WHATSAPP_BOT_FASE15_HOST.md`.

El deploy a Vercel lo haces tú (push / dashboard). Sin Evolution el panel y el simulador ya sirven.
