/**
 * InvestorDiscovery.test.tsx
 * Issue #152 – Branded reusable empty-state system for all major investor views
 *
 * Coverage targets (≥95% on InvestorDiscovery.tsx):
 *   - EmptyState integration: filtered-empty, truly-empty, error states
 *   - InvestorDiscovery (integrated): loaded state, filtered-empty, truly-empty,
 *     error state, search wiring, filter toggle, clear interactions
 *   - ARIA: role/aria-live/aria-labelledby/aria-pressed semantics
 *   - Keyboard: focus on action buttons inside state views
 *   - Mobile layout: state containers render at narrow widths
 */

import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { InvestorDiscovery, PayoutSchedule, type Payout } from './InvestorDiscovery';

expect.extend(toHaveNoViolations);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const noop = () => {};

/** Mirror of MOCK_OFFERINGS in InvestorDiscovery.tsx for test assertions */
const MOCK_OFFERINGS = [
  { id: 1, name: 'TechFlow AI', category: 'Enterprise SaaS', revenueShare: 15, target: 250000, raised: 112500 },
  { id: 2, name: 'Quantum Ledger', category: 'DeFi Infrastructure', revenueShare: 12, target: 500000, raised: 140000 },
  { id: 3, name: 'Nexus Pay', category: 'Cross-Border Payments', revenueShare: 18, target: 300000, raised: 186000 },
];

/** Helper: renders InvestorDiscovery in loaded state without skeleton delay */
const renderLoaded = (extraProps: Record<string, unknown> = {}) =>
  render(
    <InvestorDiscovery
      __simulateState={{ kind: 'loaded', offerings: MOCK_OFFERINGS }}
      {...(extraProps as Parameters<typeof InvestorDiscovery>[0])}
    />,
  );

// ─────────────────────────────────────────────────────────────────────────────
// 1. EmptyState – filtered-empty variant (via InvestorDiscovery)
// ─────────────────────────────────────────────────────────────────────────────

describe('InvestorDiscovery – filtered-empty state', () => {
  it('renders the empty state container', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'filtered-empty', query: 'fintech', hasFilters: true }} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has aria-live="polite"', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'filtered-empty', query: 'fintech', hasFilters: true }} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('renders "No offerings match your search" heading', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'filtered-empty', query: 'fintech', hasFilters: true }} />);
    expect(screen.getByRole('heading', { level: 2, name: /No offerings match your search/i })).toBeInTheDocument();
  });

  it('displays the echoed search query when provided', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'filtered-empty', query: 'fintech', hasFilters: true }} />);
    expect(screen.getByText(/"fintech"/)).toBeInTheDocument();
  });

  it('renders fallback copy when query is absent but filters active', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'filtered-empty', query: '', hasFilters: true }} />);
    expect(screen.getByText(/matching the active filters/i)).toBeInTheDocument();
  });

  it('renders the Clear filters button', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'filtered-empty', query: 'fintech', hasFilters: true }} />);
    expect(screen.getByTestId('clear-filters-btn')).toBeInTheDocument();
  });

  it('Clear filters button has descriptive aria-label', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'filtered-empty', query: 'fintech', hasFilters: true }} />);
    const btn = screen.getByTestId('clear-filters-btn');
    expect(btn).toHaveAttribute('aria-label', 'Clear all search filters and show all offerings');
  });

  it('calls onClearFilters when Clear filters is clicked', async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(
      <InvestorDiscovery
        __simulateState={{ kind: 'filtered-empty', query: 'fintech', hasFilters: true }}
        __onClearFilters={spy}
      />,
    );
    await user.click(screen.getByTestId('clear-filters-btn'));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('Clear filters button is keyboard-focusable', async () => {
    const user = userEvent.setup();
    render(<InvestorDiscovery __simulateState={{ kind: 'filtered-empty', query: 'fintech', hasFilters: true }} />);
    await user.tab();
    expect(screen.getByTestId('clear-filters-btn')).toHaveFocus();
  });

  it('renders a decorative SVG illustration', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'filtered-empty', query: 'fintech', hasFilters: true }} />);
    const svg = document.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. EmptyState – truly-empty variant (via InvestorDiscovery)
// ─────────────────────────────────────────────────────────────────────────────

