import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Home } from '../pages/Home';
import { Store } from '../pages/Store';
import { BranchSelector } from '../pages/BranchSelector';
import { Checkout } from '../pages/Checkout';
import { OrderSuccess } from '../pages/OrderSuccess';
import { AdminLogin } from '../pages/AdminLogin';
import { AdminLayout } from '../components/admin/AdminLayout';
import { ProtectedRoute, AdminHome, AdminPermGate } from '../components/admin/ProtectedRoute';
import { CustomerRoute } from '../components/auth/CustomerRoute';
import { DriverRoute } from '../components/delivery/DriverRoute';
import { DriverLayout } from '../components/delivery/DriverLayout';
import { DriverErrorBoundary } from '../components/delivery/DriverErrorBoundary';
import { AccountLayout } from '../pages/account/AccountLayout';
import { TermsConditions } from '../pages/TermsConditions';
import { ComplaintsBook } from '../pages/ComplaintsBook';
import { Loader } from '../components/ui/Loader';

const AdminOrders = lazy(() => import('../pages/admin/AdminOrders').then((m) => ({ default: m.AdminOrders })));
const AdminMenu = lazy(() => import('../pages/admin/AdminMenu').then((m) => ({ default: m.AdminMenu })));
const AdminBranches = lazy(() => import('../pages/admin/AdminBranches').then((m) => ({ default: m.AdminBranches })));
const AdminCash = lazy(() => import('../pages/admin/AdminCash').then((m) => ({ default: m.AdminCash })));
const AdminInventory = lazy(() => import('../pages/admin/AdminInventory').then((m) => ({ default: m.AdminInventory })));
const AdminReports = lazy(() => import('../pages/admin/AdminReports').then((m) => ({ default: m.AdminReports })));
const AdminUsers = lazy(() => import('../pages/admin/AdminUsers').then((m) => ({ default: m.AdminUsers })));
const AdminConfig = lazy(() => import('../pages/admin/AdminConfig').then((m) => ({ default: m.AdminConfig })));
const AdminCustomers = lazy(() => import('../pages/admin/AdminCustomers').then((m) => ({ default: m.AdminCustomers })));
const AdminCampaigns = lazy(() => import('../pages/admin/AdminCampaigns').then((m) => ({ default: m.AdminCampaigns })));
const KitchenScreen = lazy(() => import('../pages/admin/KitchenScreen').then((m) => ({ default: m.KitchenScreen })));
const AdminDrivers = lazy(() => import('../pages/admin/AdminDrivers').then((m) => ({ default: m.AdminDrivers })));
const AdminDriverConfig = lazy(() => import('../pages/admin/AdminDriverConfig').then((m) => ({ default: m.AdminDriverConfig })));
const AdminDriverRates = lazy(() => import('../pages/admin/AdminDriverRates').then((m) => ({ default: m.AdminDriverRates })));
const AdminDispatch = lazy(() => import('../pages/admin/AdminDispatch').then((m) => ({ default: m.AdminDispatch })));
const AdminLiveMap = lazy(() => import('../pages/admin/AdminLiveMap').then((m) => ({ default: m.AdminLiveMap })));
const AdminDriverReports = lazy(() => import('../pages/admin/AdminDriverReports').then((m) => ({ default: m.AdminDriverReports })));

const DriverHome = lazy(() => import('../pages/driver/DriverHome').then((m) => ({ default: m.DriverHome })));
const DriverMapPage = lazy(() => import('../pages/driver/DriverMapPage').then((m) => ({ default: m.DriverMapPage })));
const DriverHistory = lazy(() => import('../pages/driver/DriverHistory').then((m) => ({ default: m.DriverHistory })));
const DriverEarnings = lazy(() => import('../pages/driver/DriverEarnings').then((m) => ({ default: m.DriverEarnings })));
const DriverProfile = lazy(() => import('../pages/driver/DriverProfile').then((m) => ({ default: m.DriverProfile })));

const AccountProfile = lazy(() => import('../pages/account/AccountProfile').then((m) => ({ default: m.AccountProfile })));
const AccountOrders = lazy(() => import('../pages/account/AccountOrders').then((m) => ({ default: m.AccountOrders })));
const AccountAddresses = lazy(() => import('../pages/account/AccountAddresses').then((m) => ({ default: m.AccountAddresses })));
const OrderTracking = lazy(() => import('../pages/account/OrderTracking').then((m) => ({ default: m.OrderTracking })));

