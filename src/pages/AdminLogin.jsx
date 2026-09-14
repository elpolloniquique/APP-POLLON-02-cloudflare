import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { LEGACY_ADMIN_PASSWORD } from '../services/authService';
import { isStaffRole, normalizeRole, getHomePathForRole } from '../services/authService';

const LOGIN_TIMEOUT_MS = 25000;

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signOut, session, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || !session || !profile) return;
    const role = normalizeRole(profile.rol || profile.role);
    if (isStaffRole(role) || session.legacy) {
      navigate(getHomePathForRole(role), { replace: true });
    }
  }, [authLoading, session, profile, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Solo cerrar sesión de cliente; no bloquear re-login de staff
      if (session && profile && !isStaffRole(normalizeRole(profile.rol || profile.role))) {
        await withTimeout(signOut(), 8000, 'No se pudo cerrar la sesión anterior').catch(() => {});
      }
      const { profile: p, session: s } = await withTimeout(
        signIn(email.trim(), password),
        LOGIN_TIMEOUT_MS,
        'La conexión tardó demasiado. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Vercel, y que el proyecto Supabase no esté pausado.'
      );
      const role = normalizeRole(p?.rol || p?.role);
      if (!isStaffRole(role) && !s?.legacy) {
        await signOut().catch(() => {});
        setError(
          'Esta cuenta no tiene rol de personal. En Supabase ejecuta fix-perfil-admin.sql o crear-admins-sucursal.sql y verifica la tabla profiles.'
        );
        return;
      }
      navigate(getHomePathForRole(role), { replace: true });
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-pollon-black p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <img src="/img/logo pollon.png" alt="" className="mx-auto h-16 w-16" />
        <h1 className="mt-4 text-center font-display text-3xl">Acceso personal</h1>
        <p className="text-center text-sm text-gray-500">Panel administrativo — solo personal autorizado</p>

        {!isSupabaseConfigured() && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-semibold">Modo local (sin Supabase)</p>
            <p className="mt-1">Contraseña: <strong>{LEGACY_ADMIN_PASSWORD}</strong></p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input type="email" required placeholder="Email corporativo" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border px-4 py-3" />
          <input type="password" required placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border px-4 py-3" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Entrando…' : 'Iniciar sesión'}</Button>
        </form>
        <a href="/" className="mt-4 block text-center text-sm text-gray-500 hover:text-pollon-red">← Volver a la tienda (clientes)</a>
      </div>
    </div>
  );
}
