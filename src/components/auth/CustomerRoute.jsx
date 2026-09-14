import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader } from '../ui/Loader';
import { isDriverRole, normalizeRole } from '../../services/authService';

export function CustomerRoute({ children }) {
  const { session, loading, isCustomer, isStaff, profile, role } = useAuth();

  if (loading) return <Loader text="Cargando cuenta…" />;
  if (!session) return <Navigate to="/" replace state={{ openAuth: true }} />;

  const r = normalizeRole(profile?.rol || profile?.role || role);
  if (isDriverRole(r)) return <Navigate to="/repartidor" replace />;
  if (isStaff && !isCustomer) return <Navigate to="/admin" replace />;
  return children;
}
