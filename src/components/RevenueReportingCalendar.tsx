/**
 * Revenue Reporting Calendar — Issue #153
 *
 * A responsive, accessible month-grid calendar that provides issuers
 * with a month-by-month overview of report due dates, submission
 * status, and acceptance status, with quick access to submit reports.
 *
 * Features:
 * - WAI-ARIA Grid pattern with full keyboard navigation
 * - Status indicators (Due, Submitted, Accepted, Overdue)
 * - Side panel with report details and Submit Report CTA
 * - Responsive: desktop (side-by-side), tablet (collapsible), mobile (stacked)
 * - Dark mode and RTL support
 * - Edge cases: loading, empty, error, overdue, multiple reports
 */

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  KeyboardEvent,
  MouseEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Send,
  X,
  Menu,
  List,
  Upload,
  LayoutGrid,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Bell,
} from "lucide-react";
import {
  formatDate,
  formatCurrency,
  SupportedLocale,
  LOCALE_FORMAT_SETTINGS,
} from "../constants/i18n";
import { TERMINOLOGY } from "../constants/terminology";
import { Button } from "./Button";
import {
  RevenueReportingCalendarProps,
  RevenueReport,
  DetailsPanelProps,
  DayCellData,
  ReportStatus,
  REPORT_STATUS_LABELS,
  REPORT_STATUS_COLORS,
  OverdueSeverity,
  OVERDUE_SEVERITY_LABELS,
  OVERDUE_SEVERITY_COLORS,
  getOverdueDays,
  getOverdueSeverity,
} from './RevenueReportingCalendar.types';
import RevenueCalendarCsvImport from './RevenueCalendarCsvImport';
import './RevenueReportingCalendar.css';

/* ─── Helpers ──────────────────────────────────────────────────────── */

function toISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseISODate(iso: string): {
  year: number;
  month: number;
  day: number;
} {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

function isSameDay(a: string, b: string): boolean {
  return a === b;
}

function isToday(iso: string): boolean {
  const today = new Date();
  const d = parseISODate(iso);
  return (
    d.year === today.getFullYear() &&
    d.month === today.getMonth() &&
    d.day === today.getDate()
  );
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(
  year: number,
  month: number,
  weekStartsOn: number,
): number {
  const day = new Date(year, month, 1).getDay();
  return (day - weekStartsOn + 7) % 7;
}

function getPrimaryStatus(reports: RevenueReport[]): ReportStatus {
  if (reports.length === 0) return "none";
  // Priority: overdue > due > submitted > accepted
  if (reports.some((r) => r.status === "overdue")) return "overdue";
  if (reports.some((r) => r.status === "due")) return "due";
  if (reports.some((r) => r.status === "submitted")) return "submitted";
  return "accepted";
}

function isOverdue(report: RevenueReport): boolean {
  if (report.status === "accepted" || report.status === "submitted")
    return false;
  const due = new Date(report.dueDate);
  const now = new Date();
  return due < now;
}

function getMonthReports(
  reports: RevenueReport[],
  year: number,
  month: number,
): RevenueReport[] {
  return reports.filter((r) => {
    const d = parseISODate(r.date);
    return d.year === year && d.month === month;
  });
}

/* ─── Build Day Cells ──────────────────────────────────────────────── */

function buildDayCells(
  year: number,
  month: number,
  reports: RevenueReport[],
  selectedDates: string[],
  weekStartsOn: number,
): DayCellData[] {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month, weekStartsOn);
  const cells: DayCellData[] = [];

  const sortedDates = [...selectedDates].sort();
  const getSelectionProps = (date: string) => {
    const isSelected = selectedDates.includes(date);
    if (!isSelected || sortedDates.length < 2) return { isSelected };
    const isRangeStart = date === sortedDates[0];
    const isRangeEnd = date === sortedDates[sortedDates.length - 1];
    const isInRange = isSelected && !isRangeStart && !isRangeEnd;
    return { isSelected, isRangeStart, isRangeEnd, isInRange };
  };

  // Previous month padding
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const date = toISODate(prevYear, prevMonth, day);
    const dayReports = reports.filter((r) => r.date === date);
    cells.push({
      date,
      day,
      inMonth: false,
      isToday: isToday(date),
      ...getSelectionProps(date),
      reports: dayReports,
      primaryStatus: getPrimaryStatus(dayReports),
    });
  }

  // Current month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = toISODate(year, month, day);
    const dayReports = reports.filter((r) => r.date === date);
    cells.push({
      date,
      day,
      inMonth: true,
      isToday: isToday(date),
      ...getSelectionProps(date),
      reports: dayReports,
      primaryStatus: getPrimaryStatus(dayReports),
    });
  }

  // Next month padding (fill to complete 6 rows × 7 = 42 cells, or just fill the last row)
  const remaining = 42 - cells.length;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  for (let day = 1; day <= remaining; day++) {
    const date = toISODate(nextYear, nextMonth, day);
    const dayReports = reports.filter((r) => r.date === date);
    cells.push({
      date,
      day,
      inMonth: false,
      isToday: isToday(date),
      ...getSelectionProps(date),
      reports: dayReports,
      primaryStatus: getPrimaryStatus(dayReports),
    });
  }

  return cells;
}

/* ─── Status Dot ───────────────────────────────────────────────────── */

