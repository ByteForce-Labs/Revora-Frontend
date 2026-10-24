/**
 * Financial Terms Validation Tests — Issue #420
 *
 * Comprehensive unit tests for the validation utility with 95%+ coverage.
 * Tests cover:
 * - Field-level validation (required, numeric, range)
 * - Guardrail warnings (low/high thresholds)
 * - Locale number parsing (commas, periods, European/US formats)
 * - Edge cases (negative numbers, empty strings, special chars)
 * - Cross-field validation (min/max investment)
 * - Form-level validation summary
 */

import { describe, it, expect } from 'vitest';
import {
  parseLocaleNumber,
  validateField,
  validateInvestmentRange,
  validateFinancialTermsForm,
  FIELD_CONSTRAINTS,
  type FinancialTermsField,
  type FinancialTermsValues,
} from './financialTermsValidation';

/* ─── parseLocaleNumber Tests ──────────────────────────────────────────── */

describe('parseLocaleNumber', () => {
  describe('basic valid input', () => {
    it('parses simple integers', () => {
      expect(parseLocaleNumber('100')).toBe(100);
      expect(parseLocaleNumber('1000')).toBe(1000);
    });

    it('parses decimal numbers with period', () => {
      expect(parseLocaleNumber('10.5')).toBe(10.5);
      expect(parseLocaleNumber('0.1')).toBe(0.1);
    });

    it('trims leading/trailing whitespace', () => {
      expect(parseLocaleNumber('  100  ')).toBe(100);
      expect(parseLocaleNumber('\t50\n')).toBe(50);
    });
  });

  describe('locale-specific formatting', () => {
    it('parses US format with comma thousands separator', () => {
      expect(parseLocaleNumber('1,000')).toBe(1000);
      expect(parseLocaleNumber('1,000,000')).toBe(1000000);
      expect(parseLocaleNumber('1,234.56')).toBe(1234.56);
    });

    it('parses European format with period thousands and comma decimal', () => {
      expect(parseLocaleNumber('1.000')).toBe(1000);
      expect(parseLocaleNumber('1.000.000')).toBe(1000000);
      expect(parseLocaleNumber('1.234,56')).toBe(1234.56);
    });

    it('handles ambiguous single comma (decimal separator)', () => {
      expect(parseLocaleNumber('10,5')).toBe(10.5);
      expect(parseLocaleNumber('1,50')).toBe(1.5);
    });

    it('handles ambiguous single comma (thousands separator)', () => {
      expect(parseLocaleNumber('1,000')).toBe(1000);
      expect(parseLocaleNumber('5,123')).toBe(5123);
    });

    it('determines last separator is decimal in mixed format', () => {
      // US format: 1,234.56
      expect(parseLocaleNumber('1,234.56')).toBe(1234.56);
      // European format: 1.234,56
      expect(parseLocaleNumber('1.234,56')).toBe(1234.56);
    });
  });

  describe('invalid or edge case input', () => {
    it('returns null for empty string', () => {
      expect(parseLocaleNumber('')).toBeNull();
      expect(parseLocaleNumber('  ')).toBeNull();
    });

    it('returns null for non-numeric input', () => {
      expect(parseLocaleNumber('abc')).toBeNull();
      expect(parseLocaleNumber('10abc')).toBeNull();
    });

    it('returns null for negative numbers', () => {
      expect(parseLocaleNumber('-100')).toBeNull();
      expect(parseLocaleNumber('-1.5')).toBeNull();
    });

    it('returns null for special characters (except separators)', () => {
      expect(parseLocaleNumber('$100')).toBeNull();
      expect(parseLocaleNumber('100%')).toBeNull();
      expect(parseLocaleNumber('@100')).toBeNull();
    });

    it('returns null for NaN', () => {
      expect(parseLocaleNumber('NaN')).toBeNull();
      expect(parseLocaleNumber('Infinity')).toBeNull();
    });

    it('handles dot-only input', () => {
      expect(parseLocaleNumber('.')).toBeNull();
    });
  });

  describe('edge case locale combinations', () => {
    it('handles very large numbers', () => {
      expect(parseLocaleNumber('999,999,999.99')).toBe(999999999.99);
      expect(parseLocaleNumber('999.999.999,99')).toBe(999999999.99);
    });

    it('handles very small decimals (two decimal places, common in financial)', () => {
      expect(parseLocaleNumber('0.01')).toBe(0.01);
      expect(parseLocaleNumber('0,01')).toBe(0.01);
    });
  });
});

