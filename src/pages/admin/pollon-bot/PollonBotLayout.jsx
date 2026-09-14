import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bot, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { normalizeRole, getProfileBranchId } from '../../../services/authService';
import { adminListAllBranches } from '../../../services/branchService';
import { isBotBackendReady, listUnanswered, listConversations } from '../../../services/botAdminService';
import { PollonBotContext } from './PollonBotContext';
import '../../../styles/admin-pollon-bot.css';

const TABS = [
  { to: 'dashboard', label: 'Dashboard' },
  { to: 'inbox', label: 'Inbox', badge: 'inbox' },
  { to: 'memoria', label: 'Memoria' },
  { to: 'sin-respuesta', label: 'Sin respuesta', badge: 'unanswered' },
  { to: 'documentos', label: 'Documentos' },
  { to: 'sinonimos', label: 'Sinónimos' },
  { to: 'intenciones', label: 'Intenciones' },
  { to: 'config', label: 'Config' },
  { to: 'eventos', label: 'Eventos' },
  { to: 'logs', label: 'Logs' },
  { to: 'probar', label: 'Probar' },
  { to: 'conexion', label: 'Conexión' },
];

export function PollonBotLayout() {
  const { profile, can } = useAuth();
  const location = useLocation();
  const role = normalizeRole(profile?.role || profile?.rol);
  const isSuper = role === 'super_admin';
  const canWa = isSuper || can('whatsapp_ai');
  const staffBranchId = getProfileBranchId(profile);
  const isLegacy = location.pathname.endsWith('/conexion');

  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState(isSuper ? '' : (staffBranchId || ''));
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingUnanswered, setPendingUnanswered] = useState(0);
  const [humanOpen, setHumanOpen] = useState(0);

  const effectiveBranch = isSuper ? (branchFilter || null) : (staffBranchId || null);

  useEffect(() => {
    adminListAllBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (!isBotBackendReady()) return;
    listUnanswered({ status: 'pending', branchId: effectiveBranch })
      .then((rows) => setPendingUnanswered(rows.length))
      .catch(() => {});
    listConversations({ branchId: effectiveBranch, mode: 'human_required' })
      .then((rows) => setHumanOpen(rows.length))
      .catch(() => {});
  }, [effectiveBranch, location.pathname]);

  const flash = useCallback((msg) => {
    setOk(msg);
    setError('');
    setTimeout(() => setOk(''), 2800);
  }, []);

  const value = useMemo(() => ({
    profile,
    isSuper,
    canWa,
    staffBranchId,
    branches,
    branchFilter,
    setBranchFilter,
    effectiveBranch,
    error,
    ok,
    setError,
    setOk,
    flash,
    loading,
    setLoading,
  }), [profile, isSuper, canWa, staffBranchId, branches, branchFilter, effectiveBranch, error, ok, loading]);

  if (!canWa) {
    return <div className="admin-pollon-bot admin-pollon-bot--denied">Sin permiso para WhatsApp Bot.</div>;
  }

  if (isLegacy) return <Outlet />;

  return (
    <PollonBotContext.Provider value={value}>
      <div className="admin-pollon-bot">
        <header className="apb-header">
          <div>
            <p className="apb-crumb">Admin · WhatsApp Bot</p>
            <h2 className="apb-title"><Bot /> El Pollón Bot</h2>
            <p className="apb-sub">CRM, memoria y config en Supabase. Sin IA. Sin redeploy al entrenar.</p>
          </div>
          <div className="apb-header__actions">
            {isSuper && (
              <select className="apb-select" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
                <option value="">Todas / global</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name || b.nombre}</option>
                ))}
              </select>
            )}
            <button type="button" className="apb-btn apb-btn--ghost" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" /> Actualizar
            </button>
          </div>
        </header>

        <nav className="apb-tabs">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) => `apb-tab${isActive ? ' is-active' : ''}`}
            >
              {t.label}
              {t.badge === 'unanswered' && pendingUnanswered > 0 && (
                <span className="apb-tab__count">{pendingUnanswered}</span>
              )}
              {t.badge === 'inbox' && humanOpen > 0 && (
                <span className="apb-tab__count">{humanOpen}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {error && <p className="apb-error">{error}</p>}
        {ok && <p className="apb-ok">{ok}</p>}

        <div className="apb-outlet">
          <Outlet />
        </div>
      </div>
    </PollonBotContext.Provider>
  );
}
