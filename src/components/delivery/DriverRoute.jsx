import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader } from '../ui/Loader';
import { AuthModal } from '../auth/AuthModal';
import { isDriverRole, normalizeRole } from '../../services/authService';
import { isNativeDriverApp } from '../../services/backgroundGpsService';

function hideNativeSplash() {
  if (!isNativeDriverApp()) return;
  import('@capacitor/splash-screen')
    .then(({ SplashScreen }) => SplashScreen.hide().catch(() => {}))
    .catch(() => {});
}

/** Solo rol delivery / repartidor. No redirigir mientras el perfil aún carga. */
export function DriverRoute({ children }) {
  const { session, profile, loading, role, user, signOut } = useAuth();
  const [waitExpired, setWaitExpired] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const native = isNativeDriverApp();

  useEffect(() => {
    if (profile || loading || !session) {
      setWaitExpired(false);
      return undefined;
    }
    const ms = native ? 20000 : 10000;
    const t = setTimeout(() => setWaitExpired(true), ms);
    return () => clearTimeout(t);
  }, [profile, loading, session, native]);

  // Ocultar splash solo cuando ya hay UI estable (evita WebView blanco).
  useEffect(() => {
    if (!native) return;
    if (loading) return;
    hideNativeSplash();
  }, [native, loading, session, profile]);

  if (loading) return <Loader text="Cargando panel repartidor…" />;

  if (!session) {
    if (native) {
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-black px-4">
          <p className="mb-2 font-display text-2xl text-white">El Pollón</p>
          <p className="mb-6 text-center text-sm text-white/70">App repartidor — inicia sesión para continuar</p>
          <AuthModal open onClose={() => {}} defaultTab="login" />
        </div>
      );
    }
    return <Navigate to="/" replace state={{ openAuth: true }} />;
  }

  const fromProfile = normalizeRole(profile?.rol || profile?.role || role);
  const fromMeta = normalizeRole(
    user?.user_metadata?.role
    || session?.user?.user_metadata?.role
  );

  if (!profile && !isDriverRole(fromMeta)) {
    if (waitExpired) {
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
          <p className="text-sm text-white/80">No pudimos verificar tu cuenta de repartidor.</p>
          <button
            type="button"
            className="rounded-lg bg-[#c00000] px-4 py-2 text-sm font-bold"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>
          {native && (
            <button
              type="button"
              className="rounded-lg border border-white/30 px-4 py-2 text-sm font-bold text-white/90"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true);
                try { await signOut(); } finally { setSigningOut(false); }
              }}
            >
              {signingOut ? 'Saliendo…' : 'Cerrar sesión'}
            </button>
          )}
        </div>
      );
    }
    return <Loader text="Verificando cuenta repartidor…" />;
  }

  if (isDriverRole(fromProfile) || isDriverRole(fromMeta)) {
    return children;
  }

  // Nativo: nunca Navigate a /admin o /cuenta (bucle → pantalla blanca).
  if (native) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
        <p className="font-display text-2xl text-white">El Pollón</p>
        <p className="text-sm text-white/80">
          Esta app es solo para repartidores. Tu cuenta no tiene rol de delivery.
        </p>
        <button
          type="button"
          className="rounded-lg bg-[#c00000] px-4 py-2 text-sm font-bold"
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true);
            try { await signOut(); } finally { setSigningOut(false); }
          }}
        >
          {signingOut ? 'Saliendo…' : 'Cerrar sesión e intentar de nuevo'}
        </button>
      </div>
    );
  }

  return <Navigate to="/admin" replace />;
}