describe('InvestorDiscovery – truly-empty state', () => {
  it('renders "No offerings yet" heading', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'truly-empty' }} />);
    expect(screen.getByRole('heading', { level: 2, name: /No offerings yet/i })).toBeInTheDocument();
  });

  it('renders reassuring copy about future offerings', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'truly-empty' }} />);
    expect(screen.getByText(/Check back soon/i)).toBeInTheDocument();
  });

  it('renders "How it works" secondary CTA', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'truly-empty' }} />);
    expect(screen.getByRole('link', { name: /How it works/i })).toBeInTheDocument();
  });

  it('does NOT render a Clear filters button on truly-empty variant', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'truly-empty' }} />);
    expect(screen.queryByTestId('clear-filters-btn')).toBeNull();
  });

  it('renders a decorative SVG illustration', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'truly-empty' }} />);
    const svg = document.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. EmptyState – error variant (via InvestorDiscovery)
// ─────────────────────────────────────────────────────────────────────────────

describe('InvestorDiscovery – error state', () => {
  it('renders with role="status"', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'error', retryCount: 0 }} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has aria-live="polite"', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'error', retryCount: 0 }} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('renders "Couldn\'t load offerings" heading', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'error', retryCount: 0 }} />);
    expect(screen.getByRole('heading', { level: 2, name: /Couldn't load offerings/i })).toBeInTheDocument();
  });

  it('renders reassuring body copy', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'error', retryCount: 0 }} />);
    expect(screen.getByText(/Your portfolio and account are unaffected/i)).toBeInTheDocument();
  });

  it('renders Try again button', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'error', retryCount: 0 }} />);
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
  });

  it('Try again button has descriptive aria-label', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'error', retryCount: 0 }} />);
    expect(screen.getByRole('button', { name: /Retry loading offerings/i })).toBeInTheDocument();
  });

  it('calls onRetry when Try again is clicked', async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(
      <InvestorDiscovery
        __simulateState={{ kind: 'error', retryCount: 0 }}
        __onRetry={spy}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Try again/i }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('Try again button is keyboard-focusable', async () => {
    const user = userEvent.setup();
    render(<InvestorDiscovery __simulateState={{ kind: 'error', retryCount: 0 }} />);
    await user.tab();
    expect(screen.getByRole('button', { name: /Try again/i })).toHaveFocus();
  });

  it('does NOT render retry hint when retryCount=0', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'error', retryCount: 0 }} />);
    expect(screen.queryByText(/Retried/i)).toBeNull();
  });

  it('renders retry hint with singular "time" when retryCount=1', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'error', retryCount: 1 }} />);
    expect(screen.getByText(/Retried 1 time —/i)).toBeInTheDocument();
  });

  it('renders retry hint with plural "times" when retryCount=3', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'error', retryCount: 3 }} />);
    expect(screen.getByText(/Retried 3 times —/i)).toBeInTheDocument();
  });

  it('renders a decorative SVG illustration', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'error', retryCount: 0 }} />);
    const svg = document.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. InvestorDiscovery – loaded state (default)
// ─────────────────────────────────────────────────────────────────────────────

