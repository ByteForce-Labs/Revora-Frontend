/**
 * Financial Terms Validation — Issue #197
 *
 * Pure functions: no React, no side-effects.
 * Covers field-level validation, guardrail warnings, and locale-aware
 * number parsing so the form can accept "1,000.50" or "1.000,50".
 */

/* ─── Field definitions ─────────────────────────────────────────────────── */

export type FinancialTermsField =
  | 'revenueShareRate'
  | 'revenueCap'
  | 'paymentFrequency'
  | 'minInvestment'
  | 'maxInvestment'
  | 'offeringDuration';

/* ─── Constraints ───────────────────────────────────────────────────────── */

export const FIELD_CONSTRAINTS = {
  revenueShareRate: {
    min: 0.1,
    max: 50,
    step: 0.1,
    unit: '%',
    label: 'Revenue share rate',
    helpText:
      'Percentage of monthly gross revenue paid to token holders. Must be between 0.1% and 50%.',
    guardrailLow: 1,
    guardrailHigh: 30,
    guardrailLowMsg:
      'Revenue share rate below 1% may not attract investors. Consider raising it to improve offering appeal.',
    guardrailHighMsg:
      'Revenue share rate above 30% is unusually high and may strain cash flow. Confirm this is intentional.',
  },
  revenueCap: {
    min: 1,
    max: 100_000_000,
    step: 1,
    unit: 'USD',
    label: 'Revenue cap',
    helpText:
      'Maximum cumulative revenue distributed before the obligation ends. Must be at least $1 and no more than $100,000,000.',
    guardrailLow: 10_000,
    guardrailHigh: 50_000_000,
    guardrailLowMsg:
      'Revenue cap below $10,000 is very low and may close the offering quickly. Confirm this is intentional.',
    guardrailHighMsg:
      'Revenue cap above $50,000,000 is unusually large. Confirm this reflects your actual revenue projections.',
  },
  paymentFrequency: {
    min: 1,
    max: 12,
    step: 1,
    unit: 'months',
    label: 'Payment frequency',
    helpText:
      'How often distributions are made, in months. 1 = monthly, 3 = quarterly, 12 = annually.',
    guardrailLow: null,
    guardrailHigh: 6,
    guardrailLowMsg: null,
    guardrailHighMsg:
      'Payment frequency greater than 6 months means investors wait a long time between distributions.',
  },
  minInvestment: {
    min: 1,
    max: 1_000_000,
    step: 1,
    unit: 'USD',
    label: 'Minimum investment',
    helpText: 'Smallest amount a single investor may commit. Must be between $1 and $1,000,000.',
    guardrailLow: null,
    guardrailHigh: 50_000,
    guardrailLowMsg: null,
    guardrailHighMsg:
      'Minimum investment above $50,000 significantly limits your investor pool. Confirm this is intentional.',
  },
  maxInvestment: {
    min: 1,
    max: 10_000_000,
    step: 1,
    unit: 'USD',
    label: 'Maximum investment',
    helpText:
      'Largest amount a single investor may commit. Must be at least $1 and no more than $10,000,000.',
    guardrailLow: null,
    guardrailHigh: null,
    guardrailLowMsg: null,
    guardrailHighMsg: null,
  },
  offeringDuration: {
    min: 1,
    max: 120,
    step: 1,
    unit: 'months',
    label: 'Offering duration',
    helpText:
      'How long the offering remains open for investment, in months. Between 1 and 120 months.',
    guardrailLow: 3,
    guardrailHigh: 60,
    guardrailLowMsg:
      'Offering duration under 3 months gives investors very little time to participate.',
    guardrailHighMsg:
      'Offering duration over 60 months (5 years) is unusually long. Confirm this is intentional.',
  },
} as const satisfies Record<
  FinancialTermsField,
  {
    min: number;
    max: number;
    step: number;
    unit: string;
    label: string;
    helpText: string;
    guardrailLow: number | null;
    guardrailHigh: number | null;
    guardrailLowMsg: string | null;
    guardrailHighMsg: string | null;
  }
>;

/* ─── Validation result types ───────────────────────────────────────────── */

export type ValidationSeverity = 'error' | 'warning' | 'ok';

export interface FieldValidationResult {
  severity: ValidationSeverity;
  /** Human-readable message. Empty string when severity is 'ok'. */
  message: string;
  /** Numeric value parsed from the raw string, or null if unparseable. */
  numericValue: number | null;
}

