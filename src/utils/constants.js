export const BAG_PRICE = 200;
export const WHATSAPP_DEFAULT = import.meta.env.VITE_WHATSAPP_DEFAULT || '56986925310';
export const ORDERS_KEY = 'pollon_orders_v1';
export const BRANCH_KEY = 'pollon_branch_v1';
export const CART_KEY = 'pollon_cart_v2';
export const CUSTOMER_SESSION_KEY = 'pollon_customer_v1';

/** Categorías base: siempre primero en tienda y navegación */
export const CORE_CATEGORY_NAMES = [
  'Ofertas Familiares',
  'Ofertas para Dos',
  'Ofertas Personales',
];

/** Orden fijo de las 3 categorías base; el resto va después por display_order */
export function sortStoreCategories(categories) {
  if (!categories?.length) return [];
  const byCoreIndex = new Map();
  const rest = [];
  for (const c of categories) {
    const idx = CORE_CATEGORY_NAMES.findIndex(
      (n) => n.toLowerCase() === (c.name || '').trim().toLowerCase(),
    );
    if (idx >= 0) byCoreIndex.set(idx, c);
    else rest.push(c);
  }
  const core = CORE_CATEGORY_NAMES.map((_, i) => byCoreIndex.get(i)).filter(Boolean);
  rest.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  return [...core, ...rest];
}

export const CATEGORY_META = {
  'ofertas-familiares': { title: 'Ofertas Familiares', emoji: '👨‍👩‍👧‍👦' },
  'ofertas-dos': { title: 'Ofertas para Dos', emoji: '👫' },
  'ofertas-personales': { title: 'Ofertas Personales', emoji: '🧑' },
};

/** Flujo activo de avance (sin "listo"; entregado y cancelado son finales) */
export const ORDER_STATUS_FLOW = [
  'pendiente',
  'aceptado',
  'confirmado',
  'preparando',
  'en_delivery',
  'entregado',
];

export const ORDER_TERMINAL_STATES = new Set(['entregado', 'cancelado']);

/** Filtros en panel admin (incluye cancelado; "listo" solo para pedidos antiguos) */
export const ORDER_STATES = [
  ...ORDER_STATUS_FLOW,
  'cancelado',
  'listo',
];

/** Etiquetas para el cliente */
export const ORDER_STATUS_LABELS = {
  pendiente: { label: 'Pedido recibido', step: 1, color: 'bg-blue-500' },
  aceptado: { label: 'Aceptado', step: 2, color: 'bg-teal-500' },
  confirmado: { label: 'Confirmado', step: 3, color: 'bg-indigo-500' },
  preparando: { label: 'En cocina', step: 4, color: 'bg-amber-500' },
  listo: { label: 'En reparto', step: 5, color: 'bg-purple-500' },
  en_delivery: { label: 'En reparto', step: 5, color: 'bg-purple-500' },
  entregado: { label: 'Entregado', step: 6, color: 'bg-green-600' },
  cancelado: { label: 'Cancelado', step: 0, color: 'bg-red-500' },
};

export const ORDER_STATUS_STEPS = [...ORDER_STATUS_FLOW];

export function canAdvanceOrderEstado(estado) {
  return !ORDER_TERMINAL_STATES.has(estado);
}

export function canCancelOrder(estado) {
  return !ORDER_TERMINAL_STATES.has(estado);
}

/** Siguiente estado en el flujo; entregado/cancelado no avanzan ni ciclan */
export function getNextOrderEstado(current) {
  if (ORDER_TERMINAL_STATES.has(current)) return current;
  if (current === 'listo') return 'en_delivery';
  const idx = ORDER_STATUS_FLOW.indexOf(current);
  if (idx === -1) return ORDER_STATUS_FLOW[0];
  if (idx >= ORDER_STATUS_FLOW.length - 1) return current;
  return ORDER_STATUS_FLOW[idx + 1];
}

export const ORDER_TYPE_LABELS = {
  delivery: 'Delivery',
  retiro: 'Retiro en local',
  reserva: 'Reserva',
};

/** Rango orientativo de costo de delivery (CLP) */
export const DELIVERY_COST_RANGE = { min: 2500, max: 4000 };

export {
  PAYMENT_METHODS,
  PAYMENT_METHOD_IDS,
  DEFAULT_BRANCH_PAYMENT_METHODS,
} from './paymentMethods';

export const TRANSFER_BANK_INFO = {
  banco: 'Banco Estado',
  tipo: 'Cuenta Vista',
  nombre: 'Pollería El Pollón',
  rut: 'XX.XXX.XXX-X',
  numero: 'XXXX XXXX XXXX',
  email: 'contacto@elpollon.cl',
};

/** Legacy: preferir Configuración → Sabores de bebida (settings drink_flavors). */
export const DRINK_OPTIONS = [
  'Coca Cola', 'Coca Cola Cero', 'Inca Kola', 'Fanta', 'Sprite', 'Sprite Cero', 'Agua Sin Gas', 'Agua Con Gas',
];

