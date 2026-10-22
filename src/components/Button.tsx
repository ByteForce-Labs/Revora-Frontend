import React, { forwardRef } from 'react';
import { Check } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  /** Accepted for API compatibility with callers; sizing is driven by className. */
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  success?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size: _size, loading, success, disabled, children, className = '', ...props }, ref) => {
    const isDisabled = disabled || loading || success;

    const classNames = [
      variant === 'primary' ? 'btn-primary' : 'btn-secondary',
      loading ? 'btn-loading' : '',
      success ? 'btn-success' : '',
      isDisabled ? 'btn-disabled' : '',
      className,
    ].filter(Boolean).join(' ');

    return (
      <button
        ref={ref}
        className={classNames}
        disabled={isDisabled}
        aria-busy={loading ? true : undefined}
        aria-disabled={!loading && isDisabled ? true : undefined}
        {...props}
      >
        {loading && (
          <LoadingSpinner className="btn-spinner" size={18} aria-hidden="true" />
        )}
        {success && (
          <Check className="btn-check-icon" size={18} aria-hidden="true" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

