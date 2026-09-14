# WhatsApp Inteligente El Pollón — instalación (Fase 1 + 2 + 3)

Concierge + avisos + FAQ + quejas. **No cobra ni arma carrito en el chat.**  
La venta sigue en [https://www.el-pollon.cl/](https://www.el-pollon.cl/).  
**Cero APIs de pago.** Evolution API / Baileys (open source) + Supabase + Vercel.

---

## 1. Qué debes tener claro

| Pieza | Dónde corre | Por qué |
|---|---|---|
| Panel admin `/admin/whatsapp` | Vercel (El Pollón) | Super admin: todo · admin sucursal: live/KB/métricas de SU local |
| Webhooks + motor | `api/wa-*.js` en Vercel | Reciben mensajes y avisos de pedidos |
| Socket de WhatsApp | **Evolution 24/7** (PC del local u Oracle Cloud Always Free) | Vercel **no** puede mantener el QR conectado |

Un bot **por sucursal**. Activas Iquique y dejas OFF Alto Hospicio si quieres.

---

## 2. SQL (obligatorio)

En Supabase → **SQL Editor** → pega y ejecuta **en orden**:

1. `el-pollon/supabase/fix-whatsapp-inteligente.sql` (si aún no lo corriste)
2. `el-pollon/supabase/fix-whatsapp-inteligente-fase2.sql` (Ollama OFF + anti-spam foto)
3. `el-pollon/supabase/fix-whatsapp-inteligente-fase3.sql` (A/B, opt-out, RLS admin sucursal)

Crea: `ep_wa_settings`, `ep_wa_kb`, `ep_wa_sessions`, `ep_wa_messages`, `ep_wa_outbox`, `ep_wa_alerts`  
RLS: `super_admin` todo; `admin_sucursal` solo su sucursal (KB / live / métricas).

---

## 3. Variables en Vercel (y `.env.local` para pruebas)

```
EVOLUTION_API_URL=http://TU-SERVIDOR:8080
EVOLUTION_API_KEY=una-clave-larga-que-tu-elijes
EP_WA_WEBHOOK_SECRET=otra-clave-distinta
VITE_PUBLIC_SITE_URL=https://www.el-pollon.cl
SUPABASE_SERVICE_ROLE_KEY=…   (ya debería existir)
```

Nunca pongas `EVOLUTION_API_KEY` ni `SERVICE_ROLE` en el frontend (`VITE_*`).

---

## 4. Instalar Evolution API (gratis, Docker)

En un PC que quede encendido **o** en Oracle Cloud Always Free:

```bash
git clone https://github.com/EvolutionAPI/evolution-api.git
cd evolution-api
```

Crea un `.env` (ejemplo mínimo):

```
AUTHENTICATION_API_KEY=la-misma-que-EVOLUTION_API_KEY-en-Vercel
SERVER_URL=http://IP-PUBLICA:8080
```

Levanta:

```bash
docker compose up -d
```

Abre `http://IP:8080` y confirma que Evolution responde.

Si el PC está detrás de router: reenvía el puerto **8080** (o usa un túnel).  
Oracle Cloud: abre el puerto en Security List + firewall.

---

## 5. Conectar una sucursal

1. Entra a **https://www.el-pollon.cl/admin/whatsapp** con super admin.
2. Elige sucursal (arriba).
3. Pestaña **Conexión** → modo **Código (recomendado)**.
4. Confirma el número (el de `branches.whatsapp`) → **Generar código de vinculación**.
5. En el celular de **ese** WhatsApp: **Dispositivos vinculados** → **Vincular con el número de teléfono** → escribe el código (ABCD-1234). Caduca ~1 min.
6. Espera badge **Conectado** (el panel refresca solo unos 90 s).
7. Activa el toggle **Activar en esta sucursal**.
8. Pestaña **Configurar**: deja **modo proactivo OFF** (recomendado).
9. Guarda.

Plan B: pestaña **QR** → **Generar / recargar QR** → escanear.

Esto **no** elimina Evolution 24/7. El código solo evita escanear el QR.

Webhook que debe apuntar Evolution (el panel lo intenta configurar solo):

`https://www.el-pollon.cl/api/wa-evolution-webhook?secret=EP_WA_WEBHOOK_SECRET`

Si no quedó automático: en Evolution → instancia `ep_…` → Webhook → esa URL → evento `MESSAGES_UPSERT`.

---

## 6. Cómo probar (criterio de aceptación)

1. Desde otro teléfono escribe **hola** al WhatsApp de esa sucursal.  
   Debe saludar *Pollería El Pollón — {sucursal}* + pasos + link web.
2. **¿Atienden?** → abierto/cerrado real + horario.
3. Nombre de un plato (ej. *chaufa*) → precio real + link `/tienda?branch=…&q=…`.
4. Haz un pedido de prueba en la web → checkout **Activar avisos…** → envía el mensaje.  
   El bot confirma con detalle (si el módulo está ON).
5. En `/admin/pedidos` pasa a **preparando** → aviso cocina.  
   Luego **en_delivery** → en camino.  
   **entregado** → gracias (+ fidelización si ya tiene compras).
6. Escribe **reclamo** / **está frío** → empatía, el bot se calla, alerta en pestaña **Entrenar + Live**. Tú respondes a mano en el mismo WhatsApp.
7. Edita una plantilla o KB → el **siguiente** mensaje ya usa el texto nuevo (sin redeploy).

Simulador (sin WhatsApp): pestaña **Entrenar + Live** → escribe un mensaje de prueba.

---

## 7. Webhook de pedidos en Supabase (opcional, recomendado)

Además del aviso que dispara el panel al cambiar estado, puedes crear un **Database Webhook**:

- Tabla `pedidos` → INSERT + UPDATE  
- URL: `https://www.el-pollon.cl/api/wa-order-notify`  
- Header: `X-EP-WA-SECRET` = el mismo `EP_WA_WEBHOOK_SECRET`

Así también llegan avisos si el estado cambia desde otro sistema.

---

## 8. Modo proactivo vs avisos (importante)

| Modo | Qué hace | Riesgo |
|---|---|---|
| **OFF (default)** | Espera “Activar avisos…” / “AVISOS #codigo” | Bajo — recomendado |
| **ON** | El bot escribe primero cuando nace el pedido | Mayor riesgo de ban de WhatsApp |

No hagas campañas masivas por este canal.

---

## 9. Si algo falla

| Síntoma | Qué revisar |
|---|---|
| QR / código no sale / `fetch failed` | Evolution **apagado** o puerto **8080 cerrado** a internet. En el navegador debe abrir `http://TU-IP:8080`. Oracle: Security List + firewall Windows. Vercel no puede generar código ni QR si no alcanza el servidor |
| Código vacío | Evolution sí responde pero no mandó pairing: recarga en 5 s o usa QR |
| “hola” no responde | Toggle activado · webhook URL+secret · instancia `ep_…` de ESA sucursal |
| No llegan avisos de estado | SQL ejecutado · pedido con teléfono 56 9… · outbox en Live · Evolution conectado |
| Cajera ve el menú | No debe: cajera no tiene `whatsapp_ai`. Admin sucursal sí, pero sin QR |

---

## 10. Fase 2 — métricas, foto de plato, Ollama local

En `/admin/whatsapp`:

- **KPIs** arriba: avisos hoy, quejas sin leer, % pedidos con WhatsApp, confirmaciones 7d.
- Pestaña **Métricas**: hoy + 7 días + avisos por evento.
- **Configurar → foto de plato**: OFF por defecto. Si lo activas, al preguntar un plato se envía **1** imagen pública (no spam: no repite el mismo plato en 45 min).
- **Configurar → Ollama**: OFF por defecto. Solo reescribe el *fallback* con hechos reales (menú + precios). **Cero ChatGPT.**

### Ollama (opcional, misma VM que Evolution)

```bash
# En el PC / Oracle Always Free (no en Vercel)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2
# Escucha en 0.0.0.0:11434 y abre el puerto en el firewall
```

Variables extra en Vercel:

```
OLLAMA_URL=http://IP-PUBLICA:11434
OLLAMA_MODEL=llama3.2
```

Vercel **no** puede hablar con `localhost`. Si Ollama no responde en ~6 s, el bot usa la plantilla fallback.

En el admin: **Probar Ollama** → luego activa el toggle por sucursal.

### Probar Fase 2

1. Métricas: haz un pedido de prueba + avisos + un `reclamo` → los KPIs deben moverse.
2. Foto: activa “Enviar 1 foto del plato”, pregunta un plato con imagen en el menú.
3. Ollama: deja el toggle OFF salvo que Ollama esté arriba. Con ON, escribe algo raro (“me aburro”) → tono más natural, **sin inventar precios**.

---

## 11. Qué no hace (a propósito)

- Cobrar o armar carrito en WhatsApp  
- LLM de pago (ChatGPT, OpenAI, Anthropic, etc.)  
- Acceso QR / Evolution para admin de sucursal o cajera  
- Campañas masivas por WhatsApp

---

## 12. Fase 3 — Dashboard, A/B, opt-out, admin sucursal

Ejecuta `fix-whatsapp-inteligente-fase3.sql` y vuelve a desplegar.

### Dashboard

Bajo los 7 KPIs aparece una franja: **% de pedidos del periodo con avisos WhatsApp** (`pedidos.datos_json.wa_avisos`). Se marca cuando el bot envía la confirmación (checkout “Activar avisos” o `AVISOS #codigo`).

### A/B bienvenida (OFF por defecto)

En **Configurar**: toggle A/B. Variante A = plantilla Bienvenida; B = Bienvenida B. Se fija por teléfono. Métricas en pestaña **Métricas**.

### Opt-out

El cliente escribe *stop*, *no me escriban*, *darme de baja*, etc.  
Se guarda en la sesión. **Los avisos de pedido siguen** si `avisos_si_opt_out` está ON (recomendado). No es baja de WhatsApp Business masiva.

### Admin sucursal

- Ve **WhatsApp inteligente** en el menú (solo su sucursal).
- Pestañas: **Entrenar + Live** y **Métricas**.
- Puede importar/exportar KB JSON, simulador, pasar chats a humano.
- **No** ve QR, logout, restart, Ollama ping ni el toggle de activar sucursal.

### Probar Fase 3

1. Corre el SQL F3 en Supabase.
2. Dashboard: pedido de prueba + avisos → la franja % debe subir.
3. Escribe *hola* con A/B ON → mitad A / mitad B (según teléfono).
4. Escribe *stop* → respuesta de baja; en Live aparece badge opt-out.
5. Entra con un **admin de sucursal**: solo Entrenar + Métricas, sucursal bloqueada.
