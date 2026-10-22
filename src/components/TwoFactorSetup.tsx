import React, { useState, useRef, useEffect, useId, useCallback, useMemo } from 'react';
import {
  Smartphone,
  MessageSquare,
  Key,
  Copy,
  Check,
  Download,
  Printer,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  Eye,
  EyeOff,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Copy as CopyIcon,
} from 'lucide-react';
import { Button } from './Button';
import { FormError } from './FormError';
import { RegenerateCodesDialog } from './RegenerateCodesDialog';
import { WizardStepper, type WizardStep } from './WizardStepper';
import { verifyTotpCode, type VerifyTwoFactorCode } from './twoFactorVerification';
import QRCode from 'qrcode';
import './TwoFactorSetup.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type Method = 'totp' | 'sms';
type Step = 1 | 2 | 3 | 4 | 5;

interface TwoFactorSetupProps {
  /** Called when the wizard completes successfully */
  onComplete: () => void;
  /** Called when the user cancels / closes the wizard */
  onCancel: () => void;
  /** Pre-generated TOTP secret (base32); callers should generate server-side */
  totpSecret?: string;
  /** Pre-generated recovery codes (8 codes recommended) */
  recoveryCodes?: string[];
  /**
   * Optional verification boundary for server-backed TOTP/SMS validation.
   * When omitted, TOTP codes are verified locally against `totpSecret` using
   * RFC 6238. SMS verification requires callers to provide this handler.
   */
  verifyCode?: VerifyTwoFactorCode;
  /**
   * Rotates the recovery codes server-side and resolves with the new set.
   * The previous codes are invalidated by the backend. When omitted, the
   * Regenerate action is hidden.
   */
  onRegenerateCodes?: () => Promise<string[]>;
}

// ─── Standalone fallback data ─────────────────────────────────────────────────

const DEFAULT_SECRET = 'JBSWY3DPEHPK3PXP';
const DEFAULT_RECOVERY_CODES = [
  'REVR-A1B2-C3D4',
  'REVR-E5F6-G7H8',
  'REVR-I9J0-K1L2',
  'REVR-M3N4-O5P6',
  'REVR-Q7R8-S9T0',
  'REVR-U1V2-W3X4',
  'REVR-Y5Z6-A7B8',
  'REVR-C9D0-E1F2',
  'REVR-G3H4-I5J6',
  'REVR-K7L8-M9N0',
];

const verifyCodeLocally: VerifyTwoFactorCode = ({ method, code, secret }) => {
  if (method !== 'totp' || !secret) {
    throw new Error('A server verification handler is required for this method.');
  }
  return verifyTotpCode(secret, code);
};

// ─── TOTP URI + local QR generation ───────────────────────────────────────────

/**
 * Build the otpauth:// URI for authenticator enrolment.
 *
 * The label and issuer are URL-encoded so that special characters (e.g. `@`,
 * `:`, spaces) in the account email cannot break the URI structure. The secret
 * is base32 and safe, but is encoded defensively as well.
 */
