import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { AdminAlertsInbox } from './AdminAlertsInbox';

expect.extend(toHaveNoViolations);

describe('AdminAlertsInbox', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should render loading state initially and then the alerts', async () => {
    render(<AdminAlertsInbox />);
    expect(screen.getByText('Alerts Inbox')).toBeInTheDocument();
    
    // Fast-forward past the simulated 600ms network delay
    vi.advanceTimersByTime(600);
    
    await waitFor(() => {
      expect(screen.getByText('Missed Revenue Payment')).toBeInTheDocument();
    });
  });

  it('should be accessible (no axe violations)', async () => {
    const { container } = render(<AdminAlertsInbox />);
    vi.advanceTimersByTime(600);
    
    await waitFor(() => {
      expect(screen.getByText('Missed Revenue Payment')).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should support search filtering', async () => {
    render(<AdminAlertsInbox />);
    vi.advanceTimersByTime(600);
    
    await waitFor(() => {
      expect(screen.getByText('Missed Revenue Payment')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search alerts...');
    fireEvent.change(searchInput, { target: { value: 'Nebula Corp' } });

    expect(screen.getByText('Nebula Corp')).toBeInTheDocument();
    expect(screen.queryByText('Missed Revenue Payment')).not.toBeInTheDocument();
  });

  it('should group alerts by severity', async () => {
    render(<AdminAlertsInbox />);
    vi.advanceTimersByTime(600);
    
    await waitFor(() => {
      expect(screen.getByText('Missed Revenue Payment')).toBeInTheDocument();
    });

    const severityBtn = screen.getByText('Severity');
    fireEvent.click(severityBtn);

    expect(screen.getByText('Critical Priority (2)')).toBeInTheDocument();
    expect(screen.getByText('High Priority (1)')).toBeInTheDocument();
  });

  it('should group alerts by issuer', async () => {
    render(<AdminAlertsInbox />);
    vi.advanceTimersByTime(600);
    
    await waitFor(() => {
      expect(screen.getByText('Missed Revenue Payment')).toBeInTheDocument();
    });

    const issuerBtn = screen.getByText('Issuer');
    fireEvent.click(issuerBtn);

    expect(screen.getByText('Stellar Tech (2)')).toBeInTheDocument();
    expect(screen.getByText('Nebula Corp (1)')).toBeInTheDocument();
  });

  it('should group alerts by time', async () => {
    render(<AdminAlertsInbox />);
    vi.advanceTimersByTime(600);
    
    await waitFor(() => {
      expect(screen.getByText('Missed Revenue Payment')).toBeInTheDocument();
    });

    const timeBtn = screen.getByText('Time');
    fireEvent.click(timeBtn);

    expect(screen.getByText(/Today/i)).toBeInTheDocument();
  });

  it('should allow acknowledging a single alert', async () => {
    render(<AdminAlertsInbox />);
    vi.advanceTimersByTime(600);
    
    await waitFor(() => {
      expect(screen.getByText('Missed Revenue Payment')).toBeInTheDocument();
    });

    const row = screen.getByText('Missed Revenue Payment').closest('div.group');
    const ackBtn = within(row as HTMLElement).getByTitle('Acknowledge');
    fireEvent.click(ackBtn);

    expect(screen.getByText('Alert marked as acknowledged')).toBeInTheDocument();
  });

  it('should allow bulk resolving alerts', async () => {
    render(<AdminAlertsInbox />);
    vi.advanceTimersByTime(600);
    
    await waitFor(() => {
      expect(screen.getByText('Missed Revenue Payment')).toBeInTheDocument();
    });

    // check "Select all alerts"
    const selectAll = screen.getByLabelText('Select all alerts');
    fireEvent.click(selectAll);

    // Click resolve all
    const resolveAllBtn = screen.getByText('Resolve All');
    fireEvent.click(resolveAllBtn);

    expect(screen.getByText(/alerts marked as resolved/)).toBeInTheDocument();
  });

  it('should allow undoing an action', async () => {
    render(<AdminAlertsInbox />);
    vi.advanceTimersByTime(600);
    
    await waitFor(() => {
      expect(screen.getByText('Missed Revenue Payment')).toBeInTheDocument();
    });

    const row = screen.getByText('Missed Revenue Payment').closest('div.group');
    const ackBtn = within(row as HTMLElement).getByTitle('Acknowledge');
    fireEvent.click(ackBtn);

    const undoBtn = screen.getByText('Undo');
    fireEvent.click(undoBtn);

    expect(screen.queryByText('Alert marked as acknowledged')).not.toBeInTheDocument();
  });

  it('should handle mobile menu click', async () => {
    render(<AdminAlertsInbox />);
    vi.advanceTimersByTime(600);
    
    await waitFor(() => {
      expect(screen.getByText('Missed Revenue Payment')).toBeInTheDocument();
    });

    const row = screen.getByText('Missed Revenue Payment').closest('div.group');
    const menuBtn = within(row as HTMLElement).getByLabelText('Alert actions');
    
    fireEvent.click(menuBtn);
    
    // menu pops up with assign text
    const menuAssignBtn = within(row as HTMLElement).getByText('Assign');
    fireEvent.click(menuAssignBtn);

    expect(screen.getByText('Alert marked as assigned')).toBeInTheDocument();
  });

  it('should display empty state when all filtered out', async () => {
    render(<AdminAlertsInbox />);
    vi.advanceTimersByTime(600);
    
    await waitFor(() => {
      expect(screen.getByText('Missed Revenue Payment')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search alerts...');
    fireEvent.change(searchInput, { target: { value: 'Something that does not exist 1234' } });

    expect(screen.getByText('No alerts match your search.')).toBeInTheDocument();
  });
});
