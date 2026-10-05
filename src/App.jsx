import { BrowserRouter, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { BranchProvider } from './context/BranchContext';
import { BranchMenuProvider } from './context/BranchMenuContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { SeoManager } from './components/seo/SeoManager';
import { SiteAlertOverlay } from './components/layout/SiteAlertOverlay';
import { AppRoutes } from './routes/AppRoutes';
import { ensurePwaInstallListeners } from './utils/pwaInstallBridge';
import { DriverWebPushGuardian } from './components/delivery/DriverWebPushGuardian';
import { isNativeDriverApp } from './services/backgroundGpsService';

function PwaInstallBootstrap() {
  useEffect(() => {
    ensurePwaInstallListeners();
  }, []);
  return null;
}

/**
 * App nativa = solo modo repartidor.
 * Importante: NO permitir /admin ni /cuenta (evita bucles Navigate → pantalla blanca).
 */
function NativeDriverEntryRedirect({ children }) {
  const location = useLocation();
  if (!isNativeDriverApp()) return children;

  const path = location.pathname || '/';
  if (path === '/repartidor' || path.startsWith('/repartidor/')) return children;

  return <Navigate to="/repartidor" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <BranchProvider>
        <AuthProvider>
          <CartProvider>
            <BranchMenuProvider>
              <PwaInstallBootstrap />
              <DriverWebPushGuardian />
              <SeoManager />
              <NativeDriverEntryRedirect>
                <AppRoutes />
              </NativeDriverEntryRedirect>
              <SiteAlertOverlay />
            </BranchMenuProvider>
          </CartProvider>
        </AuthProvider>
      </BranchProvider>
    </BrowserRouter>
  );
}
