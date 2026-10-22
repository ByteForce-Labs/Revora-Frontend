/**
 * PayoutSchedule — Gantt-style timeline view with table alternative (Issue #219).
 *
 * RTL mirror pass (Issue #495):
 * - RTL detection via locale prop and i18n constants
 * - Gantt bars positioned with `inset-inline-start` (logical CSS)
 * - Today marker mirrored in RTL via CSS transform
 * - Tooltips shift to inline-start edge in RTL (RTL-first placement)
 * - Numeric dates wrapped in `<span dir="ltr">` with unicode-bidi:isolate
 * - Gradient stripes on failed/canceled bars mirror in RTL
 *
 * Features:
 * - View toggle: Gantt chart / accessible table
 * - Gantt with lane rows per issuer, payout bars with status colours,
 *   today marker, and zoom controls (week/month/quarter)
 * - Hover tooltips on gantt bars
 * - WCAG 2.1 AA, responsive, RTL-ready
 */

import React, { useState, useMemo } from 'react';
import { Calendar, BarChart3, Table2 } from 'lucide-react';
import { PayoutStatusPill, PAYOUT_STATUS_ORDER } from '../components/PayoutStatusPill';
import { EmptyState } from '../components/designSystem/EmptyState';
import { CalendarExportDialog } from '../components/CalendarExportDialog';
import { Button } from '../components/Button';
import { RTL_LOCALES } from '../constants/i18n';
import { parseIsoDate, formatDisplayDate } from '../components/PayoutTimeline';
import './PayoutSchedule.css';

/* ─── Types ──────────────────────────────────────────────────────────── */

export type ZoomLevel = 'week' | 'month' | 'quarter';

export interface Payout {
  id: string;
  recipient: string;
  amount: string;
  scheduledFor: string;
  status: string;
}

/* ─── Color map for bar statuses ──────────────────────────────────── */

const STATUS_BAR_COLORS: Record<string, string> = {
  scheduled: '#3b82f6',
  preparing: '#f59e0b',
  sending: '#8b5cf6',
  confirmed: '#10b981',
  retrying: '#f97316',
  failed: '#ef4444',
  canceled: '#64748b',
};

function statusBarColor(status: string): string {
  return STATUS_BAR_COLORS[status] ?? '#64748b';
}

/* ─── Demo data ─────────────────────────────────────────────────────── */

export const DEMO_PAYOUTS: Payout[] = [
  { id: '1', recipient: 'Issuer A', amount: 'USDC 12,500', scheduledFor: '2026-07-15', status: 'scheduled' },
  { id: '2', recipient: 'Issuer B', amount: 'USDC 8,000', scheduledFor: '2026-07-10', status: 'confirmed' },
  { id: '3', recipient: 'Issuer C', amount: 'USDC 5,000', scheduledFor: '2026-06-20', status: 'confirmed' },
  { id: '4', recipient: 'Issuer D', amount: 'USDC 3,000', scheduledFor: '2026-08-01', status: 'sending' },
  { id: '5', recipient: 'Issuer A', amount: 'USDC 2,500', scheduledFor: '2026-06-01', status: 'failed' },
  { id: '6', recipient: 'Issuer B', amount: 'USDC 1,500', scheduledFor: '2026-05-15', status: 'canceled' },
  { id: '7', recipient: 'Issuer C', amount: 'USDC 750', scheduledFor: '2026-07-25', status: 'retrying' },
  { id: '8', recipient: 'Issuer D', amount: 'USDC 6,000', scheduledFor: '2026-08-15', status: 'scheduled' },
];

/* ─── Helpers ────────────────────────────────────────────────────────── */



/**
 * Compute a date range that spans all payouts at the given zoom level.
 * Returns start/end as Date objects (start of day).
 */
function getRange(payouts: Payout[], zoom: ZoomLevel): { start: Date; end: Date } {
  if (payouts.length === 0) {
    const now = new Date();
    return { start: now, end: now };
  }

  const dates = payouts.map((p) => parseIsoDate(p.scheduledFor));
  let min = new Date(Math.min(...dates.map((d) => d.getTime())));
  let max = new Date(Math.max(...dates.map((d) => d.getTime())));

  // Pad the range based on zoom level
  const padDays = zoom === 'week' ? 7 : zoom === 'month' ? 30 : 90;
  min.setDate(min.getDate() - Math.floor(padDays / 2));
  max.setDate(max.getDate() + Math.floor(padDays / 2));

  return { start: min, end: max };
}

