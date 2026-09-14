# EL POLLÓN BOT — FASE 0: Diagnóstico y backup

Fecha: 2026-08-08  
Regla: **no borrar nada**. No migrar todavía. No Meta Cloud API. No IA.

---

## 1. Backup recomendado (hazlo antes de FASE 4)

En Supabase Dashboard:

1. **Project Settings → Database → Backups** (si tu plan lo incluye), o
2. SQL Editor → no hace falta `pg_dump` si haces snapshot del proyecto.
3. Opcional local: `supabase db dump` si tienes CLI.

Tablas críticas a no tocar:

`pedidos`, `detalle_pedidos`, `branches`, `products`, `categories`, `profiles`, `ep_*` (delivery), `ep_wa_*` (WhatsApp anterior).

---

## 2. Inventario: WhatsApp anterior (CONGELAR, no borrar)

| Pieza | Ruta | Acción |
|-------|------|--------|
| Panel Evolution/QR/túnel | `src/pages/admin/AdminWhatsApp.jsx` | Congelar. Se reemplaza en FASE 17 |
| Motor + Ollama + Evolution | `lib/whatsapp/*` | Congelar. Nuevo motor en `lib/bot/` |
| APIs Vercel WA | `api/wa-evolution-*.js`, `api/wa-order-notify.js` | Congelar |
| SQL Evolution | `supabase/fix-whatsapp-inteligente*.sql` | No re-ejecutar como base nueva |
| SQL Cloud API / IA | `supabase/fase2-pollon-ia.sql` | **No usar.** Si ya corriste, no DROP; FASE 4 hará ALTER |
| Docker Evolution local | `c:\APP POLLON\evolution-api\` | No es producción (PC + túnel) |
| Guía antigua | `INSTALACION-WHATSAPP-INTELIGENTE.md` | Obsoleta para este bot |

Tablas `ep_wa_*` **se dejan**. El bot nuevo usará `bot_*`. No se hace `DROP`.

Si ejecutaste `fase2-pollon-ia.sql`, pueden existir ya:

- `bot_events`, `bot_logs`, `bot_knowledge`, `notification_queue`, `bot_ai_usage`

`bot_ai_usage` **no se usará** (prohibido IA). `bot_knowledge` se **ampliará** (no se recrea).

---

## 3. Qué SÍ es el cerebro (no tocar lógica de negocio)

- Pedidos / cocina / caja / delivery GPS / auth / menú / sucursales
- Realtime de `pedidos`
- Checkout web → `codigo_pedido` como seguimiento

---

## 4. Conector WhatsApp $0 (diagnóstico, no integración ciega)

| Opción | Costo software | ¿24/7? | ¿Producción? |
|--------|----------------|--------|----------------|
| **Evolution API** (open source) | $0 licencia | Necesita proceso persistente (Docker/Node) | Sí, **si** corre en un host estable |
| trycloudflare / ngrok / PC | $0 | No estable | **No** |
| Vercel serverless | $0 (ya lo tienes) | No mantiene socket WA | **No** como conector |
| WhatsApp Cloud API (Meta) | Puede cobrar por mensaje | Serverless | **Prohibido** en este prompt |
| Twilio / 360dialog / WATI | Pago mensual | Sí | **Prohibido** |

**Conclusión FASE 0:** el cerebro (Supabase + BotEngine + panel + memoria) es **$0 extra**.  
Enviar/recibir WhatsApp **gratis de API** implica **Evolution (u otro Baileys OSS)** en un host **siempre encendido**.

Host $0 posible (no se contrata ahora): Oracle Always Free, o VM gratuita similar.  
Sin ese host, el bot puede entrenarse y simularse en el panel; WhatsApp real queda pendiente de FASE 15+21.

**No se usará trycloudflare como arquitectura definitiva.**

---

## 5. SQL de solo lectura

Ejecuta en Supabase (opcional): `supabase/fase0-bot-diagnostico.sql`  
Solo `SELECT` / `NOTICE`. No altera datos.

---

## 6. FASE 4 lista

Ejecutar **todo** `el-pollon/supabase/fase4-pollon-bot.sql` en SQL Editor.

---

## 7. Criterio para avanzar a FASE 4 (migraciones)

- [ ] Backup / snapshot hecho o aceptado el riesgo
- [ ] Entendido: tracking = `codigo_pedido`
- [ ] Entendido: estados reales (no inventar `EN_CAMINO` en DB)
- [ ] Entendido: Evolution necesita host persistente $0, no Meta
- [ ] Plan leído: `docs/WHATSAPP_BOT_IMPLEMENTATION_PLAN.md`
