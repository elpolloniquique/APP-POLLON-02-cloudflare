import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { MoreHorizontal, Share, Smartphone, X } from 'lucide-react';
import {
  dismissInstallPrompt,
  isAndroidChrome,
  isDesktopInstallableBrowser,
  isIosSafari,
  isMobileBrowser,
  isPwaAlreadyInstalled,
  isStandaloneDisplayMode,
  wasInstallPromptDismissed,
} from '../../utils/pwa';
import {
  ensurePwaInstallListeners,
  promptPwaInstall,
  subscribeDeferredInstallPrompt,
} from '../../utils/pwaInstallBridge';

const LOGO_SRC = '/img/logo pollon.png';

/**
 * Aviso “Instalar app” en el sitio (Chrome Android / iOS / escritorio).
 * - Si YA está instalada (pollito) → no se muestra.
 * - Si NO está instalada → mensaje + botón Instalar.
 * No se muestra dentro de la APK nativa, ni en /admin, ni en modo standalone.
 */
export function InstallAppPrompt() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [mode, setMode] = useState('native');
  const [installing, setInstalling] = useState(false);
  const [hint, setHint] = useState('');

  const isNative = (() => {
    try { return Capacitor.isNativePlatform(); } catch { return false; }
  })();
  const isAdmin = pathname.startsWith('/admin');

  useEffect(() => {
    ensurePwaInstallListeners();
  }, []);

  useEffect(() => {
    if (isNative || isAdmin || isStandaloneDisplayMode() || wasInstallPromptDismissed()) {
      setVisible(false);
      return undefined;
    }

    let cancelled = false;

    const hideIfInstalled = async () => {
      const installed = await isPwaAlreadyInstalled();
      if (cancelled) return installed;
      if (installed) {
        setVisible(false);
        return true;
      }
      return false;
    };

    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    if (isIosSafari()) {
      setMode('ios');
      const timer = window.setTimeout(async () => {
        if (cancelled) return;
        if (!(await hideIfInstalled())) setVisible(true);
      }, 1600);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
        window.removeEventListener('appinstalled', onInstalled);
      };
    }

    const unsub = subscribeDeferredInstallPrompt(async (p) => {
      if (cancelled) return;
      if (await hideIfInstalled()) return;
      if (p) {
        setDeferredPrompt(p);
        setMode('native');
        setVisible(true);
      }
    });

    // Fallback: Chrome a veces no dispara beforeinstallprompt a tiempo.
    // Si la PWA no está instalada, igual mostramos el aviso con botón.
    const fallback = window.setTimeout(async () => {
      if (cancelled) return;
      if (await hideIfInstalled()) return;
      if (isStandaloneDisplayMode() || wasInstallPromptDismissed()) return;
      if (isAndroidChrome() || isMobileBrowser() || isDesktopInstallableBrowser()) {
        setMode(isIosSafari() ? 'ios' : 'native');
        setVisible(true);
      }
    }, 1800);

    return () => {
      cancelled = true;
      unsub();
      window.clearTimeout(fallback);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [isAdmin, isNative, pathname]);

  const handleDismiss = useCallback(() => {
    dismissInstallPrompt();
    setVisible(false);
    setDeferredPrompt(null);
  }, []);

  const handleInstall = useCallback(async () => {
    if (mode === 'ios') {
      handleDismiss();
      return;
    }
    setInstalling(true);
    setHint('');
    try {
      const r = await promptPwaInstall();
      if (r?.outcome === 'accepted') {
        setVisible(false);
        return;
      }
      if (!r?.ok) {
        setHint('Si no aparece el diálogo: menú del navegador (⋮) → Instalar aplicación.');
      }
    } catch {
      setHint('Menú del navegador (⋮) → Instalar aplicación.');
    } finally {
      setInstalling(false);
    }
  }, [mode, handleDismiss]);

  if (!visible || isNative || isAdmin || isStandaloneDisplayMode()) return null;

  const viaLabel = isIosSafari()
    ? 'en Safari'
    : isAndroidChrome()
      ? 'en Chrome'
      : isDesktopInstallableBrowser()
        ? 'en tu navegador'
        : 'en tu dispositivo';

  const bodyText = mode === 'ios'
    ? 'Toca Compartir y luego Agregar a pantalla de inicio para instalar la app.'
    : 'Instala la app gratuita: pide más rápido y recibe avisos en el ícono del pollito.';

  return (
    <div className="install-prompt" role="dialog" aria-labelledby="install-prompt-title" aria-live="polite">
      <div className="install-prompt__card">
        <header className="install-prompt__header">
          <div className="install-prompt__site">
            <span className="install-prompt__site-logo" aria-hidden>
              <img src={LOGO_SRC} alt="" width={16} height={16} />
            </span>
            <span className="install-prompt__site-host">www.el-pollon.cl</span>
          </div>
          <div className="install-prompt__header-actions">
            <span className="install-prompt__more" aria-hidden>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </span>
            <button
              type="button"
              className="install-prompt__close"
              onClick={handleDismiss}
              aria-label="Cerrar aviso de instalación"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        <div className="install-prompt__body">
          <span className="install-prompt__app-icon" aria-hidden>
            <img src={LOGO_SRC} alt="" width={48} height={48} />
          </span>
          <div className="install-prompt__copy">
            <h2 id="install-prompt-title" className="install-prompt__title">
              El Pollón · Instalar app
            </h2>
            <p className="install-prompt__text">{bodyText}</p>
            {mode === 'ios' && (
              <div className="install-prompt__ios-steps">
                <span className="install-prompt__ios-step">
                  <Share className="h-3 w-3" aria-hidden />
                  Compartir
                </span>
                <span className="install-prompt__ios-arrow" aria-hidden>→</span>
                <span className="install-prompt__ios-step">
                  <Smartphone className="h-3 w-3" aria-hidden />
                  Agregar a inicio
                </span>
              </div>
            )}
            {hint ? <p className="install-prompt__hint">{hint}</p> : null}
            <p className="install-prompt__via">{viaLabel}</p>
          </div>
        </div>

        <div className="install-prompt__actions">
          {mode === 'native' ? (
            <button
              type="button"
              className="install-prompt__btn"
              onClick={handleInstall}
              disabled={installing}
            >
              {installing ? 'Instalando…' : 'Instalar'}
            </button>
          ) : (
            <button type="button" className="install-prompt__btn" onClick={handleDismiss}>
              Entendido
            </button>
          )}
          <button type="button" className="install-prompt__btn" onClick={handleDismiss}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
