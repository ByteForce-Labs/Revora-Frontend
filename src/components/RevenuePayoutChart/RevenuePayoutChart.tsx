import React, { useState, useId } from 'react';
import { LineChart, Table, Download } from 'lucide-react';
import { usePrintMode } from '../../hooks/usePrintMode';

export interface RevenuePayoutDataPoint {
  period: string;
  revenue: number;
  payout: number;
}

interface RevenuePayoutChartProps {
  data: RevenuePayoutDataPoint[];
  revenueCurrency?: string;
  payoutCurrency?: string;
  __initialView?: 'chart' | 'table';
}

function formatCurrency(value: number, currency = 'USD') {
  return value.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 });
}

function DualAxisChartView({
  data,
  revenueCurrency,
  payoutCurrency,
}: {
  data: RevenuePayoutDataPoint[];
  revenueCurrency?: string;
  payoutCurrency?: string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const W = 600;
  const H = 240;
  const padX = 40;
  const padRight = 40;
  const padY = 30;

  const revenues = data.map((d) => d.revenue);
  const payouts = data.map((d) => d.payout);

  const minRev = Math.min(...revenues, 0);
  const maxRev = Math.max(...revenues, 1);
  const minPayout = Math.min(...payouts, 0);
  const maxPayout = Math.max(...payouts, 1);

  const revRange = maxRev - minRev || 1;
  const payoutRange = maxPayout - minPayout || 1;

  const n = data.length;
  const barWidth = Math.max(10, ((W - padX - padRight) / (n + 1)) * 0.6);

  const getX = (i: number) => padX + ((i + 0.5) / n) * (W - padX - padRight);
  const getRevY = (val: number) => H - padY - ((val - minRev) / revRange) * (H - 2 * padY);
  const getPayoutY = (val: number) => H - padY - ((val - minPayout) / payoutRange) * (H - 2 * padY);

  const linePath = data
    .map((d, i) => (i === 0 ? `M ${getX(i)},${getRevY(d.revenue)}` : ` L ${getX(i)},${getRevY(d.revenue)}`))
    .join('');

  return (
    <div className="relative">
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Revenue vs Payouts dual-axis chart"
        style={{ overflow: 'visible' }}
      >
        {/* Y-Axis Payouts (Left) */}
        <text x={padX - 8} y={padY} textAnchor="end" fontSize={10} fill="var(--text-muted, #cbd5e1)" aria-hidden="true">
          {formatCurrency(maxPayout, payoutCurrency)}
        </text>
        <text x={padX - 8} y={H - padY} textAnchor="end" fontSize={10} fill="var(--text-muted, #cbd5e1)" aria-hidden="true">
          {formatCurrency(minPayout, payoutCurrency)}
        </text>

        {/* Y-Axis Revenue (Right) */}
        <text x={W - padRight + 8} y={padY} textAnchor="start" fontSize={10} fill="var(--text-muted, #cbd5e1)" aria-hidden="true">
          {formatCurrency(maxRev, revenueCurrency)}
        </text>
        <text x={W - padRight + 8} y={H - padY} textAnchor="start" fontSize={10} fill="var(--text-muted, #cbd5e1)" aria-hidden="true">
          {formatCurrency(minRev, revenueCurrency)}
        </text>

        {/* Bars (Payout) */}
        {data.map((d, i) => {
          const x = getX(i);
          const y = getPayoutY(Math.max(0, d.payout));
          const height = Math.abs(getPayoutY(d.payout) - getPayoutY(0));
          const actualHeight = height === 0 ? 2 : height;
          const actualY = height === 0 ? getPayoutY(0) - 2 : y;

          return (
            <rect
              key={`bar-${i}`}
              x={x - barWidth / 2}
              y={actualY}
              width={barWidth}
              height={actualHeight}
              fill="var(--primary, #3b82f6)"
              opacity={hoverIdx === null || hoverIdx === i ? 0.8 : 0.3}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className="transition-opacity duration-200"
              role="img"
              aria-label={`${d.period} Payout: ${formatCurrency(d.payout, payoutCurrency)}`}
              tabIndex={0}
              onFocus={() => setHoverIdx(i)}
              onBlur={() => setHoverIdx(null)}
            />
          );
        })}

        {/* Line (Revenue) */}
        <path d={linePath} fill="none" stroke="var(--success, #10b981)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Line Data Points */}
        {data.map((d, i) => (
          <circle
            key={`dot-${i}`}
            cx={getX(i)}
            cy={getRevY(d.revenue)}
            r={hoverIdx === i ? 6 : 4}
            fill="var(--success, #10b981)"
            stroke="var(--bg-card, #1e293b)"
            strokeWidth={2}
            className="transition-all duration-200"
            style={{ pointerEvents: 'none' }}
          />
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => (
          <text
            key={`label-${i}`}
            x={getX(i)}
            y={H - padY + 16}
            textAnchor="middle"
            fontSize={10}
            fill="var(--text-muted, #cbd5e1)"
            aria-hidden="true"
          >
            {d.period}
          </text>
        ))}

        {/* Zero line */}
        <line x1={padX} y1={getPayoutY(0)} x2={W - padRight} y2={getPayoutY(0)} stroke="var(--border, #334155)" strokeDasharray="4 4" />
      </svg>

      {/* Custom Tooltip */}
      {hoverIdx !== null && (
        <div
          className="absolute z-10 p-3 rounded-md shadow-lg bg-slate-800 border border-slate-700 text-sm pointer-events-none"
          style={{
            left: `${((getX(hoverIdx) / W) * 100)}%`,
            top: '20px',
            transform: 'translateX(-50%)'
          }}
          aria-live="polite"
        >
          <div className="font-semibold mb-1 text-white">{data[hoverIdx].period}</div>
          <div className="flex justify-between gap-4 text-emerald-400">
            <span>Revenue:</span>
            <span>{formatCurrency(data[hoverIdx].revenue, revenueCurrency)}</span>
          </div>
          <div className="flex justify-between gap-4 text-blue-400">
            <span>Payout:</span>
            <span>{formatCurrency(data[hoverIdx].payout, payoutCurrency)}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-700 flex justify-between gap-4 text-slate-300 text-xs">
            <span>Delta:</span>
            <span>
              {data[hoverIdx].revenue !== 0 
                ? (((data[hoverIdx].payout - data[hoverIdx].revenue) / data[hoverIdx].revenue) * 100).toFixed(1) + '%' 
                : 'N/A'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function TableView({
  data,
  revenueCurrency,
  payoutCurrency,
}: {
  data: RevenuePayoutDataPoint[];
  revenueCurrency?: string;
  payoutCurrency?: string;
}) {
  return (
    <div className="overflow-x-auto" role="region" aria-label="Revenue and Payouts data table">
      <table className="w-full text-sm" aria-label="Revenue vs Payouts table">
        <thead>
          <tr className="border-b border-[rgba(148,163,184,0.1)]">
            <th scope="col" className="text-left text-xs text-muted font-medium pb-2">Period</th>
            <th scope="col" className="text-right text-xs text-muted font-medium pb-2">Reported Revenue</th>
            <th scope="col" className="text-right text-xs text-muted font-medium pb-2">Actual Payout</th>
            <th scope="col" className="text-right text-xs text-muted font-medium pb-2">Delta</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => {
            const diff = d.payout - d.revenue;
            const pct = d.revenue !== 0 ? (diff / d.revenue) * 100 : 0;
            return (
              <tr key={d.period} className="border-b border-[rgba(148,163,184,0.05)]">
                <td className="py-2 text-xs">{d.period}</td>
                <td className="py-2 text-xs text-right font-medium text-success">
                  {formatCurrency(d.revenue, revenueCurrency)}
                </td>
                <td className="py-2 text-xs text-right font-medium text-primary">
                  {formatCurrency(d.payout, payoutCurrency)}
                </td>
                <td className="py-2 text-xs text-right">
                  <span className={pct > 0 ? 'text-success' : pct < 0 ? 'text-error' : 'text-muted'}>
                    {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const RevenuePayoutChart: React.FC<RevenuePayoutChartProps> = ({
  data,
  revenueCurrency = 'USD',
  payoutCurrency = 'USD',
  __initialView = 'chart',
}) => {
  const [view, setView] = useState<'chart' | 'table'>(__initialView);
  const isPrinting = usePrintMode();
  const headingId = useId();

  const effectiveView = isPrinting ? 'table' : view;

  const handleExportCsv = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Period,Revenue,Payout,Delta']
        .concat(
          data.map((d) => {
            const delta = d.revenue !== 0 ? ((d.payout - d.revenue) / d.revenue) * 100 : 0;
            return `${d.period},${d.revenue},${d.payout},${delta.toFixed(2)}`;
          })
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'revenue_vs_payout.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (data.length === 0) {
    return (
      <section className="glass-card p-6" aria-labelledby={headingId} data-testid="revenue-payout-chart">
        <h2 id={headingId} className="text-base font-semibold mb-4">Revenue vs Payouts</h2>
        <p className="text-muted text-sm text-center py-8">No data available.</p>
      </section>
    );
  }

  return (
    <section
      className="glass-card p-6 space-y-4"
      aria-labelledby={headingId}
      data-testid="revenue-payout-chart"
      data-print-view={effectiveView}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 id={headingId} className="text-base font-semibold">Revenue vs Payouts</h2>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs flex items-center gap-1 text-muted">
              <span className="w-2 h-2 rounded-full bg-success inline-block" /> Revenue
            </span>
            <span className="text-xs flex items-center gap-1 text-muted">
              <span className="w-2 h-2 rounded bg-primary inline-block" /> Payout
            </span>
          </div>
        </div>
        <div role="group" aria-label="Controls" className="flex items-center gap-2">
          <button
            className="btn--icon p-1.5 rounded-md transition-colors text-muted hover:text-main"
            onClick={handleExportCsv}
            aria-label="Download CSV"
            title="Download CSV"
            data-testid="export-csv-btn"
          >
            <Download size={16} aria-hidden="true" />
          </button>
          <div className="w-px h-4 bg-slate-700 mx-1" />
          <button
            className={`btn--icon p-1.5 rounded-md transition-colors ${effectiveView === 'chart' ? 'text-primary bg-primary/10' : 'text-muted hover:text-main'}`}
            onClick={() => setView('chart')}
            aria-pressed={effectiveView === 'chart'}
            aria-label="Dual-axis chart view"
            data-testid="chart-toggle"
          >
            <LineChart size={16} aria-hidden="true" />
          </button>
          <button
            className={`btn--icon p-1.5 rounded-md transition-colors ${effectiveView === 'table' ? 'text-primary bg-primary/10' : 'text-muted hover:text-main'}`}
            onClick={() => setView('table')}
            aria-pressed={effectiveView === 'table'}
            aria-label="Table view"
            data-testid="table-toggle"
          >
            <Table size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {effectiveView === 'chart' ? (
        <div className="chart-view mt-4">
          <DualAxisChartView data={data} revenueCurrency={revenueCurrency} payoutCurrency={payoutCurrency} />
        </div>
      ) : (
        <div className="table-view mt-4">
          <TableView data={data} revenueCurrency={revenueCurrency} payoutCurrency={payoutCurrency} />
        </div>
      )}
    </section>
  );
};
