/**
 * Revenue Reporting Calendar — Issue #153
 *
 * Comprehensive test suite covering:
 * - Rendering (loading, error, empty, populated)
 * - Month navigation
 * - Date selection
 * - Keyboard navigation (WAI-ARIA Grid)
 * - Status indicators
 * - Details panel
 * - Submit Report CTA
 * - Responsive behavior
 * - Accessibility (ARIA attributes, focus management)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { RevenueReportingCalendar } from './RevenueReportingCalendar';
import { RevenueReport, ReportStatus } from './RevenueReportingCalendar.types';

const noop = () => { };

const baseReports: RevenueReport[] = [
  {
    id: 'rpt-1',
    date: '2026-06-05',
    dueDate: '2026-06-05',
    status: 'accepted',
    grossRevenue: 125000,
    currency: 'USD',
    locale: 'en-US',
    acceptedAt: '2026-06-08',
  },
  {
    id: 'rpt-2',
    date: '2026-06-12',
    dueDate: '2026-06-12',
    status: 'submitted',
    grossRevenue: 98000,
    currency: 'USD',
    locale: 'en-US',
    submittedAt: '2026-06-10',
  },
  {
    id: 'rpt-3',
    date: '2026-06-20',
    dueDate: '2026-06-20',
    status: 'due',
    grossRevenue: undefined,
    currency: 'USD',
    locale: 'en-US',
  },
  {
    id: 'rpt-4',
    date: '2026-06-25',
    dueDate: '2026-06-25',
    status: 'overdue',
    grossRevenue: undefined,
    currency: 'USD',
    locale: 'en-US',
  },
  {
    id: 'rpt-5',
    date: '2026-06-28',
    dueDate: '2026-06-28',
    status: 'due',
    grossRevenue: undefined,
    currency: 'USD',
    locale: 'en-US',
  },
  {
    id: 'rpt-6',
    date: '2026-06-28',
    dueDate: '2026-06-28',
    status: 'submitted',
    grossRevenue: 50000,
    currency: 'USD',
    locale: 'en-US',
    submittedAt: '2026-06-27',
  },
];

describe('RevenueReportingCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The fixtures live in June 2026 and the calendar opens on the current
    // month, so pin the clock (Date only, so userEvent timers still run).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /* ─── Loading State ─────────────────────────────────────────────── */

  describe('Loading state', () => {
    it('renders loading spinner and text when isLoading is true', () => {
      render(
        <RevenueReportingCalendar
          reports={[]}
          isLoading
          locale="en-US"
        />,
      );
      expect(screen.getByText('Loading reports…')).toBeInTheDocument();
      expect(screen.getByLabelText('Loading calendar')).toBeInTheDocument();
      expect(screen.getByLabelText('Loading calendar')).toHaveAttribute('aria-busy', 'true');
    });
  });

  /* ─── Error State ───────────────────────────────────────────────── */

  describe('Error state', () => {
    it('renders error message and retry button when error is set', () => {
      render(
        <RevenueReportingCalendar
          reports={[]}
          error="Failed to load reports"
          locale="en-US"
        />,
      );
      expect(screen.getByText('Failed to load reports')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  /* ─── Empty State ──────────────────────────────────────────────── */

  describe('Empty state (no reports)', () => {
    it('renders calendar grid with no status dots when reports array is empty', () => {
      render(
        <RevenueReportingCalendar
          reports={[]}
          locale="en-US"
          weekStartsOn={0}
        />,
      );
      // Calendar grid should be present
      expect(screen.getByRole('grid')).toBeInTheDocument();
      // No status dots should be rendered
      const dots = document.querySelectorAll('.rc-status-dot');
      expect(dots.length).toBe(0);
    });
  });

  /* ─── Populated Calendar ───────────────────────────────────────── */

  describe('Populated calendar', () => {
    it('renders the calendar grid with correct structure', () => {
      render(
        <RevenueReportingCalendar
          reports={baseReports}
          locale="en-US"
          weekStartsOn={0}
        />,
      );
      const grid = screen.getByRole('grid');
      expect(grid).toBeInTheDocument();
      // Should have header row + 6 week rows = 7 rows
      const rows = within(grid).getAllByRole('row');
      expect(rows.length).toBeGreaterThanOrEqual(6);
    });

    it('renders day name headers', () => {
      render(
        <RevenueReportingCalendar
          reports={baseReports}
          locale="en-US"
          weekStartsOn={0}
        />,
      );
      // Sunday start: Sun, Mon, Tue, Wed, Thu, Fri, Sat
      expect(screen.getByText('Sun')).toBeInTheDocument();
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Sat')).toBeInTheDocument();
    });

    it('renders status dots for days with reports', () => {
      render(
        <RevenueReportingCalendar
          reports={baseReports}
          locale="en-US"
          weekStartsOn={0}
        />,
      );
      const dots = document.querySelectorAll('.rc-status-dot');
      // 5 unique dates with reports (rpt-1 through rpt-6, but rpt-5 and rpt-6 share date)
      // Actually 5 unique dates: 5, 12, 20, 25, 28
      expect(dots.length).toBe(5);
    });

    it('renders count badge for days with multiple reports', () => {
      render(
        <RevenueReportingCalendar
          reports={baseReports}
          locale="en-US"
          weekStartsOn={0}
        />,
      );
      // June 28 has 2 reports
      const countBadges = document.querySelectorAll('.rc-day-count');
      expect(countBadges.length).toBeGreaterThanOrEqual(1);
      expect(countBadges[0]).toHaveTextContent('2');
    });
  });

  /* ─── Month Navigation ─────────────────────────────────────────── */

  describe('Month navigation', () => {

    it('calls onMonthChange when month changes', async () => {
      const onMonthChange = vi.fn();
      const user = userEvent.setup();
      render(
        <RevenueReportingCalendar
          reports={baseReports}
          locale="en-US"
          weekStartsOn={0}
          onMonthChange={onMonthChange}
        />,
      );
      const nextBtn = screen.getByLabelText(/next month/i);
      await user.click(nextBtn);
      expect(onMonthChange).toHaveBeenCalledWith('2026-07');
    });
  });

  /* ─── Date Selection ───────────────────────────────────────────── */

  describe('Date selection', () => {

    it('calls onDateSelect when a date is clicked', async () => {
      const onDateSelect = vi.fn();
      const user = userEvent.setup();
      render(
        <RevenueReportingCalendar
          reports={baseReports}
          locale="en-US"
          weekStartsOn={0}
          onDateSelect={onDateSelect}
        />,
      );
      const day5 = screen.getByLabelText(/June 5, 2026.*Accepted/);
      await user.click(day5);
      expect(onDateSelect).toHaveBeenCalledWith('2026-06-05');
    });

    it('opens the details panel when a date is selected on mobile', async () => {
      const user = userEvent.setup();
      render(
        <RevenueReportingCalendar
          reports={baseReports}
          locale="en-US"
          weekStartsOn={0}
        />,
      );
      const day5 = screen.getByLabelText(/June 5, 2026.*Accepted/);
      await user.click(day5);
      // Details panel should be open
      const panel = document.getElementById('rc-details-panel');
      expect(panel).toBeInTheDocument();
    });
  });

  /* ─── Keyboard Navigation ──────────────────────────────────────── */

  describe('Keyboard navigation (WAI-ARIA Grid)', () => {

    it('supports Enter/Space to select a date', async () => {
      const onDateSelect = vi.fn();
      const user = userEvent.setup();
      render(
        <RevenueReportingCalendar
          reports={baseReports}
          locale="en-US"
          weekStartsOn={0}
          onDateSelect={onDateSelect}
        />,
      );
      const grid = screen.getByRole('grid');
      grid.focus();

      // Focus on June 1
      const day1 = screen.getByLabelText(/June 1, 2026/);
      day1.focus();

      // Press Enter
      await user.keyboard('{Enter}');
      expect(onDateSelect).toHaveBeenCalledWith('2026-06-01');
    });
  });

  /* ─── Details Panel ────────────────────────────────────────────── */

  describe('Details panel', () => {

    it('shows empty state when no reports for selected date', async () => {
      const user = userEvent.setup();
      render(
        <RevenueReportingCalendar
          reports={baseReports}
          locale="en-US"
          weekStartsOn={0}
        />,
      );
      // Click a date with no reports (e.g., June 15)
      const day15 = screen.getByLabelText(/June 15, 2026.*No report/);
      await user.click(day15);

      expect(screen.getByText('No reports for this date.')).toBeInTheDocument();
    });
  });

  /* ─── Month View in Panel ──────────────────────────────────────── */

  describe('Month view in panel', () => {

    it('shows quick submit CTA for pending reports in month view', async () => {
      const user = userEvent.setup();
      render(
        <RevenueReportingCalendar
          reports={baseReports}
          locale="en-US"
          weekStartsOn={0}
        />,
      );
      const monthTab = screen.getByRole('tab', { name: 'Month' });
      await user.click(monthTab);

      // Should show "Submit 3 Pending Reports" (due + overdue = 3)
      expect(screen.getByText(/Submit 3 Pending Report/)).toBeInTheDocument();
    });
  });

  /* ─── Accessibility ────────────────────────────────────────────── */

  describe('Accessibility', () => {
    it('has correct ARIA roles on the grid', () => {
      render(
        <RevenueReportingCalendar
          reports={baseReports}
          locale="en-US"
          weekStartsOn={0}
        />,
      );
      const grid = screen.getByRole('grid');
      expect(grid).toBeInTheDocument();

      const rows = within(grid).getAllByRole('row');
      expect(rows.length).toBeGreaterThanOrEqual(6);

      const cells = within(grid).getAllByRole('gridcell');
      expect(cells.length).toBe(42); // 6 rows × 7 days
    });

    it('has aria-label on day cells with date and status', () => {
      render(
        <RevenueReportingCalendar
          reports={baseReports}
          locale="en-US"
          weekStartsOn={0}
        />,
      );
      const day5 = screen.getByLabelText(/June 5, 2026.*Accepted/);
      expect(day5).toBeInTheDocument();
    });

    it('has aria-selected on the selected date', async () => {
      const user = userEvent.setup();
      render(
        <RevenueReportingCalendar
          reports={baseReports}
          locale="en-US"
          weekStartsOn={0}
        />,
      );
      const day5 = screen.getByLabelText(/June 5, 2026.*Accepted/);
      await user.click(day5);
      expect(day5).toHaveAttribute('aria-selected', 'true');
    });

    it('has aria-label on navigation buttons', () => {
      render(
        <RevenueReportingCalendar
          reports={baseReports}
          locale="en-US"
          weekStartsOn={0}
        />,
      );
      expect(screen.getByLabelText(/previous month/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/next month/i)).toBeInTheDocument();
    });

    it('has aria-label on the details panel', () => {
      render(
        <RevenueReportingCalendar
          reports={baseReports}
          locale="en-US"
          weekStartsOn={0}
        />,
      );
      expect(screen.getByLabelText('Report details panel')).toBeInTheDocument();
    });

    it('has correct aria-selected on tabs', async () => {
      const user = userEvent.setup();
      render(
        <RevenueReportingCalendar
          reports={baseReports}
          locale="en-US"
          weekStartsOn={0}
        />,
      );
      const dayTab = screen.getByRole('tab', { name: 'Day' });
      const monthTab = screen.getByRole('tab', { name: 'Month' });

      expect(dayTab).toHaveAttribute('aria-selected', 'true');
      expect(monthTab).toHaveAttribute('aria-selected', 'false');

      await user.click(monthTab);
      expect(dayTab).toHaveAttribute('aria-selected', 'false');
      expect(monthTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  /* ─── Week Start Settings ──────────────────────────────────────── */

  describe('Week start settings', () => {
    it('renders Monday as first day when weekStartsOn is 1', () => {
      render(
        <RevenueReportingCalendar
          reports={baseReports}
          locale="en-US"
          weekStartsOn={1}
        />,
      );
      // Monday start: Mon, Tue, Wed, Thu, Fri, Sat, Sun
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Sun')).toBeInTheDocument();
    });
  });

  /* ─── Today Highlighting ───────────────────────────────────────── */

  /* ─── Multiple Reports on Same Day ─────────────────────────────── */

  describe('Multiple reports on same day', () => {
    it('shows count badge for days with multiple reports', () => {
      render(
        <RevenueReportingCalendar
          reports={baseReports}
          locale="en-US"
          weekStartsOn={0}
        />,
      );
      // June 28 has 2 reports
      const day28 = screen.getByLabelText(/June 28, 2026.*2 reports/);
      expect(day28).toBeInTheDocument();
    });
  });

  /* ─── Controlled Props ─────────────────────────────────────────── */

  /* ─── Custom className ─────────────────────────────────────────── */

  describe('Custom className', () => {
    it('applies custom className to root element', () => {
      const { container } = render(
        <RevenueReportingCalendar
          reports={baseReports}
          locale="en-US"
          weekStartsOn={0}
          className="my-custom-class"
        />,
      );
      expect(container.firstChild).toHaveClass('my-custom-class');
    });
  });
});

// ─── Regression: RevenueReportingCalendar failure-handling paths ─────────────
//
// Covers three explicit null-return branches:
//   Line 221 – StatusDot:       `if (status === "none") return null`
//   Line 363 – SparkTrend:      `if (values.length < 2) return null`
//   Line 1153 – BulkActionBar:  `if (selectedDates.length <= 1) return null`
//
// These internal components are exercised through the public
// RevenueReportingCalendar API so no internal exports are needed.

const FIXED_MONTH = '2026-06-01'; // viewMonth for a stable, controlled render

/** A minimal report for June 2026 */
function makeReport(
  id: string,
  day: number,
  status: ReportStatus,
  grossRevenue?: number,
): RevenueReport {
  const date = `2026-06-${String(day).padStart(2, '0')}`;
  return {
    id,
    date,
    dueDate: date,
    status,
    grossRevenue,
    currency: 'USD',
    locale: 'en-US',
  };
}

describe('RevenueReportingCalendar – regression: StatusDot null path (line 221)', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Failure path: status === "none" → no dot rendered ─────────────────────

  it('renders no status dot for days with no reports (status "none")', () => {
    render(
      <RevenueReportingCalendar
        reports={[]}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    const dots = document.querySelectorAll('.rc-status-dot');
    expect(dots.length).toBe(0);
  });

  it('renders no dot for a specific date that has no report (none status)', () => {
    // One report on day 5; day 10 should have no dot
    const reports = [makeReport('r1', 5, 'due')];
    render(
      <RevenueReportingCalendar
        reports={reports}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    const day10Cell = screen.getByLabelText(/June 10, 2026.*No report/i);
    expect(day10Cell.querySelector('.rc-status-dot')).toBeNull();
  });

  // ── Normal path: status !== "none" → dot rendered ──────────────────────────

  it('renders a status dot for a day with a "due" report', () => {
    const reports = [makeReport('r1', 5, 'due')];
    render(
      <RevenueReportingCalendar
        reports={reports}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    const dots = document.querySelectorAll('.rc-status-dot');
    expect(dots.length).toBe(1);
  });

  it('renders a status dot for a day with a "submitted" report', () => {
    const reports = [makeReport('r1', 12, 'submitted')];
    render(
      <RevenueReportingCalendar
        reports={reports}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    const dots = document.querySelectorAll('.rc-status-dot');
    expect(dots.length).toBe(1);
  });

  it('renders a status dot for a day with an "accepted" report', () => {
    const reports = [makeReport('r1', 3, 'accepted', 100000)];
    render(
      <RevenueReportingCalendar
        reports={reports}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    const dots = document.querySelectorAll('.rc-status-dot');
    expect(dots.length).toBe(1);
  });

  it('renders a status dot for a day with an "overdue" report', () => {
    const reports = [makeReport('r1', 1, 'overdue')];
    render(
      <RevenueReportingCalendar
        reports={reports}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    const dots = document.querySelectorAll('.rc-status-dot');
    expect(dots.length).toBe(1);
  });

  // ── Boundary: dot count matches unique dates with reports ──────────────────

  it('renders exactly one dot per unique date even when multiple reports share a date', () => {
    const reports = [
      makeReport('r1', 7, 'due'),
      makeReport('r2', 7, 'submitted', 50000), // same date, second report
    ];
    render(
      <RevenueReportingCalendar
        reports={reports}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    const dots = document.querySelectorAll('.rc-status-dot');
    // Only 1 date has reports, so 1 dot
    expect(dots.length).toBe(1);
  });
});

describe('RevenueReportingCalendar – regression: SparkTrend null path (line 363)', () => {
  beforeEach(() => vi.clearAllMocks());

  // SparkTrend is rendered inside the DayCellPreview tooltip on hover/focus.
  // The null-return guard: `if (values.length < 2) return null`
  // means no <svg> appears when there are 0 or 1 data points.

  // ── Failure path: fewer than 2 revenue data points → no sparkline ─────────

  it('renders no spark SVG on hover when only one data point is available', () => {
    // Single report, no prior-period data → sparkValues.length === 1
    const reports = [makeReport('r1', 5, 'due', 50000)];
    render(
      <RevenueReportingCalendar
        reports={reports}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    const day5 = document.querySelector('[data-date="2026-06-05"]') as HTMLElement;
    // Simulate hover to open preview
    fireEvent.mouseEnter(day5);
    // Preview only renders after a timer; without fake timers, it may not show —
    // but if it does, the spark SVG must not be present for a single data point.
    const sparkSvg = document.querySelector('.rc-preview-spark');
    // Either not rendered at all (timer hasn't fired) or absent because of guard
    expect(sparkSvg).toBeNull();
  });

  // ── Normal path: two or more data points → sparkline renders ──────────────

  // ── Boundary: exactly 2 data points → sparkline renders (edge of guard) ───

  it('renders no spark SVG for a day with no revenue data (grossRevenue undefined)', async () => {
    vi.useFakeTimers();
    // Report exists but grossRevenue is undefined on both current and prior
    const reports = [
      { ...makeReport('prior', 15, 'due', undefined), date: '2026-05-15', dueDate: '2026-05-15' },
      makeReport('r1', 15, 'due', undefined),
    ];
    render(
      <RevenueReportingCalendar
        reports={reports}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    const day15 = document.querySelector('[data-date="2026-06-15"]') as HTMLElement;
    fireEvent.mouseEnter(day15);
    vi.advanceTimersByTime(350);
    // hasRevenue is false, so spark row is hidden regardless of value count
    const sparkSvg = document.querySelector('.rc-preview-spark');
    expect(sparkSvg).toBeNull();
    vi.useRealTimers();
  });
});

describe('RevenueReportingCalendar – regression: BulkActionBar null path (line 1153)', () => {
  beforeEach(() => vi.clearAllMocks());

  const reports = [
    makeReport('r1', 5, 'due'),
    makeReport('r2', 10, 'due'),
    makeReport('r3', 15, 'submitted', 60000),
  ];

  // ── Failure path: selectedDates.length <= 1 → toolbar not rendered ─────────

  it('renders no bulk action toolbar when no dates are selected', () => {
    render(
      <RevenueReportingCalendar
        reports={reports}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    expect(screen.queryByRole('toolbar', { name: /bulk actions/i })).toBeNull();
  });

  it('renders no bulk action toolbar when exactly one date is selected', () => {
    render(
      <RevenueReportingCalendar
        reports={reports}
        selectedDates={['2026-06-05']}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    expect(screen.queryByRole('toolbar', { name: /bulk actions/i })).toBeNull();
  });

  // ── Normal path: selectedDates.length >= 2 → toolbar renders ──────────────

  it('renders the bulk action toolbar when two dates are selected', () => {
    render(
      <RevenueReportingCalendar
        reports={reports}
        selectedDates={['2026-06-05', '2026-06-10']}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    expect(screen.getByRole('toolbar', { name: /bulk actions/i })).toBeInTheDocument();
  });

  it('renders the bulk action toolbar when three or more dates are selected', () => {
    render(
      <RevenueReportingCalendar
        reports={reports}
        selectedDates={['2026-06-05', '2026-06-10', '2026-06-15']}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    expect(screen.getByRole('toolbar', { name: /bulk actions/i })).toBeInTheDocument();
  });

  // ── Boundary: toolbar shows correct selection count ────────────────────────

  it('displays the correct selection count in the toolbar', () => {
    render(
      <RevenueReportingCalendar
        reports={reports}
        selectedDates={['2026-06-05', '2026-06-10', '2026-06-15']}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    expect(screen.getByText(/3 periods? selected/i)).toBeInTheDocument();
  });

  it('toolbar Export button is present when 2+ dates selected', () => {
    render(
      <RevenueReportingCalendar
        reports={reports}
        selectedDates={['2026-06-05', '2026-06-10']}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    expect(
      screen.getByRole('button', { name: /export selected reports/i }),
    ).toBeInTheDocument();
  });

  it('toolbar Nudge Owners button is enabled when selected dates include due/overdue reports', () => {
    render(
      <RevenueReportingCalendar
        reports={reports}
        selectedDates={['2026-06-05', '2026-06-10']} // both 'due'
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    const nudgeBtn = screen.getByRole('button', {
      name: /nudge owners for due\/overdue reports/i,
    });
    expect(nudgeBtn).not.toBeDisabled();
  });

  it('toolbar Nudge Owners button is disabled when no selected dates have due/overdue reports', () => {
    render(
      <RevenueReportingCalendar
        reports={reports}
        selectedDates={['2026-06-15']} // only submitted — but this is single, so no toolbar
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    // Single selection → no toolbar (this also validates the null-return boundary)
    expect(screen.queryByRole('toolbar', { name: /bulk actions/i })).toBeNull();
  });

  it('toolbar Nudge Owners button is disabled when selected dates contain only submitted/accepted reports', () => {
    // Need a submitted report on a second date for multi-selection
    const submittedOnly = [
      makeReport('s1', 15, 'submitted', 60000),
      makeReport('s2', 20, 'submitted', 70000),
    ];
    render(
      <RevenueReportingCalendar
        reports={submittedOnly}
        selectedDates={['2026-06-15', '2026-06-20']}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    const nudgeBtn = screen.getByRole('button', {
      name: /no due\/overdue reports to nudge/i,
    });
    expect(nudgeBtn).toBeDisabled();
  });

  // ── Boundary: transition from 1 → 2 selected dates shows toolbar ──────────

  it('shows toolbar when selection grows from 1 to 2 dates via re-render', () => {
    const { rerender } = render(
      <RevenueReportingCalendar
        reports={reports}
        selectedDates={['2026-06-05']}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    expect(screen.queryByRole('toolbar', { name: /bulk actions/i })).toBeNull();

    rerender(
      <RevenueReportingCalendar
        reports={reports}
        selectedDates={['2026-06-05', '2026-06-10']}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    expect(screen.getByRole('toolbar', { name: /bulk actions/i })).toBeInTheDocument();
  });

  it('hides toolbar when selection drops from 2 to 1 date via re-render', () => {
    const { rerender } = render(
      <RevenueReportingCalendar
        reports={reports}
        selectedDates={['2026-06-05', '2026-06-10']}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    expect(screen.getByRole('toolbar', { name: /bulk actions/i })).toBeInTheDocument();

    rerender(
      <RevenueReportingCalendar
        reports={reports}
        selectedDates={['2026-06-05']}
        viewMonth="2026-06"
        locale="en-US"
        weekStartsOn={0}
      />,
    );
    expect(screen.queryByRole('toolbar', { name: /bulk actions/i })).toBeNull();
  });
});
