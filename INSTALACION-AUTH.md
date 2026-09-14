# Autenticación y cuentas — El Pollón

## 1. Ejecutar SQL en Supabase

En orden:
1. `schema-multi-sucursal.sql`
2. `schema-auth.sql` ← **nuevo**

## 2. Crear usuarios en Supabase Auth

### Clientes
Se registran desde la tienda (modal **Iniciar sesión / Registrarse**).  
El trigger `handle_new_user` crea automáticamente el perfil en `profiles` con rol `cliente`.

### Personal (staff)
1. Authentication → Add user (email + password)
2. En SQL Editor, actualizar el perfil:

```sql
UPDATE profiles
SET role = 'super_admin', branch_id = NULL, full_name = 'Tu Nombre'
WHERE email = 'tu@email.com';
```

Roles disponibles: `super_admin`, `admin_sucursal`, `cajera`, `cocina`, `delivery`, `cliente`

Para admin de sucursal:
```sql
UPDATE profiles SET role = 'admin_sucursal', branch_id = 'UUID-DE-LA-SUCURSAL'
WHERE email = 'admin.arica@elpollon.cl';
```

## 3. Rutas

| Ruta | Quién |
|------|--------|
| Modal en header | Clientes — registro / login |
| `/cuenta` | Cliente — perfil, pedidos, direcciones |
| `/cuenta/seguimiento/:id` | Seguimiento en tiempo real |
| `/admin/login` | Solo personal |
| `/admin/clientes` | Staff con permiso `customers` |
| `/admin/campanas` | Staff con permiso `campaigns` |

## 4. Seguimiento en tiempo real

Requiere **Realtime** habilitado en Supabase para tablas `pedidos` y `order_status_history`.

## 5. Campañas por email

La UI prepara destinatarios en `campaign_recipients`.  
Para envío real de correos, conectar una Edge Function o servicio (Resend, SendGrid) en producción.

## 6. Recuperar contraseña

Disponible con Supabase configurado. El enlace redirige a `/cuenta/perfil`.
