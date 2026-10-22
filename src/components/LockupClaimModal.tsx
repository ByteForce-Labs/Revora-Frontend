import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, ChevronRight, ExternalLink, Info, Sparkles, X } from 'lucide-react';
import { Button } from './Button';

export interface LockupClaimResult {
  hash?: string;
}

export interface LockupClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  unlockedAmount?: string;
  gasEstimate?: number;
  initialAutoClaim?: boolean;
  onClaim?: (options: { autoClaim: boolean }) => Promise<LockupClaimResult | void>;
  explorerBaseUrl?: string;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const LockupClaimModal: React.FC<LockupClaimModalProps> = ({
  isOpen,
  onClose,
  unlockedAmount = '$12,480.00',
  gasEstimate = 22,
  initialAutoClaim = false,
  onClaim,
  explorerBaseUrl = 'https://stellar.expert/explorer/public/tx/',
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const inFlightRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const [autoClaim, setAutoClaim] = useState(initialAutoClaim);
  const [claimState, setClaimState] = useState<
    'idle' | 'pending' | 'confirmed' | 'later' | 'warning' | 'error'
  >('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [highGasConfirmed, setHighGasConfirmed] = useState(false);
  const [showAutoClaimInfo, setShowAutoClaimInfo] = useState(false);

  const restoreFocus = useCallback(() => {
    const opener = openerRef.current;
    if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
      opener.focus();
    }
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    restoreFocus();
  }, [onClose, restoreFocus]);

  useEffect(() => {
    if (!isOpen) {
      setAutoClaim(initialAutoClaim);
      setClaimState('idle');
      setStatusMessage('');
      setTxHash(null);
      setHighGasConfirmed(false);
      inFlightRef.current = false;
      return;
    }

    const activeElement = document.activeElement;
    openerRef.current = activeElement instanceof HTMLElement ? activeElement : null;

    if (dialogRef.current) {
      dialogRef.current.focus();
    }

    return () => {
      restoreFocus();
    };
  }, [isOpen, initialAutoClaim, restoreFocus]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
        return;
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter(
          (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true',
        );

        if (focusable.length === 0) {
          event.preventDefault();
          dialogRef.current.focus();
          return;
        }

        const active = document.activeElement as HTMLElement | null;
        const currentIndex = active ? focusable.indexOf(active) : -1;

        if (event.shiftKey) {
          if (currentIndex <= 0) {
            event.preventDefault();
            focusable[focusable.length - 1].focus();
          }
        } else if (currentIndex === -1 || currentIndex === focusable.length - 1) {
          event.preventDefault();
          focusable[0].focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const handleClaimNow = async () => {
    if (inFlightRef.current || claimState === 'pending') {
      return;
    }

    if (!unlockedAmount || unlockedAmount === '$0.00') {
      setClaimState('error');
      setStatusMessage('Nothing is currently available to claim.');
      return;
    }

    if (gasEstimate >= 80 && !highGasConfirmed) {
      setHighGasConfirmed(true);
      setClaimState('warning');
      setStatusMessage(
        'High gas fees may reduce your expected proceeds. Consider waiting or using auto-claim.',
      );
      return;
    }

    inFlightRef.current = true;
    setClaimState('pending');
    setStatusMessage('Submitting claim request…');
    setTxHash(null);

    try {
      const result: LockupClaimResult | void = await (onClaim ? onClaim({ autoClaim }) : Promise.resolve({}));
      const resolvedHash =
        result && typeof result === 'object' && typeof result.hash === 'string' && result.hash.trim()
          ? result.hash.trim()
          : null;
      setTxHash(resolvedHash);
      setClaimState('confirmed');
      setStatusMessage('Claim request queued. We will keep you updated as it confirms.');
    } catch (error) {
      setClaimState('error');
      setStatusMessage(
        error instanceof Error && error.message
          ? error.message
          : 'Unable to submit claim request. Please try again.',
      );
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleClaimLater = () => {
    if (inFlightRef.current || claimState === 'pending') {
      return;
    }
    setHighGasConfirmed(false);
    setTxHash(null);
    setClaimState('later');
    setStatusMessage('We will remind you again at a better time to claim this unlock.');
  };

  const isPending = claimState === 'pending';
  const gasLabel = gasEstimate >= 80 ? 'High' : gasEstimate >= 50 ? 'Moderate' : 'Low';
  const explorerUrl = txHash ? `${explorerBaseUrl}${encodeURIComponent(txHash)}` : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6"
      onClick={handleClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl outline-none dark:border-slate-700 dark:bg-slate-900"
        dir="auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Unlock available</p>
            <h2 id={titleId} className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              Claim your unlocked balance
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            aria-label="Close claim modal"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p id={descriptionId} className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Your lockup has unlocked partially. Choose how you want to receive the available balance.
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Unlocked amount</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900 dark:text-white">{unlockedAmount}</p>
            </div>
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <Sparkles size={20} aria-hidden="true" />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900/80">
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-200">Estimated gas</p>
              <p className="text-slate-500 dark:text-slate-400">{gasLabel.toLowerCase()} network fee estimate</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-900 dark:text-white">{gasEstimate}%</p>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">~${Math.max(8, Math.round(gasEstimate * 1.2)).toFixed(0)} fee</p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Info size={16} aria-hidden="true" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <label htmlFor="auto-claim-toggle" className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    id="auto-claim-toggle"
                    type="checkbox"
                    checked={autoClaim}
                    onChange={(event) => setAutoClaim(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  Auto-claim on next unlock
                </label>
                <button
                  type="button"
                  onClick={() => setShowAutoClaimInfo((value) => !value)}
                  className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                  aria-expanded={showAutoClaimInfo}
                  aria-controls="auto-claim-info"
                  aria-label="Learn more about auto-claim"
                >
                  <Info size={16} aria-hidden="true" />
                </button>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                We will claim automatically the next time this lockup unlocks, so you do not need to revisit this screen.
              </p>
              {showAutoClaimInfo && (
                <div id="auto-claim-info" role="tooltip" className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                  Auto-claim keeps the process hands-off, but you can still change your preference later from the account settings.
                </div>
              )}
            </div>
          </div>
        </div>

        {claimState === 'warning' && (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>High gas fees may reduce your expected proceeds. Review the estimate before continuing.</span>
          </div>
        )}

        {claimState === 'error' && (
          <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {statusMessage}
          </div>
        )}

        {claimState !== 'idle' && claimState !== 'warning' && claimState !== 'error' && (
          <div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            <p>{statusMessage}</p>
            {txHash && explorerUrl && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span>Transaction hash:</span>
                <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-emerald-900">
                  {txHash}
                </code>
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-emerald-800 underline hover:text-emerald-950"
                >
                  View on explorer
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClaimLater}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            Claim later
          </Button>
          <Button
            type="button"
            onClick={handleClaimNow}
            loading={isPending}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {claimState === 'warning' ? 'Claim anyway' : 'Claim now'}
            <ChevronRight size={16} className="ml-2 inline" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
};