function StatusDot({ status }: { status: ReportStatus }) {
  if (status === "none") return null;
  const color = REPORT_STATUS_COLORS[status];
  return (
    <span
      className="rc-status-dot"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

/* ─── Overdue Badge ────────────────────────────────────────────────── */

function OverdueBadge({ dueDate }: { dueDate: string }) {
  const days = getOverdueDays(dueDate);
  const severity = getOverdueSeverity(days);
  const color = OVERDUE_SEVERITY_COLORS[severity];

  return (
    <span
      className={`rc-overdue-badge rc-overdue-badge--${severity}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {severity === 'critical' ? (
        <AlertOctagon size={10} aria-hidden="true" />
      ) : (
        <AlertTriangle size={10} aria-hidden="true" />
      )}
      <span className="rc-overdue-badge-days">{days}</span>
    </span>
  );
}

/* ─── Preview Hook ─────────────────────────────────────────────────── */

/** Returns true if user prefers reduced motion */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/**
 * Manages show/hide timing for the cell hover preview.
 * - Opens after 300ms hover/focus (instant if reduced-motion)
 * - Closes after 120ms blur/mouseleave (instant if reduced-motion)
 */
function usePreviewTimer(reducedMotion: boolean) {
  const [visible, setVisible] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (visible) return;
    if (reducedMotion) {
      setVisible(true);
      return;
    }
    openTimer.current = setTimeout(() => setVisible(true), 300);
  }, [visible, reducedMotion]);

  const close = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (reducedMotion) {
      setVisible(false);
      return;
    }
    closeTimer.current = setTimeout(() => setVisible(false), 120);
  }, [reducedMotion]);

  const closeImmediate = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setVisible(false);
  }, []);

  useEffect(() => {
    return () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  return { visible, open, close, closeImmediate };
}

/* ─── Preview Position ─────────────────────────────────────────────── */

type PreviewPlacement = 'top' | 'bottom' | 'top-start' | 'bottom-start';

/** Computes placement to keep preview inside viewport */
function getPreviewPlacement(
  anchorEl: HTMLElement | null,
  previewWidth = 220,
  previewHeight = 160,
): PreviewPlacement {
  if (!anchorEl) return 'top';
  const rect = anchorEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spaceAbove = rect.top;
  const spaceBelow = vh - rect.bottom;
  const spaceRight = vw - rect.left;
  const vertical: 'top' | 'bottom' = spaceAbove >= previewHeight + 8 || spaceAbove > spaceBelow
    ? 'top'
    : 'bottom';
  const horizontal = spaceRight >= previewWidth ? '' : '-start';
  return `${vertical}${horizontal}` as PreviewPlacement;
}

/* ─── Variance Helper ──────────────────────────────────────────────── */

/** Compute variance of current report vs prior-period report */
function getVariance(
  current: RevenueReport[],
  prior: RevenueReport[],
): { pct: number | null; direction: 'up' | 'down' | 'flat' } {
  const curRev = current.reduce((s, r) => s + (r.grossRevenue ?? 0), 0);
  const priorRev = prior.reduce((s, r) => s + (r.grossRevenue ?? 0), 0);
  if (priorRev === 0 && curRev === 0) return { pct: null, direction: 'flat' };
  if (priorRev === 0) return { pct: null, direction: 'up' };
  const pct = ((curRev - priorRev) / priorRev) * 100;
  return {
    pct,
    direction: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat',
  };
}

/* ─── Spark Trend ──────────────────────────────────────────────────── */

/** Mini 5-point sparkline using an inline SVG path */
function SparkTrend({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 48;
  const h = 18;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      className="rc-preview-spark"
      focusable="false"
    >
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Day Cell Preview ─────────────────────────────────────────────── */

interface DayCellPreviewProps {
  cell: DayCellData;
  priorReports: RevenueReport[];
  locale: string;
  placement: PreviewPlacement;
  id: string;
}

const DayCellPreview: React.FC<DayCellPreviewProps> = ({
  cell,
  priorReports,
  locale,
  placement,
  id,
}) => {
  const reports = cell.reports;
  const totalRevenue = reports.reduce((s, r) => s + (r.grossRevenue ?? 0), 0);
  const currency = reports[0]?.currency ?? 'USD';
  const variance = getVariance(reports, priorReports);
  const primaryStatus = cell.primaryStatus;
  const statusColor = primaryStatus !== 'none' ? REPORT_STATUS_COLORS[primaryStatus] : undefined;
  const statusLabel = REPORT_STATUS_LABELS[primaryStatus];

  // Spark values: revenue of each report in the cell (padded to 5 points with prior)
  const sparkValues = [
    ...priorReports.map((r) => r.grossRevenue ?? 0),
    ...reports.map((r) => r.grossRevenue ?? 0),
  ].slice(-5);

  const hasRevenue = reports.some((r) => r.grossRevenue !== undefined);

  const VarianceIcon =
    variance.direction === 'up' ? TrendingUp
    : variance.direction === 'down' ? TrendingDown
    : Minus;

  const varianceClass =
    variance.direction === 'up' ? 'rc-preview-variance--up'
    : variance.direction === 'down' ? 'rc-preview-variance--down'
    : 'rc-preview-variance--flat';

  return (
    <div
      id={id}
      role="tooltip"
      className={`rc-day-preview rc-day-preview--${placement}`}
      aria-live="polite"
    >
      {/* Header row: date + status pill */}
      <div className="rc-preview-header">
        <span className="rc-preview-date">
          {formatDate(cell.date, locale as SupportedLocale, {
            month: 'short',
            day: 'numeric',
          })}
        </span>
        {primaryStatus !== 'none' && (
          <span
            className="rc-preview-status-pill"
            style={{ color: statusColor, borderColor: statusColor }}
          >
            {statusLabel}
          </span>
        )}
      </div>

      {/* KPI row */}
      <div className="rc-preview-kpis">
        {/* KPI 1: Revenue */}
        <div className="rc-preview-kpi">
          <span className="rc-preview-kpi-label">Revenue</span>
          <span className="rc-preview-kpi-value">
            {hasRevenue
              ? formatCurrency(totalRevenue, currency, locale as SupportedLocale)
              : '—'}
          </span>
        </div>

        {/* KPI 2: Payout status */}
        <div className="rc-preview-kpi">
          <span className="rc-preview-kpi-label">Reports</span>
          <span className="rc-preview-kpi-value">
            {reports.length > 0 ? reports.length : '0'}
          </span>
        </div>

        {/* KPI 3: Variance vs prior period */}
        <div className={`rc-preview-kpi rc-preview-variance ${varianceClass}`}>
          <span className="rc-preview-kpi-label">vs Prior</span>
          <span className="rc-preview-kpi-value rc-preview-variance-value">
            <VarianceIcon size={11} aria-hidden="true" />
            {variance.pct !== null
              ? `${variance.pct > 0 ? '+' : ''}${variance.pct.toFixed(1)}%`
              : '—'}
          </span>
        </div>
      </div>

      {/* Spark trend (hidden if only 1 data point or no revenue) */}
      {sparkValues.length >= 2 && hasRevenue && (
        <div className="rc-preview-spark-row">
          <SparkTrend values={sparkValues} />
          <span className="rc-preview-spark-label">trend</span>
        </div>
      )}

      {/* Arrow caret */}
      <span className="rc-preview-arrow" aria-hidden="true" />
    </div>
  );
};

/* ─── Calendar Day Cell ────────────────────────────────────────────── */

interface CalendarDayCellProps {
  cell: DayCellData;
  isFocused: boolean;
  weekStartsOn: number;
  onSelect: (date: string, e: MouseEvent | KeyboardEvent) => void;
  onFocus: (date: string) => void;
  locale: string;
  /** Reports from the prior period (same day prev month) for variance KPI */
  priorReports: RevenueReport[];
}

const CalendarDayCell: React.FC<CalendarDayCellProps> = ({
  cell,
  isFocused,
  weekStartsOn,
  onSelect,
  onFocus,
  locale,
  priorReports,
}) => {
  const reducedMotion = usePrefersReducedMotion();
  const { visible, open, close, closeImmediate } = usePreviewTimer(reducedMotion);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<PreviewPlacement>('top');

  const previewId = `rc-preview-${cell.date}`;

  const handleOpen = useCallback(() => {
    setPlacement(getPreviewPlacement(anchorRef.current));
    open();
  }, [open]);

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    closeImmediate();
    onSelect(cell.date, e);
  };
  const handleFocus = () => {
    onFocus(cell.date);
    handleOpen();
  };
  const handleBlur = () => close();
  const handleMouseEnter = () => handleOpen();
  const handleMouseLeave = () => close();

  // Dismiss on Escape
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      closeImmediate();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      closeImmediate();
      onSelect(cell.date, e);
    }
  };

  const statusLabel = REPORT_STATUS_LABELS[cell.primaryStatus];
  const dateFormatted = formatDate(cell.date, locale as SupportedLocale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const overdueReport = cell.primaryStatus === 'overdue'
    ? cell.reports.find((r) => r.status === 'overdue')
    : undefined;
  const overdueDays = overdueReport ? getOverdueDays(overdueReport.dueDate) : 0;
  const overdueSeverity = overdueReport ? getOverdueSeverity(overdueDays) : null;
  const severityLabel = overdueSeverity ? OVERDUE_SEVERITY_LABELS[overdueSeverity] : '';

  const ariaLabel = [
    `${dateFormatted}.`,
    cell.primaryStatus === 'overdue'
      ? `Report overdue. ${severityLabel}. ${overdueDays} day${overdueDays !== 1 ? 's' : ''} overdue.`
      : `${statusLabel}.`,
    cell.reports.length > 1 ? `${cell.reports.length} reports.` : '',
    cell.isSelected ? 'Selected.' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const cellClass = [
    "rc-day-cell",
    !cell.inMonth && "rc-day-cell--outside",
    cell.isToday && "rc-day-cell--today",
    cell.isSelected && "rc-day-cell--selected",
    cell.isRangeStart && "rc-day-cell--range-start",
    cell.isRangeEnd && "rc-day-cell--range-end",
    cell.isInRange && "rc-day-cell--in-range",
    cell.primaryStatus !== "none" && `rc-day-cell--${cell.primaryStatus}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={anchorRef}
      role="gridcell"
      className={cellClass}
      tabIndex={isFocused ? 0 : -1}
      aria-selected={cell.isSelected}
      aria-label={ariaLabel}
      aria-describedby={visible && cell.reports.length > 0 ? previewId : undefined}
      onClick={handleClick}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      data-date={cell.date}
      style={{ position: 'relative' }}
    >
      <span className="rc-day-number">{cell.day}</span>
      <StatusDot status={cell.primaryStatus} />
      {cell.primaryStatus === 'overdue' && overdueReport && (
        <OverdueBadge dueDate={overdueReport.dueDate} />
      )}
      {cell.reports.length > 1 && (
        <span className="rc-day-count" aria-hidden="true">
          {cell.reports.length}
        </span>
      )}

      {/* Hover / focus preview — only rendered when there are reports */}
      {visible && cell.reports.length > 0 && (
        <DayCellPreview
          id={previewId}
          cell={cell}
          priorReports={priorReports}
          locale={locale}
          placement={placement}
        />
      )}
    </div>
  );
};

/* ─── Calendar Grid (WAI-ARIA Grid) ────────────────────────────────── */

interface CalendarGridComponentProps {
  days: DayCellData[];
  selectedDates: string[];
  focusedDate: string | undefined;
  weekStartsOn: number;
  onDateSelect: (date: string, e: MouseEvent | KeyboardEvent) => void;
  onFocusDate: (date: string) => void;
  locale: string;
  ariaLabel: string;
  /** All reports — used to look up prior-period data for hover previews */
  allReports: RevenueReport[];
}

const CalendarGridComponent: React.FC<CalendarGridComponentProps> = ({
  days,
  selectedDates,
  focusedDate,
  weekStartsOn,
  onDateSelect,
  onFocusDate,
  locale,
  ariaLabel,
  allReports,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const dayNames = useMemo(() => {
    const names: string[] = [];
    for (let i = 0; i < 7; i++) {
      const day = (weekStartsOn + i) % 7;
      const date = new Date(2024, 0, day + 7); // Use a known Sunday
      names.push(
        date.toLocaleDateString(locale as SupportedLocale, {
          weekday: "short",
        }),
      );
    }
    return names;
  }, [weekStartsOn, locale]);

  // Group days into rows of 7
  const rows: DayCellData[][] = useMemo(() => {
    const result: DayCellData[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  // Roving tabindex: only the focused/selected day is tabbable
  const getTabIndex = useCallback(
    (cell: DayCellData) => {
      if (cell.date === focusedDate || selectedDates.includes(cell.date)) return 0;
      return -1;
    },
    [focusedDate, selectedDates],
  );

  // Focus the active cell when focusedDate changes
  useEffect(() => {
    if (focusedDate && gridRef.current) {
      const activeCell = gridRef.current.querySelector(
        `[data-date="${focusedDate}"]`,
      ) as HTMLElement | null;
      if (activeCell) {
        activeCell.focus({ preventScroll: true });
      }
    }
  }, [focusedDate]);

  const handleGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!focusedDate) return;
    const currentIndex = days.findIndex((d) => d.date === focusedDate);
    if (currentIndex === -1) return;

    let newIndex = currentIndex;
    const cols = 7;

    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        newIndex = Math.min(currentIndex + 1, days.length - 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        newIndex = Math.max(currentIndex - 1, 0);
        break;
      case "ArrowDown":
        e.preventDefault();
        newIndex = Math.min(currentIndex + cols, days.length - 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        newIndex = Math.max(currentIndex - cols, 0);
        break;
      case 'Home': {
        e.preventDefault();
        // Move to first day of current week row
        const rowStart = Math.floor(currentIndex / cols) * cols;
        newIndex = rowStart;
        break;
      }
      case 'End': {
        e.preventDefault();
        // Move to last day of current week row
        const rowEnd = Math.min(
          Math.floor(currentIndex / cols) * cols + cols - 1,
          days.length - 1,
        );
        newIndex = rowEnd;
        break;
      }
      case 'PageUp': {
        e.preventDefault();
        // Move to same day in previous month
        const currentDay = days[currentIndex].day;
        const currentMonth = parseISODate(days[currentIndex].date).month;
        const currentYear = parseISODate(days[currentIndex].date).year;
        let prevMonth = currentMonth - 1;
        let prevYear = currentYear;
        if (prevMonth < 0) {
          prevMonth = 11;
          prevYear--;
        }
        const daysInPrev = getDaysInMonth(prevYear, prevMonth);
        const targetDay = Math.min(currentDay, daysInPrev);
        const targetDate = toISODate(prevYear, prevMonth, targetDay);
        const targetIndex = days.findIndex((d) => d.date === targetDate);
        if (targetIndex !== -1) {
          newIndex = targetIndex;
        }
        break;
      }
      case "PageDown": {
        e.preventDefault();
        // Move to same day in next month
        const curDay = days[currentIndex].day;
        const curMonth = parseISODate(days[currentIndex].date).month;
        const curYear = parseISODate(days[currentIndex].date).year;
        let nextMonth = curMonth + 1;
        let nextYear = curYear;
        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear++;
        }
        const daysInNext = getDaysInMonth(nextYear, nextMonth);
        const tDay = Math.min(curDay, daysInNext);
        const tDate = toISODate(nextYear, nextMonth, tDay);
        const tIndex = days.findIndex((d) => d.date === tDate);
        if (tIndex !== -1) {
          newIndex = tIndex;
        }
        break;
      }
      default:
        return;
    }

    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < days.length) {
      onFocusDate(days[newIndex].date);
    }
  };

  return (
    <div
      ref={gridRef}
      className="rc-calendar-grid"
      role="grid"
      aria-label={ariaLabel}
      onKeyDown={handleGridKeyDown}
    >
      {/* Day name headers */}
      <div className="rc-grid-header" role="row">
        {dayNames.map((name, i) => (
          <div
            key={i}
            className="rc-grid-header-cell"
            role="columnheader"
            aria-hidden="true"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="rc-grid-row" role="row">
          {row.map((cell) => {
            // Prior period: same day number one month back
            const { year: cy, month: cm, day: cd } = parseISODate(cell.date);
            const priorMonth = cm === 0 ? 11 : cm - 1;
            const priorYear = cm === 0 ? cy - 1 : cy;
            const priorDate = toISODate(priorYear, priorMonth, cd);
            const priorReports = allReports.filter((r) => r.date === priorDate);
            return (
              <CalendarDayCell
                key={cell.date}
                cell={cell}
                isFocused={cell.date === focusedDate}
                weekStartsOn={weekStartsOn}
                onSelect={onDateSelect}
                onFocus={onFocusDate}
                locale={locale}
                priorReports={priorReports}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};

/* ─── Details Panel ────────────────────────────────────────────────── */

const DetailsPanel: React.FC<DetailsPanelProps> = ({
  selectedDate,
  reports,
  monthReports,
  viewMonth,
  locale,
  onSubmitReport,
  onReportAction,
  isOpen = true,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<"day" | "month">("day");

  const selectedReports = selectedDate
    ? reports.filter((r) => r.date === selectedDate)
    : [];

  const monthDueReports = monthReports.filter(
    (r) => r.status === "due" || r.status === "overdue",
  );
  const monthSubmittedReports = monthReports.filter(
    (r) => r.status === "submitted",
  );
  const monthAcceptedReports = monthReports.filter(
    (r) => r.status === "accepted",
  );

  const formatReportDate = (iso: string) =>
    formatDate(iso, locale as SupportedLocale, {
      month: "short",
      day: "numeric",
    });

  const formatDueDate = (iso: string) =>
    formatDate(iso, locale as SupportedLocale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const renderReportItem = (report: RevenueReport) => {
    const overdue = isOverdue(report);
    const displayStatus = overdue ? "overdue" : report.status;
    const statusColor = REPORT_STATUS_COLORS[displayStatus];
    const statusLabel = REPORT_STATUS_LABELS[displayStatus];

    return (
      <div key={report.id} className="rc-report-item">
        <div className="rc-report-item-header">
          <span
            className="rc-report-status-badge"
            style={{ backgroundColor: statusColor }}
            aria-label={statusLabel}
          />
          <span className="rc-report-status-label">{statusLabel}</span>
          <span className="rc-report-date">
            {formatReportDate(report.date)}
          </span>
        </div>
        <div className="rc-report-item-body">
          {report.grossRevenue !== undefined && (
            <p className="rc-report-revenue">
              {formatCurrency(
                report.grossRevenue,
                report.currency || "USD",
                locale as SupportedLocale,
              )}
            </p>
          )}
          {report.dueDate && (
            <p className="rc-report-due">
              <Clock size={12} aria-hidden="true" />
              Due: {formatDueDate(report.dueDate)}
            </p>
          )}
          {report.acceptedAt && (
            <p className="rc-report-accepted">
              <CheckCircle2 size={12} aria-hidden="true" />
              Accepted: {formatReportDate(report.acceptedAt)}
            </p>
          )}
          {report.notes && <p className="rc-report-notes">{report.notes}</p>}
        </div>
        <div className="rc-report-item-actions">
          {displayStatus === "due" && onSubmitReport && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onSubmitReport(report.date)}
              aria-label={`Submit report for ${formatReportDate(report.date)}`}
            >
              <Send size={14} aria-hidden="true" />
              Submit Report
            </Button>
          )}
          {displayStatus === "submitted" && (
            <span className="rc-report-awaiting">Awaiting review</span>
          )}
          {displayStatus === "accepted" && (
            <span className="rc-report-confirmed">Confirmed</span>
          )}
          {displayStatus === "overdue" && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onSubmitReport?.(report.date)}
              aria-label={`Submit overdue report for ${formatReportDate(report.date)}`}
            >
              <AlertTriangle size={14} aria-hidden="true" />
              Submit Now
            </Button>
          )}
        </div>
      </div>
    );
  };

  const [yearStr, monthLabel] = viewMonth.split("-");
  const monthName = new Date(
    Number(yearStr),
    Number(monthLabel) - 1,
  ).toLocaleDateString(locale as SupportedLocale, {
    month: "long",
    year: "numeric",
  });

  return (
    <aside
      className={`rc-details-panel ${isOpen ? "rc-details-panel--open" : "rc-details-panel--closed"}`}
      aria-label="Report details panel"
    >
      {/* Mobile close button */}
      {onClose && (
        <button
          type="button"
          className="rc-details-close"
          onClick={onClose}
          aria-label="Close details panel"
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}

      <div className="rc-details-header">
        <Calendar size={18} aria-hidden="true" />
        <h2 className="rc-details-title">{monthName}</h2>
      </div>

      {/* View mode toggle */}
      <div className="rc-details-toggle" role="tablist" aria-label="View mode">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === "day"}
          className={`rc-details-tab ${viewMode === "day" ? "rc-details-tab--active" : ""}`}
          onClick={() => setViewMode("day")}
        >
          Day
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === "month"}
          className={`rc-details-tab ${viewMode === "month" ? "rc-details-tab--active" : ""}`}
          onClick={() => setViewMode("month")}
        >
          Month
        </button>
      </div>

      {viewMode === "day" ? (
        <div className="rc-details-content" role="tabpanel">
          {selectedDate ? (
            <>
              <h3 className="rc-details-day-title">
                {formatDate(selectedDate, locale as SupportedLocale, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h3>

              {selectedReports.length === 0 ? (
                <div className="rc-details-empty">
                  <p className="rc-details-empty-text">
                    No reports for this date.
                  </p>
                  {onSubmitReport && (
                    <Button
                      variant="primary"
                      onClick={() => onSubmitReport(selectedDate)}
                      className="rc-submit-cta"
                    >
                      <Send size={16} aria-hidden="true" />
                      Submit Report
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rc-details-reports">
                  {selectedReports.map(renderReportItem)}
                </div>
              )}
            </>
          ) : (
            <div className="rc-details-empty">
              <p className="rc-details-empty-text">
                Select a date to view report details.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="rc-details-content" role="tabpanel">
          {/* Month summary */}
          <div className="rc-month-summary">
            <div className="rc-month-stat">
              <span className="rc-month-stat-value">
                {monthDueReports.length}
              </span>
              <span className="rc-month-stat-label">Due / Overdue</span>
            </div>
            <div className="rc-month-stat">
              <span className="rc-month-stat-value">
                {monthSubmittedReports.length}
              </span>
              <span className="rc-month-stat-label">Submitted</span>
            </div>
            <div className="rc-month-stat">
              <span className="rc-month-stat-value">
                {monthAcceptedReports.length}
              </span>
              <span className="rc-month-stat-label">Accepted</span>
            </div>
          </div>

          {/* Quick submit CTA for month */}
          {monthDueReports.length > 0 && onSubmitReport && (
            <Button
              variant="primary"
              className="rc-submit-cta rc-submit-cta--month"
              onClick={() => {
                // Submit for the first due/overdue report
                const firstDue = monthDueReports[0];
                if (firstDue) onSubmitReport(firstDue.date);
              }}
            >
              <Send size={16} aria-hidden="true" />
              Submit {monthDueReports.length} Pending Report
              {monthDueReports.length > 1 ? "s" : ""}
            </Button>
          )}

          {/* Month report list */}
          {monthReports.length === 0 ? (
            <p className="rc-details-empty-text">
              No reports scheduled for this month.
            </p>
          ) : (
            <div className="rc-month-reports">
              {monthReports.map(renderReportItem)}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

/* ─── Bulk Action Bar ──────────────────────────────────────────────── */

interface BulkActionBarProps {
  selectedDates: string[];
  reports: RevenueReport[];
  onClose: () => void;
  onExport: () => void;
  onNudge: () => void;
}

const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedDates,
  reports,
  onClose,
  onExport,
  onNudge,
}) => {
  if (selectedDates.length <= 1) return null;

  const selectedReports = reports.filter(r => selectedDates.includes(r.date));
  const canNudge = selectedReports.some(r => r.status === 'due' || r.status === 'overdue');

  return (
    <div className="rc-bulk-action-bar" role="toolbar" aria-label="Bulk actions">
      <div className="rc-bulk-info">
        <span className="rc-bulk-count">{selectedDates.length} period{selectedDates.length > 1 ? 's' : ''} selected</span>
      </div>
      <div className="rc-bulk-actions">
        <Button variant="secondary" size="sm" onClick={onExport} aria-label="Export selected reports">
          <Download size={16} aria-hidden="true" /> Export
        </Button>
        <Button 
          variant="primary" 
          size="sm" 
          onClick={onNudge} 
          disabled={!canNudge}
          aria-label={canNudge ? "Nudge owners for due/overdue reports" : "No due/overdue reports to nudge"}
        >
          <Bell size={16} aria-hidden="true" /> Nudge Owners
        </Button>
        <button type="button" className="rc-bulk-close" onClick={onClose} aria-label="Clear selection">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

/* ─── Agenda View ─────────────────────────────────────────────────── */

interface AgendaViewProps {
  reports: import('./RevenueReportingCalendar.types').RevenueReport[];
  selectedDate: string | undefined;
  locale: string;
  onSelect: (date: string) => void;
  onSubmitReport?: (date: string) => void;
  viewMonth: string;
}

const AgendaView: React.FC<AgendaViewProps> = ({
  reports,
  selectedDate,
  locale,
  onSelect,
  onSubmitReport,
  viewMonth,
}) => {
  const monthReports = reports.filter((r) => r.date?.startsWith(viewMonth));
  if (monthReports.length === 0) {
    return (
      <div className="rc-agenda-empty" role="status" aria-live="polite">
        No reports for this month.
      </div>
    );
  }
  return (
    <ul className="rc-agenda-list" aria-label="Agenda view">
      {monthReports.map((report) => (
        <li key={report.id} className="rc-agenda-item">
          <button
            className={`rc-agenda-btn${selectedDate === report.date ? " rc-agenda-btn--selected" : ""}`}
            onClick={() => report.date && onSelect(report.date)}
            aria-pressed={selectedDate === report.date}
          >
            <span className="rc-agenda-date">{report.date}</span>
            <span className="rc-agenda-status">{report.status}</span>
          </button>
          {onSubmitReport && report.status === "due" && (
            <button
              className="rc-agenda-submit"
              onClick={() => report.date && onSubmitReport(report.date)}
            >
              Submit Report
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};

/* ─── Main Component ───────────────────────────────────────────────── */

export const RevenueReportingCalendar: React.FC<
  RevenueReportingCalendarProps
> = ({
  reports,
  selectedDate: controlledSelectedDate,
  selectedDates: controlledSelectedDates,
  viewMonth: controlledViewMonth,
  isLoading = false,
  error = null,
  locale = "en-US",
  weekStartsOn = 0, // Sunday by default
  onDateSelect,
  onDatesSelect,
  onMonthChange,
  onSubmitReport,
  onReportAction,
  className = "",
}) => {
  // Determine current month from reports or use today
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const [internalViewMonth, setInternalViewMonth] = useState(defaultMonth);
  
  // Initialize from controlled props, favoring the array prop if present
  const defaultSelectedDates = controlledSelectedDates 
    ? controlledSelectedDates 
    : controlledSelectedDate 
      ? [controlledSelectedDate] 
      : [];
      
  const [internalSelectedDates, setInternalSelectedDates] = useState<string[]>(defaultSelectedDates);
  const [lastSelectedDate, setLastSelectedDate] = useState<string | undefined>(
    defaultSelectedDates[defaultSelectedDates.length - 1]
  );
  const [focusedDate, setFocusedDate] = useState<string | undefined>(undefined);
  const [panelOpen, setPanelOpen] = useState(true);
  const [mobileView, setMobileView] = useState<"calendar" | "agenda">("agenda");
  const [showImportWizard, setShowImportWizard] = useState(false);

  const viewMonth = controlledViewMonth ?? internalViewMonth;
  const selectedDates = controlledSelectedDates ?? internalSelectedDates;
  
  // For backwards compatibility and single-date details panel
  const selectedDate = selectedDates.length === 1 ? selectedDates[0] : undefined;

  const [viewYear, viewMonthNum] = useMemo(() => {
    const [y, m] = viewMonth.split("-").map(Number);
    return [y, m - 1];
  }, [viewMonth]);

  // Build day cells
  const dayCells = useMemo(
    () =>
      buildDayCells(
        viewYear,
        viewMonthNum,
        reports,
        selectedDates,
        weekStartsOn,
      ),
    [viewYear, viewMonthNum, reports, selectedDates, weekStartsOn],
  );

  // Month reports
  const monthReports = useMemo(
    () => getMonthReports(reports, viewYear, viewMonthNum),
    [reports, viewYear, viewMonthNum],
  );

  // Navigation handlers
  const goToPrevMonth = useCallback(() => {
    let newMonth = viewMonthNum - 1;
    let newYear = viewYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    }
    const newMonthStr = `${newYear}-${String(newMonth + 1).padStart(2, "0")}`;
    setInternalViewMonth(newMonthStr);
    onMonthChange?.(newMonthStr);
  }, [viewMonthNum, viewYear, onMonthChange]);

  const goToNextMonth = useCallback(() => {
    let newMonth = viewMonthNum + 1;
    let newYear = viewYear;
    if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    const newMonthStr = `${newYear}-${String(newMonth + 1).padStart(2, "0")}`;
    setInternalViewMonth(newMonthStr);
    onMonthChange?.(newMonthStr);
  }, [viewMonthNum, viewYear, onMonthChange]);

  const handleDateSelect = useCallback(
    (date: string, e?: MouseEvent | KeyboardEvent) => {
      let newSelection: string[] = [];
      
      if (e?.shiftKey && lastSelectedDate) {
        // Range selection
        const start = new Date(lastSelectedDate).getTime();
        const end = new Date(date).getTime();
        const minDate = new Date(Math.min(start, end));
        const maxDate = new Date(Math.max(start, end));
        
        // Include all dates in the range
        const range: string[] = [];
        let curr = new Date(minDate);
        while (curr <= maxDate) {
          range.push(curr.toISOString().split('T')[0]);
          curr.setDate(curr.getDate() + 1);
        }
        
        // Merge with existing if ctrl/cmd is held, otherwise replace
        if (e.ctrlKey || e.metaKey) {
          newSelection = Array.from(new Set([...selectedDates, ...range]));
        } else {
          newSelection = range;
        }
      } else if (e?.ctrlKey || e?.metaKey) {
        // Toggle selection
        if (selectedDates.includes(date)) {
          newSelection = selectedDates.filter(d => d !== date);
        } else {
          newSelection = [...selectedDates, date];
        }
      } else {
        // Single selection
        newSelection = [date];
      }

      setInternalSelectedDates(newSelection);
      setLastSelectedDate(date);
      
      onDateSelect?.(date);
      onDatesSelect?.(newSelection);
      
      // Open panel on mobile when date is selected and it's a single selection
      if (newSelection.length === 1) {
        setPanelOpen(true);
      }
    },
    [onDateSelect, onDatesSelect, selectedDates, lastSelectedDate],
  );

  const handleFocusDate = useCallback((date: string) => {
    setFocusedDate(date);
  }, []);

  const handleSubmitReport = useCallback(
    (date: string) => {
      onSubmitReport?.(date);
    },
    [onSubmitReport],
  );

  const handleReportAction = useCallback(
    (reportId: string, action: string) => {
      onReportAction?.(reportId, action);
    },
    [onReportAction],
  );

  // Month label
  const monthName = new Date(viewYear, viewMonthNum).toLocaleDateString(
    locale as SupportedLocale,
    { month: "long", year: "numeric" },
  );

  // Loading state
  if (isLoading) {
    return (
      <div
        className={`rc-container ${className}`}
        aria-busy="true"
        aria-label="Loading calendar"
      >
        <div className="rc-loading">
          <div className="rc-loading-spinner" aria-hidden="true" />
          <p className="rc-loading-text">Loading reports…</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`rc-container ${className}`} role="alert">
        <div className="rc-error">
          <AlertTriangle size={24} aria-hidden="true" />
          <p className="rc-error-text">{error}</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rc-container ${className}`}>
      {/* Mobile panel toggle */}
      <button
        type="button"
        className="rc-mobile-toggle"
        onClick={() => setPanelOpen((prev) => !prev)}
        aria-expanded={panelOpen}
        aria-controls="rc-details-panel"
        aria-label={panelOpen ? "Hide details panel" : "Show details panel"}
      >
        <Menu size={18} aria-hidden="true" />
        {panelOpen ? "Hide Details" : "Show Details"}
      </button>

      <div className="rc-layout">
        {/* Calendar section */}
        <section
          className="rc-calendar-section"
          aria-label="Revenue reporting calendar"
        >
          {/* Month navigation */}
          <div className="rc-month-nav">
            <button
              type="button"
              className="rc-nav-btn"
              onClick={goToPrevMonth}
              aria-label={`Previous month: ${new Date(viewYear, viewMonthNum - 1).toLocaleDateString(locale as SupportedLocale, { month: "long", year: "numeric" })}`}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <h2 className="rc-month-title">{monthName}</h2>
            <button
              type="button"
              className="rc-nav-btn"
              onClick={goToNextMonth}
              aria-label={`Next month: ${new Date(viewYear, viewMonthNum + 1).toLocaleDateString(locale as SupportedLocale, { month: "long", year: "numeric" })}`}
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>
          
          <div className="rc-actions" style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 var(--spacing-6) var(--spacing-4)' }}>
            <Button variant="secondary" onClick={() => setShowImportWizard(true)} aria-label="Import historical revenue from CSV">
              <Upload size={16} aria-hidden="true" />
              Import CSV
            </Button>
          </div>

          {/* Mobile view toggle (calendar/agenda */}
          <div
            className="rc-view-toggle"
            role="tablist"
            aria-label="Calendar view mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mobileView === "calendar"}
              className={`rc-view-toggle-btn ${mobileView === "calendar" ? "rc-view-toggle-btn--active" : ""}`}
              onClick={() => setMobileView("calendar")}
              aria-label="Calendar view"
            >
              <Calendar size={16} aria-hidden="true" />
              <span>Calendar</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileView === "agenda"}
              className={`rc-view-toggle-btn ${mobileView === "agenda" ? "rc-view-toggle-btn--active" : ""}`}
              onClick={() => setMobileView("agenda")}
              aria-label="Agenda view"
            >
              <List size={16} aria-hidden="true" />
              <span>Agenda</span>
            </button>
          </div>

          {/* Legend */}
          <div
            className={`rc-legend ${mobileView === "agenda" ? "rc-legend--hidden-on-agenda" : ""}`}
            aria-label="Status legend"
          >
            <span className="rc-legend-item">
              <span
                className="rc-legend-dot"
                style={{ backgroundColor: "var(--rc-status-due)" }}
                aria-hidden="true"
              />
              Due
            </span>
            <span className="rc-legend-item">
              <span
                className="rc-legend-dot"
                style={{ backgroundColor: "var(--rc-status-submitted)" }}
                aria-hidden="true"
              />
              Submitted
            </span>
            <span className="rc-legend-item">
              <span
                className="rc-legend-dot"
                style={{ backgroundColor: "var(--rc-status-accepted)" }}
                aria-hidden="true"
              />
              Accepted
            </span>
            <span className="rc-legend-item">
              <span className="rc-legend-dot" style={{ backgroundColor: 'var(--rc-overdue-mild)' }} aria-hidden="true" />
              Overdue (1–3 days)
            </span>
            <span className="rc-legend-item">
              <span className="rc-legend-dot" style={{ backgroundColor: 'var(--rc-overdue-moderate)' }} aria-hidden="true" />
              Overdue (4–29 days)
            </span>
            <span className="rc-legend-item">
              <span className="rc-legend-dot" style={{ backgroundColor: 'var(--rc-overdue-critical)' }} aria-hidden="true" />
              Overdue (30+ days)
            </span>
          </div>

          {/* Calendar grid (shown on desktop, or when mobile view is calendar */}
          <div
            className={`rc-calendar-wrapper ${mobileView === "agenda" ? "rc-calendar-wrapper--hidden-on-agenda" : ""}`}
          >
            <CalendarGridComponent
              days={dayCells}
              selectedDates={selectedDates}
              focusedDate={focusedDate}
              weekStartsOn={weekStartsOn}
              onDateSelect={handleDateSelect}
              onFocusDate={handleFocusDate}
              locale={locale}
              allReports={reports}
              ariaLabel={`Revenue reporting calendar for ${monthName}. Use arrow keys to navigate, Home and End for row edges, Page Up and Page Down for month navigation, Enter or Space to select.`}
            />
          </div>

          {/* Agenda view (shown when mobile view is agenda) */}
          <div
            className={`rc-agenda-wrapper ${mobileView === "calendar" ? "rc-agenda-wrapper--hidden-on-calendar" : ""}`}
          >
            <AgendaView
              reports={reports}
              selectedDate={selectedDate}
              locale={locale}
              onSelect={handleDateSelect}
              onSubmitReport={handleSubmitReport}
              viewMonth={viewMonth}
            />
          </div>
        </section>

        {/* Details panel */}
        <div id="rc-details-panel" className="rc-details-wrapper">
          <DetailsPanel
            selectedDate={selectedDate}
            reports={reports}
            monthReports={monthReports}
            viewMonth={viewMonth}
            locale={locale}
            onSubmitReport={handleSubmitReport}
            onReportAction={handleReportAction}
            isOpen={panelOpen}
            onClose={() => setPanelOpen(false)}
          />
        </div>
      </div>
      
      {/* Import Wizard Modal */}
      {showImportWizard && (
        <div className="rc-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'var(--color-overlay, rgba(0, 0, 0, 0.5))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: 'var(--spacing-4)'
        }}>
          <RevenueCalendarCsvImport 
            onCancel={() => setShowImportWizard(false)}
            onImport={(rows) => {
              console.log('Imported rows:', rows);
              setShowImportWizard(false);
              // Handle import logic here
            }}
          />
        </div>
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedDates={selectedDates}
        reports={reports}
        onClose={() => {
          setInternalSelectedDates([]);
          setLastSelectedDate(undefined);
          onDatesSelect?.([]);
        }}
        onExport={() => {
          console.log('Export selected:', selectedDates);
          // Trigger actual export
        }}
        onNudge={() => {
          console.log('Nudging owners for:', selectedDates);
          // Trigger actual nudge
        }}
      />
    </div>
  );
};

export default RevenueReportingCalendar;
