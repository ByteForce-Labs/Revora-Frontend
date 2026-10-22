/**
 * ComplianceAppealForm — Appeal-submission form with attachments (Issue #286).
 *
 * Features:
 * - Reason categories (dropdown)
 * - Free-text explanation
 * - Attachment slots (drag-and-drop / file input)
 * - Autosave draft to localStorage
 * - Unsaved-changes warning (beforeunload + navigation)
 * - Confirmation screen with expected review timeline
 */

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react";

/* ─── Constants ────────────────────────────────────────────────────── */

const STORAGE_KEY = "compliance-appeal-draft";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt";

const APPEAL_REASONS = [
  { value: "incorrect_info", label: "Incorrect information on hold" },
  { value: "already_verified", label: "Identity already verified" },
  { value: "document_error", label: "Document upload error" },
  { value: "time_sensitive", label: "Time-sensitive transaction" },
  { value: "other", label: "Other (please explain)" },
] as const;

interface AppealDraft {
  holdId: string;
  reason: string;
  explanation: string;
  attachmentNames: string[];
  updatedAt: string;
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function loadDraft(holdId: string): AppealDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppealDraft;
    return parsed.holdId === holdId ? parsed : null;
  } catch {
    return null;
  }
}

function saveDraft(draft: AppealDraft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage quota may be exceeded; silently fail
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function formatExpectedDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/* ─── Attachment File Type Icon ────────────────────────────────────── */

function FileTypeIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return (
    <span className="caf-file-type" aria-hidden="true">
      {ext === "pdf" ? "PDF" : ext === "doc" || ext === "docx" ? "DOC" : "FILE"}
    </span>
  );
}

/* ─── Unsaved Changes Warning ──────────────────────────────────────── */

