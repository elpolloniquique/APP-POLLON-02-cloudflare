# Cajeras por sucursal (2 por local)

Guía para crear **8 cuentas de cajera** (2 en cada una de las 4 sucursales).  
Cada cajera **solo ve pedidos, caja y clientes de su sucursal**.

---

## Qué puede hacer una cajera

| Sí puede | No puede |
|----------|----------|
| Dashboard (solo su sucursal) | Menú / sucursales / configuración |
| Pedidos (ver, imprimir, cambiar estado) | Otras sucursales |
| Caja diaria | Cocina (no está en su menú) |
| Clientes de su sucursal | Campañas |

---

## Correos sugeridos (8 usuarios)

| # | Email | Sucursal |
|---|--------|----------|
| 1 | `cajera1.iquique@elpollon.cl` | Iquique - Vivar |
| 2 | `cajera2.iquique@elpollon.cl` | Iquique - Vivar |
| 3 | `cajera1.altohospicio@elpollon.cl` | Alto Hospicio |
| 4 | `cajera2.altohospicio@elpollon.cl` | Alto Hospicio |
| 5 | `cajera1.arica.sm@elpollon.cl` | Arica Santa María |
| 6 | `cajera2.arica.sm@elpollon.cl` | Arica Santa María |
| 7 | `cajera1.arica.saucache@elpollon.cl` | Arica Saucache |
| 8 | `cajera2.arica.saucache@elpollon.cl` | Arica Saucache |

Puedes usar Gmail; el email debe coincidir en Auth y en el SQL.

---

## Paso 1 — Crear usuarios en Supabase (8 veces)

1. Supabase → **Authentication** → **Users** → **Add user**
2. Email + contraseña
3. **Auto Confirm User** activado
4. **Create user**

Si falla al crear usuario: ejecuta `fix-trigger-crear-usuario.sql`.

---

## Paso 2 — SQL

1. **SQL Editor** → copia todo `supabase/crear-cajeras-sucursal.sql`
2. **Run**
3. Verificación: **8 filas** con `role = cajera`

---

## Paso 3 — Redeploy Vercel

Necesario para el filtro por sucursal en Pedidos y Dashboard.

---

## Paso 4 — Probar

1. `/admin/login` con `cajera1.iquique@elpollon.cl`
2. En Pedidos: **Sucursal: Pollón Iquique - Vivar**
3. Solo pedidos de Iquique

---

## Resumen técnico

- `profiles.role` = `cajera`
- `profiles.branch_id` = UUID de la sucursal
- La app filtra pedidos por `branch_id` del pedido

Super admin ve todas las sucursales.
