import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TwoFactorRecoveryFlow } from './TwoFactorRecoveryFlow';

const onComplete = vi.fn();
const onCancel = vi.fn();
const onRequestCode = vi.fn().mockResolvedValue(undefined);
const onVerify = vi.fn().mockResolvedValue(true);
const onResend = vi.fn().mockResolvedValue(undefined);

const renderFlow = (defaultEmail?: string, overrides: Partial<React.ComponentProps<typeof TwoFactorRecoveryFlow>>= {}) =>
  render(
    <TwoFactorRecoveryFlow
      onComplete={onComplete}
      onCancel={onCancel}
      defaultEmail={defaultEmail}
      onRequestCode={onRequestCode}
      onVerify={onVerify}
      onResend={onResend}
      {...overrides}
    />
  );

beforeEach(() => {
  vi.clearAllMocks();
  onRequestCode.mockResolvedValue(undefined);
  onVerify.mockResolvedValue(true);
  onResend.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Step indicator', () => {
  it('renders progress navigation', () => {
    renderFlow();
    expect(screen.getByRole('navigation', { name: /recovery progress/i })).toBeInTheDocument();
  });

  it('shows step 1 as active on mount', () => {
    renderFlow();
    const step1 = screen.getByText('Step 1: Request code');
    expect(step1).toBeInTheDocument();
  });

  it('updates active step after progressing', async () => {
    const user = userEvent.setup();
    renderFlow();
    await user.type(screen.getByRole('textbox', { name: /recovery email/i }), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send recovery code/i }));
    await waitFor(() => {
      expect(screen.getByText('Step 2: Enter code')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

describe('Step 1 – Request email', () => {
  it('renders email input', () => {
    renderFlow();
    expect(screen.getByRole('textbox', { name: /recovery email/i })).toBeInTheDocument();
  });

  it('renders heading', () => {
    renderFlow();
    expect(screen.getByRole('heading', { name: /recover your account/i })).toBeInTheDocument();
  });

  it('pre-fills default email when provided', () => {
    renderFlow('user@example.com');
    expect(screen.getByRole('textbox', { name: /recovery email/i })).toHaveValue('user@example.com');
  });

  it('shows error on empty submission', async () => {
    const user = userEvent.setup();
    renderFlow();
    await user.click(screen.getByRole('button', { name: /send recovery code/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/please enter your recovery email/i);
  });

  it('shows error on invalid email', async () => {
    const user = userEvent.setup();
    renderFlow();
    await user.type(screen.getByRole('textbox', { name: /recovery email/i }), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /send recovery code/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i);
  });

  it('clears error when user starts typing', async () => {
    const user = userEvent.setup();
    renderFlow();
    await user.click(screen.getByRole('button', { name: /send recovery code/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /recovery email/i }), 'a');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('advances to step 2 after valid email', async () => {
    const user = userEvent.setup();
    renderFlow();
    await user.type(screen.getByRole('textbox', { name: /recovery email/i }), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send recovery code/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your recovery email/i })).toBeInTheDocument();
    }, { timeout: 3000 });
    expect(onRequestCode).toHaveBeenCalledWith('test@example.com');
  });

  it('shows loading state while sending', async () => {
    const user = userEvent.setup();
    onRequestCode.mockReturnValue(new Promise(() => {}));
    renderFlow();
    await user.type(screen.getByRole('textbox', { name: /recovery email/i }), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send recovery code/i }));
    expect(await screen.findByRole('button', { name: /sending/i })).toBeInTheDocument();
  });

  it('shows warning note about security', () => {
    renderFlow();
    expect(screen.getByRole('note')).toHaveTextContent(/single-use/i);
  });

  it('renders support link', () => {
    renderFlow();
    expect(screen.getByRole('button', { name: /still can't access/i })).toBeInTheDocument();
  });

  it('calls onCancel when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderFlow();
    await user.click(screen.getByRole('button', { name: /cancel account recovery/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('Step 2 – Verify code', () => {
  const navigateToStep2 = async (user: ReturnType<typeof userEvent.setup>, email = 'test@example.com') => {
    renderFlow();
    await user.type(screen.getByRole('textbox', { name: /recovery email/i }), email);
    await user.click(screen.getByRole('button', { name: /send recovery code/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your recovery email/i })).toBeInTheDocument();
    }, { timeout: 3000 });
  };

  it('renders 6-digit code input', async () => {
    const user = userEvent.setup();
    await navigateToStep2(user);
    expect(screen.getByRole('textbox', { name: /recovery code/i })).toBeInTheDocument();
  });

  it('has inputMode="numeric"', async () => {
    const user = userEvent.setup();
    await navigateToStep2(user);
    expect(screen.getByRole('textbox', { name: /recovery code/i })).toHaveAttribute('inputMode', 'numeric');
  });

  it('shows error when submitting empty code', async () => {
    const user = userEvent.setup();
    await navigateToStep2(user);
    await user.click(screen.getByRole('button', { name: /verify code/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/full 6-digit/i);
  });

  it('shows error when code is too short', async () => {
    const user = userEvent.setup();
    await navigateToStep2(user);
    await user.type(screen.getByRole('textbox', { name: /recovery code/i }), '123');
    await user.click(screen.getByRole('button', { name: /verify code/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/full 6-digit/i);
  });

  it('strips non-numeric characters', async () => {
    const user = userEvent.setup();
    await navigateToStep2(user);
    const input = screen.getByRole('textbox', { name: /recovery code/i });
    await user.type(input, 'abc123def456');
    expect(input).toHaveValue('123456');
  });

  it('clears error when user starts typing after error', async () => {
    const user = userEvent.setup();
    await navigateToStep2(user);
    await user.click(screen.getByRole('button', { name: /verify code/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /recovery code/i }), '1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the email address the code was sent to', async () => {
    const user = userEvent.setup();
    await navigateToStep2(user, 'user@example.com');
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('advances to step 3 after valid code', async () => {
    const user = userEvent.setup();
    await navigateToStep2(user);
    await user.type(screen.getByRole('textbox', { name: /recovery code/i }), '123456');
    await user.click(screen.getByRole('button', { name: /verify code/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /recovery complete/i })).toBeInTheDocument();
    }, { timeout: 3000 });
    expect(onVerify).toHaveBeenCalledWith('123456');
  });

  it('shows loading state while verifying', async () => {
    const user = userEvent.setup();
    await navigateToStep2(user);
    onVerify.mockReturnValue(new Promise(() => {}));
    await user.type(screen.getByRole('textbox', { name: /recovery code/i }), '123456');
    await user.click(screen.getByRole('button', { name: /verify code/i }));
    expect(await screen.findByRole('button', { name: /verifying/i })).toBeInTheDocument();
  });

  it('back button returns to step 1', async () => {
    const user = userEvent.setup();
    await navigateToStep2(user);
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByRole('heading', { name: /recover your account/i })).toBeInTheDocument();
  });

  it('renders resend button with cooldown countdown', async () => {
    const user = userEvent.setup();
    await navigateToStep2(user);
    expect(screen.getByRole('button', { name: /resend again in 30 seconds/i })).toBeInTheDocument();
  });

  it('cooldown decrements over time', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const user = userEvent.setup();
    renderFlow();
    await user.type(screen.getByRole('textbox', { name: /recovery email/i }), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send recovery code/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your recovery email/i })).toBeInTheDocument();
    }, { timeout: 3000 });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByRole('button', { name: /resend again in 25 seconds/i })).toBeInTheDocument();
  });

  it('resend button becomes enabled after cooldown expires', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const user = userEvent.setup();
    renderFlow();
    await user.type(screen.getByRole('textbox', { name: /recovery email/i }), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send recovery code/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your recovery email/i })).toBeInTheDocument();
    }, { timeout: 3000 });
    act(() => { vi.advanceTimersByTime(31000); });
    expect(screen.getByRole('button', { name: /resend recovery code/i })).toBeInTheDocument();
  });

  it('renders support link', async () => {
    const user = userEvent.setup();
    await navigateToStep2(user);
    expect(screen.getByRole('button', { name: /still can't access/i })).toBeInTheDocument();
  });
});

describe('Step 2 – Verification failures', () => {
  const navigateToStep2 = async (user: ReturnType<typeof userEvent.setup>) => {
    renderFlow();
    await user.type(screen.getByRole('textbox', { name: /recovery email/i }), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send recovery code/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your recovery email/i })).toBeInTheDocument();
    }, { timeout: 3000 });
  };

  it('shows an error and stays on the verify step when onVerify resolves false', async () => {
    onVerify.mockResolvedValue(false);
    const user = userEvent.setup();
    await navigateToStep2(user);
    await user.type(screen.getByRole('textbox', { name: /recovery code/i }), '000000');
    await user.click(screen.getByRole('button', { name: /verify code/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid or has expired/i);
    });
    expect(screen.getByRole('heading', { name: /check your recovery email/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /recovery complete/i })).not.toBeInTheDocument();
  });

  it('shows a retryable error when onVerify rejects', async () => {
    onVerify.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    await navigateToStep2(user);
    await user.type(screen.getByRole('textbox', { name: /recovery code/i }), '123456');
    await user.click(screen.getByRole('button', { name: /verify code/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/unable to verify/i);
    });
    // Fail closed: stays on verify step and allows retry.
    expect(screen.queryByRole('heading', { name: /recovery complete/i })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /recovery code/i })).not.toBeDisabled();
  });

  it('locks input after N failures', async () => {
    onVerify.mockResolvedValue(false);
    const user = userEvent.setup();
    renderFlow(undefined, { maxAttempts: 3 });
    await user.type(screen.getByRole('textbox', { name: /recovery email/i }), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send recovery code/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your recovery email/i })).toBeInTheDocument();
    }, { timeout: 3000 });

    const input = screen.getByRole('textbox', { name: /recovery code/i });
    for (let i = 0; i < 3; i++) {
      await user.clear(input);
      await user.type(input, '000000');
      await user.click(screen.getByRole('button', { name: /verify code/i }));
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    }

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/too many incorrect attempts/i);
    });
    expect(screen.getByRole('textbox', { name: /recovery code/i })).toBeDisabled();
    expect(onVerify).toHaveBeenCalledTimes(3);
  });
});