function useUnsavedWarning(hasUnsaved: boolean) {
  useEffect(() => {
    if (!hasUnsaved) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);
}

/* ─── Props ─────────────────────────────────────────────────────────── */

export interface ComplianceAppealFormProps {
  holdId: string;
  holdTitle: string;
  /** Called when the form is submitted successfully */
  onSubmit?: (data: {
    holdId: string;
    reason: string;
    explanation: string;
    attachments: File[];
  }) => Promise<void>;
  onClose?: () => void;
  isOpen?: boolean;
}

/* ─── Step: Form ───────────────────────────────────────────────────── */

function AppealFormStep({
  holdId,
  holdTitle,
  draft,
  reason,
  setReason,
  explanation,
  setExplanation,
  attachments,
  setAttachments,
  isSubmitting,
  onSubmit,
}: {
  holdId: string;
  holdTitle: string;
  draft: AppealDraft | null;
  reason: string;
  setReason: (v: string) => void;
  explanation: string;
  setExplanation: (v: string) => void;
  attachments: File[];
  setAttachments: React.Dispatch<React.SetStateAction<File[]>>;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const hasUnsaved = reason !== "" || explanation !== "" || attachments.length > 0;
  const [fileError, setFileError] = useState<string | null>(null);

  useUnsavedWarning(hasUnsaved);

  const handleAddFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      setFileError(null);

      const newFiles: File[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > MAX_FILE_SIZE) {
          setFileError(`"${file.name}" exceeds the 10 MB size limit.`);
          continue;
        }
        newFiles.push(file);
      }

      if (newFiles.length > 0) {
        setAttachments((prev) => [...prev, ...newFiles]);
      }
    },
    [setAttachments],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleAddFiles(e.dataTransfer.files);
    },
    [handleAddFiles],
  );

  const removeAttachment = useCallback(
    (index: number) => {
      setAttachments((prev) => prev.filter((_, i) => i !== index));
    },
    [setAttachments],
  );

  // Autosave
  useEffect(() => {
    if (!hasUnsaved) return;
    const timer = setTimeout(() => {
      saveDraft({
        holdId,
        reason,
        explanation,
        attachmentNames: attachments.map((f) => f.name),
        updatedAt: new Date().toISOString(),
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [holdId, reason, explanation, attachments, hasUnsaved]);

  return (
    <form onSubmit={onSubmit} className="caf-form" noValidate>
      {/* Hold context */}
      <div className="caf-context">
        <AlertTriangle size={16} aria-hidden="true" />
        <span>Appealing: <strong>{holdTitle}</strong></span>
      </div>

      {/* Reason category */}
      <div className="caf-field">
        <label htmlFor={`${formId}-reason`} className="caf-label">
          Reason for appeal
        </label>
        <select
          id={`${formId}-reason`}
          className="caf-select"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          aria-required="true"
        >
          <option value="" disabled>
            Select a reason…
          </option>
          {APPEAL_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Free-text explanation */}
      <div className="caf-field">
        <label htmlFor={`${formId}-explanation`} className="caf-label">
          Explanation
        </label>
        <textarea
          id={`${formId}-explanation`}
          className="caf-textarea"
          rows={5}
          placeholder="Describe why this hold should be reviewed…"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          aria-describedby={`${formId}-explanation-hint`}
        />
        <span id={`${formId}-explanation-hint`} className="caf-hint">
          Provide as much detail as possible to help us review your appeal quickly.
        </span>
      </div>

      {/* Attachments */}
      <div className="caf-field">
        <label className="caf-label">Supporting documents (optional)</label>
        {/* Kept outside the role="button" dropzone to avoid nested interactive controls */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          className="caf-file-input"
          onChange={(e) => handleAddFiles(e.target.files)}
          aria-hidden="true"
          tabIndex={-1}
        />
        <div
          className="caf-dropzone"
          role="button"
          tabIndex={0}
          aria-label="Drop files here or click to upload"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <Upload size={20} aria-hidden="true" />
          <span>Drop files here or click to upload</span>
          <span className="caf-hint">PDF, DOC, JPG, PNG, TXT (up to 10 MB each)</span>
        </div>

        {fileError && (
          <p className="caf-field-error" role="alert">
            {fileError}
          </p>
        )}

        {attachments.length > 0 && (
          <ul className="caf-file-list">
            {attachments.map((file, idx) => (
              <li key={`${file.name}-${idx}`} className="caf-file-item">
                <FileTypeIcon fileName={file.name} />
                <span className="caf-file-name">{file.name}</span>
                <span className="caf-file-size">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  className="caf-file-remove"
                  onClick={() => removeAttachment(idx)}
                  aria-label={`Remove ${file.name}`}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Autosave indicator */}
      <AutosaveChip reason={reason} explanation={explanation} attachments={attachments} draft={draft} />

      {/* Submit */}
      <div className="caf-actions">
        <button
          type="submit"
          className="caf-btn caf-btn--primary"
          disabled={!reason || isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="caf-spin" aria-hidden="true" />
              Submitting…
            </>
          ) : (
            "Submit appeal"
          )}
        </button>
      </div>
    </form>
  );
}

/* ─── Autosave Chip ────────────────────────────────────────────────── */

function AutosaveChip({
  reason,
  explanation,
  attachments,
  draft,
}: {
  reason: string;
  explanation: string;
  attachments: File[];
  draft: AppealDraft | null;
}) {
  const hasContent = reason !== "" || explanation !== "" || attachments.length > 0;
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    if (!hasContent) {
      setStatus("idle");
      return;
    }

    setStatus("saving");
    const timer = setTimeout(() => setStatus("saved"), 1200);
    return () => clearTimeout(timer);
  }, [reason, explanation, attachments.length, hasContent]);

  const chipLabel =
    status === "saving"
      ? "Saving draft…"
      : status === "saved" && draft
        ? `Draft saved ${formatRelativeTimeAgo(draft.updatedAt)}`
        : "Draft saved";

  if (!hasContent) return null;

  return (
    <div
      className={`caf-autosave-chip ${status === "saving" ? "caf-autosave-chip--saving" : "caf-autosave-chip--saved"}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {status === "saving" ? (
        <Loader2 size={12} className="caf-spin" aria-hidden="true" />
      ) : (
        <CheckCircle2 size={12} aria-hidden="true" />
      )}
      <span>{chipLabel}</span>
    </div>
  );
}

function formatRelativeTimeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
}

/* ─── Step: Confirmation ───────────────────────────────────────────── */

function AppealConfirmationStep({
  holdTitle,
  onClose,
}: {
  holdTitle: string;
  onClose?: () => void;
}) {
  const expectedDate = formatExpectedDate(3); // 3 business days

  return (
    <div className="caf-confirmation">
      <div className="caf-confirmation-icon">
        <CheckCircle2 size={48} aria-hidden="true" />
      </div>
      <h2 className="caf-confirmation-title">Appeal submitted</h2>
      <p className="caf-confirmation-text">
        Your appeal for <strong>"{holdTitle}"</strong> has been received.
      </p>

      <div className="caf-confirmation-timeline">
        <div className="caf-timeline-item">
          <div className="caf-timeline-dot caf-timeline-dot--active" />
          <div className="caf-timeline-content">
            <span className="caf-timeline-title">Submitted</span>
            <span className="caf-timeline-desc">Your appeal is being queued for review</span>
          </div>
        </div>
        <div className="caf-timeline-item">
          <div className="caf-timeline-dot" />
          <div className="caf-timeline-content">
            <span className="caf-timeline-title">In Review</span>
            <span className="caf-timeline-desc">
              Our compliance team will review your appeal
            </span>
          </div>
        </div>
        <div className="caf-timeline-item">
          <div className="caf-timeline-dot caf-timeline-dot--success" />
          <div className="caf-timeline-content">
            <span className="caf-timeline-title">Decision</span>
            <span className="caf-timeline-desc">
              Expected by <strong>{expectedDate}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="caf-confirmation-note">
        <Clock size={16} aria-hidden="true" />
        <span>
          Review usually takes <strong>1–3 business days</strong>. You will be notified
          by email when a decision is made.
        </span>
      </div>

      {onClose && (
        <button className="caf-btn caf-btn--secondary caf-btn--full" onClick={onClose}>
          Close
        </button>
      )}
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────── */

export const ComplianceAppealForm: React.FC<ComplianceAppealFormProps> = ({
  holdId,
  holdTitle,
  onSubmit: externalOnSubmit,
  onClose,
  isOpen = true,
}) => {
  const [step, setStep] = useState<"form" | "confirmation">("form");
  const [reason, setReason] = useState("");
  const [explanation, setExplanation] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Restore draft on mount
  useEffect(() => {
    if (!isOpen) return;
    const draft = loadDraft(holdId);
    if (draft) {
      setReason(draft.reason);
      setExplanation(draft.explanation);
      // We cannot restore File objects, just flag that there were attachments
    }
  }, [holdId, isOpen]);

  // Focus trap & scroll lock
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;

    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length > 0) {
      focusable[0].focus();
    }

    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen, step]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!reason) return;

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        if (externalOnSubmit) {
          await externalOnSubmit({ holdId, reason, explanation, attachments });
        } else {
          // Simulate submission
          await new Promise((r) => setTimeout(r, 1500));
        }

        clearDraft();
        setStep("confirmation");
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : "Failed to submit appeal. Please try again.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [holdId, reason, explanation, attachments, externalOnSubmit],
  );

  const handleClose = useCallback(() => {
    // Only warn if user has content in the form
    const hasContent = reason !== "" || explanation !== "" || attachments.length > 0;
    if (hasContent && step === "form") {
      saveDraft({
        holdId,
        reason,
        explanation,
        attachmentNames: attachments.map((f) => f.name),
        updatedAt: new Date().toISOString(),
      });
    }
    onClose?.();
  }, [holdId, reason, explanation, attachments, step, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const draft = loadDraft(holdId);

  return (
    <div
      className="caf-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={handleOverlayClick}
    >
      <div className="caf-dialog glass-card" ref={dialogRef}>
        {step === "confirmation" ? (
          <AppealConfirmationStep holdTitle={holdTitle} onClose={handleClose} />
        ) : (
          <>
            <div className="caf-dialog-header">
              <h2 id={titleId} className="caf-dialog-title">
                Submit an Appeal
              </h2>
              <button
                type="button"
                className="caf-dialog-close"
                onClick={handleClose}
                aria-label="Close appeal form"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {draft && (
              <div className="caf-draft-restored" role="status">
                <FileText size={14} aria-hidden="true" />
                <span>Draft restored from {formatRelativeTimeAgo(draft.updatedAt)}</span>
              </div>
            )}

            {submitError && (
              <div className="caf-submit-error" role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="caf-scroll-area">
              <AppealFormStep
                holdId={holdId}
                holdTitle={holdTitle}
                draft={draft}
                reason={reason}
                setReason={setReason}
                explanation={explanation}
                setExplanation={setExplanation}
                attachments={attachments}
                setAttachments={setAttachments}
                isSubmitting={isSubmitting}
                onSubmit={handleSubmit}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
