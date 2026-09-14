/** Tarjeta contenedora de gráfico compacto. */
export function DashboardChartCard({ title, subtitle, children, className = '', action }) {
  return (
    <article className={`dashboard-chart-card ${className}`}>
      <div className="dashboard-chart-card__head">
        <div className="min-w-0">
          <h3 className="dashboard-chart-card__title">{title}</h3>
          {subtitle && <p className="dashboard-chart-card__subtitle">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="dashboard-chart-card__body">{children}</div>
    </article>
  );
}

/** KPI con variación vs período anterior. */
export function DashboardKpiCard({ label, value, delta, icon: Icon, accent = 'red', compareLabel = 'vs. periodo ant.' }) {
  const accentClass = accent === 'green'
    ? 'text-emerald-600'
    : accent === 'amber'
      ? 'text-amber-600'
      : accent === 'blue'
        ? 'text-blue-600'
        : 'text-pollon-red';
  const deltaUp = typeof delta === 'number' && delta > 0;
  const deltaDown = typeof delta === 'number' && delta < 0;
  const deltaClass = deltaUp
    ? 'dashboard-kpi__delta--up'
    : deltaDown
      ? 'dashboard-kpi__delta--down'
      : 'dashboard-kpi__delta--flat';

  return (
    <div className="dashboard-kpi">
      <div className="dashboard-kpi__top">
        {Icon && (
          <span className={`dashboard-kpi__icon ${accentClass}`}>
            <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
          </span>
        )}
        <div className="dashboard-kpi__delta-wrap">
          {delta !== undefined && delta !== null && (
            <span className={`dashboard-kpi__delta ${deltaClass}`}>
              {delta > 0 ? '+' : ''}{delta}%
            </span>
          )}
          {delta !== undefined && delta !== null && (
            <span className="dashboard-kpi__compare">{compareLabel}</span>
          )}
        </div>
      </div>
      <p className="dashboard-kpi__value">{value}</p>
      <p className="dashboard-kpi__label">{label}</p>
    </div>
  );
}