/* ─── validateField Tests ──────────────────────────────────────────────── */

describe('validateField', () => {
  describe('required field validation', () => {
    it('returns error for empty string', () => {
      const result = validateField('revenueShareRate', '');
      expect(result.severity).toBe('error');
      expect(result.message).toContain('required');
      expect(result.numericValue).toBeNull();
    });

    it('returns error for whitespace-only input', () => {
      const result = validateField('revenueShareRate', '   ');
      expect(result.severity).toBe('error');
      expect(result.message).toContain('required');
    });
  });

  describe('non-numeric validation', () => {
    it('returns error for non-numeric input', () => {
      const result = validateField('revenueShareRate', 'abc');
      expect(result.severity).toBe('error');
      expect(result.message).toContain('positive number');
      expect(result.numericValue).toBeNull();
    });

    it('returns error for negative values', () => {
      const result = validateField('revenueCap', '-5000');
      expect(result.severity).toBe('error');
      expect(result.message).toContain('positive number');
      expect(result.numericValue).toBeNull();
    });

    it('includes field label in error message', () => {
      const result = validateField('revenueShareRate', 'invalid');
      expect(result.message).toContain('Revenue share rate');
    });
  });

  describe('minimum constraint validation', () => {
    it('returns error when value below minimum', () => {
      const result = validateField('revenueShareRate', '0.05');
      expect(result.severity).toBe('error');
      expect(result.message).toContain('at least');
      expect(result.message).toContain('0.1%');
    });

    it('allows value exactly at minimum', () => {
      const result = validateField('revenueShareRate', '0.1');
      expect(result.severity).toBe('warning'); // 0.1 < guardrailLow (1)
      expect(result.numericValue).toBe(0.1);
    });

    it('error message includes suggested fix', () => {
      const result = validateField('revenueCap', '0.50');
      expect(result.message).toContain('Enter a value');
      expect(result.message).toContain('or higher');
    });
  });

  describe('maximum constraint validation', () => {
    it('returns error when value above maximum', () => {
      const result = validateField('revenueShareRate', '99');
      expect(result.severity).toBe('error');
      expect(result.message).toContain('cannot exceed');
      expect(result.message).toContain('50%');
    });

    it('allows value exactly at maximum', () => {
      const result = validateField('revenueShareRate', '50');
      expect(result.severity).toBe('warning'); // 50 > guardrailHigh (30)
      expect(result.numericValue).toBe(50);
    });

    it('error message includes suggested fix', () => {
      const result = validateField('paymentFrequency', '25');
      expect(result.message).toContain('Enter a value');
      expect(result.message).toContain('or lower');
    });
  });

  describe('guardrail warnings', () => {
    describe('revenueShareRate guardrails', () => {
      it('shows warning for rate below 1%', () => {
        const result = validateField('revenueShareRate', '0.5');
        expect(result.severity).toBe('warning');
        expect(result.message).toContain('below 1%');
        expect(result.numericValue).toBe(0.5);
      });

      it('shows warning for rate above 30%', () => {
        const result = validateField('revenueShareRate', '35');
        expect(result.severity).toBe('warning');
        expect(result.message).toContain('above 30%');
        expect(result.numericValue).toBe(35);
      });

      it('no warning for rate between 1% and 30%', () => {
        const result = validateField('revenueShareRate', '15');
        expect(result.severity).toBe('ok');
      });
    });

    describe('revenueCap guardrails', () => {
      it('shows warning for cap below $10,000', () => {
        const result = validateField('revenueCap', '5000');
        expect(result.severity).toBe('warning');
        expect(result.message).toContain('below $10,000');
      });

      it('shows warning for cap above $50,000,000', () => {
        const result = validateField('revenueCap', '75000000');
        expect(result.severity).toBe('warning');
        expect(result.message).toContain('above $50,000,000');
      });

      it('no warning for cap between thresholds', () => {
        const result = validateField('revenueCap', '500000');
        expect(result.severity).toBe('ok');
      });
    });

    describe('paymentFrequency guardrails', () => {
      it('shows warning for frequency above 6 months', () => {
        const result = validateField('paymentFrequency', '9');
        expect(result.severity).toBe('warning');
        expect(result.message).toContain('greater than 6 months');
      });

      it('no warning for frequency 6 months or less', () => {
        const result = validateField('paymentFrequency', '6');
        expect(result.severity).toBe('ok');
      });
    });

    describe('offeringDuration guardrails', () => {
      it('shows warning for duration under 3 months', () => {
        const result = validateField('offeringDuration', '2');
        expect(result.severity).toBe('warning');
        expect(result.message).toContain('under 3 months');
      });

      it('shows warning for duration over 60 months', () => {
        const result = validateField('offeringDuration', '72');
        expect(result.severity).toBe('warning');
        expect(result.message).toContain('over 60 months');
      });

      it('no warning for duration between 3 and 60 months', () => {
        const result = validateField('offeringDuration', '24');
        expect(result.severity).toBe('ok');
      });
    });

    describe('minInvestment guardrails', () => {
      it('shows warning for minimum above $50,000', () => {
        const result = validateField('minInvestment', '75000');
        expect(result.severity).toBe('warning');
        expect(result.message).toContain('above $50,000');
      });

      it('no warning for minimum $50,000 or less', () => {
        const result = validateField('minInvestment', '50000');
        expect(result.severity).toBe('ok');
      });
    });
  });

  describe('locale number parsing with validation', () => {
    it('validates parsed comma-formatted number', () => {
      const result = validateField('revenueCap', '1,000,000');
      expect(result.severity).toBe('ok');
      expect(result.numericValue).toBe(1000000);
    });

    it('validates parsed European-format number', () => {
      const result = validateField('revenueCap', '1.000.000');
      expect(result.severity).toBe('ok');
      expect(result.numericValue).toBe(1000000);
    });

    it('preserves numeric value even on guardrail warning', () => {
      const result = validateField('revenueShareRate', '0.5');
      expect(result.numericValue).toBe(0.5);
      expect(result.severity).toBe('warning');
    });
  });

  describe('field-specific validation', () => {
    it('validates all six fields independently', () => {
      const fields: FinancialTermsField[] = [
        'revenueShareRate',
        'revenueCap',
        'paymentFrequency',
        'minInvestment',
        'maxInvestment',
        'offeringDuration',
      ];

      fields.forEach((field) => {
        const result = validateField(field, 'invalid');
        expect(result.severity).toBe('error');
        expect(result.numericValue).toBeNull();
      });
    });

    it('uses correct unit in error messages', () => {
      // Negative values produce "positive number" error (no unit needed in that message)
      const rateResult = validateField('revenueShareRate', '-1');
      expect(rateResult.message).toContain('positive number');

      // Range errors should include units
      const rateRangeResult = validateField('revenueShareRate', '99');
      expect(rateRangeResult.message).toContain('%');

      const capResult = validateField('revenueCap', '99999999999');
      expect(capResult.message).toContain('$');

      const freqResult = validateField('paymentFrequency', '25');
      expect(freqResult.message).toContain('months');
    });
  });

  describe('error message format pattern', () => {
    it('follows pattern: [Field Label] [issue]. [Suggested fix].', () => {
      const result = validateField('revenueShareRate', '99');
      // Verify structure: label at start, issue description, and suggestion
      expect(result.message).toMatch(/^Revenue share rate/);
      expect(result.message).toMatch(/cannot exceed/);
      expect(result.message).toMatch(/Enter a value/);
    });

    it('uses correct unit in error messages for range errors', () => {
      // Negative values produce "positive number" error (no unit needed in that message)
      const rateResult = validateField('revenueShareRate', '-1');
      expect(rateResult.message).toContain('positive number');

      // Range errors should include units
      const rateRangeResult = validateField('revenueShareRate', '99');
      expect(rateRangeResult.message).toContain('%');

      const capResult = validateField('revenueCap', '99999999999');
      expect(capResult.message).toContain('$');

      const freqResult = validateField('paymentFrequency', '25');
      expect(freqResult.message).toContain('months');
    });
  });
});

