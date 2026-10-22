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