describe('InvestorDiscovery – loaded state', () => {
  it('renders the page heading', () => {
    renderLoaded();
    expect(screen.getByRole('heading', { level: 1, name: /Discover Offerings/i })).toBeInTheDocument();
  });

  it('renders all three mock offering cards', () => {
    renderLoaded();
    expect(screen.getByTestId('offering-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('offering-card-2')).toBeInTheDocument();
    expect(screen.getByTestId('offering-card-3')).toBeInTheDocument();
  });

  it('does NOT render empty or error state', () => {
    renderLoaded();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders the portfolio CTA section in loaded state', () => {
    renderLoaded();
    expect(screen.getByRole('heading', { level: 2, name: /Build Your Portfolio/i })).toBeInTheDocument();
  });

  it('has a search input with aria-label', () => {
    renderLoaded();
    expect(screen.getByRole('searchbox', { name: /Search startup offerings/i })).toBeInTheDocument();
  });

  // Issue #668 replaced the funding progress bars with AccessibleChart, which
  // exposes the raised/target figures through a labelled tabular fallback.
  it('each offering exposes its funding progress as an accessible table', () => {
    renderLoaded();
    MOCK_OFFERINGS.forEach((offering) => {
      const table = screen.getByRole('table', { name: `${offering.name} Funding Progress` });
      expect(within(table).getByText('Raised')).toBeInTheDocument();
      expect(within(table).getByText('Target')).toBeInTheDocument();
    });
  });

  it('filter toggle button has aria-pressed', () => {
    renderLoaded();
    expect(screen.getByTestId('filter-toggle-btn')).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. InvestorDiscovery – search filtering
// ─────────────────────────────────────────────────────────────────────────────

describe('InvestorDiscovery – search filtering', () => {
  it('filters offerings by name (case-insensitive)', async () => {
    renderLoaded();
    const search = screen.getByRole('searchbox', { name: /Search startup offerings/i });
    await userEvent.type(search, 'techflow');
    expect(screen.getByText('TechFlow AI')).toBeInTheDocument();
    expect(screen.queryByText('Nexus Pay')).toBeNull();
  });

  it('shows filtered-empty when search matches nothing', async () => {
    renderLoaded();
    const search = screen.getByRole('searchbox', { name: /Search startup offerings/i });
    await userEvent.type(search, 'zzzz-not-a-real-startup');
    expect(screen.getByRole('heading', { level: 2, name: /No offerings match your search/i })).toBeInTheDocument();
  });

  it('clear search button resets to loaded state', async () => {
    renderLoaded();
    const search = screen.getByRole('searchbox', { name: /Search startup offerings/i });
    await userEvent.type(search, 'zzzz');
    expect(screen.getByRole('heading', { level: 2, name: /No offerings match your search/i })).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('clear-search-btn'));
    expect(screen.getByText('TechFlow AI')).toBeInTheDocument();
  });

  it('clear filters resets filtered-empty to loaded', async () => {
    render(
      <InvestorDiscovery
        __simulateState={{ kind: 'filtered-empty', query: 'fintech', hasFilters: true }}
        __onClearFilters={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: /No offerings match your search/i })).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('clear-filters-btn'));
    // After clearing, should show loaded state with mock data
    expect(screen.getByText('TechFlow AI')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. InvestorDiscovery – filter toggle
// ─────────────────────────────────────────────────────────────────────────────

describe('InvestorDiscovery – filter toggle', () => {
  it('filter button toggles aria-pressed', async () => {
    renderLoaded();
    const btn = screen.getByTestId('filter-toggle-btn');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows "Filters active" indicator when toggled on', async () => {
    renderLoaded();
    const btn = screen.getByTestId('filter-toggle-btn');
    await userEvent.click(btn);
    expect(screen.getByText('Filters active')).toBeInTheDocument();
  });

  it('Clear all link clears filters', async () => {
    renderLoaded();
    const btn = screen.getByTestId('filter-toggle-btn');
    await userEvent.click(btn);
    expect(screen.getByText('Filters active')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Clear all'));
    expect(screen.queryByText('Filters active')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. InvestorDiscovery – simulated states
// ─────────────────────────────────────────────────────────────────────────────

describe('InvestorDiscovery – simulated states', () => {
  it('renders truly-empty when __simulateState is truly-empty', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'truly-empty' }} />);
    expect(screen.getByRole('heading', { level: 2, name: /No offerings yet/i })).toBeInTheDocument();
  });

  it('renders filtered-empty when __simulateState is filtered-empty', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'filtered-empty', query: 'test', hasFilters: false }} />);
    expect(screen.getByRole('heading', { level: 2, name: /No offerings match your search/i })).toBeInTheDocument();
  });

  it('renders error when __simulateState is error', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'error', retryCount: 0 }} />);
    expect(screen.getByRole('heading', { level: 2, name: /Couldn't load offerings/i })).toBeInTheDocument();
  });

  it('renders loaded when __simulateState is loaded', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'loaded', offerings: MOCK_OFFERINGS }} />);
    expect(screen.getByText('TechFlow AI')).toBeInTheDocument();
  });

  it('portfolio CTA is only visible in loaded state', () => {
    const { rerender } = render(<InvestorDiscovery __simulateState={{ kind: 'loaded', offerings: MOCK_OFFERINGS }} />);
    expect(screen.getByRole('heading', { level: 2, name: /Build Your Portfolio/i })).toBeInTheDocument();

    rerender(<InvestorDiscovery __simulateState={{ kind: 'truly-empty' }} />);
    expect(screen.queryByRole('heading', { level: 2, name: /Build Your Portfolio/i })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. InvestorDiscovery – retry interaction
// ─────────────────────────────────────────────────────────────────────────────

describe('InvestorDiscovery – retry interaction', () => {
  it('retry button resets loading state', async () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'error', retryCount: 0 }} />);
    const retryBtn = screen.getByRole('button', { name: /Try again/i });
    await userEvent.click(retryBtn);
    // After retry, should show loading skeletons
    expect(screen.getByLabelText(/Loading available offerings/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Result area accessibility
// ─────────────────────────────────────────────────────────────────────────────

describe('InvestorDiscovery – result area accessibility', () => {
  it('result section has aria-live="polite"', () => {
    renderLoaded();
    expect(screen.getByLabelText('Available startup offerings')).toHaveAttribute('aria-live', 'polite');
  });

  it('error state uses role="status" with aria-live', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'error', retryCount: 0 }} />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-labelledby');
  });

  it('empty state heading is linked via aria-labelledby', () => {
    render(<InvestorDiscovery __simulateState={{ kind: 'truly-empty' }} />);
    const container = screen.getByRole('status');
    const labelId = container.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    const heading = document.getElementById(labelId!);
    expect(heading).not.toBeNull();
    expect(heading!.tagName.toLowerCase()).toBe('h2');
  });
});

describe('InvestorDiscovery distribution dashboard', () => {
  it('renders payout KPIs and a labelled chart for confirmed distribution history', () => {
    renderLoaded();

    expect(screen.getByRole('heading', { level: 2, name: /Distribution dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/Total distributed/i)).toBeInTheDocument();
    expect(screen.getByText(/Last payout/i)).toBeInTheDocument();
    expect(screen.getByText(/Projected next payout/i)).toBeInTheDocument();
    expect(screen.getByText('Jun 30, 2026')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Past distribution amounts and cumulative total/i })).toBeInTheDocument();
  });

  it('switches to the same payout data in an accessible table', async () => {
    const user = userEvent.setup();
    renderLoaded();

    const toggle = screen.getByRole('button', { name: /View as table/i });
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('table', { name: /Distribution payout history/i })).toBeInTheDocument();
    expect(screen.getByText('Jan 31, 2026')).toBeInTheDocument();
  });

  it('drops malformed and duplicate distribution records before computing KPI totals', () => {
    render(
      <InvestorDiscovery
        __simulateState={{ kind: 'loaded', offerings: MOCK_OFFERINGS }}
        __simulateDistributionState={{
          kind: 'loaded',
          distributions: [
            { id: 'valid', date: '2026-02-01', amount: 100, currency: 'USD' },
            { id: 'valid', date: '2026-02-02', amount: 900, currency: 'USD' },
            { id: 'invalid-date', date: 'not-a-date', amount: 200, currency: 'USD' },
            { id: 'negative', date: '2026-02-03', amount: -1, currency: 'USD' },
          ],
        }}
      />,
    );

    expect(screen.getAllByText('$100')).toHaveLength(2);
    expect(screen.queryByText('$1,000')).not.toBeInTheDocument();
  });

  it('makes empty and failure states explicit and retryable', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <InvestorDiscovery
        __simulateState={{ kind: 'loaded', offerings: MOCK_OFFERINGS }}
        __simulateDistributionState={{ kind: 'empty' }}
      />,
    );
    expect(screen.getByText(/No distributions have been paid yet/i)).toBeInTheDocument();

    rerender(
      <InvestorDiscovery
        __simulateState={{ kind: 'loaded', offerings: MOCK_OFFERINGS }}
        __simulateDistributionState={{ kind: 'error' }}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Try again/i }));
    expect(screen.getByTestId('distribution-dashboard')).toBeInTheDocument();
  });

  it('has no axe-detectable violations in chart and table views', async () => {
    const chart = renderLoaded();
    expect(await axe(chart.container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole('button', { name: /View as table/i }));
    expect(await axe(chart.container)).toHaveNoViolations();
  });
});