/* ─── validateInvestmentRange Tests ────────────────────────────────────── */

describe('validateInvestmentRange', () => {
  describe('valid range', () => {
    it('returns null when min < max', () => {
      const error = validateInvestmentRange('1000', '50000');
      expect(error).toBeNull();
    });

    it('handles locale-formatted numbers', () => {
      const error = validateInvestmentRange('1,000', '50,000');
      expect(error).toBeNull();
    });

    it('handles European format', () => {
      const error = validateInvestmentRange('1.000', '50.000');
      expect(error).toBeNull();
    });
  });

  describe('invalid range', () => {
    it('returns error when min >= max', () => {
      const error = validateInvestmentRange('50000', '1000');
      expect(error).not.toBeNull();
      expect(error).toContain('must be greater than');
    });

    it('returns error when min equals max', () => {
      const error = validateInvestmentRange('25000', '25000');
      expect(error).not.toBeNull();
      expect(error).toContain('must be greater than');
    });

    it('includes formatted values in error message', () => {
      const error = validateInvestmentRange('50000', '1000');
      expect(error).toContain('$');
      expect(error).toContain('50');
      expect(error).toContain('1');
    });

    it('provides suggested fix in error message', () => {
      const error = validateInvestmentRange('50000', '1000');
      expect(error).toMatch(/Increase the maximum|decrease the minimum/);
    });
  });

  describe('missing/invalid values', () => {
    it('returns null when either value is unparseable', () => {
      expect(validateInvestmentRange('invalid', '5000')).toBeNull();
      expect(validateInvestmentRange('1000', 'invalid')).toBeNull();
      expect(validateInvestmentRange('invalid', 'invalid')).toBeNull();
    });

    it('returns null when either value is empty', () => {
      expect(validateInvestmentRange('', '5000')).toBeNull();
      expect(validateInvestmentRange('1000', '')).toBeNull();
    });
  });
});

