import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import { getHomePathForRole, isDriverRole, normalizeRole } from '../../services/authService';

const TABS = [
  { id: 'login', label: 'Iniciar sesión' },
  { id: 'register', label: 'Registrarse' },
];

function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function AuthModal({ open, onClose, defaultTab = 'login' }) {
  const { signIn, signUp, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const native = isNativeApp();
  const [tab, setTab] = useState(defaultTab);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [forgotMode, setForgotMode] = useState(false);

  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    acceptsEmail: false,
    acceptsWhatsapp: false,
  });

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  if (!open) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { profile: p } = await signIn(form.email, form.password);
      onClose();
      const role = normalizeRole(p?.rol || p?.role);
      if (native) {
        // App nativa: siempre al panel repartidor (el gate valida el rol).
        navigate('/repartidor', { replace: true });
        return;
      }
      if (isDriverRole(role) || ['super_admin', 'admin_sucursal', 'administrador', 'cajera', 'cajero', 'cocina', 'delivery', 'repartidor'].includes(role)) {
        navigate(getHomePathForRole(role));
      } else {
        navigate('/cuenta');
      }
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      await signUp({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone,
        acceptsEmailPromotions: form.acceptsEmail,
        acceptsWhatsappPromotions: form.acceptsWhatsapp,
      });
      setSuccess('¡Cuenta creada! Revisa tu correo si se requiere confirmación.');
      setTimeout(() => {
        onClose();
        navigate(native ? '/repartidor' : '/cuenta', { replace: true });
      }, 1200);
    } catch (err) {
      setError(err.message || 'No se pudo registrar');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        setError('Recuperación de contraseña disponible solo con Supabase');
        return;
      }
      await requestPasswordReset(form.email);
      setSuccess('Te enviamos un enlace para restablecer tu contraseña.');
      setForgotMode(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={onClose} aria-label="Cerrar" />
      <div className="relative w-full max-w-md animate-in slide-in-from-bottom-4 rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="font-display text-2xl text-pollon-black">Mi cuenta</h2>
            <p className="text-xs text-gray-500">Pedidos, ofertas y seguimiento</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!forgotMode && (
          <div className="flex border-b px-6">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTab(t.id); setError(''); setSuccess(''); }}
                className={`flex-1 border-b-2 py-3 text-sm font-bold transition ${
                  tab === t.id ? 'border-pollon-red text-pollon-red' : 'border-transparent text-gray-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {success && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

          {forgotMode ? (
            <form onSubmit={handleForgot} className="space-y-4">
              <p className="text-sm text-gray-600">Ingresa tu correo y te enviaremos un enlace para recuperar tu contraseña.</p>
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600"><Mail className="h-3.5 w-3.5" /> Correo</span>
                <input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} className="w-full rounded-xl border px-4 py-3 text-sm focus:border-pollon-red focus:outline-none focus:ring-2 focus:ring-pollon-red/20" />
              </label>
              <button type="submit" disabled={loading} className="w-full rounded-xl bg-pollon-red py-3 text-sm font-bold text-white hover:bg-pollon-red-dark disabled:opacity-60">
                {loading ? 'Enviando…' : 'Enviar enlace'}
              </button>
              <button type="button" onClick={() => setForgotMode(false)} className="w-full text-sm text-gray-500 hover:text-pollon-red">← Volver</button>
            </form>
          ) : tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600"><Mail className="h-3.5 w-3.5" /> Correo</span>
                <input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} className="w-full rounded-xl border px-4 py-3 text-sm focus:border-pollon-red focus:outline-none focus:ring-2 focus:ring-pollon-red/20" placeholder="tu@email.com" />
              </label>
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600"><Lock className="h-3.5 w-3.5" /> Contraseña</span>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} required value={form.password} onChange={(e) => update('password', e.target.value)} className="w-full rounded-xl border px-4 py-3 pr-10 text-sm focus:border-pollon-red focus:outline-none focus:ring-2 focus:ring-pollon-red/20" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <button type="button" onClick={() => setForgotMode(true)} className="text-xs font-semibold text-pollon-red hover:underline">¿Olvidaste tu contraseña?</button>
              <button type="submit" disabled={loading} className="w-full rounded-xl bg-pollon-red py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg hover:bg-pollon-red-dark disabled:opacity-60">
                {loading ? 'Entrando…' : 'Iniciar sesión'}
              </button>
              <p className="text-center text-xs text-gray-500">
                ¿Eres personal?{' '}
                {native ? (
                  <span className="font-semibold text-gray-400">Usa el panel web de staff</span>
                ) : (
                  <a href="/admin/login" className="font-semibold text-pollon-red hover:underline">Acceso staff</a>
                )}
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600"><User className="h-3.5 w-3.5" /> Nombre completo</span>
                <input required value={form.fullName} onChange={(e) => update('fullName', e.target.value)} className="w-full rounded-xl border px-4 py-3 text-sm focus:border-pollon-red focus:outline-none focus:ring-2 focus:ring-pollon-red/20" />
              </label>
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600"><Phone className="h-3.5 w-3.5" /> Teléfono</span>
                <input required type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} className="w-full rounded-xl border px-4 py-3 text-sm focus:border-pollon-red focus:outline-none focus:ring-2 focus:ring-pollon-red/20" placeholder="+56 9 …" />
              </label>
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600"><Mail className="h-3.5 w-3.5" /> Correo</span>
                <input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} className="w-full rounded-xl border px-4 py-3 text-sm focus:border-pollon-red focus:outline-none focus:ring-2 focus:ring-pollon-red/20" />
              </label>
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600"><Lock className="h-3.5 w-3.5" /> Contraseña</span>
                <input type="password" required minLength={6} value={form.password} onChange={(e) => update('password', e.target.value)} className="w-full rounded-xl border px-4 py-3 text-sm focus:border-pollon-red focus:outline-none focus:ring-2 focus:ring-pollon-red/20" />
              </label>
              <div className="space-y-2 rounded-xl bg-pollon-cream p-3">
                <p className="text-xs font-semibold text-gray-700">Promociones y novedades</p>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={form.acceptsEmail} onChange={(e) => update('acceptsEmail', e.target.checked)} className="mt-1" />
                  <span>Acepto recibir ofertas y promociones por <strong>correo</strong></span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={form.acceptsWhatsapp} onChange={(e) => update('acceptsWhatsapp', e.target.checked)} className="mt-1" />
                  <span>Acepto recibir novedades por <strong>WhatsApp</strong></span>
                </label>
              </div>
              <button type="submit" disabled={loading} className="w-full rounded-xl bg-pollon-red py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg hover:bg-pollon-red-dark disabled:opacity-60">
                {loading ? 'Creando cuenta…' : 'Crear cuenta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
