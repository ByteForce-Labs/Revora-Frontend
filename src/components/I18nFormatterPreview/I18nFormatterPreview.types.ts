import React from "react";

export interface I18nFormatterPreviewProps {
  /** Initial selected locale string (e.g. 'de-DE', 'ar-SA', 'ja-JP') */
  initialLocale?: string;
  /** System default locale string (defaults to 'en-US') */
  systemDefaultLocale?: string;
  /** Callback fired when selected locale changes */
  onLocaleChange?: (locale: string) => void;
  /** Additional CSS class names */
  className?: string;
  /** Section heading ID for accessibility linking */
  ariaHeadingId?: string;
}

export interface SampleRowData {
  id: string;
  category: "number" | "compact" | "percent" | "currency" | "date" | "long-date" | "rtl-copy" | "copy-expansion";
  categoryLabel: string;
  description: string;
  rawSample: string;
  formatValue: (locale: string) => string;
  diffNote: string;
}