/* ─── validateFinancialTermsForm Tests ──────────────────────────────────── */

describe('validateFinancialTermsForm', () => {
  const VALID_VALUES: FinancialTermsValues = {
    revenueShareRate: '8',
    revenueCap: '500000',
    paymentFrequency: '3',
    minInvestment: '1000',
    maxInvestment: '50000',
    offeringDuration: '24',
  };

  describe('valid form', () => {
    it('returns isValid: true when all fields valid', () => {
      const summary = validateFinancialTermsForm(VALID_VALUES);
      expect(summary.isValid).toBe(true);
      expect(summary.crossFieldError).toBeNull();
    });

    it('includes all field results', () => {
      const summary = validateFinancialTermsForm(VALID_VALUES);
      expect(Object.keys(summary.fields).length).toBe(6);
      Object.values(summary.fields).forEach((result) => {
        expect(result.severity).toBe('ok');
      });
    });
  });

  describe('form with field errors', () => {
    it('returns isValid: false when any field has error', () => {
      const values = { ...VALID_VALUES, revenueShareRate: 'invalid' };
      const summary = validateFinancialTermsForm(values);
      expect(summary.isValid).toBe(false);
    });

    it('reports all field errors', () => {
      const values = {
        ...VALID_VALUES,
        revenueShareRate: 'invalid',
        revenueCap: '',
      };
      const summary = validateFinancialTermsForm(values);
      expect(summary.fields.revenueShareRate.severity).toBe('error');
      expect(summary.fields.revenueCap.severity).toBe('error');
    });
  });

  describe('form with guardrail warnings', () => {
    it('returns isValid: true with warnings (not blocking)', () => {
      const values = { ...VALID_VALUES, revenueShareRate: '0.5' };
      const summary = validateFinancialTermsForm(values);
      expect(summary.isValid).toBe(true);
      expect(summary.fields.revenueShareRate.severity).toBe('warning');
    });

    it('allows submission with warnings', () => {
      const values = {
        ...VALID_VALUES,
        revenueShareRate: '0.5',
        revenueCap: '5000',
      };
      const summary = validateFinancialTermsForm(values);
      expect(summary.isValid).toBe(true);
    });
  });

  describe('form with cross-field errors', () => {
    it('returns isValid: false when cross-field constraint violated', () => {
      const values = {
        ...VALID_VALUES,
        minInvestment: '50000',
        maxInvestment: '1000',
      };
      const summary = validateFinancialTermsForm(values);
      expect(summary.isValid).toBe(false);
      expect(summary.crossFieldError).not.toBeNull();
    });

    it('includes cross-field error message in summary', () => {
      const values = {
        ...VALID_VALUES,
        minInvestment: '50000',
        maxInvestment: '1000',
      };
      const summary = validateFinancialTermsForm(values);
      expect(summary.crossFieldError).toMatch(/must be greater than/);
    });

    it('ignores cross-field error when either field is invalid', () => {
      const values = {
        ...VALID_VALUES,
        minInvestment: 'invalid',
        maxInvestment: '1000',
      };
      const summary = validateFinancialTermsForm(values);
      expect(summary.crossFieldError).toBeNull();
    });
  });

  describe('form with mixed error states', () => {
    it('returns isValid: false with field error and cross-field warning', () => {
      const values = {
        ...VALID_VALUES,
        revenueShareRate: 'invalid',
        minInvestment: '50000',
        maxInvestment: '1000',
      };
      const summary = validateFinancialTermsForm(values);
      expect(summary.isValid).toBe(false);
      expect(summary.fields.revenueShareRate.severity).toBe('error');
      expect(summary.crossFieldError).not.toBeNull();
    });

    it('reports only errors, warnings do not block', () => {
      const values = {
        ...VALID_VALUES,
        revenueShareRate: '0.5', // warning
        revenueCap: '5000', // warning
      };
      const summary = validateFinancialTermsForm(values);
      expect(summary.isValid).toBe(true);
    });
  });

  describe('form with empty values', () => {
    it('returns isValid: false when all fields empty', () => {
      const values: FinancialTermsValues = {
        revenueShareRate: '',
        revenueCap: '',
        paymentFrequency: '',
        minInvestment: '',
        maxInvestment: '',
        offeringDuration: '',
      };
      const summary = validateFinancialTermsForm(values);
      expect(summary.isValid).toBe(false);
      Object.values(summary.fields).forEach((result) => {
        expect(result.severity).toBe('error');
      });
    });
  });

  describe('numeric value extraction', () => {
    it('extracts numeric values from valid fields', () => {
      const summary = validateFinancialTermsForm(VALID_VALUES);
      expect(summary.fields.revenueShareRate.numericValue).toBe(8);
      expect(summary.fields.revenueCap.numericValue).toBe(500000);
    });

    it('extracts numeric values from locale-formatted input', () => {
      const values = {
        ...VALID_VALUES,
        revenueCap: '1,000,000',
        minInvestment: '10.000',
      };
      const summary = validateFinancialTermsForm(values);
      expect(summary.fields.revenueCap.numericValue).toBe(1000000);
      expect(summary.fields.minInvestment.numericValue).toBe(10000);
    });

    it('sets numeric value to null for unparseable input', () => {
      const values = { ...VALID_VALUES, revenueShareRate: 'invalid' };
      const summary = validateFinancialTermsForm(values);
      expect(summary.fields.revenueShareRate.numericValue).toBeNull();
    });
  });
});

