import React, { useEffect, useId, useRef } from 'react';
import { FormError } from './FormError';

interface RegenerateCodesDialogProps {
  /** True while the regenerate request is in flight */
  isPending: boolean;
  /** Error message from a failed regenerate attempt */
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible confirmation dialog for regenerating recovery codes.
 * Moves focus to Cancel on mount, traps Tab, and closes on Escape.
 * The caller is responsible for returning focus to the trigger on close.
 */
export const RegenerateCodesDialog: React.FC<RegenerateCodesDialogProps> = ({
  isPending,
  error,
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (!isPending) onCancel();
      return;
    }
    if (e.key !== 'Tab') return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!focusable || focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    const outside = !dialogRef.current?.contains(active);
    if (e.shiftKey && (active === first || outside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || outside)) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={handleKeyDown}
        className="bg-glass-bg rounded-lg p-6 max-w-md w-full"
      >
        <h2 id={titleId} className="text-lg font-semibold mb-4">Regenerate Recovery Codes</h2>
        <div id={descId} className="tfa-warning-banner mb-4">
          <p className="text-sm">
            <strong>⚠️ Warning:</strong> This will invalidate your current recovery codes and generate a new set of 10 codes.
            Any existing recovery codes will no longer work.
          </p>
          <p className="text-xs mt-2">
            Make sure you've saved the current codes before proceeding!
          </p>
        </div>
        {error && <FormError message={error} id="regenerate-error" />}
        <div className="flex gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            aria-busy={isPending}
            className="bg-error text-white px-4 py-2 rounded-lg hover:bg-error/90 transition-colors"
          >
            {isPending ? 'Regenerating…' : 'Regenerate Codes'}
          </button>
        </div>
      </div>
    </div>
  );
};