function LazyPage({ children }) {
  return (
    <Suspense fallback={<Loader text="Cargando módulo…" />}>
      {children}
    </Suspense>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/tienda" element={<Store />} />
      <Route path="/sucursal" element={<BranchSelector />} />
      <Route path="/terminos" element={<TermsConditions />} />
      <Route path="/libro-reclamaciones" element={<ComplaintsBook />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/pedido/:id" element={<OrderSuccess />} />

      <Route
        path="/cuenta"
        element={(
          <CustomerRoute>
            <AccountLayout />
          </CustomerRoute>
        )}
      >
        <Route index element={<LazyPage><AccountProfile /></LazyPage>} />
        <Route path="pedidos" element={<LazyPage><AccountOrders /></LazyPage>} />
        <Route path="direcciones" element={<LazyPage><AccountAddresses /></LazyPage>} />
        <Route path="seguimiento/:orderId" element={<LazyPage><OrderTracking /></LazyPage>} />
      </Route>

      <Route
        path="/repartidor"
        element={(
          <DriverErrorBoundary>
            <DriverRoute>
              <DriverLayout />
            </DriverRoute>
          </DriverErrorBoundary>
        )}
      >
        <Route index element={<LazyPage><DriverHome /></LazyPage>} />
        <Route path="mapa" element={<LazyPage><DriverMapPage /></LazyPage>} />
        <Route path="historial" element={<LazyPage><DriverHistory /></LazyPage>} />
        <Route path="ingresos" element={<LazyPage><DriverEarnings /></LazyPage>} />
        <Route path="perfil" element={<LazyPage><DriverProfile /></LazyPage>} />
      </Route>

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={(
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        )}
      >
        <Route index element={<AdminHome />} />
        <Route path="pedidos" element={<LazyPage><AdminPermGate perm="orders"><AdminOrders /></AdminPermGate></LazyPage>} />
        <Route path="cocina" element={<LazyPage><AdminPermGate perm="kitchen"><KitchenScreen /></AdminPermGate></LazyPage>} />
        <Route path="menu" element={<LazyPage><AdminPermGate perm="menu"><AdminMenu /></AdminPermGate></LazyPage>} />
        <Route path="clientes" element={<LazyPage><AdminPermGate perm="customers"><AdminCustomers /></AdminPermGate></LazyPage>} />
        <Route path="campanas" element={<LazyPage><AdminPermGate perm="campaigns"><AdminCampaigns /></AdminPermGate></LazyPage>} />
        <Route path="sucursales" element={<LazyPage><AdminPermGate perm="branches"><AdminBranches /></AdminPermGate></LazyPage>} />
        <Route path="caja" element={<LazyPage><AdminPermGate perm="cash"><AdminCash /></AdminPermGate></LazyPage>} />
        <Route path="stock" element={<LazyPage><AdminPermGate perm="inventory"><AdminInventory /></AdminPermGate></LazyPage>} />
        <Route path="reportes" element={<LazyPage><AdminPermGate perm="reports"><AdminReports /></AdminPermGate></LazyPage>} />
        <Route path="usuarios" element={<LazyPage><AdminPermGate perm="users"><AdminUsers /></AdminPermGate></LazyPage>} />
        <Route path="whatsapp/*" element={<Navigate to="/admin/pedidos" replace />} />
        <Route path="config" element={<LazyPage><AdminPermGate perm="settings"><AdminConfig /></AdminPermGate></LazyPage>} />

        <Route path="repartidores" element={<LazyPage><AdminPermGate perm="drivers"><AdminDrivers /></AdminPermGate></LazyPage>} />
        <Route path="repartidores/config" element={<LazyPage><AdminPermGate perm="driver_config"><AdminDriverConfig /></AdminPermGate></LazyPage>} />
        <Route path="repartidores/tarifas" element={<LazyPage><AdminPermGate perm="driver_rates"><AdminDriverRates /></AdminPermGate></LazyPage>} />
        <Route path="repartidores/despacho" element={<LazyPage><AdminPermGate perm="dispatch"><AdminDispatch /></AdminPermGate></LazyPage>} />
        <Route path="repartidores/en-vivo" element={<LazyPage><AdminPermGate perm="live_map"><AdminLiveMap /></AdminPermGate></LazyPage>} />
        <Route path="repartidores/reportes" element={<LazyPage><AdminPermGate perm="driver_reports"><AdminDriverReports /></AdminPermGate></LazyPage>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
