import { useMemo, useState } from 'react';
import {
  CreditCard,
  Calendar,
  CheckCircle2,
  Clock,
  Package,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Truck,
  Wallet,
  MessageCircle,
} from 'lucide-react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';

import { useOrders } from '../../hooks/useOrders';
import { useAdminBranchFilter } from '../../hooks/useAdminBranchFilter';
import { money } from '../../utils/format';
import {
  PERIOD_OPTIONS,
  buildBranchStats,
  buildHourlyChart,
  buildOrderTypeChart,
  buildPaymentChart,
  buildStatusChart,
  buildTimeline,
  buildTopProducts,
  computeKPIs,
  filterOrdersInRange,
  getPeriodRange,
} from '../../utils/dashboardAnalytics';
import { AdminBranchFilter } from '../../components/admin/AdminBranchFilter';
import { DashboardChartCard, DashboardKpiCard } from '../../components/admin/dashboard/DashboardChartCard';
import '../../styles/admin-dashboard.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
);

const CHART_FONT = { size: 11, weight: '600' };
const GRID_COLOR = 'rgba(0,0,0,0.04)';

function formatRangeDate(d) {
  if (!d) return '';
  const s = d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  return s.replace(/\./g, '').replace(/ de /gi, ' ');
}

function periodCompareLabel(periodId) {
  if (periodId === 'today') return 'vs. día anterior';
  if (periodId === 'week') return 'vs. semana anterior';
  if (periodId === 'month') return 'vs. mes anterior';
  return 'vs. trimestre ant.';
}

function doughOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0a0a0a',
        padding: 8,
        titleFont: { size: 10 },
        bodyFont: { size: 10 },
      },
    },
  };
}

function evolutionOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          boxWidth: 8,
          boxHeight: 8,
          font: CHART_FONT,
          padding: 6,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: '#0a0a0a',
        padding: 8,
        titleFont: { size: 10 },
        bodyFont: { size: 10 },
        callbacks: {
          label(ctx) {
            const label = ctx.dataset.label || '';
            const val = ctx.parsed.y;
            if (ctx.dataset.yAxisID === 'y1') return ` ${label}: ${val}`;
            return ` ${label}: ${money(val)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: CHART_FONT, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        border: { display: false },
      },
      y: {
        position: 'left',
        grid: { color: GRID_COLOR },
        border: { display: false },
        ticks: {
          font: CHART_FONT,
          maxTicksLimit: 4,
          callback: (v) => {
            const n = Number(v) || 0;
            if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
            if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000)}k`;
            return `$${n}`;
          },
        },
      },
      y1: {
        position: 'right',
        grid: { drawOnChartArea: false },
        border: { display: false },
        ticks: { font: CHART_FONT, maxTicksLimit: 4, precision: 0 },
      },
    },
  };
}

function barOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#0a0a0a', padding: 8 },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 8 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
        border: { display: false },
      },
      y: {
        grid: { color: GRID_COLOR },
        ticks: { font: CHART_FONT, maxTicksLimit: 4 },
        border: { display: false },
      },
    },
  };
}

