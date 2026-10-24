import { useCallback, useReducer } from 'react';
import {
  validateField,
  validateFinancialTermsForm,
  type FinancialTermsField,
  type FinancialTermsValues,
  type FieldValidationResult,
  type FormValidationSummary,
} from '../utils/financialTermsValidation';

/* ─── State ─────────────────────────────────────────────────────────────── */

export interface FinancialTermsFormState {
  values: FinancialTermsValues;
  /** Fields the user has interacted with (blurred at least once). */
  touched: Record<FinancialTermsField, boolean>;
  /** Whether a submit was attempted — triggers validation on all fields. */
  submitAttempted: boolean;
}

const INITIAL_VALUES: FinancialTermsValues = {
  revenueShareRate: '',
  revenueCap: '',
  paymentFrequency: '',
  minInvestment: '',
  maxInvestment: '',
  offeringDuration: '',
};

const INITIAL_TOUCHED: Record<FinancialTermsField, boolean> = {
  revenueShareRate: false,
  revenueCap: false,
  paymentFrequency: false,
  minInvestment: false,
  maxInvestment: false,
  offeringDuration: false,
};

const initialState: FinancialTermsFormState = {
  values: INITIAL_VALUES,
  touched: INITIAL_TOUCHED,
  submitAttempted: false,
};

/* ─── Reducer ───────────────────────────────────────────────────────────── */

type Action =
  | { type: 'CHANGE'; field: FinancialTermsField; value: string }
  | { type: 'BLUR'; field: FinancialTermsField }
  | { type: 'SUBMIT_ATTEMPT' }
  | { type: 'RESET' };

function reducer(
  state: FinancialTermsFormState,
  action: Action,
): FinancialTermsFormState {
  switch (action.type) {
    case 'CHANGE':
      return {
        ...state,
        values: { ...state.values, [action.field]: action.value },
      };
    case 'BLUR':
      return {
        ...state,
        touched: { ...state.touched, [action.field]: true },
      };
    case 'SUBMIT_ATTEMPT':
      return {
        ...state,
        submitAttempted: true,
        touched: Object.fromEntries(
          Object.keys(state.touched).map((k) => [k, true]),
        ) as Record<FinancialTermsField, boolean>,
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

/* ─── Hook return type ──────────────────────────────────────────────────── */

export interface UseFinancialTermsFormReturn {
  values: FinancialTermsValues;
  touched: Record<FinancialTermsField, boolean>;
  submitAttempted: boolean;
  /**
   * Returns the validation result for a field only when it should be
   * visible to the user (field is touched OR submit was attempted).
   * Returns null when the field has not been interacted with yet.
   */
  getFieldValidation: (field: FinancialTermsField) => FieldValidationResult | null;
  /** Full form validation summary (always computed, regardless of touched). */
  formSummary: FormValidationSummary;
  handleChange: (field: FinancialTermsField, value: string) => void;
  handleBlur: (field: FinancialTermsField) => void;
  /**
   * Call on form submit. Returns the summary so the caller can decide
   * whether to proceed. Marks all fields as touched.
   */
  handleSubmit: () => FormValidationSummary;
  reset: () => void;
}

/* ─── Hook ──────────────────────────────────────────────────────────────── */

export function useFinancialTermsForm(locale?: string): UseFinancialTermsFormReturn {
  const [state, dispatch] = useReducer(reducer, initialState);

  const formSummary = validateFinancialTermsForm(state.values, locale);

  const getFieldValidation = useCallback(
    (field: FinancialTermsField): FieldValidationResult | null => {
      if (!state.touched[field] && !state.submitAttempted) return null;
      return validateField(field, state.values[field], locale);
    },
    [state.touched, state.submitAttempted, state.values, locale],
  );

  const handleChange = useCallback((field: FinancialTermsField, value: string) => {
    dispatch({ type: 'CHANGE', field, value });
  }, []);

  const handleBlur = useCallback((field: FinancialTermsField) => {
    dispatch({ type: 'BLUR', field });
  }, []);

  const handleSubmit = useCallback((): FormValidationSummary => {
    dispatch({ type: 'SUBMIT_ATTEMPT' });
    return validateFinancialTermsForm(state.values, locale);
  }, [state.values, locale]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    values: state.values,
    touched: state.touched,
    submitAttempted: state.submitAttempted,
    getFieldValidation,
    formSummary,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
  };
}