/* ─── FIELD_CONSTRAINTS Structure Tests ────────────────────────────────── */

describe('FIELD_CONSTRAINTS', () => {
  it('defines constraints for all six fields', () => {
    const fields: FinancialTermsField[] = [
      'revenueShareRate',
      'revenueCap',
      'paymentFrequency',
      'minInvestment',
      'maxInvestment',
      'offeringDuration',
    ];

    fields.forEach((field) => {
      expect(FIELD_CONSTRAINTS[field]).toBeDefined();
      expect(FIELD_CONSTRAINTS[field]).toHaveProperty('min');
      expect(FIELD_CONSTRAINTS[field]).toHaveProperty('max');
      expect(FIELD_CONSTRAINTS[field]).toHaveProperty('unit');
      expect(FIELD_CONSTRAINTS[field]).toHaveProperty('label');
      expect(FIELD_CONSTRAINTS[field]).toHaveProperty('helpText');
      expect(FIELD_CONSTRAINTS[field]).toHaveProperty('guardrailLow');
      expect(FIELD_CONSTRAINTS[field]).toHaveProperty('guardrailHigh');
    });
  });

  it('has min < max for all fields', () => {
    (Object.keys(FIELD_CONSTRAINTS) as FinancialTermsField[]).forEach((field) => {
      const c = FIELD_CONSTRAINTS[field];
      expect(c.min).toBeLessThan(c.max);
    });
  });

  it('has valid guardrail thresholds', () => {
    (Object.keys(FIELD_CONSTRAINTS) as FinancialTermsField[]).forEach((field) => {
      const c = FIELD_CONSTRAINTS[field];
      if (c.guardrailLow !== null) {
        expect(c.guardrailLow).toBeGreaterThanOrEqual(c.min);
        expect(c.guardrailLow).toBeLessThanOrEqual(c.max);
      }
      if (c.guardrailHigh !== null) {
        expect(c.guardrailHigh).toBeGreaterThanOrEqual(c.min);
        expect(c.guardrailHigh).toBeLessThanOrEqual(c.max);
      }
    });
  });

  it('has non-empty labels and help text', () => {
    (Object.keys(FIELD_CONSTRAINTS) as FinancialTermsField[]).forEach((field) => {
      const c = FIELD_CONSTRAINTS[field];
      expect(c.label).toBeTruthy();
      expect(c.helpText).toBeTruthy();
    });
  });
});