function DonutWithLegend({ chart, formatValue }) {
  const colors = chart.datasets?.[0]?.backgroundColor || [];
  const values = chart.counts || chart.amounts || chart.datasets?.[0]?.data || [];
  const percents = chart.percents || [];

  return (
    <div className="dash-donut">
      <div className="dash-donut__chart">
        <Doughnut data={chart} options={doughOptions()} />
      </div>
      <ul className="dash-donut__legend">
        {(chart.labels || []).map((label, i) => (
          <li key={`${label}-${i}`}>
            <span className="dash-donut__swatch" style={{ background: colors[i] }} />
            <span className="dash-donut__name">{label}</span>
            <span className="dash-donut__val">
              {formatValue ? formatValue(values[i]) : values[i]}
              {percents[i] != null ? ` (${percents[i]}%)` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminDashboard() {
  const { orders, refresh } = useOrders();
  const [period, setPeriod] = useState('today');
  const [refreshing, setRefreshing] = useState(false);
  const {
    applyBranchFilter,
    isSuperAdmin,
    showBranchFilter,
    branches,
    selectedBranchId,
    setSelectedBranchId,
  } = useAdminBranchFilter();

  const ordersScoped = useMemo(() => applyBranchFilter(orders), [orders, applyBranchFilter]);
  const compareLabel = periodCompareLabel(period);

  const analytics = useMemo(() => {
    const range = getPeriodRange(period);
    const current = filterOrdersInRange(ordersScoped, range.start, range.end);
    const previous = filterOrdersInRange(ordersScoped, range.prevStart, range.prevEnd);
    const kpis = computeKPIs(current, previous);
    const branchStats = buildBranchStats(ordersScoped, branches, period);

    return {
      range,
      current,
      kpis,
      timeline: buildTimeline(current, period),
      branchStats,
      status: buildStatusChart(current),
      payment: buildPaymentChart(current),
      orderType: buildOrderTypeChart(current),
      hourly: buildHourlyChart(current),
      topProducts: buildTopProducts(current, 5),
    };
  }, [ordersScoped, period, branches]);

  const cashTotal = useMemo(
    () => analytics.current
      .filter((o) => o.estado !== 'cancelado' && (o.metodo_pago || 'efectivo') === 'efectivo')
      .reduce((s, o) => s + (Number(o.total) || 0), 0),
    [analytics.current],
  );
  const transferTotal = useMemo(
    () => analytics.current
      .filter((o) => o.estado !== 'cancelado' && o.metodo_pago === 'transferencia')
      .reduce((s, o) => s + (Number(o.total) || 0), 0),
    [analytics.current],
  );
  const cardTotal = useMemo(
    () => analytics.current
      .filter((o) => o.estado !== 'cancelado' && o.metodo_pago === 'tarjeta')
      .reduce((s, o) => s + (Number(o.total) || 0), 0),
    [analytics.current],
  );

  const branchTotals = useMemo(() => {
    const list = analytics.branchStats;
    return {
      productSales: list.reduce((s, b) => s + b.productSales, 0),
      deliverySales: list.reduce((s, b) => s + b.deliverySales, 0),
      sales: list.reduce((s, b) => s + b.sales, 0),
      orders: list.reduce((s, b) => s + b.orders, 0),
    };
  }, [analytics.branchStats]);

  const evolutionData = {
    labels: analytics.timeline.labels,
    datasets: [
      {
        label: 'Ventas productos',
        data: analytics.timeline.productSales,
        borderColor: '#c41e1e',
        backgroundColor: 'rgba(196,30,30,0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 2,
        pointHoverRadius: 4,
        borderWidth: 2,
        yAxisID: 'y',
      },
      {
        label: 'Delivery (ingresos)',
        data: analytics.timeline.deliverySales,
        borderColor: '#f97316',
        backgroundColor: 'rgba(249,115,22,0.08)',
        fill: false,
        tension: 0.35,
        pointRadius: 2,
        pointHoverRadius: 4,
        borderWidth: 2,
        yAxisID: 'y',
      },
      {
        label: 'Cantidad pedidos',
        data: analytics.timeline.orders,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,0.06)',
        fill: false,
        tension: 0.35,
        pointRadius: 2,
        pointHoverRadius: 4,
        borderWidth: 2,
        borderDash: [4, 3],
        yAxisID: 'y1',
      },
    ],
  };

  const hourlyData = {
    labels: analytics.hourly.labels,
    datasets: [{
      label: 'Pedidos',
      data: analytics.hourly.orders,
      backgroundColor: '#c41e1e',
      borderRadius: 2,
      maxBarThickness: 10,
    }],
  };

  const dateRangeLabel = `${formatRangeDate(analytics.range.start)} - ${formatRangeDate(analytics.range.end)}`;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <header className="dash-header">
        <div className="dash-header__titles">
          <h1 className="dash-header__title">Dashboard</h1>
          <p className="dash-header__subtitle">Análisis y control en tiempo real</p>
        </div>
        <div className="dash-header__actions">
          <button
            type="button"
            className="dash-btn dash-btn--primary"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          {showBranchFilter && (
            <AdminBranchFilter
              branches={branches}
              value={selectedBranchId}
              onChange={setSelectedBranchId}
            />
          )}
          <div className="dash-date-range" title="Rango del período seleccionado">
            <Calendar className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span>{dateRangeLabel}</span>
          </div>
        </div>
      </header>

      {/* Period tabs + live */}
      <div className="dash-toolbar">
        <div className="dashboard-period-tabs" role="tablist" aria-label="Período">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={period === opt.id}
              onClick={() => setPeriod(opt.id)}
              className={`dashboard-period-tab ${period === opt.id ? 'dashboard-period-tab--active' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="dashboard-toolbar__meta">
          <span className="dashboard-live-dot" aria-hidden />
          Datos en tiempo real
          <span className="dashboard-toolbar__sep">·</span>
          {analytics.current.length} pedidos en el periodo
        </p>
      </div>

      {/* Contenido con scroll en pantallas medianas/pequeñas */}
      <div className="admin-dashboard-scroll">
        {/* KPIs — 7 como en la foto */}
        <div className="dashboard-kpi-grid">
          <DashboardKpiCard
            label="Ventas Totales"
            value={money(analytics.kpis.sales)}
            delta={analytics.kpis.salesDelta}
            icon={ShoppingBag}
            compareLabel={compareLabel}
          />
          <DashboardKpiCard
            label="Delivery (Ingresos)"
            value={money(analytics.kpis.deliverySales)}
            delta={analytics.kpis.deliverySalesDelta}
            icon={Truck}
            accent="amber"
            compareLabel={compareLabel}
          />
          <DashboardKpiCard
            label="Ventas Productos"
            value={money(analytics.kpis.productSales)}
            delta={analytics.kpis.productSalesDelta}
            icon={Wallet}
            compareLabel={compareLabel}
          />
          <DashboardKpiCard
            label="Pedidos"
            value={analytics.kpis.orders}
            delta={analytics.kpis.ordersDelta}
            icon={Package}
            accent="blue"
            compareLabel={compareLabel}
          />
          <DashboardKpiCard
            label="Ticket Promedio"
            value={money(analytics.kpis.ticket)}
            delta={analytics.kpis.ticketDelta}
            icon={TrendingUp}
            compareLabel={compareLabel}
          />
          <DashboardKpiCard
            label="Entregados"
            value={analytics.kpis.delivered}
            delta={analytics.kpis.deliveredDelta}
            icon={CheckCircle2}
            accent="green"
            compareLabel={compareLabel}
          />
          <DashboardKpiCard
            label="Pendientes"
            value={analytics.kpis.pending}
            delta={analytics.kpis.pendingDelta}
            icon={Clock}
            accent="amber"
            compareLabel={compareLabel}
          />
        </div>

        <div className="dashboard-wa-strip" title="Pedidos del periodo con avisos WhatsApp activados">
          <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.4} />
          <strong>{analytics.kpis.pctWaAvisos}%</strong>
          <span>con avisos WhatsApp</span>
          <span className="dashboard-wa-strip__n">{analytics.kpis.waAvisos} de {analytics.kpis.orders}</span>
        </div>

        {/* Body: mid + bottom + summary */}
        <div className="admin-dashboard-body">
          {/* Mid: evolución + 3 donuts */}
          <section className="dash-mid">
            <DashboardChartCard
              title="Evolución de Ventas"
              subtitle="Productos, delivery y cantidad de pedidos"
              className="dash-mid__evolution"
            >
              <div className="dashboard-chart-h dashboard-chart-h--lg">
                <Line data={evolutionData} options={evolutionOptions()} />
              </div>
            </DashboardChartCard>

            <DashboardChartCard title="Distribución de Estados" className="dash-mid__donut">
              <DonutWithLegend chart={analytics.status} />
            </DashboardChartCard>

            <DashboardChartCard title="Métodos de Pago" className="dash-mid__donut">
              <DonutWithLegend chart={analytics.payment} formatValue={(v) => money(v)} />
            </DashboardChartCard>

            <DashboardChartCard title="Tipo de Pedido" className="dash-mid__donut">
              <DonutWithLegend chart={analytics.orderType} />
            </DashboardChartCard>
          </section>

          {/* Bottom: ranking + top productos + hora */}
          <section className="dash-bottom">
            <DashboardChartCard title="Ranking por Sucursal" className="dash-bottom__rank">
              <div className="dash-table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Sucursal</th>
                      <th>Ventas productos</th>
                      <th>Delivery</th>
                      <th>Ventas totales</th>
                      <th>Pedidos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.branchStats.length ? analytics.branchStats : [{
                      id: 'empty',
                      name: 'Sin datos',
                      productSales: 0,
                      deliverySales: 0,
                      sales: 0,
                      orders: 0,
                    }]).slice(0, 6).map((b, i) => (
                      <tr
                        key={b.id}
                        className={b.id !== 'empty' && isSuperAdmin ? 'dash-table__row--click' : ''}
                        onClick={() => {
                          if (b.id !== 'empty' && isSuperAdmin) setSelectedBranchId(b.id);
                        }}
                      >
                        <td>{i + 1}</td>
                        <td className="dash-table__name">{b.name}</td>
                        <td>{money(b.productSales)}</td>
                        <td>{money(b.deliverySales)}</td>
                        <td className="dash-table__strong">{money(b.sales)}</td>
                        <td>{b.orders}</td>
                      </tr>
                    ))}
                  </tbody>
                  {analytics.branchStats.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={2}>TOTAL GENERAL</td>
                        <td>{money(branchTotals.productSales)}</td>
                        <td>{money(branchTotals.deliverySales)}</td>
                        <td className="dash-table__strong">{money(branchTotals.sales)}</td>
                        <td>{branchTotals.orders}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </DashboardChartCard>

            <DashboardChartCard
              title="Top Productos Más Vendidos"
              className="dash-bottom__products"
              action={(
                <span className="dash-link-muted">Ver todos los productos</span>
              )}
            >
              <ol className="dash-top-list">
                {(analytics.topProducts.items || []).map((item, i) => (
                  <li key={`${item.name}-${i}`}>
                    <span className="dash-top-list__rank">{i + 1}</span>
                    <span className="dash-top-list__name" title={item.name}>{item.name}</span>
                    <span className="dash-top-list__meta">
                      <strong>{item.qty}</strong> uds
                    </span>
                    <span className="dash-top-list__sales">{money(item.sales)}</span>
                  </li>
                ))}
                {!(analytics.topProducts.items || []).length && (
                  <li className="dash-top-list__empty">Sin ventas en el período</li>
                )}
              </ol>
            </DashboardChartCard>

            <DashboardChartCard title="Actividad por Hora" className="dash-bottom__hourly">
              <div className="dashboard-chart-h dashboard-chart-h--sm">
                <Bar data={hourlyData} options={barOptions()} />
              </div>
            </DashboardChartCard>
          </section>

          {/* Resumen rápido */}
          <section className="dashboard-summary-grid" aria-label="Resumen rápido">
            {[
              ['Pedidos en periodo', analytics.kpis.orders, Package],
              ['Ventas productos', money(analytics.kpis.productSales), Wallet],
              ['Delivery', money(analytics.kpis.deliverySales), Truck],
              ['Ventas totales', money(analytics.kpis.sales), ShoppingBag],
              ['Ticket promedio', money(analytics.kpis.ticket), TrendingUp],
              ['Tasa de entrega', `${analytics.kpis.conversion}%`, CheckCircle2],
              ['Efectivo', money(cashTotal), Wallet],
              ['Transferencia', money(transferTotal), Wallet],
              ['Tarjeta', money(cardTotal), CreditCard],
            ].map(([label, val, Icon]) => (
              <div key={label} className="dashboard-summary-item">
                <Icon className="dashboard-summary-item__icon" strokeWidth={2} />
                <div className="min-w-0">
                  <span className="dashboard-summary-item__label">{label}</span>
                  <span className="dashboard-summary-item__value">{val}</span>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
