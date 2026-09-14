# Verificación módulo Delivery / GPS

## 1) Ejecuta en Supabase (obligatorio ahora)

Archivo:

```
supabase/fix-delivery-production-ready.sql
```

Al final verás un JSON `verificacion` con `ok: true` y tablas/funciones en verde.

También puedes correr:

```sql
SELECT public.ep_verify_delivery_module();
```

## 2) Checklist rápido (ya probado en tu proyecto)

| Componente | Estado |
|------------|--------|
| Tablas `ep_*` | Existen (HTTP 200) |
| `ep_pricing_rules` | Seed "Tarifa base El Pollón" |
| `branches` / `pedidos` | OK |
| OSRM routing | HTTP 200 |
| CARTO tiles | HTTP 200 |
| MapLibre | En build producción |

## 3) Prueba manual repartidor

1. Login con cuenta `role = delivery`
2. Ir a `/repartidor` → **Conectarme** → aceptar permiso GPS del navegador
3. Debe mostrar: `GPS activo · lat, lng`
4. Admin → **En vivo**: debe aparecer el marker del repartidor
5. Admin → **Despacho** → Sincronizar → Ofertar
6. Repartidor recibe card → Aceptar → Recogido → Entregado

## 4) Si falla GPS en celular

- Usa HTTPS (Vercel) o `localhost`
- Chrome/Safari: permitir ubicación
- Android: ubicación en alta precisión

## 5) Mapas (gratis)

- Calles: CARTO Voyager
- Satélite: Esri
- Rutas: `VITE_OSRM_URL` (default project-osrm.org)
