import './TwoFactorSetup.css';
import React, { useState, useRef, useEffect, useId } from 'react';
import {
  Mail,
  Key,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  Clock,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { Button } from './Button';
import { FormError } from './FormError';

type Step = 1 | 2 | 3;

export interface TwoFactorRecoveryFlowProps {
  /** Called when recovery is successful */
  onComplete: () => void;
  /** Called when the user cancels / goes back */
  onCancel: () => void;
  /** Pre-filled email if konown from context */
  defaultEmail?: string;
  /** Request a recovery code be sent to the given email */
  onRequestCode: (email: string) => Promise<void>;
  /** Verify a recovery code. Resolves true only on success. */
  onVerify: (code: string) => Promise<boolean>;
  /** Resend a recovery code to the given email */
  onResend: (email: string) => Promise<void>;
  /** Maximum verify attempts before lockout. Defaults to 5. */
  maxAttempts?: number;
  /** Lockout cooldown in seconds after max attempts. Defaults to 30. */
  lockoutSeconds?: number;
}

const COOLOWN_SECONDS = 30;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_LOCKOUT_SECONDS = 30;

const StepIndicator: React.FC<{ current: Step }> = ({ current }) => {
  const steps = [
    { number: 1, label: 'Request code' },
    { number: 2, label: 'Enter code' },
    { number: 3, label: 'Recovery complete' },
  ];

  return (
    <nav aria-label="Recovery progress" className="tfar-progress">
      <ol className="tfar-progress__list">
        {steps.map((s, i) => {
          const state =
            s.number < current ? 'completed' : s.number === current ? 'active' : 'upcoming';
          return (
            <li
              key={s.number}
              className={`tfar-progress__item tfar-progress__item--${state}`}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <span className="tfar-progress__circle" aria-hidden="true">
                {state === 'completed' ? (
                  <CheckCircle2 size={14} />
                ) : (
                  s.number
                )}
              </span>
              <span className="tfar-progress__label sr-only">
                Step {s.number}: {s.label}
              </span>
              <span className="tfar-progress__label tfar-progress__label--visible">
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <span className="tfar-progress__connector" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

interface RequestEmailStepProps {
  onSend: (email: string) => Promise<void>;
  defaultEmail?: string;
  onSupport: () => void;
}

const RequestEmailStep: React.FC<RequestEmailStepProps> = (stepProps) => {
  const { onSend, defaultEmail = '', onSupport } = stepProps;
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();

    if (!trimmed) {
      setError('Please enter your recovery email address.');
      return;
    }
    if (!trimmed.includes('@') || !trimmed.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    setError(null);
    setIsSending(true);
    try {
      await onSend(trimmed);
    } catch {
      setError('Unable to send the recovery code. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const emailId = useId();
  const errorId = useId();

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 animate-fade-in ${error ? 'animate-shake' : ''}`} noValidate>
      <p className="text-muted text-sm">
        If you&#x27rve lost access to your authenticator device, we can send a recovery code to
        your registered recovery email.
      </p>

      <div className="tfar-warning" role="note">
        <AlertTriangle size={16} aria-hidden="true" className="flex-shrink-0 mt-0.5" />
        <p className="text-sm">
          For security, recovery codes are single-use and expire after 15 minutes.
        </p>
      </div>

      <FormError message={error} id={errorId} />

      <div className="input-group">
        <label className="input-label" htmlFor={emailId}>
          Recovery email address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 text-muted" size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            id={emailId}
            type="email"
            className={`input-field pl-10 ${error ? 'input-error' : ''}`}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            required
            aria-required="true"
            aria-describedby={error ? errorId : undefined}
            disabled={isSending}
            autoComplete="email"
          />
        </div>
      </div>

      <Button type="submit" loading={isSending}>
        {isSending ? 'Sending…' : 'Send recovery code'}
      </Button>

      <button
        type="button"
        className="tfar-support-link"
        onClick={onSupport}
        aria-label="Still can't access your account? Contact support"
      >
        <ExternalLink size={14} aria-hidden="true" />
        Still can&#x27;t access your account?
      </button>
    </form>
  );
};

interface VerifyCodeStepProps {
  onVerify: (code: string) => Promise<boolean>;
  onResend: () => Promise<void>;
  onBack: () => void;
  onSupport: () => void;
  email: string;
  maxAttempts: number;
  lockoutSeconds: number;
}

const VerifyCodeStep: React.FC<VerifyCodeStepProps> = (stepProps) => {
  const { onVerify, onResend, onBack, onSupport, email, maxAttempts, lockoutSeconds } = stepProps;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(COOLOWN_SECONDS);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number>(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    inputRef.current?.focus();
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) return 0;
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    if (lockedUntil <= 0) {
      setLockoutRemaining(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setLockoutRemaining(remaining);
      if (remaining <= 0) {
        setLockedUntil(0);
        setAttempts(0);
        setError(null);
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  const isLocked = lockedUntil > 0 && lockoutRemaining > 0;

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(val);
    if (error) setError(null);
  };

  const registerFailure = () => {
    setAttempts((prev) => {
      const next = prev + 1;
      if (next >= maxAttempts) {
        setLockedUntil(Date.now() + lockoutSeconds * 1000);
        setLockoutRemaining(lockoutSeconds);
        setError(
          `Too many incorrect attempts. Please wait ${lockoutSeconds} seconds before trying again.`
        );
      } else {
        setError('The code you entered is invalid or has expired. Please try again.');
      }
      return next;
    });
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    if (code.length < 6) {
      setError('Please enter the full 6-digit recovery code.');
      return;
    }
    setIsVerifying(true);
    try {
      const valid = await onVerify(code);
      if (!mountedRef.current) return;
      if (!valid) {
        registerFailure();
      }
    } catch {
      if (!mountedRef.current) return;
      setError('Unable to verify the code right now. Please try again.');
    } finally {
      if (mountedRef.current) setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);
    try {
      await onResend();
      setCooldown(COOLOWN_SECONDS);
      setError(null);
    } catch {
      setError('Unable to resend the recovery code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const formatCooldown = (seconds: number): string => {
    if (seconds <= 0) return '';
    if (seconds === 1) return '1 second';
    return `${seconds} seconds`;
  };

  const codeId = useId();
  const errorId = useId();

  return (
    <form onSubmit={handleVerify} className={`space-y-4 animate-fade-in ${error ? 'animate-shake' : ''}`} noValidate>
      <p className="text-muted text-sm">
        We&#x27ve sent a 6-digit recovery code to{' '}
        <span className="text-main font-medium">{email}</span>.
        The code expires in 15 minutes.
      </p>

      <FormError message={error} id={errorId} />

      <div className="input-group">
        <label className="input-label" htmlFor={codeId}>
          Recovery code
        </label>
        <div className="relative">
          <Key className="absolute left-3 top-3 text-muted" size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            id={codeId}
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            className={`input-field pl-10 tfar-code-input ${error ? 'input-error' : ''}`}
            value={code}
            onChange={handleCodeChange}
            placeholder="000000"
            autoComplete="one-time-code"
            aria-required="true"
            aria-describedby={error ? errorId : undefined}
            disabled={isVerifying || isLocked}
          />
        </div>
        <p className="text-muted text-xs mt-1">
          Check your spam folder if you don&#x27t see the email.
        </p>
      </div>

      <Button type="submit" loading={isVerifying} disabled={isLocked}>
        {isLocked
          ? `Try again in ${formatCooldown(lockoutRemaining)}`
          : isVerifying
            ? 'Verifying…'
            : 'Verify code'}
      </Button>

      <div className="tfar-resend-area">
        <button
          type="button"
          className="tfar-resend-btn"
          onClick={handleResend}
          disabled={cooldown > 0 || isResending}
          aria-disabled={cooldown > 0 || isResending}
          aria-label={
            isResending
              ? 'Resending recovery code'
              : cooldown > 0
                ? `Resend again in ${formatCooldown(cooldown)}`
                : 'Resend recovery code'
          }
        >
          {isResending
            ? 'Resending…'
            : cooldown > 0
              ? `Resend again in ${formatCooldown(cooldown)}`
              : 'Resend recovery code'}
        </button>
        {cooldown > 0 && (
          <span className="tfar-cooldown-icon" aria-hidden="true">
            <Clock size={14} />
          </span>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary" onClick={onBack} disabled={isVerifying}>
          <ArrowLeft size={16} className="icon-rtl" aria-hidden="true" />
          Back
        </button>
      </div>

      <button
        type="button"
        className="tfar-support-link"
        onClick={onSupport}
        aria-label="Still can't access your account? Contact support"
      >
        <ExternalLink size={14} aria-hidden="true" />
        Still can&#x27;t access your account?
      </button>

      <div role="status" aria-live="polite" className="sr-only">
        {isResending
          ? 'Resending recovery code'
          : cooldown > 0
            ? `Please wait ${formatCooldown(cooldown)} before requesting a new code`
            : ''}
      </div>
    </form>
  );
};

interface RecoverySuccessStepProps {
  onComplete: () => void;
}

const RecoverySuccessStep: React.FC<RecoverySuccessStepProps> = ({ onComplete }) => {
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    btnRef.current?.focus();
  }, []);

  return (
    <div className="text-center space-y-5 animate-fade-in">
      <div className="tfar-success-icon" aria-hidden="true">
        <ShieldCheck size={36} />
      </div>
      <div>
        <h3 className="font-semibold text-main text-lg">Recovery successful</h3>
        <p className="text-muted text-sm mt-1">
          Your identity has been verified. You can now log in to your account.
          For security, we recommend setting up a new two-factor authentication method.
        </p>
      </div>
      <Button ref={btnRef} type="button" onClick={onComplete}>
        Continue to sign in
      </Button>
    </div>
  );
};

export const TwoFactorRecoveryFlow: React.FC<TwoFactorRecoveryFlowProps> = (props) => {
  const {
    onComplete,
    onCancel,
    defaultEmail = '',
    onRequestCode,
    onVerify,
    onResend,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    lockoutSeconds = DEFAULT_LOCKOUT_SECONDS,
  } = props;
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState(defaultEmail);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const handleSend = async (e: string) => {
    await onRequestCode(e);
    setEmail(e);
    setStep(2);
  };

  const handleVerify = async (code: string): Promise<boolean> => {
    const valid = await onVerify(code);
    if (valid) {
      setStep(3);
    }
    return valid;
  };

  const handleResend = async () => {
    await onResend(email);
  };

  const handleCancel = () => {
    onCancel();
  };

  const handleSupport = () => {
    // Support link is presentational; no backend integration in scope.
  };

  const headings = {
    1: 'Recover your account',
    2: 'Check your recovery email',
    3: 'Recovery complete',
  } as const;

  return (
    <section aria-labelledby={headingId} className="tfar-container">
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="tfar-heading">
        {headings[step]}
      </h2>

      <StepIndicator current={step} />

      {step === 1 && (
        <RequestEmailStep
          onSend={handleSend}
          defaultEmail={defaultEmail}
          onSupport={handleSupport}
        />
      )}
      {step === 2 && (
        <VerifyCodeStep
          onVerify={handleVerify}
          onResend={handleResend}
          onBack={() => setStep(1)}
          onSupport={handleSupport}
          email={email}
          maxAttempts={maxAttempts}
          lockoutSeconds={lockoutSeconds}
        />
      )}
      {step === 3 && <RecoverySuccessStep onComplete={onComplete} />}

      {step !== 3 && (
        <div className="tfar-cancel-area">
          <button
            type="button"
            className="tfar-cancel-btn"
            onClick={handleCancel}
            aria-label="Cancel account recovery"
          >
            Cancel account recovery
          </button>
        </div>
      )}
    </section>
  );
};
