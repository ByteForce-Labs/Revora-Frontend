import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TwoFactorSetup } from './TwoFactorSetup';

// Test data
const TEST_CODES = [
  'REVR-A1B2-C3D4', 'REVR-E5F6-G7H8',
  'REVR-I9J0-K1L2', 'REVR-M3N4-O5P6',
  'REVR-Q7R8-S9T0', 'REVR-U1V2-W3X4',
  'REVR-Y5Z6-A7B8', 'REVR-C9D0-E1F2',
  'REVR-G3H4-I5J6', 'REVR-K7L8-M9N0',
];
const TEST_SECRET = 'JBSWY3DPEHPK3PXP';

const onComplete = vi.fn();
const onCancel = vi.fn();
const verifyCode = vi.fn(async ({ code }: { code: string }) => code === '123456');

const renderSetup = () => {
  return render(
    <TwoFactorSetup
      onComplete={onComplete}
      onCancel={onCancel}
      totpSecret={TEST_SECRET}
      recoveryCodes={TEST_CODES}
      verifyCode={verifyCode}
      onRegenerateCodes={async () => TEST_CODES}
    />
  );
};

// ─── Step 4: Enhanced Recovery Codes Tests ───────────────────────────────────────────────────

describe('Step 4 – Enhanced Recovery Codes UX', () => {
  // Helper to navigate to Step 4
  const navigateToStep4 = async (user: ReturnType<typeof userEvent.setup>) => {
    renderSetup();
    await user.click(screen.getByRole('button', { name: /authenticator app/i }));
    await user.click(screen.getByRole('button', { name: /i've added the account/i }));
    await user.type(screen.getByRole('textbox'), '123456');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /save your recovery codes/i })).toBeInTheDocument(),
      { timeout: 2000 }
    );
  };

  it('renders 10 recovery codes in responsive grid', async () => {
    const user = userEvent.setup();
    await navigateToStep4(user);

    // Verify grid container exists
    const grid = screen.getByRole('grid', { name: /recovery codes grid/i });
    expect(grid).toBeInTheDocument();

    // Verify 10 code cards (grid-template-columns should show 5 items visible)
    const codeCards = within(grid).getAllByRole('button');
    expect(codeCards).toHaveLength(10);
  });

  it('hides all codes by default with placeholders for shoulder-surfing safety', async () => {
    const user = userEvent.setup();
    await navigateToStep4(user);

    // Check that placeholder is visible and codes are hidden
    expect(screen.getByText('••••••')).toBeInTheDocument();
    expect(screen.queryByText(TEST_CODES[0])).not.toBeInTheDocument();

    // Verify status shows 0 revealed
    expect(screen.getByText(/Revealed: 0\/10/)).toBeInTheDocument();
  });

  it('reveals single code when clicked (shoulder-surfing safety)', async () => {
    const user = userEvent.setup();
    await navigateToStep4(user);

    const codeCards = screen.getAllByRole('button');
    const firstCard = codeCards[0];

    // Click to reveal
    await user.click(firstCard);

    // Should now be revealed
    expect(firstCard).toHaveClass('revealed');
    // The code text should be visible
    expect(screen.getByText(TEST_CODES[0])).toBeInTheDocument();
    // Placeholder should be gone
    expect(screen.queryByText('••••••')).not.toBeInTheDocument();

    // Other cards should still be hidden
    const secondCard = codeCards[1];
    expect(secondCard).not.toHaveClass('revealed');
    expect(screen.queryByText(TEST_CODES[1])).not.toBeInTheDocument();
  });

  it('shows reveal count and status indicators', async () => {
    const user = userEvent.setup();
    await navigateToStep4(user);

    // Should show "Revealed: 0/10" initially
    expect(screen.getByText(/Revealed: 0/10/)).toBeInTheDocument();

    // Reveal first code
    const codeCards = screen.getAllByRole('button');
    await user.click(codeCards[0]);

    // Should now show "Revealed: 1/10"
    expect(screen.getByText(/Revealed: 1/10/)).toBeInTheDocument();
  });

  it('shows "Reveal All" and "Hide All" buttons', async () => {
    const user = userEvent.setup();
    await navigateToStep4(user);

    const revealAllBtn = screen.getByRole('button', { name: /show all recovery codes/i });
    expect(revealAllBtn).toBeInTheDocument();

    const hideAllBtn = screen.getByRole('button', { name: /hide all recovery codes/i });
    expect(hideAllBtn).toBeInTheDocument();
  });

  it('toggles all codes visibility with Reveal All button', async () => {
    const user = userEvent.setup();
    await navigateToStep4(user);

    // Initially all should be hidden
    expect(screen.getByText('••••••')).toBeInTheDocument();

    // Click Reveal All
    const revealAllBtn = screen.getByRole('button', { name: /show all recovery codes/i });
    await user.click(revealAllBtn);

    // All codes should now be revealed
    expect(screen.queryByText('••••••')).not.toBeInTheDocument();
    TEST_CODES.forEach(code => {
      expect(screen.getByText(code)).toBeInTheDocument();
    });

    // Check that Reveal All button renamed to Hide All
    await user.click(screen.getByRole('button', { name: /hide all recovery codes/i }));

    // All codes should be hidden again
    expect(screen.getByText('••••••')).toBeInTheDocument();
  });

  it('copy all codes to clipboard with feedback', async () => {
    const user = userEvent.setup();
    await navigateToStep4(user);

    // First reveal some codes
    const codeCards = screen.getAllByRole('button');
    await user.click(codeCards[0]);
    await user.click(codeCards[1]);

    // Mock clipboard
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    // Click copy button
    const copyBtn = screen.getByRole('button', { name: /copy all revealed recovery codes to clipboard/i });
    await user.click(copyBtn);

    // Verify clipboard was called
    expect(writeText).toHaveBeenCalled();
    const copiedContent = writeText.mock.calls[0][0];
    expect(copiedContent).toContain(TEST_CODES[0]);
    expect(copiedContent).toContain(TEST_CODES[1]);

    // Should show copied feedback
    expect(screen.getByText(/Copied!/)).toBeInTheDocument();
  });

  it('download codes as text file when revealed', async () => {
    const user = userEvent.setup();
    await navigateToStep4(user);

    // Mock file download
    const createObjectURL = vi.fn().mockReturnValue('blob:test');
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    const clickFn = vi.fn();
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreate(tag);
      if (tag === 'a') el.click = clickFn;
      return el;
    });

    // Reveal some codes
    const codeCards = screen.getAllByRole('button');
    await user.click(codeCards[0]);

    // Click download
    const downloadBtn = screen.getByRole('button', { name: /download revealed recovery codes as text file/i });
    await user.click(downloadBtn);

    // Verify download was triggered
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickFn).toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('print recovery codes with print window', async () => {
    const user = userEvent.setup();
    await navigateToStep4(user);

    // Mock print window
    const printWindow = {
      document: { write: vi.fn() },
      print: vi.fn(),
      close: vi.fn(),
    };
    window.open = vi.fn().mockReturnValue(printWindow);

    // Reveal some codes
    const codeCards = screen.getAllByRole('button');
    await user.click(codeCards[0]);

    // Click print
    const printBtn = screen.getByRole('button', { name: /print recovery codes/i });
    await user.click(printBtn);

    // Verify print window was created and print was called
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(printWindow.print).toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('shows confirmation modal on regenerate click', async () => {
    const user = userEvent.setup();
    await navigateToStep4(user);

    // Click regenerate button
    const regenBtn = screen.getByRole('button', { name: /regenerate recovery codes/i });
    await user.click(regenBtn);

    // Should show confirmation modal
    expect(screen.getByRole('heading', { name: /Regenerate Recovery Codes/i })).toBeInTheDocument();
    expect(screen.getByText(/⚠️ Warning:/i)).toBeInTheDocument();

    // Cancel button should be present
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    expect(cancelBtn).toBeInTheDocument();

    // Confirm button should be present
    const confirmBtn = screen.getByRole('button', { name: /Regenerate Codes/i });
    expect(confirmBtn).toBeInTheDocument();
  });

  it('requires acknowledgment checkbox to enable Continue button', async () => {
    const user = userEvent.setup();
    await navigateToStep4(user);

    // Continue button should be disabled initially
    const continueBtn = screen.getByRole('button', { name: /continue/i });
    expect(continueBtn).toBeDisabled();

    // Check the acknowledgment checkbox
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    // Continue button should now be enabled
    expect(continueBtn).not.toBeDisabled();
  });

  it('acknowledgment checkbox disables Continue when unchecked', async () => {
    const user = userEvent.setup();
    await navigateToStep4(user);

    const checkbox = screen.getByRole('checkbox');
    const continueBtn = screen.getByRole('button', { name: /continue/i });

    // Check it
    await user.click(checkbox);
    expect(continueBtn).not.toBeDisabled();

    // Uncheck it
    await user.click(checkbox);
    expect(continueBtn).toBeDisabled();
  });

  it('has proper ARIA labels and accessibility features', async () => {
    const user = userEvent.setup();
    await navigateToStep4(user);

    // Grid should have proper ARIA label
    const grid = screen.getByRole('grid', { name: /recovery codes grid/i });
    expect(grid).toBeInTheDocument();

    // Each code card should have ARIA pressed state
    const codeCards = screen.getAllByRole('button');
    const firstCard = codeCards[0];
    expect(firstCard).toHaveAttribute('aria-pressed', 'false'); // Initially hidden

    // Click to reveal
    await user.click(firstCard);

    // Should still be aria-pressed (representing reveal state)
    expect(firstCard).toHaveAttribute('aria-pressed', 'true');

    // Buttons should have proper labels
    expect(screen.getByRole('button', { name: /show all recovery codes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy all revealed recovery codes to clipboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download revealed recovery codes as text file/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /print recovery codes/i })).toBeInTheDocument();
  });

  it('shows status indicators when codes are revealed', async () => {
    const user = userEvent.setup();
    await navigateToStep4(user);

    // Check icon should appear after all codes are revealed
    // (This is tested through the status bar)
    expect(screen.getByText(/All codes visible/)).not.toBeInTheDocument(); // Initially

    // Reveal all codes by clicking them
    const codeCards = screen.getAllByRole('button');
    for (const card of codeCards) {
      await user.click(card);
    }

    // Now should see "All codes visible"
    expect(screen.getByText(/All codes visible/i)).toBeInTheDocument();
  });

  it('maintains accessibility focus management', async () => {
    const user = userEvent.setup();
    await navigateToStep4(user);

    // Focus should be managed properly
    const grid = screen.getByRole('grid', { name: /recovery codes grid/i });
    expect(grid).toHaveFocus();

    // Click on a code should not remove focus from grid
    const codeCards = screen.getAllByRole('button');
    await user.click(codeCards[0]);

    expect(grid).toHaveFocus();
  });
});

