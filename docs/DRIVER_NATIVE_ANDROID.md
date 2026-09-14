# App nativa repartidor — El Pollón (Android Capacitor)

## Qué es
APK Android (`cl.elpollon.app`) para repartidores con:
- Gate obligatorio (no opera en PWA/Chrome)
- GPS background (Capgo Foreground Service) con pantalla apagada
- Push FCM nativo (cuando Firebase está configurado) + Web Push fallback
- Onboarding: notificaciones + ubicación “Permitir todo el tiempo”

## Descarga
URL pública (tras deploy / hosting del APK):

`https://www.el-pollon.cl/DESCARGAR-APK/El-Pollon-repartidor.apk`

Archivo local tras build:

`public/DESCARGAR-APK/El-Pollon-repartidor.apk`

Versión actual: **1.2.0** (versionCode **3**)

> El APK debug incluye el `dist` web completo (~180–200 MB). GitHub rechaza archivos >100 MB:
> para la URL pública súbelo a **Supabase Storage / CDN / Vercel Blob**, o fuerza el archivo en el hosting.
> No subas keystores ni `google-services.json` con secretos al repo.

## SQL a ejecutar en Supabase (orden)
1. `supabase/fix-driver-native-fcm.sql`
2. `supabase/fix-require-gps-offer-gate.sql`
3. (si faltan) `fix-dispatch-config-v2.sql`, `fix-dispatch-voice-alerts.sql`, `fix-driver-commission-percent.sql`

## Build APK (desarrollo / sideload)
```bash
cd el-pollon
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```
Salida típica:
`android/app/build/outputs/apk/debug/app-debug.apk`

Copiar a web:
```bash
mkdir public\DESCARGAR-APK
copy android\app\build\outputs\apk\debug\app-debug.apk public\DESCARGAR-APK\El-Pollon-repartidor.apk
```

Release firmado (producción):
```bash
.\gradlew.bat assembleRelease
```
Requiere keystore. No subir keystores al git.

## Firebase / FCM (push con app killada) — HTTP v1 (recomendado)

Firebase ya no muestra **Server key** (Legacy desactivado). Usa **cuenta de servicio**:

1. Firebase → ⚙️ Project settings → pestaña **Service accounts** / **Cuentas de servicio**
2. **Generate new private key** / **Generar nueva clave privada** → Download JSON
3. En Vercel → Environment Variables:
   - Key: `FIREBASE_SERVICE_ACCOUNT_JSON`
   - Value: **todo el contenido del JSON** (una sola línea / pegado completo)
   - Production → Save → Redeploy
4. `google-services.json` ya debe estar en `android/app/`
5. Rebuild APK e instalar

Opcional (legado): `FCM_SERVER_KEY` si algún día habilitas Legacy.

> Plan Hobby: el cron de re-oferta en Vercel solo puede ser **1×/día**.
> El reintento en vivo lo hacen **Pedidos / Despacho** en el admin (cada ~20s).
> Para cron cada 1–3 min hace falta plan Pro o un scheduler externo.

## Checklist dispositivo real
1. En Chrome `/repartidor` → bloquea y ofrece APK
2. Instalar APK → login repartidor
3. Activar notificaciones + ubicación Siempre
4. Disponible → pin visible en Admin → En vivo
5. Pantalla apagada 5 min → pin sigue moviéndose
6. Oferta → push / badge
7. 2 pedidos → GPS sigue hasta el último entregado

## OEM (Xiaomi / Huawei / Samsung)
Desactivar optimización de batería para El Pollón, o el SO puede matar el FGS.
