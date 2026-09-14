/**
 * Encabezado estándar de páginas admin — responsive en móvil/tablet/PC.
 */
export function AdminPageHeader({ title, subtitle, branchLabel, actions }) {
  return (
    <div className="admin-page-header flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <h2 className="admin-page-header__title">{title}</h2>
        {subtitle && <p className="admin-page-header__subtitle">{subtitle}</p>}
        {branchLabel && (
          <p className="mt-1 text-xs font-medium text-pollon-red sm:text-sm">Sucursal: {branchLabel}</p>
        )}
      </div>
      {actions && (
        <div className="admin-page-header__actions flex shrink-0 flex-wrap gap-1.5 sm:gap-2">{actions}</div>
      )}
    </div>
  );
}
