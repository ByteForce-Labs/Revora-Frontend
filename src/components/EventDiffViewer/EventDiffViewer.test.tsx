import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventDiffViewer } from './EventDiffViewer';

describe('EventDiffViewer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('expands the diff panel and exposes field-level values', async () => {
    const user = userEvent.setup();

    render(
      <EventDiffViewer
        diff={{
          eventType: 'payout.approved',
          fields: [
            { label: 'Status', before: 'pending', after: 'approved' },
            { label: 'Amount (USDC)', before: '1200', after: '1250' },
          ],
        }}
        entryLabel="payout batch"
      />
    );

    await user.click(screen.getByRole('button', { name: /show field diff for payout batch/i }));

    expect(screen.getByRole('region', { name: /field diff for payout.approved/i })).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('approved')).toBeInTheDocument();
  });

  it('copies a plain-text diff when requested', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(
      <EventDiffViewer
        diff={{
          eventType: 'investment.created',
          fields: [{ label: 'Amount', before: undefined, after: '5000' }],
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: /show field diff/i }));
    await user.click(screen.getByRole('button', { name: /copy diff as plain text/i }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Event: investment.created'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Field: Amount'));
  });
});
