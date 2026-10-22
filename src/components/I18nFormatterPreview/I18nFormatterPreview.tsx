import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, RotateCcw, Globe, Check, X, Info } from "lucide-react";
import {
  COPY_EXPANSION_SAMPLES,
  LOCALE_FORMAT_SETTINGS,
  isRtlLocale,
  formatNumber,
  formatCurrency,
  formatDate,
  formatPercent,
  formatCompactNumber,
} from "../../constants/i18n";
import { LocalizedText } from "../LocalizedText";
import { I18nFormatterPreviewProps, SampleRowData } from "./I18nFormatterPreview.types";
import "./I18nFormatterPreview.css";

const DEFAULT_LOCALE = "en-US";

export const I18nFormatterPreview: React.FC<I18nFormatterPreviewProps> = ({
  initialLocale = DEFAULT_LOCALE,
  systemDefaultLocale = DEFAULT_LOCALE,
  onLocaleChange,
  className = "",
  ariaHeadingId = "i18n-preview-heading",
}) => {
  const [selectedLocale, setSelectedLocale] = useState<string>(initialLocale);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [announcement, setAnnouncement] = useState<string>("");

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Available locales list from system settings
  const availableLocales = useMemo(() => {
    return Object.values(LOCALE_FORMAT_SETTINGS);
  }, []);

  // Filtered locales based on search query
  const filteredLocales = useMemo(() => {
    if (!searchQuery.trim()) return availableLocales;
    const query = searchQuery.toLowerCase().trim();
    return availableLocales.filter(
      (meta) =>
        meta.code.toLowerCase().includes(query) ||
        meta.label.toLowerCase().includes(query) ||
        meta.nativeLabel.toLowerCase().includes(query) ||
        meta.defaultCurrency.toLowerCase().includes(query),
    );
  }, [availableLocales, searchQuery]);

  const currentMeta = useMemo(() => {
    return (
      LOCALE_FORMAT_SETTINGS[selectedLocale] || {
        code: selectedLocale,
        label: selectedLocale,
        nativeLabel: selectedLocale,
        defaultCurrency: "USD",
        date: { year: "numeric", month: "short", day: "numeric" },
        number: { maximumFractionDigits: 2 },
        currency: { style: "currency", currency: "USD", maximumFractionDigits: 2 },
      }
    );
  }, [selectedLocale]);

  const defaultMeta = useMemo(() => {
    return LOCALE_FORMAT_SETTINGS[systemDefaultLocale] || LOCALE_FORMAT_SETTINGS[DEFAULT_LOCALE];
  }, [systemDefaultLocale]);

  const isOverrideActive = selectedLocale !== systemDefaultLocale;
  const isRtl = isRtlLocale(selectedLocale);

  // Handle locale selection
  const handleSelectLocale = (code: string) => {
    setSelectedLocale(code);
    setIsOpen(false);
    setSearchQuery("");
    setHighlightedIndex(-1);

    const meta = LOCALE_FORMAT_SETTINGS[code];
    const label = meta ? meta.label : code;
    const newAnnouncement = `Locale changed to ${label}`;
    setAnnouncement(newAnnouncement);

    if (onLocaleChange) {
      onLocaleChange(code);
    }
  };

  // Revert to system default locale
  const handleRevertToDefault = () => {
    handleSelectLocale(systemDefaultLocale);
  };

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation for dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredLocales.length - 1 ? prev + 1 : 0,
        );
        break;

      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredLocales.length - 1,
        );
        break;

      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredLocales.length) {
          handleSelectLocale(filteredLocales[highlightedIndex].code);
        }
        break;

      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;

      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  // Sample data definitions for comparison table
  const sampleRows: SampleRowData[] = useMemo(() => {
    return [
      {
        id: "standard-number",
        category: "number",
        categoryLabel: "Standard Number",
        description: "Large decimal with grouping and fractional digits",
        rawSample: "1234567.89",
        formatValue: (loc) => formatNumber(1234567.89, loc),
        diffNote: "Grouping separator & decimal mark",
      },
      {
        id: "compact-number",
        category: "compact",
        categoryLabel: "Compact / Abbreviated",
        description: "Large integer compact notation (thousands / millions)",
        rawSample: "1234567890",
        formatValue: (loc) => formatCompactNumber(1234567890, loc),
        diffNote: "Compact suffix notation (B vs Mrd. vs 億)",
      },
      {
        id: "percent",
        category: "percent",
        categoryLabel: "Percentage",
        description: "Percentage ratio formatting",
        rawSample: "0.145 (14.5%)",
        formatValue: (loc) => formatPercent(0.145, loc),
        diffNote: "Symbol placement & trailing spaces",
      },
      {
        id: "currency",
        category: "currency",
        categoryLabel: "Default Currency",
        description: "Locale-native currency symbol and spacing",
        rawSample: "1234567.89",
        formatValue: (loc) => formatCurrency(1234567.89, undefined, loc),
        diffNote: "Currency symbol, prefix/suffix & digits",
      },
      {
        id: "short-date",
        category: "date",
        categoryLabel: "Short Date",
        description: "Standard calendar date representation",
        rawSample: "2026-07-28",
        formatValue: (loc) => formatDate("2026-07-28", loc),
        diffNote: "Date component ordering (DMY vs MDY vs YMD)",
      },
      {
        id: "long-date",
        category: "long-date",
        categoryLabel: "Full Date & Time",
        description: "Extended localized date with weekday and month",
        rawSample: "2026-07-28T14:30:00Z",
        formatValue: (loc) =>
          formatDate("2026-07-28T14:30:00Z", loc, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        diffNote: "Localized month and day names",
      },
      {
        id: "rtl-copy",
        category: "rtl-copy",
        categoryLabel: "Bidi / Mixed Copy",
        description: "Contextual copy mixing text and numeric values",
        rawSample: "Net Distribution: $1,234.56",
        formatValue: (loc) => {
          const curr = formatCurrency(1234.56, undefined, loc);
          return isRtlLocale(loc)
            ? `O�OU?US OU,O�U^O�USO1: ${curr}`
            : `Net Distribution: ${curr}`;
        },
        diffNote: "Text directionality (LTR vs RTL isolate)",
      },
      {
        id: "copy-expansion",
        category: "copy-expansion",
        categoryLabel: "Copy Expansion",
        description: "Same English copy rendered in the selected locale against the +40% layout budget",
        rawSample: "Confirm payout",
        formatValue: (loc) => {
          const sample = COPY_EXPANSION_SAMPLES.find((s) => s.locale === loc);
          return sample ? sample.expanded : "Confirm payout";
        },
        diffNote: "Localized string growth vs. the +40% copy-expansion budget",
      },
    ];
  }, []);

  return (
    <section
      className={`i18n-preview glass-card p-6 ${className}`.trim()}
      aria-labelledby={ariaHeadingId}
    >
      {/* Screen Reader Live Region for Announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* Header */}
      <header className="i18n-preview__header">
        <div className="i18n-preview__title-group">
          <h2 id={ariaHeadingId} className="i18n-preview__title">
            <Globe size={22} className="text-primary" aria-hidden="true" />
            <span>Locale Formatter Preview</span>
          </h2>
          <p className="i18n-preview__subtitle">
            Preview live number, currency, and date formatting rules for your chosen locale compared to the system default.
          </p>
        </div>

        {/* Toolbar & Searchable Combobox Dropdown */}
        <div className="i18n-preview__controls">
          <div
            ref={dropdownRef}
            className="i18n-preview__combobox"
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls="locale-options-list"
          >
            <div className="i18n-preview__input-wrapper">
              <Search size={16} className="i18n-preview__search-icon" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                className="i18n-preview__input focus-ring"
                placeholder={currentMeta.label || "Search locale (e.g. Deutsch, Arabic)..."}
                value={isOpen ? searchQuery : searchQuery || currentMeta.label}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!isOpen) setIsOpen(true);
                }}
                onFocus={() => {
                  setIsOpen(true);
                }}
                onKeyDown={handleKeyDown}
                aria-autocomplete="list"
                aria-controls={isOpen ? "locale-options-list" : undefined}
                aria-activedescendant={
                  highlightedIndex >= 0 && highlightedIndex < filteredLocales.length
                    ? `locale-option-${filteredLocales[highlightedIndex].code}`
                    : undefined
                }
                aria-label="Select or search locale"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="i18n-preview__clear-btn"
                  onClick={() => {
                    setSearchQuery("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search input"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Dropdown Options Menu */}
            {isOpen && (
              <ul
                id="locale-options-list"
                className="i18n-preview__dropdown"
                role="listbox"
                aria-label="Available locales"
              >
                {filteredLocales.length === 0 ? (
                  <li className="i18n-preview__no-results" role="option" aria-selected={false}>
                    No matching locales found
                  </li>
                ) : (
                  filteredLocales.map((meta, index) => {
                    const isSelected = meta.code === selectedLocale;
                    const isHighlighted = index === highlightedIndex;

                    return (
                      <li
                        key={meta.code}
                        id={`locale-option-${meta.code}`}
                        role="option"
                        aria-selected={isSelected}
                        className={`i18n-preview__option ${
                          isSelected ? "i18n-preview__option--selected" : ""
                        } ${isHighlighted ? "i18n-preview__option--highlighted" : ""}`}
                        onClick={() => handleSelectLocale(meta.code)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{meta.label}</span>
                          <span className="text-xs text-muted">
                            Code: {meta.code} • Currency: {meta.defaultCurrency}
                          </span>
                        </div>
                        {isSelected && <Check size={16} className="text-primary flex-shrink-0" />}
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>

          {/* Revert to Default Affordance Button */}
          <button
            type="button"
            className="i18n-preview__revert-btn"
            onClick={handleRevertToDefault}
            disabled={!isOverrideActive}
            aria-disabled={!isOverrideActive}
            title={
              isOverrideActive
                ? `Revert locale override to system default (${defaultMeta.label})`
                : `Currently using system default locale (${defaultMeta.label})`
            }
          >
            <RotateCcw size={15} aria-hidden="true" />
            <span>Revert to Default</span>
          </button>
        </div>
      </header>

      {/* Locale Status Bar */}
      <div className="i18n-preview__status-bar">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-muted font-medium">Selected Locale:</span>
          <span className="font-semibold text-main">{currentMeta.label}</span>
          <span className="text-xs text-slate-400">({selectedLocale})</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap inset-inline-start-auto">
          {isOverrideActive ? (
            <span className="i18n-preview__badge i18n-preview__badge--override">
              Custom Override Active
            </span>
          ) : (
            <span className="i18n-preview__badge i18n-preview__badge--default">
              System Default Active
            </span>
          )}

          {isRtl && (
            <span className="i18n-preview__badge i18n-preview__badge--rtl">
              RTL Text Direction
            </span>
          )}
        </div>
      </div>

      {/* Formatter Comparison Table */}
      <div className="i18n-preview__table-container">
        <table className="i18n-preview__table">
          <thead>
            <tr>
              <th scope="col">Sample Type & Description</th>
              <th scope="col">Raw Value</th>
              <th scope="col">Current Locale ({selectedLocale})</th>
              <th scope="col">System Default ({systemDefaultLocale})</th>
              <th scope="col">Formatting Difference</th>
            </tr>
          </thead>
          <tbody>
            {sampleRows.map((row) => {
              // Intl throws a RangeError for malformed locale tags; fall back to
              // the raw sample instead of crashing the whole preview.
              const safeFormat = (loc: string) => {
                try {
                  return row.formatValue(loc);
                } catch {
                  return row.rawSample;
                }
              };
              const currentFormatted = safeFormat(selectedLocale);
              const defaultFormatted = safeFormat(systemDefaultLocale);

              return (
                <tr key={row.id}>
                  <td data-label="Sample Type">
                    <div className="i18n-preview__cat-name">{row.categoryLabel}</div>
                    <div className="i18n-preview__cat-desc">{row.description}</div>
                  </td>

                  <td data-label="Raw Value">
                    <code className="i18n-preview__raw-val">{row.rawSample}</code>
                  </td>

                  <td data-label="Current Locale">
                    <LocalizedText
                      locale={selectedLocale}
                      className="i18n-preview__current-val"
                    >
                      {currentFormatted}
                    </LocalizedText>
                  </td>

                  <td data-label="System Default">
                    <LocalizedText
                      locale={systemDefaultLocale}
                      className="i18n-preview__default-val"
                    >
                      {defaultFormatted}
                    </LocalizedText>
                  </td>

                  <td data-label="Difference">
                    <span className="i18n-preview__diff-badge">
                      <Info size={12} className="mr-1 inline text-muted" aria-hidden="true" />
                      {row.diffNote}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
