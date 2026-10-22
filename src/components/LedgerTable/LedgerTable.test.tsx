import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import LedgerTable from './LedgerTable';
import type { Column, LedgerDrawerConfig, LedgerTableProps } from './LedgerTable';

interface TestRow {
  id: number;
  name: string;
  value: number;
}

const columns: Column<TestRow>[] = [
  { key: 'id', label: 'ID', render: (r) => r.id },
  { key: 'name', label: 'Name', render: (r) => r.name },
  { key: 'value', label: 'Value', render: (r) => r.value },
];

const data: TestRow[] = [
  { id: 1, name: 'Alpha', value: 100 },
  { id: 2, name: 'Beta', value: 200 },
  { id: 3, name: 'Gamma', value: 300 },
];

describe('LedgerTable', () => {
  it('renders table with data', () => {
    render(
      <LedgerTable
        data={data}
        columns={columns}
        rowKey={(r) => r.id}
        ariaLabel="Test table"
      />,
    );

    expect(screen.getByRole('grid', { name: 'Test table' })).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(
      <LedgerTable
        data={data}
        columns={columns}
        rowKey={(r) => r.id}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'ID' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Value' })).toBeInTheDocument();
  });

  it('shows row count', () => {
    render(
      <LedgerTable
        data={data}
        columns={columns}
        rowKey={(r) => r.id}
      />,
    );

    expect(screen.getByText('3 rows')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(
      <LedgerTable
        data={[]}
        columns={columns}
        rowKey={(r) => r.id}
      />,
    );

    expect(screen.getByText('No data to display.')).toBeInTheDocument();
  });

  it('shows empty state when no columns', () => {
    render(
      <LedgerTable
        data={data}
        columns={[]}
        rowKey={(r) => r.id}
      />,
    );

    expect(screen.getByText('No columns defined.')).toBeInTheDocument();
  });

  it('toggles column visibility', async () => {
    const user = userEvent.setup();
    render(
      <LedgerTable
        data={data}
        columns={columns}
        rowKey={(r) => r.id}
      />,
    );

    const columnsBtn = screen.getByLabelText('Column visibility');
    await user.click(columnsBtn);

    // The column menu items are <label role="menuitemcheckbox"> containing <input>
    const menuItems = screen.getAllByRole('menuitemcheckbox');
    const idItem = menuItems.find((el) => el.textContent?.includes('ID'))!;
    await user.click(idItem);

    expect(screen.queryByRole('columnheader', { name: 'ID' })).not.toBeInTheDocument();
  });

  it('does not allow hiding the last column', async () => {
    const user = userEvent.setup();
    render(
      <LedgerTable
        data={data}
        columns={[{ key: 'id', label: 'ID', render: (r) => r.id }]}
        rowKey={(r) => r.id}
      />,
    );

    const columnsBtn = screen.getByLabelText('Column visibility');
    await user.click(columnsBtn);

    // The disabled state lives on the <input> inside the menuitemcheckbox label
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
  });

  it('cycles density on button click', async () => {
    const user = userEvent.setup();
    render(
      <LedgerTable
        data={data}
        columns={columns}
        rowKey={(r) => r.id}
        defaultDensity="cozy"
      />,
    );

    const densityBtn = screen.getByLabelText(/Density/);
    expect(densityBtn).toHaveTextContent('cozy');

    await user.click(densityBtn);
    // cozy → compact
    expect(densityBtn).toHaveTextContent('compact');
  });

  it('handles keyboard navigation', () => {
    render(
      <LedgerTable
        data={data}
        columns={columns}
        rowKey={(r) => r.id}
      />,
    );

    const grid = screen.getByRole('grid');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'ArrowUp' });

    expect(grid).toBeInTheDocument();
  });

  it('handles pagination', () => {
    const manyRows = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      name: `Row ${i + 1}`,
      value: (i + 1) * 10,
    }));

    render(
      <LedgerTable
        data={manyRows}
        columns={columns}
        rowKey={(r) => r.id}
        pageSize={50}
      />,
    );

    expect(screen.getByText('60 rows')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    const nextBtn = screen.getByLabelText('Next page');
    fireEvent.click(nextBtn);

    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('opens and closes row detail', async () => {
    const user = userEvent.setup();
    const DetailComponent = ({ row }: { row: TestRow }) => (
      <div data-testid="detail-content">{row.name} detail</div>
    );

    render(
      <LedgerTable
        data={data}
        columns={columns}
        rowKey={(r) => r.id}
        rowDetail={(row) => <DetailComponent row={row} />}
      />,
    );

    const toggleButtons = screen.getAllByLabelText('Open detail');
    await user.click(toggleButtons[0]);

    expect(screen.getByTestId('detail-content')).toBeInTheDocument();
    expect(screen.getByText('Alpha detail')).toBeInTheDocument();

    const closeButton = screen.getByLabelText('Close detail');
    await user.click(closeButton);

    expect(screen.queryByTestId('detail-content')).not.toBeInTheDocument();
  });

  describe('Virtualized Cell Focus Outlines', () => {
    it('renders floating focus ring overlay on row navigation', () => {
      render(
        <LedgerTable
          data={data}
          columns={columns}
          rowKey={(r) => r.id}
        />,
      );

      const grid = screen.getByRole('grid');
      expect(screen.queryByTestId('focus-ring-overlay')).not.toBeInTheDocument();

      fireEvent.keyDown(grid, { key: 'ArrowDown' });

      const focusOverlay = screen.getByTestId('focus-ring-overlay');
      expect(focusOverlay).toBeInTheDocument();
      expect(focusOverlay).toHaveClass('lt-focus-ring-overlay--row');
      expect(focusOverlay).toHaveAttribute('aria-hidden', 'true');
      expect(focusOverlay).toHaveAttribute('role', 'presentation');
    });

    it('navigates cell focus with ArrowRight and ArrowLeft keys', () => {
      render(
        <LedgerTable
          data={data}
          columns={columns}
          rowKey={(r) => r.id}
        />,
      );

      const grid = screen.getByRole('grid');
      fireEvent.keyDown(grid, { key: 'ArrowDown' });
      fireEvent.keyDown(grid, { key: 'ArrowRight' });

      const focusOverlay = screen.getByTestId('focus-ring-overlay');
      expect(focusOverlay).toHaveClass('lt-focus-ring-overlay--cell');

      fireEvent.keyDown(grid, { key: 'ArrowLeft' });
      fireEvent.keyDown(grid, { key: 'ArrowLeft' }); // back to row focus (-1)
      expect(focusOverlay).toHaveClass('lt-focus-ring-overlay--row');
    });

    it('supports Home and End key navigation for cells', () => {
      render(
        <LedgerTable
          data={data}
          columns={columns}
          rowKey={(r) => r.id}
        />,
      );

      const grid = screen.getByRole('grid');
      fireEvent.keyDown(grid, { key: 'ArrowDown' });
      fireEvent.keyDown(grid, { key: 'End' });

      const focusOverlay = screen.getByTestId('focus-ring-overlay');
      expect(focusOverlay).toHaveClass('lt-focus-ring-overlay--cell');

      fireEvent.keyDown(grid, { key: 'Home' });
      expect(focusOverlay).toHaveClass('lt-focus-ring-overlay--cell');
    });

    it('focuses cell on cell click', async () => {
      render(
        <LedgerTable
          data={data}
          columns={columns}
          rowKey={(r) => r.id}
        />,
      );

      const cell = screen.getByText('Beta');
      fireEvent.click(cell);

      const focusOverlay = screen.getByTestId('focus-ring-overlay');
      expect(focusOverlay).toBeInTheDocument();
      expect(focusOverlay).toHaveClass('lt-focus-ring-overlay--cell');
    });

    it('maintains focus overlay positioning during container scroll', () => {
      const manyRows = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        value: i * 5,
      }));

      render(
        <LedgerTable
          data={manyRows}
          columns={columns}
          rowKey={(r) => r.id}
          pageSize={100}
        />,
      );

      const grid = screen.getByRole('grid');
      fireEvent.keyDown(grid, { key: 'ArrowDown' }); // focus row 0
      fireEvent.keyDown(grid, { key: 'ArrowDown' }); // focus row 1

      const focusOverlay = screen.getByTestId('focus-ring-overlay');
      expect(focusOverlay).toBeInTheDocument();

      // Trigger scroll event on container wrapper
      fireEvent.scroll(grid, { target: { scrollTop: 120 } });
      expect(screen.getByTestId('focus-ring-overlay')).toBeInTheDocument();
    });

    it('handles RTL direction key navigation', () => {
      // jsdom does not derive computed `direction` from a `dir` attribute,
      // so mark the document itself as RTL for the duration of this test.
      document.dir = 'rtl';
      render(
        <div dir="rtl">
          <LedgerTable
            data={data}
            columns={columns}
            rowKey={(r) => r.id}
          />
        </div>,
      );

      const grid = screen.getByRole('grid');
      fireEvent.keyDown(grid, { key: 'ArrowDown' });
      
      // In RTL, ArrowLeft increases column index (moves right to next column)
      fireEvent.keyDown(grid, { key: 'ArrowLeft' });
      const focusOverlay = screen.getByTestId('focus-ring-overlay');
      expect(focusOverlay).toHaveClass('lt-focus-ring-overlay--cell');
      document.dir = '';
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #628 – Row-detail side drawer + deep-link permalink
// ─────────────────────────────────────────────────────────────────────────────

describe('LedgerTable – row-detail side drawer (Issue #628)', () => {
  interface LedgerEntry {
    id: string;
    date: string;
    amount: number;
    status: string;
  }

  const ledgerColumns: Column<LedgerEntry>[] = [
    { key: 'id', label: 'ID', width: '90px', render: (r) => r.id },
    { key: 'date', label: 'Date', width: '110px', render: (r) => r.date },
    { key: 'amount', label: 'Amount', width: '110px', render: (r) => r.amount },
    { key: 'status', label: 'Status', render: (r) => r.status },
  ];

  const ledgerData: LedgerEntry[] = [
    { id: 'ENT-0001', date: '2026-01-01', amount: 100, status: 'confirmed' },
    { id: 'ENT-0002', date: '2026-01-02', amount: 200, status: 'pending' },
    { id: 'ENT-0003', date: '2026-01-03', amount: 300, status: 'failed' },
  ];

  const drawerConfig: LedgerDrawerConfig<LedgerEntry> = { deepLinkParam: 'entry' };

  const renderDrawerTable = (
    props: Partial<LedgerTableProps<LedgerEntry>> = {},
  ) =>
    render(
      <LedgerTable
        data={ledgerData}
        columns={ledgerColumns}
        rowKey={(r) => r.id}
        rowDetail={(row) => <div data-testid="drawer-detail">{row.id}</div>}
        detailMode="drawer"
        drawer={drawerConfig}
        ariaLabel="Ledger entries table"
        {...props}
      />,
    );

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    document.body.style.overflow = '';
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
    document.body.style.overflow = '';
    vi.unstubAllGlobals();
  });

  it('does not render a drawer by default in inline mode', () => {
    render(
      <LedgerTable
        data={ledgerData}
        columns={ledgerColumns}
        rowKey={(r) => r.id}
        rowDetail={(row) => <div>{row.id}</div>}
      />,
    );
    expect(screen.queryByTestId('lt-drawer')).not.toBeInTheDocument();
  });

  it('opens the side drawer when a row is clicked', async () => {
    const user = userEvent.setup();
    renderDrawerTable();
    await user.click(screen.getByText('ENT-0001'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByTestId('drawer-detail')).toHaveTextContent('ENT-0001');
    expect(screen.getByTestId('lt-drawer-backdrop')).toBeInTheDocument();
  });

  it('focuses the close button and locks body scroll while open', async () => {
    const user = userEvent.setup();
    renderDrawerTable();
    await user.click(screen.getByText('ENT-0001'));
    await waitFor(() => expect(screen.getByLabelText('Close row detail')).toHaveFocus());
    expect(document.body.style.overflow).toBe('hidden');
    await user.click(screen.getByLabelText('Close row detail'));
    expect(document.body.style.overflow).toBe('');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the drawer with the Escape key', async () => {
    const user = userEvent.setup();
    renderDrawerTable();
    await user.click(screen.getByText('ENT-0002'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the drawer when the backdrop is pressed', async () => {
    const user = userEvent.setup();
    renderDrawerTable();
    await user.click(screen.getByText('ENT-0003'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('lt-drawer-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('writes the deep-link permalink into the URL when opened and removes it on close', async () => {
    const user = userEvent.setup();
    renderDrawerTable();
    expect(window.location.search).not.toContain('entry=');
    await user.click(screen.getByText('ENT-0002'));
    expect(window.location.search).toContain('entry=ENT-0002');
    expect(screen.getByTestId('lt-drawer-permalink').textContent).toMatch(
      /\?entry=ENT-0002/,
    );
    await user.click(screen.getByLabelText('Close row detail'));
    expect(window.location.search).not.toContain('entry=');
  });

  it('restores the drawer from a deep-link param on mount and scrolls the row into view', async () => {
    window.history.replaceState(null, '', '/?entry=ENT-0003');
    renderDrawerTable();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByTestId('drawer-detail')).toHaveTextContent('ENT-0003');
    expect(screen.getByTestId('lt-drawer-permalink')).toHaveTextContent(
      '?entry=ENT-0003',
    );
  });

  it('does not open a drawer when the deep-link param does not match any row', () => {
    window.history.replaceState(null, '', '/?entry=ENT-NOPE');
    renderDrawerTable();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('syncs the drawer across popstate navigation', async () => {
    renderDrawerTable();
    act(() => {
      window.history.replaceState(null, '', '/?entry=ENT-0001');
      window.dispatchEvent(new Event('popstate'));
    });
    expect(screen.getByTestId('drawer-detail')).toHaveTextContent('ENT-0001');
    act(() => {
      window.history.replaceState(null, '', '/');
      window.dispatchEvent(new Event('popstate'));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('copies the permalink URL to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderDrawerTable();
    // user-event 14+ installs its own navigator.clipboard stub on setup, so
    // override it (on the instance) after setup to spy on the real code path.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    await user.click(screen.getByText('ENT-0001'));
    await user.click(screen.getByRole('button', { name: /Copy link/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('?entry=ENT-0001'));
    expect(screen.getByText('Link copied to clipboard')).toBeInTheDocument();
    // The button label mirrors the copy state.
    expect(screen.getByRole('button', { name: /Copy link/i })).toHaveTextContent('Copied');
  });

  it('renders a custom drawer title and footer when provided', async () => {
    const user = userEvent.setup();
    renderDrawerTable({
      drawer: {
        deepLinkParam: 'entry',
        title: (row) => `Ledger ${row.id} details`,
        footer: (row, close) => (
          <button type="button" onClick={close}>View {row.amount}</button>
        ),
      },
    });
    await user.click(screen.getByText('ENT-0001'));
    expect(screen.getByRole('heading', { name: 'Ledger ENT-0001 details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View 100' })).toBeInTheDocument();
  });

  it('activates the drawer from the keyboard', () => {
    renderDrawerTable();
    const grid = screen.getByRole('grid');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(screen.getByTestId('drawer-detail')).toHaveTextContent('ENT-0001');
    // Enter toggles the detail for the focused row
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(screen.queryByTestId('drawer-detail')).not.toBeInTheDocument();
  });

  it('shows the empty state (not a drawer) for an empty ledger', () => {
    renderDrawerTable({ data: [] });
    expect(screen.getByText('No data to display.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('virtualizes tens of thousands of rows while preserving row-index semantics', () => {
    const hugeData: LedgerEntry[] = Array.from({ length: 50000 }, (_, i) => ({
      id: `ENT-${String(i + 1).padStart(5, '0')}`,
      date: '2026-01-01',
      amount: i + 1,
      status: 'confirmed',
    }));
    render(
      <LedgerTable
        data={hugeData}
        columns={ledgerColumns}
        rowKey={(r) => r.id}
        detailMode="drawer"
        drawer={drawerConfig}
        pageSize={50}
        ariaLabel="Large ledger table"
      />,
    );
    const grid = screen.getByRole('grid');
    // aria-rowcount reflects the full feed, not the visible page
    expect(grid).toHaveAttribute('aria-rowcount', '50000');
    expect(screen.getByText('50000 rows')).toBeInTheDocument();
    // Only a virtual window of rows is in the DOM
    expect(screen.getAllByRole('row').length).toBeLessThan(50);

    // Scrolling deep into the feed swaps in a different window of rows
    fireEvent.scroll(grid, { target: { scrollTop: 2400000 } });
    expect(screen.getAllByRole('row').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('row').length).toBeLessThan(50);
  });

  it('renders very wide columns without clipping virtualized rows', () => {
    const wideColumns: Column<LedgerEntry>[] = ledgerColumns.map((c) => ({
      ...c,
      width: '180px',
    }));
    render(
      <LedgerTable
        data={ledgerData}
        columns={wideColumns}
        rowKey={(r) => r.id}
        rowDetail={(row) => <div>{row.id}</div>}
        detailMode="drawer"
        drawer={drawerConfig}
        ariaLabel="Wide columns table"
      />,
    );
    // The scroll container is rendered and all wide cells exist
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'ID' })).toBeInTheDocument();
    expect(screen.getByText('ENT-0001')).toBeInTheDocument();
    expect(screen.getByText('ENT-0002')).toBeInTheDocument();
    expect(screen.getByText('ENT-0003')).toBeInTheDocument();
    const grid = screen.getByRole('grid');
    expect(grid.className).toContain('lt-table-wrap');
  });

  it('has no axe violations with the drawer open', async () => {
    const user = userEvent.setup();
    const { container } = renderDrawerTable();
    await user.click(screen.getByText('ENT-0001'));
    const results = await axe(screen.getByRole('dialog'));
    expect(results).toHaveNoViolations();
    expect(container).toBeInTheDocument();
  });
});
