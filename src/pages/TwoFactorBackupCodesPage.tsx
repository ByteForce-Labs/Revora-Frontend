import '../components/TwoFactorSetup.css';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  Download,
  Printer,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../components/Button';
import { RegenerateCodesDialog } from '../components/RegenerateCodesDialog';
import '../components/TwoFactorSetup.css';

const DEFAULT_CODES = [
  'REVR-A1B2-C3D4', 'REVR-E5F6-G7H8', 'REVR-I9J0-K1L2',
  'REVR-M3N4-O5P6', 'REVR-Q7R8-S9T0', 'REVR-U1V2-W3X4',
  'REVR-Y5Z6-A7B8', 'REVR-C9D0-E1F2', 'REVR-G3H4-I5J6',
  'REVR-K7L8-M9N0',
];

const CODE_PLACEHOLDER = '••••••';

export interface TwoFactorBackupCodesPageProps {
  initialCodes?: string[];
  codes?: string[];
  /**
   * Rotates the recovery codes server-side and resolves with the new set.
   * When omitted, the Regenerate action is hidden.
   */
  onRegenerateCodes?: () => Promise<string[]>;
}

const TwoFactorBackupCodesPage: React.FC<TwoFactorBackupCodesPageProps> = ({
  initialCodes,
  codes: propCodes,
  onRegenerateCodes,
}) => {
  const [codes, setCodes] = useState<string[]>(() => propCodes ?? initialCodes ?? DEFAULT_CODES);
  const [revealed, setRevealed] = useState<boolean[]>(() => new Array(codes.length).fill(false));
  const [allRevealed, setAllRevealed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const codesGridRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regenerateTriggerRef = useRef<HTMLButtonElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const closeRegenerateDialog = () => {
    setShowRegenerateConfirm(false);
    setRegenerateError(null);
    regenerateTriggerRef.current?.focus();
  };

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
      setIsRegenerating(false);
      closeRegenerateDialog();
    } catch {
      if (!isMountedRef.current) return;
      setIsRegenerating(false);
      setRegenerateError('Could not regenerate recovery codes. Your existing codes are unchanged. Please try again.');
    }
  };

  const toggleReveal = useCallback((index: number) => {
    setRevealed(prev => {
      const next = [...prev];
      next[index] = !prev[index];
      setAllRevealed(next.every(v => v));
      return next;
    });
  }, []);

  const toggleAllReveal = () => {
    const newVal = !allRevealed;
    setAllRevealed(newVal);
    setRevealed(prev => prev.map(() => newVal));
  };

  const revealedCount = revealed.filter(Boolean).length;

  const copyAllCodes = async () => {
    const revealedCodes = codes.filter((_, i) => revealed[i]);
    if (!revealedCodes.length) return;
    try {
      await navigator.clipboard.writeText(revealedCodes.join('\n'));
      setIsCopied(true);
      setCopyError(null);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch {
      setCopyError('Failed to copy recovery codes to clipboard.');
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setCopyError(null);
      }, 4000);
    }
  };

  const downloadCodes = () => {
    const revealedCodes = codes.filter((_, i) => revealed[i]);
    if (!revealedCodes.length) return;
    const content = `Revora Recovery Codes\nGenerated: ${new Date().toISOString()}\n\n${revealedCodes.join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'revora-recovery-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  };

  const printCodes = () => {
    const revealedCodes = codes.filter((_, i) => revealed[i]);
    if (!revealedCodes.length) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Revora Recovery Codes</title>
<style>body{font-family:system-ui,sans-serif;padding:2rem}table{width:100%;border-collapse:collapse}td,th{padding:.75rem;border:1px solid #ddd;text-align:left;font-family:monospace}@media print{body{background:#fff}}</style></head><body>
<h1>Revora Recovery Codes</h1><p>Generated: ${new Date().toLocaleString()}</p>
<table><thead><tr><th>#</th><th>Code</th></tr></thead><tbody>${revealedCodes.map((c,i)=>`<tr><td>${i+1}</td><td>${c}</td></tr>`).join('')}</tbody></table>
<p style="margin-top:2rem">⚠️ Keep these codes safe and secret.</p></body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 500);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck size={28} className="text-success" />
        <div>
          <h1 className="text-2xl font-bold">Two-Factor Backup Codes</h1>
          <p className="text-muted text-sm">Save these codes in a secure location for account recovery</p>
        </div>
      </div>

      <div className="tfa-warning-banner mb-6" role="alert">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} aria-hidden="true" className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold mb-1">🚨 SAVE THESE CODES NOW</p>
            <p className="text-sm">
              If you lose access to your authenticator app, these codes are the <strong>ONLY</strong> way to recover your account. Each code can be used once.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 p-4 rounded-lg bg-glass-bg-accent border border-glass-border">
        <span className="text-sm">Revealed: {revealedCount}/{codes.length}</span>
        <div className="flex flex-wrap gap-2">
          <button onClick={toggleAllReveal} className="btn-secondary text-sm">
            {allRevealed ? <><EyeOff size={16} className="mr-1" /> Hide All</> : <><Eye size={16} className="mr-1" /> Reveal All</>}
          </button>
          <button onClick={copyAllCodes} disabled={!revealedCount} className="btn-secondary text-sm">
            {isCopied ? <><Check size={16} className="mr-1" /> Copied!</> : <><Copy size={16} className="mr-1" /> Copy All</>}
          </button>
          <button onClick={downloadCodes} disabled={!revealedCount} className="btn-secondary text-sm">
            <Download size={16} className="mr-1" /> Download
          </button>
          <button onClick={printCodes} disabled={!revealedCount} className="btn-secondary text-sm">
            <Printer size={16} className="mr-1" /> Print
          </button>
          {onRegenerateCodes && (
            <button
              ref={regenerateTriggerRef}
              type="button"
              onClick={() => setShowRegenerateConfirm(true)}
              className="btn-secondary text-sm text-error"
            >
              <RotateCcw size={16} className="mr-1" /> Regenerate
            </button>
          )}
        </div>
      </div>

      {copyError && (
        <div role="status" aria-live="polite" className="mb-4 p-3 rounded bg-red-100 text-red-800 text-sm border border-red-300">
          {copyError}
        </div>
      )}

      <div ref={codesGridRef} className="tfa-recovery-grid">
        {codes.map((code, idx) => (
          <button
            key={code}
            type="button"
            onClick={() => toggleReveal(idx)}
            className={`tfa-recovery-card ${revealed[idx] ? 'revealed' : 'concealed'}`}
            aria-pressed={revealed[idx]}
          >
            <div className="tfa-recovery-card__content">
              <div className="tfa-recovery-card__index">{idx + 1}</div>
              <div className={`tfa-recovery-card__code ${revealed[idx] ? '' : 'placeholder'}`}>
                {revealed[idx] ? code : CODE_PLACEHOLDER}
              </div>
            </div>
          </button>
        ))}
      </div>

      {onRegenerateCodes && showRegenerateConfirm && (
        <RegenerateCodesDialog
          isPending={isRegenerating}
          error={regenerateError}
          onConfirm={confirmRegenerate}
          onCancel={() => { if (!isRegenerating) closeRegenerateDialog(); }}
        />
      )}
    </div>
  );
};

export default TwoFactorBackupCodesPage;
