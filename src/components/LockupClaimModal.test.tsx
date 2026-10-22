import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LockupClaimModal } from './LockupClaimModal';

describe('LockupClaimModal', () => {
  it('renders unlocked amount, gas detail, and claim choices in an accessible dialog', () => {
    render(<LockupClaimModal isOpen onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: /claim your unlocked balance/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/unlocked amount/i)).toBeInTheDocument();
    expect(screen.getByText(/estimated gas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /claim now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /claim later/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /auto-claim on next unlock/i })).toBeInTheDocument();
  });

  it('calls onClaim once per confirmed click with autoClaim state, disables button while pending, and shows tx hash link', async () => {
    const user = userEvent.setup();
    let resolveClaim!: (value: { hash?: string }) => void;
    const onClaim = vi.fn(
      () =>
        new Promise<{ hash?: string }>((resolve) => {
          resolveClaim = resolve;
        }),
    );

    render(<LockupClaimModal isOpen onClose={vi.fn()} onClaim={onClaim} />);

    const checkbox = screen.getByRole('checkbox', { name: /auto-claim on next unlock/i });
    await user.click(checkbox);

    const claimButton = screen.getByRole('button', { name: /claim now/i });
    await user.click(claimButton);
    await user.click(claimButton);

    expect(onClaim).toHaveBeenCalledTimes(1);
    expect(onClaim).toHaveBeenCalledWith({ autoClaim: true });
    expect(claimButton).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/submitting claim/i);

    resolveClaim({ hash: '0xabc123def456' });

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/claim request queued/i);
    });
    expect(claimButton).not.toBeDisabled();
    expect(screen.getByText('0xabc123def456')).toBeInTheDocument();

    const explorerLink = screen.getByRole('link', { name: /view on explorer/i });
    expect(explorerLink).toHaveAttribute(
      'href',
      'https://stellar.expert/explorer/public/tx/0xabc123def456',
    );
    expect(explorerLink).toHaveAttribute('target', '_blank');
  });

  it('shows an error and re-enables the button when onClaim rejects', async () => {
    const user = userEvent.setup();
    let rejectClaim!: (reason?: unknown) => void;
    const onClaim = vi.fn(
      () =>
        new Promise<{ hash?: string }>((_, reject) => {
          rejectClaim = reject;
        }),
    );

    render(<LockupClaimModal isOpen onClose={vi.fn()} onClaim={onClaim} />);

    const claimButton = screen.getByRole('button', { name: /claim now/i });
    await user.click(claimButton);

    expect(claimButton).toBeDisabled();

    rejectClaim(new Error('RPC simulation failed'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('RPC simulation failed');
    });
    expect(claimButton).not.toBeDisabled();
  });

  it('requires a second "Claim anyway" confirmation when gas fees are high before calling onClaim', async () => {
    const user = userEvent.setup();
    const onClaim = vi.fn().mockResolvedValue({ hash: '0xhighgas99' });

    render(<LockupClaimModal isOpen onClose={vi.fn()} gasEstimate={95} onClaim={onClaim} />);

    await user.click(screen.getByRole('button', { name: /claim now/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/high gas fees/i);
    expect(onClaim).not.toHaveBeenCalled();

    const confirmButton = screen.getByRole('button', { name: /claim anyway/i });
    await user.click(confirmButton);

    expect(onClaim).toHaveBeenCalledTimes(1);
    expect(onClaim).toHaveBeenCalledWith({ autoClaim: false });
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/claim request queued/i);
    });
  });

  it('traps Tab and Shift+Tab focus within the modal and returns focus to the opener on close', async () => {
    const user = userEvent.setup();
    const opener = document.createElement('button');
    opener.textContent = 'Open claim modal';
    document.body.appendChild(opener);
    opener.focus();
    expect(opener).toHaveFocus();

    const onClose = vi.fn();
    const { rerender } = render(<LockupClaimModal isOpen onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: /close claim modal/i });
    const checkbox = screen.getByRole('checkbox', { name: /auto-claim on next unlock/i });
    const infoButton = screen.getByRole('button', { name: /learn more about auto-claim/i });
    const claimLaterButton = screen.getByRole('button', { name: /claim later/i });
    const claimNowButton = screen.getByRole('button', { name: /claim now/i });

    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(claimNowButton).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.tab();
    expect(checkbox).toHaveFocus();

    await user.tab();
    expect(infoButton).toHaveFocus();

    await user.tab();
    expect(claimLaterButton).toHaveFocus();

    await user.tab();
    expect(claimNowButton).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(opener).toHaveFocus();

    rerender(<LockupClaimModal isOpen={false} onClose={onClose} />);
    expect(opener).toHaveFocus();

    document.body.removeChild(opener);
  });
});
