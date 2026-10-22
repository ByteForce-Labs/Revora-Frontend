import React, { useState, useEffect, useRef } from 'react';
import { Save, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import './SaveAsDraft.css';

export interface SaveAsDraftProps {
  /**
   * Async function triggered when save is requested.
   * Should throw an error or reject if the save fails (e.g., offline).
   */
  onSave: () => Promise<void>;
  /** Optional custom className */
  className?: string;
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export const SaveAsDraft: React.FC<SaveAsDraftProps> = ({ onSave, className = '' }) => {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  const statusRef = useRef<HTMLDivElement>(null);

  const handleSave = async () => {
    setStatus('saving');
    setErrorMessage('');
    try {
      await onSave();
      setStatus('success');
      setLastSaved(new Date());
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error?.message || 'Save failed. Check connection.');
    }
  };

  // Clear success message after 3 seconds, but keep the timestamp
  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        setStatus('idle');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Focus management on error for accessibility
  useEffect(() => {
    if (status === 'error' && statusRef.current) {
      statusRef.current.focus();
    }
  }, [status]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`save-as-draft-container ${className}`}>
      <div 
        className="save-as-draft-status" 
        role="region" 
        aria-live="polite" 
        aria-atomic="true"
      >
        {status === 'success' && (
          <div className="status-message success animate-fade-in">
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>Draft saved</span>
          </div>
        )}
        
        {status === 'error' && (
          <div 
            className="status-message error animate-fade-in" 
            tabIndex={-1} 
            ref={statusRef}
          >
            <AlertCircle size={16} aria-hidden="true" />
            <span>{errorMessage}</span>
            <button 
              type="button" 
              onClick={handleSave} 
              className="retry-btn"
              aria-label="Retry saving draft"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {status === 'idle' && lastSaved && (
          <div className="status-message idle text-muted">
            Last saved at {formatTime(lastSaved)}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={status === 'saving'}
        className="save-as-draft-btn"
        aria-label="Save progress as draft"
      >
        {status === 'saving' ? (
          <>
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            <span>Saving...</span>
          </>
        ) : (
          <>
            <Save size={16} aria-hidden="true" />
            <span>Save as Draft</span>
          </>
        )}
      </button>
    </div>
  );
};