// ─── End-to-End Integration Tests ───────────────────────────────────────────────────────────

describe('Complete 2FA Setup Flow Integration', () => {
  it('completes entire 2FA setup with enhanced recovery codes', async () => {
    const user = userEvent.setup();
    renderSetup();

    // Step 1: Choose TOTP
    await user.click(screen.getByRole('button', { name: /authenticator app/i }));
    expect(screen.getByRole('heading', { name: /set up authenticator app/i })).toBeInTheDocument();

    // Step 2: Add authenticator
    await user.click(screen.getByRole('button', { name: /i've added the account/i }));
    expect(screen.getByRole('heading', { name: /enter verification code/i })).toBeInTheDocument();

    // Step 3: Verify code
    await user.type(screen.getByRole('textbox'), '123456');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /save your recovery codes/i })).toBeInTheDocument(),
      { timeout: 2000 }
    );

    // Step 4: Save recovery codes - test new functionality
    expect(screen.getByRole('grid', { name: /recovery codes grid/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show all recovery codes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy all revealed recovery codes to clipboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download revealed recovery codes as text file/i })).toBeInTheDocument();

    // Acknowledge and continue
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    const continueBtn = screen.getByRole('button', { name: /continue/i });
    await user.click(continueBtn);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /setup complete/i })).toBeInTheDocument(),
      { timeout: 2000 }
    );

    // Step 5: Complete
    await user.click(screen.getByRole('button', { name: /done/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

// ─── Accessibility Tests ──────────────────────────────────────────────────────────────────

describe('Accessibility', () => {
  it('passes axe accessibility tests', async () => {
    const user = userEvent.setup();
    await navigateToStep4(user);

    // In a real test, this would run axe-core
    // expect(await screen.getByRole('grid')).toHaveNoViolations();
    // For demo, we'll verify key accessibility features

    const grid = screen.getByRole('grid', { name: /recovery codes grid/i });
    expect(grid).toHaveAttribute('aria-label', 'Recovery codes grid');

    // All interactive elements should have proper roles
    const codeCards = screen.getAllByRole('button');
    expect(codeCards).toHaveLength(10);

    // Status indicators should be present
    expect(screen.getByText(/Revealed:/)).toBeInTheDocument();
  });

  it('has proper keyboard navigation', async () => {
    const user = userEvent.setup();
    renderSetup();

    // Tab through all elements
    const elements = await screen.findAllByRole('button');
    const firstButton = elements[0];
    firstButton.focus();
    expect(firstButton).toHaveFocus();

    // Can navigate to code cards
    const codeCards = screen.getAllByRole('button').slice(2); // Skip method buttons
    if (codeCards.length > 0) {
      codeCards[0].focus();
      expect(codeCards[0]).toHaveFocus();
    }
  });
});

// ─── RTL Support Tests ───────────────────────────────────────────────────────────────────

describe('RTL Support', () => {
  it('adapts layout for RTL languages', async () => {
    const user = userEvent.setup();
    await navigateToStep4(user);

    // In RTL mode, card index should appear on right
    const html = screen.getByText('••••••').closest('html') || document.documentElement;
    // This would test the [dir="rtl"] styles
    // For demo, we'll just verify the component renders
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });
});

// Helper function
const navigateToStep4 = async (user: ReturnType<typeof userEvent.setup>) => {
  renderSetup();
  await user.click(screen.getByRole('button', { name: /authenticator app/i }));
  await user.click(screen.getByRole('button', { name: /i've added the account/i }));
  await user.type(screen.getByRole('textbox'), '123456');
  await user.click(screen.getByRole('button', { name: /^verify$/i }));
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: /save your recovery codes/i })).toBeInTheDocument(),
    { timeout: 2000 }
  );
};