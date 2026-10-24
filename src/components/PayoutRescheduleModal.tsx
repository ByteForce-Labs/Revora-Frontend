import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { analyzeConflicts } from './PayoutTimeline/conflictAnalysis';
import type { PayoutEvent } from './PayoutTimeline/PayoutTimeline';

export type ConflictType = 'hard' | 'soft';

export interface Conflict {
  id: string;
  type?: ConflictType;
  severity?: ConflictType;
  message: string;
}

export interface PayoutRescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newDate: string, note: string) => void;
  initialDate: string;
  currentDate?: string;
  conflicts?: Conflict[];
  allPayouts?: PayoutEvent[];
  payoutId?: string;
  getConflicts?: (date: string) => Conflict[];
}

export const PayoutRescheduleModal: React.FC<PayoutRescheduleModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialDate,
  currentDate,
  conflicts: conflictsProp,
  allPayouts,
  payoutId,
  getConflicts,
}) => {
  const [newDate, setNewDate] = useState(initialDate);
  const [note, setNote] = useState('');
  const dateId = useId();
  const noteId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setNewDate(initialDate);
      setNote('');
    }
  }, [isOpen, initialDate]);

  useEffect(() => {
    if (!isOpen) return;

    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !focusable || focusable.length === 0) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    setTimeout(() => {
      confirmRef.current?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  let computedConflicts: Conflict[] = [];
  if (getConflicts) {
    computedConflicts = getConflicts(newDate);
  } else if (allPayouts && payoutId) {
    computedConflicts = analyzeConflicts(payoutId, newDate, allPayouts).map((c) => ({
      id: c.id,
      severity: c.severity,
      type: c.severity,
      message: c.message,
    }));
  } else if (conflictsProp) {
    computedConflicts = conflictsProp;
  }

  const conflicts = computedConflicts;
  const hasHardConflict = conflicts.some((c) => c.type === 'hard' || c.severity === 'hard');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const isEmpty = !newDate;
  const isPast = newDate ? newDate < todayStr : false;
  const isUnchanged = currentDate ? newDate === currentDate : initialDate ? newDate === initialDate && currentDate === undefined ? false : currentDate ? newDate === currentDate : false : false;
  // If currentDate not provided, treat as unchanged only if equals initial and we want to be strict? Issue says "invalid dates" - empty/past/unchanged
  const unchanged = currentDate !== undefined ? newDate === currentDate : newDate === initialDate && note === '';
  const invalid = isEmpty || isPast || newDate === (currentDate ?? initialDate);
  const canConfirm = !hasHardConflict && !invalid;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payout-reschedule-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-700 p-6 shadow-2xl"
        role="document"
      >
        <h2 id="payout-reschedule-title" className="text-lg font-semibold mb-4">Reschedule Payout</h2>
        
        <div className="space-y-4 mb-6">
          <div>
            <label htmlFor={dateId} className="block text-sm font-medium">Select New Date</label>
            <input
              id={dateId}
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg"
              aria-invalid={invalid}
            />
            {(isEmpty || isPast || (currentDate !== undefined ? newDate === currentDate : newDate === initialDate)) && (
              <p className="text-xs text-red-400 mt-1">
                {isEmpty ? 'Date is required' : isPast ? 'Date cannot be in the past' : 'Date must be different from the current date'}
              </p>
            )}
          </div>
          
          {conflicts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-400" />
                Detected Conflicts
              </h3>
              <ul className="space-y-1">
                {conflicts.map((c) => (
                  <li key={c.id} className={`text-xs flex items-center gap-2 ${c.type === 'hard' ? 'text-red-400' : 'text-amber-400'}`}>
                    <Clock size={12} />
                    {c.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label htmlFor={noteId} className="block text-sm font-medium">Audit Note</label>
            <textarea
              id={noteId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg"
              rows={3}
              placeholder="Reason for rescheduling..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button ref={cancelRef} onClick={onClose} className="px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700">Cancel</button>
          <button
            ref={confirmRef}
            onClick={() => onConfirm(newDate, note)}
            disabled={!canConfirm}
            className={`px-4 py-2 rounded-lg font-medium ${!canConfirm ? 'bg-slate-700 text-slate-500' : 'bg-primary text-white hover:bg-primary-dark'}`}
          >
            Confirm Reschedule
          </button>
        </div>
      </div>
    </div>
  );
};