describe('PayoutSchedule', () => {
  const mockPayouts: Payout[] = [
    { id: '1', date: '2026-09-01T00:00:00Z', amount: 1500, status: 'Upcoming' },
    { id: '2', date: '2026-10-01T00:00:00Z', amount: 2000, status: 'Upcoming' },
    { id: '3', date: '2026-08-01T00:00:00Z', amount: 1200, status: 'Processing' },
    { id: '4', date: '2026-07-01T00:00:00Z', amount: 1000, status: 'Paid' },
    { id: '5', date: '2026-06-01T00:00:00Z', amount: 500, status: 'Missed' },
  ];

  it('renders empty state when no payouts', () => {
    render(<PayoutSchedule payouts={[]} />);
    expect(screen.getByText('No Payouts Yet')).toBeInTheDocument();
  });

  it('renders next expected payout hero card', () => {
    render(<PayoutSchedule payouts={mockPayouts} />);
    const nextPayout = screen.getByLabelText('Next expected payout');
    expect(within(nextPayout).getByText('Next Expected Payout')).toBeInTheDocument();
    expect(within(nextPayout).getByText('$1,200')).toBeInTheDocument();
  });

  it('groups payouts by month and year', () => {
    render(<PayoutSchedule payouts={mockPayouts} />);
    expect(screen.getByText('August 2026')).toBeInTheDocument();
    expect(screen.getByText('September 2026')).toBeInTheDocument();
  });

  it('renders all payout statuses', () => {
    render(<PayoutSchedule payouts={mockPayouts} />);
    expect(screen.getAllByText('Upcoming').length).toBe(2);
    expect(screen.getAllByText('Processing')).toHaveLength(2);
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Missed')).toBeInTheDocument();
  });
});