describe('Step 3 – Recovery success', () => {
  const navigateToStep3 = async (user: ReturnType<typeof userEvent.setup>) => {
    renderFlow();
    await user.type(screen.getByRole('textbox', { name: /recovery email/i }), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send recovery code/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your recovery email/i })).toBeInTheDocument();
    }, { timeout: 3000 });
    await user.type(screen.getByRole('textbox', { name: /recovery code/i }), '123456');
    await user.click(screen.getByRole('button', { name: /verify code/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /recovery complete/i })).toBeInTheDocument();
    }, { timeout: 3000 });
  };

  it('renders success heading', async () => {
    const user = userEvent.setup();
    await navigateToStep3(user);
    expect(screen.getByRole('heading', { name: /recovery complete/i })).toBeInTheDocument();
  });

  it('renders success message', async () => {
    const user = userEvent.setup();
    await navigateToStep3(user);
    expect(screen.getByText(/recovery successful/i)).toBeInTheDocument();
  });

  it('calls onComplete when Continue is clicked', async () => {
    const user = userEvent.setup();
    await navigateToStep3(user);
    await user.click(screen.getByRole('button', { name: /continue to sign in/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not show cancel button', async () => {
    const user = userEvent.setup();
    await navigateToStep3(user);
    expect(screen.queryByRole('button', { name: /cancel account recovery/i })).not.toBeInTheDocument();
  });
});

describe('Accessibility', () => {
  it('has section with aria-labelledby pointing to heading', () => {
    renderFlow();
    const section = screen.getByRole('region', { name: /recover your account/i });
    expect(section).toBeInTheDocument();
  });

  it('step heading is focused after step transition', async () => {
    const user = userEvent.setup();
    renderFlow();
    await user.type(screen.getByRole('textbox', { name: /recovery email/i }), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send recovery code/i }));
    await waitFor(() => {
      const heading = screen.getByRole('heading', { name: /check your recovery email/i });
      expect(heading).toHaveFocus();
    }, { timeout: 3000 });
  });
});
