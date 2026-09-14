# El Pollón Bot — Producción (FASE 21)

Checklist para salir a producción. **No despliego yo**: lo haces en Vercel + Supabase + (opcional) Evolution.

Costo extra de software: **$0**. Sin Meta Cloud API. Sin IA.

---

## 1. SQL (en este orden, SQL Editor)

1. Backup / snapshot (recomendado)
2. `supabase/fase4-pollon-bot.sql` (si aún no)
3. `supabase/fase4-fix-search-vector.sql` solo si falló el `search_vector` de fase 4
4. `supabase/fase6-normalize-chile-phone.sql` (opcional pero recomendado)
5. `supabase/fase7-8-intents-search.sql`
6. `supabase/fase13-15-order-notify.sql`
7. `supabase/fase19-bot-security.sql`

No ejecutes `fase2-pollon-ia.sql`. No DROP `ep_wa_*`.

---

## 2. Variables Vercel (solo backend, nunca `VITE_EVOLUTION_*`)

| Variable | Uso |
|----------|-----|
| `SUPABASE_URL` o ya tienes `VITE_SUPABASE_URL` | Proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | APIs `/api/bot-*` |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` | Front + JWT |
| `VITE_PUBLIC_SITE_URL` | `https://www.el-pollon.cl` |
| `EP_WA_WEBHOOK_SECRET` | Webhooks pedidos + inbound + cola |
| `CRON_SECRET` | Cron `/api/bot-dispatch-queue` (Vercel lo manda como Bearer) |
| `EVOLUTION_API_URL` | Host persistente (si hay WA real) |
| `EVOLUTION_API_KEY` | Misma clave que Evolution |
| `EVOLUTION_INSTANCE_NAME` | default `pollon-bot` |

Plantilla vacía: `.env.example`. **No** subas `.env` / `.env.local` a GitHub.

---

## 3. Webhooks

### Pedidos (tiempo real)

Supabase → Database Webhooks → tabla `pedidos` INSERT+UPDATE →  
`https://www.el-pollon.cl/api/bot-order-hook?secret=EP_WA_WEBHOOK_SECRET`

Si existía webhook a `/api/wa-order-notify`, **apágala**.

El trigger SQL ya encola aunque el HTTP falle. El checkout solo hace ping de respaldo.

### WhatsApp inbound

Evolution (instancia) →  
`https://www.el-pollon.cl/api/bot-wa-inbound?secret=EP_WA_WEBHOOK_SECRET`  
(o header `apikey` = `EVOLUTION_API_KEY`)

### Cola

Cron Vercel (Hobby: 1×/día, `0 15 * * *` UTC): `/api/bot-dispatch-queue`  
El webhook de pedidos es lo que importa en vivo.

---

## 4. Evolution 24/7 (solo si quieres WA real)

Ver `docs/WHATSAPP_BOT_FASE15_HOST.md`.

- Oracle Always Free u otra VM **encendida**
- **No** trycloudflare / ngrok / PC del local como arquitectura definitiva
- **No** Vercel como socket Baileys

Sin Evolution el cerebro (panel, memoria, simulador) funciona. La cola queda `provider_not_configured`.

---

## 5. Deploy front

1. `npm run test:bot`
2. `npm run build`
3. Push a GitHub → Vercel (o deploy manual)
4. Entra a `/admin/whatsapp/dashboard` con un usuario `whatsapp_ai`
5. Configura plantillas en `/admin/whatsapp/config`
6. Prueba en `/admin/whatsapp/probar` (no envía WA)

---

## 6. Troubleshooting

| Síntoma | Qué mirar |
|---------|-----------|
| 401 en webhooks | `EP_WA_WEBHOOK_SECRET` en Vercel y en la URL/header |
| Cola `provider_not_configured` | `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` + host encendido |
| Avisos duplicados | Webhook viejo `wa-order-notify` todavía activo |
| Bot no responde en WA | Inbox modo `human` / `human_required` → Devolver al bot |
| No encuentra memoria | ¿Corriste `fase7-8-intents-search.sql`? ¿`active=true`? |
| Admin sucursal no puede guardar config global | Correcto (FASE 19). Solo override de **su** sucursal |
| 429 | Rate limit FASE 19 (IP / teléfono / staff) |
| `search_vector` / 42P17 | `fase4-fix-search-vector.sql` |

Logs: `/admin/whatsapp/logs` (`bot_logs`, sin secretos).  
Eventos: `/admin/whatsapp/eventos` (`bot_events.event_key` UNIQUE).

---

## 7. Seguridad (FASE 19)

- RLS: `anon` sin acceso a `bot_*`. Staff según sucursal.
- Service role solo en `/api/*`.
- Secrets obligatorios en producción.
- Rate limit en inbound, simulador, order-hook, dispatch, human-reply.
- Auditoría: trigger `bot_settings` / `bot_knowledge` → `bot_logs` + `writeAudit` en reply humano / documentos.
- Cron: no se autentica solo con header `x-vercel-cron`.