/* ─── Number parsing ────────────────────────────────────────────────────── */

function getLocaleSeparators(locale: string): { decimal: string; group: string } {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(1000.1);
    let decimal = '.';
    let group = ',';
    for (const part of parts) {
      if (part.type === 'decimal') decimal = part.value;
      if (part.type === 'group') group = part.value;
    }
    return { decimal, group };
  } catch {
    return { decimal: '.', group: ',' };
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parses a locale-formatted number string into a JS number.
 *
 * Handles:
 * - Thousands separators: commas (en-US), periods (de-DE), spaces/NBSP (fr-FR)
 * - Decimal separators: period (en-US), comma (de-DE)
 * - Leading/trailing whitespace
 * - Negative values → returns null (financial terms must be positive)
 * - Empty / non-numeric strings → returns null
 */
export function parseLocaleNumber(raw: string, locale?: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  // Reject explicit negatives — all financial terms must be positive
  if (trimmed.startsWith('-')) return null;

  // Allow digits, separators (comma, period, space, NBSP, thin space), and locale-derived
  const normalizedWhitespace = trimmed.replace(/[\s\u00A0\u202F]/g, ' ');
  if (!/^[\d,.\s\u00A0\u202F]*$/.test(trimmed)) return null;

  let working = normalizedWhitespace;

  if (locale) {
    const { decimal, group } = getLocaleSeparators(locale);
    const groupRe = new RegExp(escapeRegExp(group === ' ' ? ' ' : group), 'g');
    working = working.replace(groupRe, '');
    if (group === ' ') {
      working = working.replace(/\s+/g, '');
    }
    if (decimal !== '.') {
      const decRe = new RegExp(escapeRegExp(decimal), 'g');
      working = working.replace(decRe, '.');
    }
    working = working.replace(/\s+/g, '');
  } else {
    const dotCount = (working.match(/\./g) ?? []).length;
    const commaCount = (working.match(/,/g) ?? []).length;

    if (dotCount > 0 && commaCount > 0) {
      // Both present — whichever comes last is the decimal separator
      const lastDot = working.lastIndexOf('.');
      const lastComma = working.lastIndexOf(',');
      if (lastComma > lastDot) {
        // European format: 1.234,56
        working = working.replace(/\./g, '').replace(',', '.');
      } else {
        // US format with comma thousands: 1,234.56
        working = working.replace(/,/g, '');
      }
    } else if (commaCount === 1) {
      // Single comma — decimal separator if followed by 1-3 digits at end (or if no other pattern)
      if (/,(\d{1,3})$/.test(working)) {
        // Check if it's likely thousands (grouped in threes) vs decimal
        const before = working.slice(0, working.lastIndexOf(','));
        if (before.includes(',') || before.includes('.')) {
          working = working.replace(/,/g, '');
        } else if ((before.match(/\d/g) || []).length % 3 === 0 && before.length > 0 && before.replace(/[^0-9]/g, '').length > 0 && !/,\d{1,2}$/.test(working)) {
          // Could be thousands in some locales, but default to decimal only for 1-2 digits? Keep original heuristic but be more careful
          working = working.replace(',', '.');
        } else if (/,\d{3}$/.test(working)) {
          // Ambiguous case - treat as thousands if grouped
          working = working.replace(/,/g, '');
        } else {
          working = working.replace(',', '.');
        }
      } else {
        working = working.replace(/,/g, '');
      }
    } else if (dotCount === 1) {
      // Single dot — could be decimal or thousands separator
      if (/\.\d{3}$/.test(working)) {
        working = working.replace(/\./g, '');
      }
      // else: single dot as decimal — pass through as-is
    } else if (dotCount > 1) {
      // Multiple dots — thousands separators (e.g. "1.000.000")
      working = working.replace(/\./g, '');
    }

    working = working.replace(/[^\d.]/g, '');
  }

  working = working.replace(/[^\d.]/g, '');

  if (working === '' || working === '.') return null;

  const value = parseFloat(working);
  return isNaN(value) ? null : value;
}

/* ─── Per-field validation ──────────────────────────────────────────────── */

/**
 * Validates a single financial terms field.
 *
 * Error copy pattern: "[Field label] [issue]. [Suggested fix]."
 * Guardrail warnings are only emitted when the value is valid but near
 * an unusual threshold.
 */
export function validateField(
  field: FinancialTermsField,
  rawValue: string,
): FieldValidationResult {
  const c = FIELD_CONSTRAINTS[field];

  if (rawValue.trim() === '') {
    return {
      severity: 'error',
      message: `${c.label} is required. Enter a value between ${formatConstraint(c.min, c.unit)} and ${formatConstraint(c.max, c.unit)}.`,
      numericValue: null,
    };
  }

  const num = parseLocaleNumber(rawValue);

  if (num === null) {
    return {
      severity: 'error',
      message: `${c.label} must be a positive number. Remove any letters or special characters and try again.`,
      numericValue: null,
    };
  }

  if (num < c.min) {
    return {
      severity: 'error',
      message: `${c.label} must be at least ${formatConstraint(c.min, c.unit)}. Enter a value of ${formatConstraint(c.min, c.unit)} or higher.`,
      numericValue: num,
    };
  }

  if (num > c.max) {
    return {
      severity: 'error',
      message: `${c.label} cannot exceed ${formatConstraint(c.max, c.unit)}. Enter a value of ${formatConstraint(c.max, c.unit)} or lower.`,
      numericValue: num,
    };
  }

  if (typeof c.step === 'number' && c.step > 0) {
    const epsilon = 1e-8;
    if (c.step === 1) {
      // Allow values that are integers (including .0)
      if (Math.abs(num - Math.round(num)) > 1e-6) {
        return {
          severity: 'error',
          message: `${c.label} must be in increments of ${c.step} ${c.unit}. Enter a value like ${c.min}.`,
          numericValue: num,
        };
      }
    } else {
      const quotient = num / c.step;
      const qRounded = Math.round(quotient);
      if (Math.abs(quotient - qRounded) > epsilon) {
        return {
          severity: 'error',
          message: `${c.label} must be in increments of ${c.step} ${c.unit}. Enter a value like ${c.min}.`,
          numericValue: num,
        };
      }
    }
  }

  if (c.guardrailLow !== null && num < c.guardrailLow && c.guardrailLowMsg !== null) {
    return { severity: 'warning', message: c.guardrailLowMsg, numericValue: num };
  }

  if (c.guardrailHigh !== null && num > c.guardrailHigh && c.guardrailHighMsg !== null) {
    return { severity: 'warning', message: c.guardrailHighMsg, numericValue: num };
  }

  return { severity: 'ok', message: '', numericValue: num };
}

/* ─── Cross-field validation ────────────────────────────────────────────── */

/**
 * Validates that minInvestment < maxInvestment when both are valid numbers.
 * Returns an error message string, or null when the constraint is satisfied.
 */
export function validateInvestmentRange(
  minRaw: string,
  maxRaw: string,
): string | null {
  const minVal = parseLocaleNumber(minRaw);
  const maxVal = parseLocaleNumber(maxRaw);
  if (minVal === null || maxVal === null) return null;
  if (minVal >= maxVal) {
    return `Maximum investment ($${formatNumber(maxVal)}) must be greater than minimum investment ($${formatNumber(minVal)}). Increase the maximum or decrease the minimum.`;
  }
  return null;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function formatConstraint(value: number, unit: string): string {
  if (unit === '%') return `${value}%`;
  if (unit === 'USD') return `$${formatNumber(value)}`;
  return `${value} ${unit}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/* ─── Form-level validity ───────────────────────────────────────────────── */

export type FinancialTermsValues = Record<FinancialTermsField, string>;

export interface FormValidationSummary {
  /** True when all fields pass (no errors; warnings are allowed). */
  isValid: boolean;
  /** Per-field results keyed by field name. */
  fields: Record<FinancialTermsField, FieldValidationResult>;
  /** Cross-field error message, or null. */
  crossFieldError: string | null;
}

export function validateFinancialTermsForm(
  values: FinancialTermsValues,
  locale?: string,
): FormValidationSummary {
  const fields = (Object.keys(FIELD_CONSTRAINTS) as FinancialTermsField[]).reduce(
    (acc, field) => {
      acc[field] = validateField(field, values[field], locale);
      return acc;
    },
    {} as Record<FinancialTermsField, FieldValidationResult>,
  );

  const crossFieldError = validateInvestmentRange(
    values.minInvestment,
    values.maxInvestment,
  );

  const hasFieldErrors = Object.values(fields).some((r) => r.severity === 'error');
  const isValid = !hasFieldErrors && crossFieldError === null;

  return { isValid, fields, crossFieldError };
}
