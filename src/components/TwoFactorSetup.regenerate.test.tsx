import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { TwoFactorSetup } from './TwoFactorSetup';
import TwoFactorBackupCodesPage from '../pages/TwoFactorBackupCodesPage';

const OLD_CODES = Array.from({ length: 10 }, (_, i) => `OLD-CODE-${i + 1}`);
const NEW_CODES = Array.from({ length: 10 }, (_, i) => `NEW-CODE-${i + 1}`);

const renderSetupAtStep4 = async (
  user: ReturnType<typeof userEvent.setup>,
  onRegenerateCodes?: () => Promise<string[]>,
) => {
  const utils = render(
    <TwoFactorSetup
      onComplete={vi.fn()}
      onCancel={vi.fn()}
      totpSecret="JBSWY3DPEHPK3PXP"
      recoveryCodes={OLD_CODES}
      verifyCode={async ({ code }: { code: string }) => code === '123456'}
      onRegenerateCodes={onRegenerateCodes}
    />,
  );
  await user.click(screen.getByRole('button', { name: /authenticator app/i }));
  await user.click(screen.getByRole('button', { name: /i've added the account/i }));
  await user.type(screen.getByRole('textbox'), '123456');
  await user.click(screen.getByRole('button', { name: /^verify$/i }));
  await screen.findByRole('heading', { name: /save your recovery codes/i });
  return utils;
};

describe('TwoFactorSetup – regenerate recovery codes', () => {
  it('hides the Regenerate action when no handler is supplied', async () => {
    const user = userEvent.setup();
    await renderSetupAtStep4(user);
    expect(screen.queryByRole('button', { name: /regenerate recovery codes/i })).not.toBeInTheDocument();
  });

  it('calls the handler and replaces the displayed codes, resetting reveal state', async () => {
    const user = userEvent.setup();
    const onRegenerateCodes = vi.fn().mockResolvedValue(NEW_CODES);
    await renderSetupAtStep4(user, onRegenerateCodes);

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /show all recovery codes/i }));
    expect(screen.getByText(OLD_CODES[0])).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /regenerate recovery codes/i }));
    await user.click(screen.getByRole('button', { name: /^regenerate codes$/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onRegenerateCodes).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(OLD_CODES[0])).not.toBeInTheDocument();
    expect(screen.getByText(/0\/10/)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /show all recovery codes/i }));
    expect(screen.getByText(NEW_CODES[0])).toBeInTheDocument();
    expect(screen.queryByText(OLD_CODES[0])).not.toBeInTheDocument();
  });

  it('shows pending state while the request is in flight', async () => {
    const user = userEvent.setup();
    let resolve!: (codes: string[]) => void;
    const onRegenerateCodes = vi.fn(() => new Promise<string[]>((r) => { resolve = r; }));
    await renderSetupAtStep4(user, onRegenerateCodes);

    await user.click(screen.getByRole('button', { name: /regenerate recovery codes/i }));
    await user.click(screen.getByRole('button', { name: /^regenerate codes$/i }));

    expect(screen.getByRole('button', { name: /regenerating/i })).toBeDisabled();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i })).toBeDisabled();

    resolve(NEW_CODES);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows an error and keeps the old codes when regeneration fails', async () => {
    const user = userEvent.setup();
    const onRegenerateCodes = vi.fn().mockRejectedValue(new Error('boom'));
    await renderSetupAtStep4(user, onRegenerateCodes);

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /show all recovery codes/i }));

    await user.click(screen.getByRole('button', { name: /regenerate recovery codes/i }));
    await user.click(screen.getByRole('button', { name: /^regenerate codes$/i }));

    expect(await screen.findByText(/could not regenerate recovery codes/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(OLD_CODES[0])).toBeInTheDocument();
    expect(screen.queryByText(NEW_CODES[0])).not.toBeInTheDocument();
  });

  describe('confirmation dialog accessibility', () => {
    it('is a labelled modal dialog with initial focus on Cancel', async () => {
      const user = userEvent.setup();
      await renderSetupAtStep4(user, vi.fn().mockResolvedValue(NEW_CODES));
      await user.click(screen.getByRole('button', { name: /regenerate recovery codes/i }));

      const dialog = screen.getByRole('dialog', { name: /regenerate recovery codes/i });
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i })).toHaveFocus();
    });

    it('closes on Escape and returns focus to the trigger', async () => {
      const user = userEvent.setup();
      await renderSetupAtStep4(user, vi.fn().mockResolvedValue(NEW_CODES));
      const trigger = screen.getByRole('button', { name: /regenerate recovery codes/i });
      await user.click(trigger);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });

    it('traps Tab focus inside the dialog', async () => {
      const user = userEvent.setup();
      await renderSetupAtStep4(user, vi.fn().mockResolvedValue(NEW_CODES));
      await user.click(screen.getByRole('button', { name: /regenerate recovery codes/i }));

      const cancel = within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i });
      const confirm = screen.getByRole('button', { name: /^regenerate codes$/i });
      expect(cancel).toHaveFocus();
      await user.tab();
      expect(confirm).toHaveFocus();
      await user.tab();
      expect(cancel).toHaveFocus();
      await user.tab({ shift: true });
      expect(confirm).toHaveFocus();
    });

    it('has no axe violations with the dialog open', async () => {
      const user = userEvent.setup();
      await renderSetupAtStep4(user, vi.fn().mockResolvedValue(NEW_CODES));
      await user.click(screen.getByRole('button', { name: /regenerate recovery codes/i }));
      // Scoped to the dialog: the pre-existing role="grid" markup is out of scope for this change.
      expect(await axe(screen.getByRole('dialog'))).toHaveNoViolations();
    });
  });
});