export const buildTotpUri = (secret: string, accountLabel = 'Revora'): string => {
  const issuer = 'Revora';
  const label = `${issuer}:${accountLabel}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
};

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEP_LABELS: Record<Step, string> = {
  1: 'Choose method',
  2: 'Set up authenticator',
  3: 'Verify code',
  4: 'Save recovery codes',
  5: 'Done',
};
const TOTAL_STEPS = 5;

const WIZARD_STEPS: WizardStep[] = (
  Object.keys(STEP_LABELS) as unknown as Step[]
).map((s) => {
  const step = Number(s) as Step;
  return { id: `tfa-step-${step}`, label: STEP_LABELS[step], number: step };
});

interface StepIndicatorProps {
  current: Step;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ current }) => (
  <WizardStepper
    steps={WIZARD_STEPS}
    currentIndex={current - 1}
    ariaLabel="Setup progress"
    showProgressTrack
  />
);

// ─── Step 1: Choose method ────────────────────────────────────────────────────

interface Step1Props {
  onSelect: (method: Method) => void;
}

const Step1: React.FC<Step1Props> = ({ onSelect }) => (
  <div className="space-y-4 animate-fade-in">
    <p className="text-muted text-sm">
      Choose how you'd like to verify your identity each time you sign in.
    </p>
    <div className="grid gap-3">
      <button
        type="button"
        className="tfa-method-card"
        onClick={() => onSelect('totp')}
        aria-describedby="totp-desc"
      >
        <div className="tfa-method-card__icon" aria-hidden="true">
          <Smartphone size={22} />
        </div>
        <div className="tfa-method-card__body">
          <span className="tfa-method-card__title">Authenticator App</span>
          <span id="totp-desc" className="tfa-method-card__desc">
            Use Google Authenticator, Authy, or any TOTP-compatible app.
          </span>
        </div>
        <ChevronRight size={18} className="text-muted flex-shrink-0 icon-rtl" aria-hidden="true" />
      </button>

      <button
        type="button"
        className="tfa-method-card"
        onClick={() => onSelect('sms')}
        aria-describedby="sms-desc"
      >
        <div className="tfa-method-card__icon" aria-hidden="true">
          <MessageSquare size={22} />
        </div>
        <div className="tfa-method-card__body">
          <span className="tfa-method-card__title">SMS Backup</span>
          <span id="sms-desc" className="tfa-method-card__desc">
            Receive a one-time code via text message. Requires a mobile number.
          </span>
        </div>
        <ChevronRight size={18} className="text-muted flex-shrink-0 icon-rtl" aria-hidden="true" />
      </button>
    </div>
  </div>
);

// ─── Step 2: QR / manual key ──────────────────────────────────────────────────

interface Step2Props {
  method: Method;
  secret: string;
  /** Account label (usually the user's email) embedded in the otpauth URI */
  accountLabel?: string;
  onNext: () => void;
  onBack: () => void;
}

const Step2: React.FC<Step2Props> = ({ method, secret, accountLabel, onNext, onBack }) => {
  const [showManual, setShowManual] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const secretId = useId();

  const otpauthUri = useMemo(
    () => buildTotpUri(secret, accountLabel),
    [secret, accountLabel]
  );

  // Render the QR code locally to a data URL — never send the secret off-device.
  useEffect(() => {
    let cancelled = false;
    setQrError(null);
    QRCode.toDataURL(otpauthUri, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 180,
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl(null);
          setQrError('Could not generate the QR code. Use the manual key below.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [otpauthUri]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text for manual copy
      const el = document.getElementById(secretId);
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
  };

  if (method === 'sms') {
    return (
      <div className="space-y-4 animate-fade-in">
        <p className="text-muted text-sm">
          We'll send a 6-digit code to your registered mobile number each time you sign in.
        </p>
        <div className="input-group">
          <label className="input-label" htmlFor="phone">Mobile number</label>
          <input
            id="phone"
            type="tel"
            className="input-field"
            placeholder="+1 555 000 0000"
            autoComplete="tel"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onBack}>Back</button>
          <Button type="button" onClick={onNext}>Send verification code</Button>
        </div>
      </div>
    );
  }

  // TOTP QR flow
  return (
    <div className="space-y-4 animate-fade-in">
      <p className="text-muted text-sm">
        Open your authenticator app and scan the QR code below to add your Revora account.
      </p>

      {/* QR code */}
      <div className="tfa-qr-wrapper" role="img" aria-label="QR code for authenticator app setup. Use the manual key below if you cannot scan.">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt=""
            aria-hidden="true"
            width={180}
            height={180}
            className="tfa-qr-img"
          />
        ) : (
          <div className="tfa-qr-img tfa-qr-placeholder" aria-hidden="true" />
        )}
      </div>
      {qrError && (
        <p className="text-error text-xs" role="alert">
          {qrError}
        </p>
      )}

      {/* Manual key toggle */}
      <button
        type="button"
        className="tfa-toggle-link"
        onClick={() => setShowManual((v) => !v)}
        aria-expanded={showManual}
        aria-controls="manual-key-section"
      >
        <Key size={14} aria-hidden="true" />
        {showManual ? 'Hide manual key' : "Can't scan? Enter key manually"}
      </button>

      {showManual && (
        <div id="manual-key-section" className="tfa-manual-key">
          <p className="text-muted text-xs mb-2">
            Type this key into your authenticator app instead of scanning the QR code.
          </p>
          <div className="tfa-manual-key__row">
            <code
              id={secretId}
              className="tfa-manual-key__code"
              aria-label={`Manual setup key: ${secret.split('').join(' ')}`}
            >
              {secret}
            </code>
            <button
              type="button"
              className="tfa-icon-btn"
              onClick={handleCopy}
              aria-label={copied ? 'Key copied to clipboard' : 'Copy key to clipboard'}
            >
              {copied ? (
                <Check size={16} className="text-success" aria-hidden="true" />
              ) : (
                <Copy size={16} aria-hidden="true" />
              )}
              <span className="sr-only">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
          {copied && (
            <p className="text-success text-xs mt-1" role="status" aria-live="polite">
              Key copied to clipboard.
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary" onClick={onBack}>Back</button>
        <Button type="button" onClick={onNext}>I've added the account</Button>
      </div>
    </div>
  );
};

// ─── Step 3: Verify code ──────────────────────────────────────────────────────

interface Step3Props {
  method: Method;
  secret: string;
  verifyCode: VerifyTwoFactorCode;
  onNext: () => void;
  onBack: () => void;
}

const Step3: React.FC<Step3Props> = ({ method, secret, verifyCode, onNext, onBack }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(val);
    if (error) setError(null);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Please enter the 6-digit code from your authenticator app.');
      return;
    }

    setIsVerifying(true);
    setError(null);

    let verified: boolean;
    try {
      verified = await verifyCode({ method, code, secret });
    } catch {
      setIsVerifying(false);
      setError('We could not verify the code right now. Please try again.');
      return;
    }

    if (!verified) {
      setIsVerifying(false);
      setError('The verification code is invalid or has expired.');
      return;
    }

    setIsVerifying(false);
    onNext();
  };

  return (
    <form onSubmit={handleVerify} className={`space-y-4 animate-fade-in ${error ? 'animate-shake' : ''}`} noValidate>
      <p className="text-muted text-sm">
        Enter the 6-digit code currently displayed in your authenticator app.
      </p>
      <FormError message={error} id="verify-error" />
      <div className="input-group">
        <label className="input-label" htmlFor="totp-code">
          Verification code
        </label>
        <input
          ref={inputRef}
          id="totp-code"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          className={`input-field tfa-code-input ${error ? 'input-error' : ''}`}
          value={code}
          onChange={handleChange}
          placeholder="000000"
          autoComplete="one-time-code"
          aria-required="true"
          aria-describedby={error ? 'verify-error' : undefined}
          disabled={isVerifying}
        />
        <p className="text-muted text-xs mt-1">Code refreshes every 30 seconds.</p>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary" onClick={onBack} disabled={isVerifying}>Back</button>
        <Button type="submit" loading={isVerifying}>Verify</Button>
      </div>
    </form>
  );
};

// ─── Step 4: Recovery codes ───────────────────────────────────────────────────

interface Step4Props {
  codes: string[];
  onRegenerateCodes?: () => Promise<string[]>;
  onNext: () => void;
  onBack: () => void;
}

// Reveal pattern for shoulder-surfing safety
const CODE_PLACEHOLDER = '••••••';
const CODES_PER_ROW = 5;

const Step4: React.FC<Step4Props> = ({ codes: initialCodes, onRegenerateCodes, onNext, onBack }) => {
  const [codes, setCodes] = useState<string[]>(initialCodes);
  const [acknowledged, setAcknowledged] = useState(false);
  const [revealed, setRevealed] = useState<boolean[]>(() => new Array(codes.length).fill(false));
  const [allRevealed, setAllRevealed] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const codesGridRef = useRef<HTMLDivElement>(null);
  const regenerateTriggerRef = useRef<HTMLButtonElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Handle reveal toggle for individual codes
  const toggleReveal = useCallback((index: number) => {
    setRevealed(prev => {
      const next = [...prev];
      next[index] = !prev[index];
      setAllRevealed(next.every(v => v));
      return next;
    });
  }, []);

  // Toggle all codes
  const toggleAllReveal = () => {
    const newAllRevealed = !allRevealed;
    setAllRevealed(newAllRevealed);
    setRevealed(prev => prev.map(() => newAllRevealed));
  };

  // Copy all codes to clipboard with feedback
  const copyAllCodes = async () => {
    const revealedCodes = codes.filter((_, idx) => revealed[idx]);
    if (revealedCodes.length === 0) return;

    const codesText = revealedCodes.join('\n');
    try {
      await navigator.clipboard.writeText(codesText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Fallback: select text from grid
      codesGridRef.current?.focus();
    }
  };

  // Download codes as text file
  const downloadCodes = () => {
    const revealedCodes = codes.filter((_, idx) => revealed[idx]);
    if (revealedCodes.length === 0) return;

    const content = `Revora Recovery Codes\nGenerated: ${new Date().toISOString()}\n\n${revealedCodes.join('\n')}\n\n⚠️ IMPORTANT: These are your recovery codes. Store them safely and use them only for account recovery. Each code can only be used once.`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'revora-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print codes with print stylesheet
  const printCodes = () => {
    const revealedCodes = codes.filter((_, idx) => revealed[idx]);
    if (revealedCodes.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Revora Recovery Codes - Print</title>
        <style>
          @media print {
            @page {
              margin: 2cm;
              @bottom-center {
                content: "Page " counter(page);
              }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 0;
              background: white !important;
              color: black !important;
            }
            .print-container {
              max-width: 100%;
              margin: 0;
            }
            .warning-banner {
              background: #fef3c7;
              border: 2px solid #f59e0b;
              padding: 1rem;
              margin-bottom: 1.5rem;
              border-radius: 0.5rem;
            }
            .codes-grid {
              display: grid;
              grid-template-columns: repeat(${CODES_PER_ROW}, 1fr);
              gap: 0.75rem;
              margin: 1.5rem 0;
            }
            .code-card {
              border: 2px solid #e5e7eb;
              padding: 1rem;
              text-align: center;
              background: #f9fafb;
              border-radius: 0.5rem;
            }
            .code-card.revealed {
              border-color: #10b981;
              background: #ecfdf5;
            }
            .code-value {
              font-family: 'Courier New', Monaco, monospace;
              font-size: 1.25rem;
              font-weight: bold;
              color: #111827;
              letter-spacing: 0.1em;
            }
            .code-placeholder {
              color: #9ca3af;
              font-style: italic;
            }
            .header {
              margin-bottom: 2rem;
              text-align: center;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 1rem;
            }
            .footer {
              margin-top: 2rem;
              text-align: center;
              font-size: 0.875rem;
              color: #6b7280;
              border-top: 1px solid #e5e7eb;
              padding-top: 1rem;
            }
            .no-print {
              display: none;
            }
          }
          @media screen {
            body {
              background: var(--bg-gradient);
              color: var(--text-main);
              padding: 2rem;
              max-width: 1200px;
              margin: 0 auto;
            }
            .no-screen {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          <div class="header">
            <h1>Revora Recovery Codes</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
          </div>

          <div class="warning-banner">
            <h2>⚠️ IMPORTANT SECURITY NOTICE</h2>
            <p><strong>Save these codes now.</strong> They are the only way to recover your account if you lose access to your authenticator. Each code can be used once and expires after 30 minutes of deactivation.</p>
            <p><strong>For security, print this page immediately and store it in a safe location.</strong></p>
          </div>

          <div class="codes-grid">
            ${revealedCodes.map((code, idx) => `
              <div class="code-card ${revealed[idx] ? 'revealed' : ''}">
                <div class="text-xs text-muted mb-1">Code ${idx + 1}</div>
                <div class="code-value ${revealed[idx] ? '' : 'code-placeholder'}">
                  ${revealed[idx] ? code : CODE_PLACEHOLDER}
                </div>
              </div>
            `).join('')}
          </div>

          <div class="footer">
            <p>⚠️ These codes provide access to your account. Keep them secret and safe.</p>
            <p>Regenerated: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printHTML);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  // Handle regenerate codes with confirmation
  const handleRegenerate = () => {
    setShowRegenerateConfirm(true);
  };

  const closeRegenerateDialog = useCallback(() => {
    setShowRegenerateConfirm(false);
    setRegenerateError(null);
    regenerateTriggerRef.current?.focus();
  }, []);

  const confirmRegenerate = async () => {
    if (!onRegenerateCodes || isRegenerating) return;
    setIsRegenerating(true);
    setRegenerateError(null);
    try {
      const newCodes = await onRegenerateCodes();
      if (!isMountedRef.current) return;
      setCodes(newCodes);
      setRevealed(new Array(newCodes.length).fill(false));
      setAllRevealed(false);
      setIsCopied(false);
      setAcknowledged(false);
      setIsRegenerating(false);
      closeRegenerateDialog();
    } catch {
      if (!isMountedRef.current) return;
      setIsRegenerating(false);
      setRegenerateError('Could not regenerate recovery codes. Your existing codes are unchanged. Please try again.');
    }
  };

  const cancelRegenerate = () => {
    if (isRegenerating) return;
    closeRegenerateDialog();
  };

  // Count of revealed codes for status indicators
  const revealedCount = revealed.filter(Boolean).length;
  const allCodesRevealed = revealed.length > 0 && revealed.every(Boolean);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Critical Warning Banner */}
      <div className="tfa-warning-banner" role="alert" aria-live="polite">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} aria-hidden="true" className="flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold mb-1">
              🚨 SAVE THESE CODES NOW - ACCOUNT RECOVERY DEPENDENCY
            </p>
            <p className="text-sm">
              <strong>These are your last line of defense.</strong> If you lose access to your authenticator app, these recovery codes are the <strong>ONLY</strong> way to get back into your account.
              Each code can be used once and <strong>expires after 30 minutes of deactivation.</strong>
            </p>
            <p className="text-xs mt-2 opacity-90">
              📱肩-surfing安全: Codes are hidden by default. Click to reveal.
            </p>
          </div>
        </div>
      </div>

      {/* Status and Actions Bar */}
      <div className="bg-glass-bg-accent rounded-lg p-4 border border-glass-border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="font-medium">Revealed:</span> {revealedCount}/{codes.length}
            </div>
            {allCodesRevealed && (
              <div className="flex items-center gap-1 text-success">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span className="text-sm font-medium">All codes visible</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleAllReveal}
              className="btn-secondary text-sm"
              aria-label={allRevealed ? 'Hide all recovery codes' : 'Show all recovery codes'}
            >
              {allRevealed ? (
                <><EyeOff size={16} className="mr-1" aria-hidden="true" /> Hide All</>
              ) : (
                <><Eye size={16} className="mr-1" aria-hidden="true" /> Reveal All</>
              )}
            </button>

            <button
              type="button"
              onClick={copyAllCodes}
              disabled={revealedCount === 0}
              className={`btn-secondary text-sm ${isCopied ? 'bg-success/20' : ''}`}
              aria-label="Copy all revealed recovery codes to clipboard"
            >
              {isCopied ? (
                <><Check size={16} className="mr-1" aria-hidden="true" /> Copied!</>
              ) : (
                <><CopyIcon size={16} className="mr-1" aria-hidden="true" /> Copy All</>
              )}
            </button>

            <button
              type="button"
              onClick={downloadCodes}
              disabled={revealedCount === 0}
              className="btn-secondary text-sm"
              aria-label="Download revealed recovery codes as text file"
            >
              <Download size={16} className="mr-1" aria-hidden="true" /> Download
            </button>

            <button
              type="button"
              onClick={printCodes}
              disabled={revealedCount === 0}
              className="btn-secondary text-sm"
              aria-label="Print recovery codes"
            >
              <Printer size={16} className="mr-1" aria-hidden="true" /> Print
            </button>

            {onRegenerateCodes && (
              <button
                ref={regenerateTriggerRef}
                type="button"
                onClick={handleRegenerate}
                className="btn-secondary text-sm text-error hover:bg-error/10"
                aria-label="Regenerate recovery codes"
              >
                <RotateCcw size={16} className="mr-1" aria-hidden="true" /> Regenerate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Codes Grid with Reveal-on-Click */}
      <div
        ref={codesGridRef}
        className="tfa-recovery-grid"
        role="grid"
        aria-label="Recovery codes grid"
        style={{ gridTemplateColumns: `repeat(${Math.min(CODES_PER_ROW, codes.length)}, 1fr)` }}
      >
        {codes.map((code, idx) => (
          <button
            key={code}
            type="button"
            onClick={() => toggleReveal(idx)}
            className={`
              tfa-recovery-card
              ${revealed[idx] ? 'revealed' : 'hidden'}
              ${allRevealed ? 'all-revealed' : ''}
              ${!acknowledged ? 'cursor-pointer' : 'cursor-default'}
            `}
            aria-pressed={revealed[idx]}
            aria-label={`Code ${idx + 1}: ${revealed[idx] ? 'visible, click to hide' : 'hidden, click to reveal'}`}
            disabled={!acknowledged}
          >
            <div className="tfa-recovery-card__content">
              <div className="tfa-recovery-card__index" aria-hidden="true">
                {idx + 1}
              </div>
              <div className={`tfa-recovery-card__code ${revealed[idx] ? '' : 'placeholder'}`}>
                {revealed[idx] ? code : CODE_PLACEHOLDER}
              </div>
              {revealed[idx] && (
                <div className="tfa-recovery-card__status" aria-hidden="true">
                  👁️
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="text-center text-xs text-muted">
        💡 Click on any code to toggle visibility for shoulder-surfing safety
      </div>

      {/* Acknowledgment Checkbox */}
      <label className="tfa-acknowledge-stack relative group">
        <div className="flex items-start gap-3 p-4 bg-glass-bg-accent rounded-lg border border-glass-border hover:border-primary/30 transition-colors">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            aria-required="true"
            className="mt-1 w-5 h-5 rounded border-2 border-glass-border text-primary focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex-1">
            <span className="font-medium block mb-1">I have saved my recovery codes in a safe place.</span>
            <span className="text-xs text-muted block">
              I understand that these codes provide account recovery access and I have stored them securely.
            </span>
          </div>
          {acknowledged && (
            <CheckCircle2 size={20} className="text-success flex-shrink-0" aria-hidden="true" />
          )}
        </div>
      </label>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          className="btn-secondary"
          onClick={onBack}
        >
          Back
        </button>
        <Button
          type="button"
          disabled={!acknowledged}
          onClick={onNext}
          className="flex-1"
        >
          Continue
        </Button>
      </div>

      {/* Regenerate Confirmation Modal */}
      {onRegenerateCodes && showRegenerateConfirm && (
        <RegenerateCodesDialog
          isPending={isRegenerating}
          error={regenerateError}
          onConfirm={confirmRegenerate}
          onCancel={cancelRegenerate}
        />
      )}

      {/* Screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {revealedCount === codes.length && allRevealed &&
          "All recovery codes are now visible. Click any code to hide it."
        }
        {revealedCount === 0 &&
          "No recovery codes are currently visible. Click any code to reveal it."
        }
        {isCopied &&
          "Codes copied to clipboard successfully!"
        }
      </div>
    </div>
  );
};

// ─── Step 5: Success ──────────────────────────────────────────────────────────

interface Step5Props {
  onComplete: () => void;
}

const Step5: React.FC<Step5Props> = ({ onComplete }) => {
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    btnRef.current?.focus();
  }, []);

  return (
    <div className="text-center space-y-5 animate-fade-in">
      <div className="tfa-success-icon" aria-hidden="true">
        <ShieldCheck size={36} />
      </div>
      <div>
        <h3 className="font-semibold text-main text-lg">Two-factor authentication enabled</h3>
        <p className="text-muted text-sm mt-1">
          Your account is now protected. You'll be asked for a code at each sign-in.
        </p>
      </div>
      <Button ref={btnRef} type="button" onClick={onComplete}>
        Done
      </Button>
    </div>
  );
};

// ─── Main wizard ──────────────────────────────────────────────────────────────

export const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({
  onComplete,
  onCancel,
  totpSecret = DEFAULT_SECRET,
  recoveryCodes = DEFAULT_RECOVERY_CODES,
  verifyCode = verifyCodeLocally,
  onRegenerateCodes,
}) => {
  const [step, setStep] = useState<Step>(1);
  const [method, setMethod] = useState<Method>('totp');
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the section heading whenever the step changes
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS) as Step);
  const back = () => setStep((s) => Math.max(s - 1, 1) as Step);

  const handleMethodSelect = (m: Method) => {
    setMethod(m);
    next();
  };

  const stepTitles: Record<Step, string> = {
    1: 'Choose authentication method',
    2: method === 'totp' ? 'Set up authenticator app' : 'Set up SMS backup',
    3: 'Enter verification code',
    4: 'Save your recovery codes',
    5: 'Setup complete',
  };

  return (
    <section aria-labelledby="tfa-heading" className="tfa-wizard">
      <StepIndicator current={step} />

      <h2
        id="tfa-heading"
        ref={headingRef}
        className="tfa-wizard__title"
        tabIndex={-1}
      >
        {stepTitles[step]}
      </h2>

      {step === 1 && <Step1 onSelect={handleMethodSelect} />}
      {step === 2 && (
        <Step2 method={method} secret={totpSecret} onNext={next} onBack={back} />
      )}
      {step === 3 && (
        <Step3
          method={method}
          secret={totpSecret}
          verifyCode={verifyCode}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 4 && (
        <Step4
          codes={recoveryCodes}
          onRegenerateCodes={onRegenerateCodes}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 5 && <Step5 onComplete={onComplete} />}

      {step < 5 && (
        <button
          type="button"
          className="tfa-cancel"
          onClick={onCancel}
          aria-label="Cancel two-factor authentication setup"
        >
          Cancel setup
        </button>
      )}
    </section>
  );
};