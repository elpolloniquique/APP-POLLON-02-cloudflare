import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AdminDashboard } from '../../pages/admin/AdminDashboard';
import { Loader } from '../ui/Loader';
import { getDefaultAdminPath, hasPermission, isStaffRole, isDriverRole, isFleetBossRole, normalizeRole } from '../../services/authService';

/** Guard de sesión staff (solo layout /admin). */
export function ProtectedRoute({ children, perm }) {
  const { session, profile, loading, can, role } = useAuth();

  if (loading) return <Loader text="Verificando sesión…" />;
  if (!session) return <Navigate to="/admin/login" replace />;

  const normalizedRole = normalizeRole(profile?.rol || profile?.role || role);

  // Moto pura → app. Jefe de flota en el pollito → panel. En nativo el jefe va a /repartidor.
  if (isDriverRole(normalizedRole) && !isFleetBossRole(normalizedRole)) {
    return <Navigate to="/repartidor" replace />;
  }
  if (isFleetBossRole(normalizedRole) && typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
    return <Navigate to="/repartidor" replace />;
  }

  if (!isStaffRole(normalizedRole) && !session.legacy) {
    // Evita expulsar a /cuenta mientras el perfil staff aún no llegó (caché vacía)
    if (!profile && session?.user) {
      return <Loader text="Cargando perfil…" />;
    }
    return <Navigate to="/cuenta" replace />;
  }

  if (perm && !can(perm)) {
    return <Navigate to={getDefaultAdminPath(normalizedRole)} replace />;
  }

  return children;
}

/**
 * Solo permiso de página. No vuelve a mostrar Loader de sesión
 * (el layout ya pasó por ProtectedRoute).
 */
export function AdminPermGate({ children, perm }) {
  const { can, role, profile, session } = useAuth();
  const normalizedRole = normalizeRole(profile?.rol || profile?.role || role);
  if (perm && !can(perm)) {
    return <Navigate to={getDefaultAdminPath(normalizedRole)} replace />;
  }
  if (!session) return <Navigate to="/admin/login" replace />;
  return children;
}

/** Pantalla inicial /admin — dashboard o redirección según rol. */
export function AdminHome() {
  const { loading, role, profile } = useAuth();

  if (loading) return <Loader text="Cargando panel…" />;

  const normalizedRole = normalizeRole(profile?.rol || profile?.role || role);
  if (isDriverRole(normalizedRole) && !isFleetBossRole(normalizedRole)) {
    return <Navigate to="/repartidor" replace />;
  }
  if (isFleetBossRole(normalizedRole)) {
    return <Navigate to={getDefaultAdminPath(normalizedRole)} replace />;
  }
  if (hasPermission(normalizedRole, 'dashboard')) {
    return <AdminDashboard />;
  }

  return <Navigate to={getDefaultAdminPath(normalizedRole)} replace />;
}