/* ─── Coverage edge cases ──────────────────────────────────────────────── */

describe('edge cases for complete coverage', () => {
  it('handles zero value', () => {
    const result = validateField('revenueShareRate', '0');
    expect(result.severity).toBe('error');
    expect(result.message).toContain('at least');
  });

  it('handles very small positive decimal (guardrail low threshold)', () => {
    const result = validateField('revenueShareRate', '0.1');
    expect(result.severity).toBe('warning'); // Below guardrailLow (1%)
    expect(result.numericValue).toBe(0.1);
  });

  it('handles maximum allowed value exactly (guardrail high threshold)', () => {
    const result = validateField('revenueShareRate', '50');
    expect(result.severity).toBe('warning'); // Above guardrailHigh (30%)
    expect(result.numericValue).toBe(50);
  });

  it('handles one over maximum', () => {
    const result = validateField('revenueShareRate', '50.1');
    expect(result.severity).toBe('error');
    expect(result.message).toContain('cannot exceed');
  });

  it('handles guardrail low boundary exactly', () => {
    const result = validateField('revenueShareRate', '1');
    expect(result.severity).toBe('ok');
  });

  it('handles guardrail high boundary exactly', () => {
    const result = validateField('revenueShareRate', '30');
    expect(result.severity).toBe('ok');
  });

  it('handles one below guardrail low', () => {
    const result = validateField('revenueShareRate', '0.9');
    expect(result.severity).toBe('warning');
  });

  it('handles one above guardrail high', () => {
    const result = validateField('revenueShareRate', '30.1');
    expect(result.severity).toBe('warning');
  });
});