describe('TwoFactorBackupCodesPage – regenerate recovery codes', () => {
  it('hides Regenerate when no handler is supplied', () => {
    render(<TwoFactorBackupCodesPage />);
    expect(screen.queryByRole('button', { name: /regenerate/i })).not.toBeInTheDocument();
  });

  it('replaces the codes on success and resets reveal state', async () => {
    const user = userEvent.setup();
    const onRegenerateCodes = vi.fn().mockResolvedValue(NEW_CODES);
    render(<TwoFactorBackupCodesPage onRegenerateCodes={onRegenerateCodes} />);

    await user.click(screen.getByRole('button', { name: /reveal all/i }));
    expect(screen.getByText(/Revealed: 10\/10/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^regenerate$/i }));
    await user.click(screen.getByRole('button', { name: /^regenerate codes$/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onRegenerateCodes).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/0\/10/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /reveal all/i }));
    expect(screen.getByText(NEW_CODES[0])).toBeInTheDocument();
    expect(screen.queryByText('REVR-A1B2-C3D4')).not.toBeInTheDocument();
  });

  it('shows an error and keeps the old codes on failure', async () => {
    const user = userEvent.setup();
    render(<TwoFactorBackupCodesPage onRegenerateCodes={vi.fn().mockRejectedValue(new Error('x'))} />);

    await user.click(screen.getByRole('button', { name: /reveal all/i }));
    await user.click(screen.getByRole('button', { name: /^regenerate$/i }));
    await user.click(screen.getByRole('button', { name: /^regenerate codes$/i }));

    expect(await screen.findByText(/could not regenerate recovery codes/i)).toBeInTheDocument();
    expect(screen.getByText('REVR-A1B2-C3D4')).toBeInTheDocument();
  });

  it('closes on Escape, returns focus to the trigger, and passes axe', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TwoFactorBackupCodesPage onRegenerateCodes={vi.fn().mockResolvedValue(NEW_CODES)} />,
    );
    const trigger = screen.getByRole('button', { name: /^regenerate$/i });
    await user.click(trigger);
    expect(await axe(container)).toHaveNoViolations();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