// ─── Ledger Entries Section Tests (Issue #628) ──────────────────────────────

import { LedgerEntriesSection, generateLedgerEntries, LedgerEntry } from './InvestorDiscovery';

describe('LedgerEntriesSection – Issue #628', () => {
  const entries = generateLedgerEntries(12);

  beforeEach(() => {
    // Reset any deep-link param left by previous tests (history.replaceState
    // persists across tests in the same file).
    window.history.replaceState(null, '', '/');
  });

  it('generates deterministic ledger entries', () => {
    const again = generateLedgerEntries(12);
    expect(again.map((e) => e.id)).toEqual(entries.map((e) => e.id));
    expect(entries[0].id).toBe('LED-0001');
    expect(entries[11].id).toBe('LED-0012');
    // amounts are stable (no Math.random)
    expect(entries.map((e) => e.amount)).toEqual(again.map((e) => e.amount));
  });

  it('renders the virtualized ledger table with entry rows in loaded state', () => {
    render(<LedgerEntriesSection entries={entries} />);
    expect(screen.getByRole('heading', { name: 'Ledger Entries' })).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: 'Investor ledger entries' })).toBeInTheDocument();
    expect(screen.getByText('LED-0001')).toBeInTheDocument();
    expect(screen.getByText('LED-0012')).toBeInTheDocument();
    // 12 entries over 6 offerings → each offering appears exactly twice.
    expect(screen.getAllByText('Helios Solar')).toHaveLength(2);
    expect(screen.getByTestId('ledger-entry-count')).toHaveTextContent('12 entries');
  });

  it('opens the row-detail side drawer with the entry detail', async () => {
    const user = userEvent.setup();
    render(<LedgerEntriesSection entries={entries} />);
    await user.click(screen.getByText('LED-0001'));
    const drawer = screen.getByRole('dialog', { name: 'Ledger entry LED-0001' });
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByTestId('ledger-entry-detail')).toBeInTheDocument();
    expect(within(drawer).getByText('Helios Solar')).toBeInTheDocument();
  });

  it('writes the deep-link permalink on open and removes it on close', async () => {
    const user = userEvent.setup();
    render(<LedgerEntriesSection entries={entries} />);
    await user.click(screen.getByText('LED-0001'));
    expect(new URLSearchParams(window.location.search).get('entry')).toBe('LED-0001');
    await user.click(screen.getByRole('button', { name: 'Close row detail' }));
    expect(new URLSearchParams(window.location.search).has('entry')).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('copies the deep-link permalink to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LedgerEntriesSection entries={entries} />);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await user.click(screen.getByText('LED-0002'));
    await user.click(screen.getByRole('button', { name: /Copy link/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('?entry=LED-0002'));
    expect(screen.getByRole('button', { name: /Copy link/ })).toHaveTextContent('Copied');
  });

  it('renders an empty state when no entries are provided', () => {
    const { unmount } = render(<LedgerEntriesSection entries={[]} />);
    expect(screen.getByText('No Ledger Entries Yet')).toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    unmount();

    // Also cover the "entries prop absent/undefined" branch.
    render(<LedgerEntriesSection />);
    expect(screen.getByText('No Ledger Entries Yet')).toBeInTheDocument();
  });

  it('does NOT render the ledger section outside the loaded state', () => {
    const { unmount } = render(<LedgerEntriesSection entries={entries} />);
    unmount();
    const states: Parameters<typeof InvestorDiscovery>[0]['__simulateState'][] = [
      { kind: 'filtered-empty', query: 'zzz', hasFilters: false },
      { kind: 'truly-empty' },
      { kind: 'error', retryCount: 0 },
    ];
    for (const simState of states) {
      const view = render(<InvestorDiscovery __simulateState={simState} />);
      expect(view.container.querySelector('#ledger-entries-heading')).toBeNull();
      expect(view.queryByRole('grid')).toBeNull();
      view.unmount();
    }
  });

  it('renders the ledger inside the loaded InvestorDiscovery page', () => {
    renderLoaded();
    expect(screen.getByRole('heading', { name: 'Ledger Entries' })).toBeInTheDocument();
    expect(screen.getByText('LED-0001')).toBeInTheDocument();
  });
});
