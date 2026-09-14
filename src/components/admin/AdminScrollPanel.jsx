/**
 * Contenedor con scroll vertical adaptativo (móvil, tablet, laptop 12", desktop).
 * variant: "table" (thead sticky) | "card" (listas/tarjetas) | "grid" (grillas cocina/sucursales)
 */
export function AdminScrollPanel({
  children,
  maxRows = 7,
  variant = 'table',
  className = '',
}) {
  const variantClass = {
    table: 'admin-scroll-table',
    card: 'admin-scroll-card',
    grid: 'admin-scroll-grid',
  }[variant] || 'admin-scroll-table';

  const rows = Math.min(Math.max(maxRows, 3), 12);

  return (
    <div
      className={`admin-scroll-panel ${variantClass} overflow-auto ${className}`}
      style={{ '--admin-scroll-rows': rows }}
    >
      {children}
    </div>
  );
}
