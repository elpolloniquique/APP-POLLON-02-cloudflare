import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { User, Package, MapPin, LogOut, ChevronLeft } from 'lucide-react';
import { SiteHeader } from '../../components/layout/SiteHeader';
import { SiteFooter } from '../../components/layout/SiteFooter';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';

const NAV = [
  { to: '/cuenta', label: 'Mi perfil', icon: User, end: true },
  { to: '/cuenta/pedidos', label: 'Mis pedidos', icon: Package },
  { to: '/cuenta/direcciones', label: 'Direcciones', icon: MapPin },
];

export function AccountLayout() {
  const { profile, signOut } = useAuth();
  const { setIsOpen } = useCart();
  const navigate = useNavigate();

  const logout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen flex-col bg-pollon-cream">
      <SiteHeader onOpenCart={() => setIsOpen(true)} variant="compact" />
      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 py-8 md:flex-row">
        <aside className="w-full shrink-0 md:w-64">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pollon-red text-xl font-bold text-white">
              {(profile?.fullName || profile?.nombre || '?')[0]}
            </div>
            <p className="mt-3 font-bold text-pollon-black">{profile?.fullName || profile?.nombre}</p>
            <p className="text-xs text-gray-500">{profile?.email}</p>
            <nav className="mt-6 space-y-1">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive ? 'bg-pollon-red text-white' : 'text-gray-600 hover:bg-gray-50'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <button type="button" onClick={logout} className="mt-4 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-red-600 hover:bg-red-50">
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
            <NavLink to="/" className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-pollon-red">
              <ChevronLeft className="h-3 w-3" /> Volver a la tienda
            </NavLink>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