/** Compute days between two Date objects. */
function daysBetweenDates(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Format a date range label. */
function formatRangeLabel(start: Date, end: Date, zoom: ZoomLevel): string {
  const opts: Intl.DateTimeFormatOptions =
    zoom === 'week'
      ? { month: 'short', day: 'numeric', year: 'numeric' }
      : zoom === 'month'
        ? { month: 'long', year: 'numeric' }
        : { year: 'numeric' };

  const startStr = new Intl.DateTimeFormat('en-US', opts).format(start);
  const endStr = new Intl.DateTimeFormat('en-US', opts).format(end);
  return `${startStr} – ${endStr}`;
}

/* ─── Props ──────────────────────────────────────────────────────────── */

interface PayoutScheduleProps {
  payouts?: Payout[];
  empty?: boolean;
  /** Locale string for RTL detection. Defaults to 'en-US'. */
  locale?: string;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export const PayoutSchedule: React.FC<PayoutScheduleProps> = ({
  payouts: payoutsProp = DEMO_PAYOUTS,
  empty = false,
  locale = 'en-US',
}) => {
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [showGantt, setShowGantt] = useState(false);
  const [zoom, setZoom] = useState<ZoomLevel>('month');
  const [hoveredPayoutId, setHoveredPayoutId] = useState<string | null>(null);

  const isRtl = RTL_LOCALES.includes(locale);

  /* ─── Group by issuer for Gantt lanes ─── */
  const lanes = useMemo(() => {
    const map = new Map<string, Payout[]>();
    for (const p of payoutsProp) {
      const arr = map.get(p.recipient) ?? [];
      arr.push(p);
      map.set(p.recipient, arr);
    }
    return Array.from(map.entries()).map(([issuer, items]) => ({
      issuer,
      items: items.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)),
    }));
  }, [payoutsProp]);

  /* ─── Time range ─── */
  const range = useMemo(
    () => getRange(lanes.flatMap((l) => l.items), zoom),
    [lanes, zoom],
  );
  const totalDays = daysBetweenDates(range.start, range.end) || 1;

  const todayDate = new Date();
  const todayOffset = daysBetweenDates(range.start, todayDate);
  const todayPct = ((todayOffset / totalDays) * 100).toFixed(2);

  /* ─── Zoom handlers ─── */
  const handleZoomChange = (next: ZoomLevel) => {
    setZoom(next);
  };

  /* ─── Empty state ─── */
  if (empty) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-10 animate-fade-in">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payout Schedule</h1>
            <p className="text-muted text-sm mt-1">
              View upcoming and past RevenueShare payout dates.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setIsExportDialogOpen(true)}
            style={{ width: 'auto' }}
          >
            <Calendar size={18} />
            Subscribe
          </Button>
        </div>
        <EmptyState
          variant="payout-schedule"
          title="No payouts scheduled"
          description="Payouts will appear here once revenue is reported and the distribution cycle begins."
          primaryAction={{
            label: 'Report Revenue',
            href: '/startup/report-revenue',
          }}
          secondaryAction={{
            label: 'Learn How It Works',
            href: '/',
          }}
        />
        <CalendarExportDialog
          isOpen={isExportDialogOpen}
          onClose={() => setIsExportDialogOpen(false)}
        />
      </div>
    );
  }

  return (
    <div
      className="max-w-6xl mx-auto p-6 space-y-8 animate-fade-in"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* ── Header ── */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payout Schedule</h1>
          <p className="text-muted text-sm mt-1">
            View upcoming and past RevenueShare payout dates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div
            className="psp-toggle"
            role="tablist"
            aria-label="View mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!showGantt}
              className={`psp-toggle-btn ${!showGantt ? 'psp-toggle-btn--active' : ''}`}
              onClick={() => setShowGantt(false)}
            >
              <Table2 size={16} aria-hidden="true" />
              Table
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showGantt}
              className={`psp-toggle-btn ${showGantt ? 'psp-toggle-btn--active' : ''}`}
              onClick={() => setShowGantt(true)}
            >
              <BarChart3 size={16} aria-hidden="true" />
              Gantt
            </button>
          </div>

          <Button
            variant="secondary"
            onClick={() => setIsExportDialogOpen(true)}
            style={{ width: 'auto' }}
          >
            <Calendar size={18} />
            Subscribe
          </Button>
        </div>
      </div>

      {/* ── Status Legend (always visible) ── */}
      <div
        data-testid="payout-status-legend"
        className="flex flex-wrap gap-2"
      >
        {PAYOUT_STATUS_ORDER.map((status) => (
          <PayoutStatusPill key={status} status={status} variant="full" />
        ))}
      </div>

      {/* ── Gantt Chart View ── */}
      {showGantt && (
        <div className="psp-gantt" data-testid="payout-gantt-view">
          {/* Controls row */}
          <div className="psp-controls">
            <span className="psp-range-label" dir="ltr">
              {formatRangeLabel(range.start, range.end, zoom)}
            </span>

            <div
              className="psp-zoom-group"
              role="group"
              aria-label="Zoom controls"
            >
              {(['week', 'month', 'quarter'] as ZoomLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  role="button"
                  aria-pressed={zoom === level}
                  className={`psp-zoom-btn ${zoom === level ? 'psp-zoom-btn--active' : ''}`}
                  onClick={() => handleZoomChange(level)}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Gantt lanes */}
          <div className="psp-lanes">
            {lanes.map((lane) => (
              <div key={lane.issuer} className="psp-lane">
                <div className="psp-lane-label">
                  <span className="psp-lane-name" title={lane.issuer}>
                    {lane.issuer}
                  </span>
                  <span className="psp-lane-count">{lane.items.length}</span>
                </div>

                <div className="psp-track">
                  {/* Today marker */}
                  {todayOffset >= 0 && todayOffset <= totalDays && (
                    <div
                      className="psp-today-marker"
                      style={{ '--psp-today-pct': `${todayPct}%` } as React.CSSProperties}
                      aria-hidden="true"
                    >
                      <div className="psp-today-dot" />
                    </div>
                  )}

                  {/* Payout bars */}
                  {lane.items.map((item) => {
                    const itemDate = parseIsoDate(item.scheduledFor);
                    const offset = daysBetweenDates(range.start, itemDate);
                    const pct = (offset / totalDays) * 100;
                    const color = statusBarColor(item.status);
                    const isFailedOrCanceled =
                      item.status === 'failed' || item.status === 'canceled';
                    const isHovered = hoveredPayoutId === item.id;

                    const classNames = [
                      'psp-bar',
                      isFailedOrCanceled ? `psp-bar--${item.status}` : '',
                    ]
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <div
                        key={item.id}
                        className={classNames}
                        style={{
                          insetInlineStart: `${Math.max(0, pct)}%`,
                          width: `${Math.max(2, 100 / totalDays)}%`,
                          top: '25%',
                          height: '50%',
                          minWidth: 4,
                          opacity: isHovered ? 1 : 0.8,
                          backgroundColor: color,
                        } as React.CSSProperties}
                        title={`${lane.issuer}: ${item.amount} — ${item.scheduledFor} — ${item.status}`}
                        onMouseEnter={() => setHoveredPayoutId(item.id)}
                        onMouseLeave={() => setHoveredPayoutId(null)}
                      >
                        {/* Tooltip */}
                        {isHovered && (
                          <div className="psp-bar-tooltip" role="tooltip">
                            <div className="psp-bar-tooltip-inner">
                              <div className="psp-bar-tooltip-issuer">
                                {lane.issuer}
                              </div>
                              <div className="psp-bar-tooltip-amount">
                                {item.amount}
                              </div>
                              <div className="psp-bar-tooltip-date" dir="ltr">
                                {formatDisplayDate(item.scheduledFor)}
                              </div>
                              <div className="psp-bar-tooltip-status">
                                <PayoutStatusPill
                                  status={item.status}
                                  variant="compact"
                                  showTooltip={false}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Pattern key */}
          <div className="psp-pattern-key">
            <span className="psp-pattern-key-label">Pattern key:</span>
            <span className="psp-pattern-key-item">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{
                  background:
                    'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px), #64748b',
                }}
              />
              Failed / Canceled
            </span>
            <span className="psp-pattern-key-item">
              <span className="inline-block w-2 h-0.5 rounded bg-primary/60" />
              Today marker
            </span>
          </div>
        </div>
      )}

      {/* ── Table View (default/fallback) ── */}
      {!showGantt && (
        <div
          className="rounded-xl border border-glass-border bg-[rgba(15,23,42,0.35)] overflow-x-auto"
          data-testid="payout-schedule-table"
        >
          <table className="psp-table w-full">
            <thead>
              <tr>
                <th scope="col">Recipient</th>
                <th scope="col">Amount</th>
                <th scope="col">Scheduled For</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {lanes.flatMap((lane) =>
                lane.items.map((item) => (
                  <tr
                    key={item.id}
                    className="psp-table-row"
                    data-testid={`payout-row-${item.id}`}
                  >
                    <td className="font-medium text-text-main">
                      {item.recipient}
                    </td>
                    <td className="text-muted">{item.amount}</td>
                    <td className="text-muted" dir="ltr">
                      {formatDisplayDate(item.scheduledFor)}
                    </td>
                    <td>
                      <PayoutStatusPill
                        status={item.status}
                        variant="compact"
                      />
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Status Legend (full variants, always visible) ── */}
      <div className="rounded-xl border border-glass-border bg-[rgba(15,23,42,0.35)] p-4">
        <h2 className="text-sm font-semibold text-text-main mb-2">
          Status Legend
        </h2>
        <p className="text-xs text-muted mb-3 max-w-lg">
          Payouts move through these lifecycle stages. Each status has a
          distinct icon, label, and colour so meaning is never conveyed by
          colour alone.
        </p>
        <ul className="flex flex-wrap gap-2" aria-label="Payout status definitions">
          {PAYOUT_STATUS_ORDER.map((status) => (
            <li key={status}>
              <PayoutStatusPill status={status} variant="full" />
            </li>
          ))}
        </ul>
      </div>

      <CalendarExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
      />
    </div>
  );
};

export default PayoutSchedule;
