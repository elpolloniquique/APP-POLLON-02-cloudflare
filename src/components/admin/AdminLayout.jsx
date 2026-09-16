import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStaffBranch } from '../../hooks/useStaffBranch';
import { ADMIN_NAV } from '../../utils/constants';
import {
  LogOut, Menu, X,
  LayoutDashboard, BookOpen, ShoppingBag, ChefHat, Users, Megaphone,
  Building2, Banknote, Package, BarChart3, Settings, Bike, SlidersHorizontal,
  DollarSign, Send, MapPin, FileBarChart,
} from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import '../../styles/admin-shell.css';
import '../../styles/admin-theme.css';

const ICON_MAP = {
  LayoutDashboard, BookOpen, ShoppingBag, ChefHat, Users, Megaphone,
  Building2, Banknote, Package, BarChart3, Settings, Bike, SlidersHorizontal,
  DollarSign, Send, MapPin, FileBarChart,
};

/** < 1024px = drawer (móvil / POS <~10"); ≥1024 = sidebar fijo */
const DRAWER_MQ = '(max-width: 1023px)';

function NavIcon({ name, className }) {
  const Comp = ICON_MAP[name];
  if (!Comp) return null;
  return <Comp className={className} strokeWidth={2.2} />;
}

function useIsDrawerMode() {
  const [isDrawer, setIsDrawer] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia(DRAWER_MQ).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(DRAWER_MQ);
    const onChange = () => setIsDrawer(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    mq.addListener?.(onChange);
    return () => {
      mq.removeEventListener?.('change', onChange);
      mq.removeListener?.(onChange);
    };
  }, []);

  return isDrawer;
}

export function AdminLayout() {
  const { profile, signOut, can, role } = useAuth();
  const { branchName, isBranchScoped, branchId } = useStaffBranch();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const isDrawer = useIsDrawerMode();

  const nav = useMemo(() => ADMIN_NAV.filter((n) => can(n.perm)), [can, role]);

  const currentPageLabel = useMemo(() => {
    const match = nav.find((item) =>
      item.path === '/admin'
        ? location.pathname === '/admin'
        : location.pathname.startsWith(item.path),
    );
    return match?.label || 'Administración';
  }, [nav, location.pathname]);

  // Cerrar drawer al navegar
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Al pasar a sidebar fijo, cerrar overlay
  useEffect(() => {
    if (!isDrawer) setOpen(false);
  }, [isDrawer]);

  // Scroll lock + avisar mapas (invalidateSize)
  useEffect(() => {
    const sidebarVisible = !isDrawer || open;
    if (isDrawer) {
      document.body.style.overflow = open ? 'hidden' : '';
    } else {
      document.body.style.overflow = '';
    }
    window.dispatchEvent(new CustomEvent('ep-admin-drawer', { detail: { open: sidebarVisible } }));
    return () => { document.body.style.overflow = ''; };
  }, [open, isDrawer]);

  const roleLabels = {
    super_admin: 'Super Admin',
    admin_sucursal: 'Admin sucursal',
    cajera: 'Cajera',
    cajero: 'Cajero',
    despachador: 'Despachador',
    cocina: 'Cocina',
    delivery: 'Repartidor',
  };
  const roleLabel = roleLabels[role] || role;

  const handleLogout = useCallback(async () => {
    setOpen(false);
    await signOut();
    navigate('/admin/login');
  }, [signOut, navigate]);

  const mainNav = useMemo(() => nav.filter((n) => n.group !== 'delivery'), [nav]);
  const deliveryNav = useMemo(() => nav.filter((n) => n.group === 'delivery'), [nav]);

  return (
    <div className="admin-shell">
      <aside
        className={`admin-shell__sidebar ${open ? 'is-open' : ''}`}
        aria-hidden={isDrawer ? !open : false}
      >
        <div className="admin-shell__brand">
          <div className="admin-shell__brand-main">
            <img src="/img/logo pollon.png" alt="" className="admin-shell__logo" />
            <div className="admin-shell__brand-text">
              <p className="admin-shell__brand-name">EL POLLÓN</p>
              <p className="admin-shell__brand-role">{roleLabel}</p>
            </div>
          </div>
          {isDrawer && (
            <button
              type="button"
              className="admin-shell__close"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className="admin-shell__nav" aria-label="Menú administración">
          <div className="admin-shell__group">
            {mainNav.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path === '/admin'}
                data-tip={item.label}
                title={item.label}
                className={({ isActive }) =>
                  `admin-shell__link ${isActive ? 'is-active' : ''}`
                }
              >
                <NavIcon name={item.icon} className="admin-shell__link-icon" />
                <span className="admin-shell__link-label">{item.label}</span>
              </NavLink>
            ))}
          </div>

          {deliveryNav.length > 0 && (
            <>
              <div className="admin-shell__divider" />
              <p className="admin-shell__group-label">Delivery / GPS</p>
              <div className="admin-shell__group">
                {deliveryNav.map((item) => (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    data-tip={item.label}
                    title={item.label}
                    className={({ isActive }) =>
                      `admin-shell__link ${isActive ? 'is-active' : ''}`
                    }
                  >
                    <NavIcon name={item.icon} className="admin-shell__link-icon" />
                    <span className="admin-shell__link-label">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </>
          )}
        </nav>

        <div className="admin-shell__footer">
          <p className="admin-shell__email">{profile?.email}</p>
          {isBranchScoped && branchId && (
            <p className="admin-shell__local">Local: {branchName}</p>
          )}
          <button
            type="button"
            className="admin-shell__logout"
            onClick={handleLogout}
            data-tip="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut className="h-5 w-5 shrink-0" strokeWidth={2.2} />
            <span className="admin-shell__logout-label">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div
        className={`admin-shell__backdrop ${open ? 'is-open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      <div className="admin-shell__body">
        <header className="admin-shell__topbar">
          {isDrawer && (
            <button
              type="button"
              className="admin-shell__burger"
              onClick={() => setOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" strokeWidth={2} />
            </button>
          )}
          <div className="admin-shell__topbar-copy">
            <p className="admin-shell__eyebrow">Administración</p>
            <h1 className="admin-shell__page-title">{currentPageLabel}</h1>
          </div>
          {isBranchScoped && branchName && (
            <span className="admin-shell__branch-chip">{branchName}</span>
          )}
        </header>

        <main className="admin-shell__main">
          {isBranchScoped && !branchId && (
            <div className="admin-shell__alert">
              Tu cuenta no tiene sucursal asignada. Solo verás datos vacíos hasta que el super admin configure tu <code>branch_id</code>.
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