/** Roles del sistema */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN_SUCURSAL: 'admin_sucursal',
  CAJERA: 'cajera',
  COCINA: 'cocina',
  DELIVERY: 'delivery',
  CLIENTE: 'cliente',
  // Legacy
  ADMINISTRADOR: 'administrador',
};

export const STAFF_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN_SUCURSAL,
  ROLES.CAJERA,
  ROLES.COCINA,
  ROLES.DELIVERY,
  ROLES.ADMINISTRADOR,
  'despachador',
  'cajero',
  'cocinero',
  'repartidor',
];

/** Permisos del módulo delivery GPS (aditivo — no altera menú/caja/cocina) */
const DELIVERY_MODULE_PERMS = [
  'drivers',
  'driver_config',
  'driver_rates',
  'dispatch',
  'live_map',
  'driver_reports',
];

export const ROLE_PERMISSIONS = {
  super_admin: ['dashboard', 'menu', 'orders', 'kitchen', 'products', 'categories', 'branches', 'cash', 'inventory', 'reports', 'users', 'settings', 'customers', 'campaigns', 'whatsapp_ai', ...DELIVERY_MODULE_PERMS],
  admin_sucursal: ['dashboard', 'menu', 'orders', 'kitchen', 'customers', 'branches', 'cash', 'inventory', 'reports', 'users', 'settings', 'whatsapp_ai', ...DELIVERY_MODULE_PERMS],
  administrador: ['dashboard', 'menu', 'orders', 'kitchen', 'customers', 'branches', 'cash', 'inventory', 'reports', 'users', 'settings', 'whatsapp_ai', ...DELIVERY_MODULE_PERMS],
  cajera: ['dashboard', 'orders', 'kitchen', 'dispatch', 'live_map'],
  cajero: ['dashboard', 'orders', 'kitchen', 'dispatch', 'live_map'],
  despachador: ['dashboard', 'orders', 'kitchen', 'dispatch', 'live_map'],
  cocina: ['kitchen'],
  cocinero: ['kitchen'],
  delivery: ['driver_app'],
  repartidor: ['driver_app'],
  cliente: [],
};

export const ADMIN_NAV = [
  { id: 'dashboard', path: '/admin', label: 'Dashboard', perm: 'dashboard', icon: 'LayoutDashboard' },
  { id: 'menu', path: '/admin/menu', label: 'Menú por sucursal', perm: 'menu', icon: 'BookOpen' },
  { id: 'pedidos', path: '/admin/pedidos', label: 'Pedidos', perm: 'orders', icon: 'ShoppingBag' },
  { id: 'cocina', path: '/admin/cocina', label: 'Cocina', perm: 'kitchen', icon: 'ChefHat' },
  { id: 'clientes', path: '/admin/clientes', label: 'Clientes', perm: 'customers', icon: 'Users' },
  { id: 'campanas', path: '/admin/campanas', label: 'Campañas', perm: 'campaigns', icon: 'Megaphone' },
  { id: 'sucursales', path: '/admin/sucursales', label: 'Sucursales', perm: 'branches', icon: 'Building2' },
  { id: 'caja', path: '/admin/caja', label: 'Caja diaria', perm: 'cash', icon: 'Banknote' },
  { id: 'stock', path: '/admin/stock', label: 'Stock', perm: 'inventory', icon: 'Package' },
  { id: 'reportes', path: '/admin/reportes', label: 'Reportes', perm: 'reports', icon: 'BarChart3' },
  { id: 'usuarios', path: '/admin/usuarios', label: 'Usuarios', perm: 'users', icon: 'Users' },
  { id: 'config', path: '/admin/config', label: 'Configuración', perm: 'settings', icon: 'Settings' },
  { id: 'drivers', path: '/admin/repartidores', label: 'Repartidores', perm: 'drivers', group: 'delivery', icon: 'Bike' },
  { id: 'driver_config', path: '/admin/repartidores/config', label: 'Config. despacho', perm: 'driver_config', group: 'delivery', icon: 'SlidersHorizontal' },
  { id: 'driver_rates', path: '/admin/repartidores/tarifas', label: 'Tarifas', perm: 'driver_rates', group: 'delivery', icon: 'DollarSign' },
  { id: 'dispatch', path: '/admin/repartidores/despacho', label: 'Despacho', perm: 'dispatch', group: 'delivery', icon: 'Send' },
  { id: 'live_map', path: '/admin/repartidores/en-vivo', label: 'En vivo', perm: 'live_map', group: 'delivery', icon: 'MapPin' },
  { id: 'driver_reports', path: '/admin/repartidores/reportes', label: 'Reportes', perm: 'driver_reports', group: 'delivery', icon: 'FileBarChart' },
];
