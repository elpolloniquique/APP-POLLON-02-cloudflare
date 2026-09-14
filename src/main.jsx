import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import { ensurePwaInstallListeners } from './utils/pwaInstallBridge';
import './index.css';
import App from './App.jsx';

ensurePwaInstallListeners();

const isNativeCapacitor = (() => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
})();

const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
const isViteDev = Boolean(import.meta.hot) || import.meta.env.MODE === 'development';

function unregisterServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistrations?.()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .catch(() => {});
}

// En localhost un SW viejo (de un preview/build) intercepta /src/*.jsx y deja la página en blanco.
if (isLocalHost || isViteDev) {
  unregisterServiceWorkers();
}

// El SW de la PWA rompe/cuelga el WebView Capacitor (permisos, caché vieja, ready infinito).
// Solo en build real publicado; nunca en `npm run dev`.
if (import.meta.env.PROD && !isViteDev && !isNativeCapacitor && !isLocalHost) {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 60 * 1000);
    },
    onOfflineReady() {
      /* PWA lista */
    },
  });
}

if (isNativeCapacitor) {
  // No ocultar splash aquí: esperar a que DriverRoute pinte UI estable.
  // Si se oculta al cargar el bundle, el WebView blanco se ve al reabrir la APK.
  unregisterServiceWorkers();
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('No se encontró #root');
}

try {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (err) {
  console.error('[El Pollón] Error al iniciar la app:', err);
  rootEl.innerHTML = '<p style="padding:1.25rem;font-family:Inter,sans-serif;color:#111">No se pudo iniciar la app en local. Abre la consola del navegador (F12) y recarga con Ctrl+Shift+R.</p>';
}
