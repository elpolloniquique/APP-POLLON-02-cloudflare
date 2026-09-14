# El Pollón Bot — FASE 15: host WhatsApp ($0)

El cerebro (Supabase + BotEngine + panel) **no necesita** WhatsApp.  
Enviar/recibir mensajes reales sí: **Evolution API** (open source) en un proceso **siempre encendido**.

## Qué está prohibido

| Opción | ¿Por qué no? |
|--------|----------------|
| Meta Cloud API | Puede cobrar por mensaje |
| Twilio / 360dialog / WATI | Pago mensual |
| trycloudflare / ngrok / PC del local | Se cae; **no es producción** |
| Vercel como socket WA | Serverless no mantiene la sesión Baileys |

## Qué sí: Evolution OSS + VM persistente

Licencia Evolution: **$0**.  
Host recomendado **$0**: [Oracle Cloud Always Free](https://www.oracle.com/cloud/free/) (VM Ampere ARM, 24/7).

Otras VM gratuitas similares valen si:

1. IP pública o dominio estable  
2. Puerto 8080 (o el que uses) abierto en firewall / Security List  
3. Docker o Node para Evolution  
4. Reinicio automático (`restart: unless-stopped`)

## Variables (solo backend / Vercel)

```
EVOLUTION_API_URL=https://tu-vm:8080
EVOLUTION_API_KEY=clave-larga
EVOLUTION_INSTANCE_NAME=pollon-bot
EP_WA_WEBHOOK_SECRET=otra-clave
SUPABASE_SERVICE_ROLE_KEY=…   (ya la tienes)
```

Nunca `VITE_EVOLUTION_*`. Nunca subir claves a GitHub.

## Webhooks

### 1. Pedidos (FASE 13–14) — tiempo real

En Supabase → **Database → Webhooks** (o Integrations → Webhooks):

- Tabla: `pedidos`
- Eventos: INSERT, UPDATE
- URL: `https://www.el-pollon.cl/api/bot-order-hook?secret=EP_WA_WEBHOOK_SECRET`
- Header opcional: `X-EP-WA-SECRET: …`

El **trigger SQL** (`fase13-15-order-notify.sql`) ya encola en `bot_notification_queue` aunque el webhook falle.  
El checkout solo hace un ping de respaldo (no es la fuente de verdad).

Si tenías un webhook viejo a `/api/wa-order-notify`, **desactívalo** para no duplicar avisos.

### 2. Mensajes entrantes (FASE 15)

En Evolution, webhook de la instancia:

`https://www.el-pollon.cl/api/bot-wa-inbound?secret=EP_WA_WEBHOOK_SECRET`

Eventos: `MESSAGES_UPSERT` (como mínimo).

### 3. Cola (reintentos)

Cron Vercel diario (Hobby): `GET /api/bot-dispatch-queue`  
El webhook de pedidos es lo que importa en vivo.

## Flujo

```
INSERT/UPDATE pedidos
  → trigger SQL → bot_events (UNIQUE) + bot_notification_queue
  → Database Webhook / ping checkout / cron
  → /api/bot-dispatch-queue
  → WhatsAppProvider.sendText()  (adapter Evolution)
```

```
WhatsApp cliente
  → Evolution (VM)
  → POST /api/bot-wa-inbound
  → BotEngine (lib/bot)
  → WhatsAppProvider.sendText()
```

Si Evolution no está configurado, la cola **queda pending** (`provider_not_configured`) y no quema reintentos. El panel y el simulador siguen funcionando.

## Checklist host

- [ ] VM Always Free (u otra) encendida 24/7  
- [ ] Evolution con `restart: unless-stopped`  
- [ ] `EVOLUTION_API_URL` alcanzable desde Vercel (HTTPS o HTTP público)  
- [ ] Instancia `pollon-bot` vinculada (QR / pairing)  
- [ ] Webhook inbound apuntando a `/api/bot-wa-inbound`  
- [ ] Webhook DB `pedidos` → `/api/bot-order-hook`  
- [ ] SQL `fase13-15-order-notify.sql` ejecutado  
- [ ] **No** trycloudflare en producción  
