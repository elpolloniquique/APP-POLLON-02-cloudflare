# Pedidos en tiempo real — Guía profesional

Cuando un cliente confirma un pedido en la tienda, debe aparecer **automáticamente** en `/admin/pedidos` sin pulsar "Actualizar".

---

## Cómo funciona (arquitectura)

```
Cliente (tienda)  →  INSERT en tabla pedidos (Supabase)
                              ↓
                    Realtime (WebSocket)
                              ↓
Panel admin (/admin/pedidos)  →  lista se actualiza sola + alarma (opcional)
```

Requisitos:
1. El pedido se **guarda en Supabase** (no solo en el navegador del cliente).
2. La tabla **`pedidos`** está en la publicación **`supabase_realtime`**.
3. El panel admin tiene la página **abierta** y conectada (Realtime usa WebSocket).

---

## Paso 1 — SQL en Supabase (obligatorio)

1. **SQL Editor** → **New query**
2. Copia y ejecuta **`supabase/fix-realtime-pedidos.sql`**
3. Debe salir **Success**
4. En los resultados verás filas con `tablename = pedidos` en `supabase_realtime`

---

## Paso 2 — Activar Realtime en el panel de Supabase

1. Supabase → **Database** → **Publications**
2. Abre **`supabase_realtime`**
3. Confirma que **`pedidos`** está marcado / incluido
4. Si no aparece, en **Database** → **Replication** (según versión del dashboard):
   - Busca tabla **`pedidos`**
   - Activa **Realtime** / **Enable replication**

> En proyectos nuevos a veces hay que activarlo manualmente además del SQL.

---

## Paso 3 — Variables en Vercel

En **Vercel** → proyecto → **Settings** → **Environment Variables**:

| Variable | Dónde copiarla |
|----------|----------------|
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |

**Redeploy** después de cualquier cambio.

---

## Paso 4 — Subir el código corregido

Se corrigió un bug importante: antes los pedidos del checkout **no se guardaban en Supabase** si no habías abierto el panel admin antes.

Haz **commit + push** a GitHub para que Vercel redeploy, o **Redeploy** manual.

---

## Paso 5 — Probar el flujo completo

### A) Panel admin (ventana 1)

1. Incógnito o navegador normal: `https://app-pollon.vercel.app/admin/login`
2. Entra como **super_admin**
3. Ve a **Pedidos**
4. Debe decir: **"En vivo — los pedidos nuevos aparecen solos"** (punto verde)
5. Activa **🔔 Alarma ON** si quieres sonido al llegar pedidos

### B) Cliente (ventana 2 — otra incógnito)

1. `https://app-pollon.vercel.app`
2. Elige **sucursal** → agrega productos al carrito
3. **Checkout** → completa nombre, teléfono, dirección → **Confirmar pedido**

### C) Resultado esperado

- En la ventana del **admin**, en 1–3 segundos aparece el pedido nuevo **sin refrescar**
- Si la alarma está ON, suena un beep

---

## Paso 6 — Comprobar en Supabase que el pedido llegó

**Table Editor** → **`pedidos`** → debe haber filas nuevas con `estado = pendiente`.

Si la tabla está **vacía** después de un pedido de prueba:
- Revisa consola del navegador en checkout (F12 → Console)
- Confirma variables Vercel
- Ejecuta de nuevo `fix-realtime-pedidos.sql`

Consulta rápida:

```sql
SELECT id, codigo_pedido, cliente_nombre, total, estado, creado_en
FROM pedidos
ORDER BY creado_en DESC
LIMIT 10;
```

---

## Solución de problemas

| Síntoma | Causa | Solución |
|---------|--------|----------|
| "Sin pedidos" siempre | Pedidos no llegan a Supabase | Redeploy + fix-realtime-pedidos.sql |
| Hay pedidos en Table Editor pero no en admin | Realtime no activado | Paso 2 + fix-realtime-pedidos.sql |
| Solo actualiza con "Actualizar" | WebSocket desconectado | Recarga `/admin/pedidos`, revisa que diga "En vivo" |
| Modo local (texto ámbar) | `.env` / Vercel mal configurado | Variables + redeploy |
| Alarma no suena | Alarma OFF | Pulsa **🔔 Alarma ON** |

---

## Realtime en otras pantallas

Estas páginas también usan la misma conexión en vivo:

- **Dashboard** (`/admin`)
- **Cocina** (`/admin/cocina`)
- **Pedidos** (`/admin/pedidos`)

Mantén al menos una abierta en el local para recibir pedidos.

---

## Resumen checklist

- [ ] `fix-realtime-pedidos.sql` ejecutado
- [ ] `pedidos` en publicación `supabase_realtime`
- [ ] Vercel con URL y ANON KEY + redeploy
- [ ] Prueba: pedido cliente → aparece en admin en segundos
- [ ] Alarma ON en panel Pedidos (opcional)

Archivo SQL: **`supabase/fix-realtime-pedidos.sql`**
