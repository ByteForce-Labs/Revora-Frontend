import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronRight,
  ChevronLeft,
  Search,
  ArrowRight,
} from 'lucide-react';
import { Button } from './Button';
import {
  RevenueCalendarCsvImportProps,
  WizardStep,
  WIZARD_STEP_LABELS,
  CsvRow,
  PreviewRow,
  ColumnMapping,
  ConflictReason,
  CONFLICT_REASON_LABELS,
} from './RevenueCalendarCsvImport.types';
import './RevenueCalendarCsvImport.css';

/* ─── Helpers ──────────────────────────────────────────────────────── */

function parseCsvText(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  return lines.map((line) => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          cells.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    cells.push(current.trim());
    return cells;
  });
}

function detectColumnMapping(headers: string[]): ColumnMapping {
  const dateKeywords = ['date', 'month', 'period', 'time'];
  const revenueKeywords = ['revenue', 'amount', 'gross', 'value'];
  const currencyKeywords = ['currency', 'curr'];

  const lowerHeaders = headers.map((h) => h.toLowerCase().replace(/[\s_-]/g, ''));

  let dateCol = headers[0] ?? '';
  let revenueCol = headers[1] ?? '';
  let currencyCol: string | undefined;

  for (let i = 0; i < lowerHeaders.length; i++) {
    if (dateKeywords.some((kw) => lowerHeaders[i].includes(kw))) {
      dateCol = headers[i];
      break;
    }
  }

  for (let i = 0; i < lowerHeaders.length; i++) {
    if (revenueKeywords.some((kw) => lowerHeaders[i].includes(kw))) {
      revenueCol = headers[i];
      break;
    }
  }

  for (let i = 0; i < lowerHeaders.length; i++) {
    if (currencyKeywords.some((kw) => lowerHeaders[i].includes(kw))) {
      currencyCol = headers[i];
      break;
    }
  }

  return { date: dateCol, revenue: revenueCol, currency: currencyCol };
}

function detectConflicts(
  rows: CsvRow[],
  mapping: ColumnMapping,
): PreviewRow[] {
  const seen = new Set<string>();
  return rows.map((row, idx) => {
    const dateStr = (row[mapping.date] ?? '').trim();
    const revenueStr = (row[mapping.revenue] ?? '').trim();
    const currencyStr = mapping.currency ? (row[mapping.currency] ?? '').trim() : undefined;

    let conflictReason: ConflictReason | undefined;
    let conflictDetail: string | undefined;

    const parsedDate = new Date(dateStr);
    const parsedRev = parseFloat(revenueStr.replace(/[^0-9.-]+/g, '')); // Strip currency symbols just in case

    if (!dateStr || !revenueStr) {
      conflictReason = 'missing_fields';
      conflictDetail = 'Date or Revenue fields are missing.';
    } else if (isNaN(parsedDate.getTime())) {
      conflictReason = 'invalid_date';
      conflictDetail = 'The date format is invalid.';
    } else if (isNaN(parsedRev)) {
      conflictReason = 'invalid_revenue';
      conflictDetail = 'The revenue amount is invalid.';
    } else if (seen.has(dateStr)) {
      conflictReason = 'duplicate_row';
      conflictDetail = 'This date already has a row in the file.';
    }

    seen.add(dateStr);

    return {
      date: dateStr,
      revenue: revenueStr,
      currency: currencyStr,
      conflictReason,
      conflictDetail,
      rowNumber: idx + 1,
    };
  });
}

/* ─── Step Indicator ───────────────────────────────────────────────── */

const STEPS: WizardStep[] = ['upload', 'map', 'preview', 'confirm'];

function StepIndicator({
  currentStep,
}: {
  currentStep: WizardStep;
}) {
  const currentIdx = STEPS.indexOf(currentStep);

  return (
    <nav className="rcci-steps" aria-label="Import progress">
      <ol className="rcci-steps-list">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <li
              key={step}
              className={`rcci-step ${isCompleted ? 'rcci-step--completed' : ''} ${isCurrent ? 'rcci-step--current' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className="rcci-step-number" aria-hidden="true">
                {isCompleted ? <CheckCircle2 size={14} /> : idx + 1}
              </span>
              <span className="rcci-step-label">{WIZARD_STEP_LABELS[step]}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ─── Upload Step ──────────────────────────────────────────────────── */

function UploadStep({
  onFileParsed,
}: {
  onFileParsed: (headers: string[], rows: CsvRow[]) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      setError(null);

      if (!file.name.endsWith('.csv') && !file.type.includes('csv')) {
        setError('Please select a CSV file.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          setError('Failed to read file.');
          return;
        }

        const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
        const rows = parseCsvText(clean);

        if (rows.length < 2) {
          setError('File must contain a header row and at least one data row.');
          return;
        }

        const headers = rows[0];
        const dataRows = rows.slice(1).map((cells) => {
          const row: CsvRow = { date: '' };
          headers.forEach((h, i) => {
            row[h] = cells[i] ?? '';
          });
          return row;
        });

        onFileParsed(headers, dataRows);
      };
      reader.onerror = () => setError('Failed to read file.');
      reader.readAsText(file);
    },
    [onFileParsed],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  return (
    <div className="rcci-upload">
      <div
        className={`rcci-dropzone ${dragOver ? 'rcci-dropzone--active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload CSV file. Click or drag and drop."
      >
        <FileSpreadsheet size={32} className="rcci-upload-icon" aria-hidden="true" />
        <p className="rcci-upload-text">
          Drop a CSV file here, or <span className="rcci-upload-link">browse</span>
        </p>
        <p className="rcci-upload-hint">Supports .csv files with historical revenue data</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="rcci-file-input"
          onChange={handleChange}
          aria-label="Select CSV file"
        />
      </div>
      {error && (
        <div className="rcci-upload-error" role="alert" aria-live="assertive">
          <AlertTriangle size={14} aria-hidden="true" />
          {error}
        </div>
      )}
    </div>
  );
}

/* ─── Map Step ─────────────────────────────────────────────────────── */

function MapStep({
  headers,
  mapping,
  onMappingChange,
}: {
  headers: string[];
  mapping: ColumnMapping;
  onMappingChange: (m: ColumnMapping) => void;
}) {
  return (
    <div className="rcci-map">
      <p className="rcci-map-description">
        Map CSV columns to the required fields. The Date and Revenue columns are required.
      </p>
      <div className="rcci-map-fields">
        <div className="rcci-map-field">
          <label className="rcci-map-label" htmlFor="rcci-date-col">
            Date Column <span className="rcci-required" aria-label="required">*</span>
          </label>
          <select
            id="rcci-date-col"
            className="rcci-map-select"
            value={mapping.date}
            onChange={(e) => onMappingChange({ ...mapping, date: e.target.value })}
          >
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div className="rcci-map-field">
          <label className="rcci-map-label" htmlFor="rcci-revenue-col">
            Revenue Column <span className="rcci-required" aria-label="required">*</span>
          </label>
          <select
            id="rcci-revenue-col"
            className="rcci-map-select"
            value={mapping.revenue}
            onChange={(e) => onMappingChange({ ...mapping, revenue: e.target.value })}
          >
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div className="rcci-map-field">
          <label className="rcci-map-label" htmlFor="rcci-currency-col">
            Currency Column <span className="rcci-map-optional">(optional)</span>
          </label>
          <select
            id="rcci-currency-col"
            className="rcci-map-select"
            value={mapping.currency ?? ''}
            onChange={(e) =>
              onMappingChange({ ...mapping, currency: e.target.value || undefined })
            }
          >
            <option value="">None</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="rcci-map-preview">
        <p className="rcci-map-preview-label">Column preview:</p>
        <div className="rcci-map-preview-headers">
          {headers.map((h) => (
            <span
              key={h}
              className={`rcci-map-preview-chip ${h === mapping.date || h === mapping.revenue ? 'rcci-map-preview-chip--mapped' : ''} ${h === mapping.currency ? 'rcci-map-preview-chip--mapped' : ''}`}
            >
              {h}
              {(h === mapping.date || h === mapping.revenue) && (
                <ArrowRight size={10} aria-hidden="true" className="rcci-chip-icon" />
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Preview Step ─────────────────────────────────────────────────── */

const PAGE_SIZE = 25;

function PreviewStep({
  rows,
  currentPage,
  onPageChange,
}: {
  rows: PreviewRow[];
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const conflictCount = rows.filter((r) => r.conflictReason).length;
  const cleanCount = rows.length - conflictCount;

  const liveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.textContent = `${rows.length} rows loaded. ${cleanCount} clean, ${conflictCount} with warnings.`;
    }
  }, [rows.length, cleanCount, conflictCount]);

  return (
    <div className="rcci-preview">
      <div className="rcci-preview-summary" aria-live="polite" ref={liveRef}>
        <div className="rcci-preview-stat">
          <span className="rcci-preview-stat-value">{rows.length}</span>
          <span className="rcci-preview-stat-label">Total rows</span>
        </div>
        <div className="rcci-preview-stat rcci-preview-stat--clean">
          <span className="rcci-preview-stat-value">{cleanCount}</span>
          <span className="rcci-preview-stat-label">Valid</span>
        </div>
        <div className="rcci-preview-stat rcci-preview-stat--conflict">
          <span className="rcci-preview-stat-value">{conflictCount}</span>
          <span className="rcci-preview-stat-label">Warnings</span>
        </div>
      </div>

      <div className="rcci-preview-table-wrap" role="region" aria-label="Import preview table" tabIndex={0}>
        <table className="rcci-preview-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Date</th>
              <th scope="col">Revenue</th>
              <th scope="col">Currency</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={row.rowNumber}
                className={`rcci-tr ${row.conflictReason ? 'rcci-tr--conflict' : ''}`}
              >
                <td className="rcci-td-row">{row.rowNumber}</td>
                <td>{row.date || '—'}</td>
                <td>{row.revenue || '—'}</td>
                <td>{row.currency || '—'}</td>
                <td>
                  {row.conflictReason ? (
                    <span
                      className={`rcci-badge rcci-badge--${row.conflictReason}`}
                      aria-label={CONFLICT_REASON_LABELS[row.conflictReason]}
                      title={row.conflictDetail}
                    >
                      <AlertTriangle size={10} aria-hidden="true" />
                      {CONFLICT_REASON_LABELS[row.conflictReason]}
                    </span>
                  ) : (
                    <span className="rcci-badge rcci-badge--clean">
                      <CheckCircle2 size={10} aria-hidden="true" />
                      Ready
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="rcci-pagination" role="navigation" aria-label="Preview pagination">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft size={14} aria-hidden="true" />
            Prev
          </Button>
          <span className="rcci-pagination-info">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
          >
            Next
            <ChevronRight size={14} aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─── Confirm Step ─────────────────────────────────────────────────── */

function ConfirmStep({
  rows,
  onConfirm,
  isCommitting,
  committed,
}: {
  rows: PreviewRow[];
  onConfirm: () => void;
  isCommitting: boolean;
  committed: boolean;
}) {
  const conflictCount = rows.filter((r) => r.conflictReason).length;
  const cleanCount = rows.length - conflictCount;

  return (
    <div className="rcci-confirm">
      <div className="rcci-confirm-summary">
        <CheckCircle2 size={32} className="rcci-confirm-icon" aria-hidden="true" />
        <h3 className="rcci-confirm-title">Ready to import</h3>
        <p className="rcci-confirm-description">
          {cleanCount} revenue record{cleanCount !== 1 ? 's' : ''} will be imported.
          {conflictCount > 0 && (
            <> {conflictCount} flagged record{conflictCount !== 1 ? 's' : ''} will be skipped.</>
          )}
        </p>
      </div>

      {conflictCount > 0 && (
        <div className="rcci-confirm-warnings" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <p>
            <strong>{conflictCount} rows</strong> were flagged with warnings and will not be imported.
            Review the preview step to see details.
          </p>
        </div>
      )}

      {committed ? (
        <div className="rcci-confirm-done" role="status" aria-live="polite">
          <CheckCircle2 size={16} aria-hidden="true" />
          Imported {cleanCount} row{cleanCount !== 1 ? 's' : ''}
        </div>
      ) : (
        <Button
          variant="primary"
          onClick={onConfirm}
          className="rcci-confirm-btn"
          disabled={isCommitting}
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          Confirm Import
        </Button>
      )}
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────── */

export const RevenueCalendarCsvImport: React.FC<RevenueCalendarCsvImportProps> = ({
  onImport,
  onCancel,
  className = '',
}) => {
  const [step, setStep] = useState<WizardStep>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<CsvRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ date: '', revenue: '' });
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCommitting, setIsCommitting] = useState(false);
  const [committed, setCommitted] = useState(false);
  const committedRef = useRef(false);

  const stepIdx = STEPS.indexOf(step);

  const handleFileParsed = useCallback((h: string[], rows: CsvRow[]) => {
    setHeaders(h);
    setRawRows(rows);
    setMapping(detectColumnMapping(h));
    setStep('map');
  }, []);

  const handleMappingConfirm = useCallback(() => {
    const detected = detectConflicts(rawRows, mapping);
    setPreviewRows(detected);
    setCurrentPage(1);
    setStep('preview');
  }, [rawRows, mapping]);

  const goToConfirm = useCallback(() => {
    setStep('confirm');
  }, []);

  const commitImport = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    setIsCommitting(true);
    const cleanRows = previewRows.filter((r) => !r.conflictReason);
    onImport?.(cleanRows);
    setCommitted(true);
    setIsCommitting(false);
  }, [previewRows, onImport]);

  const handleBack = useCallback(() => {
    if (stepIdx > 0) setStep(STEPS[stepIdx - 1]);
  }, [stepIdx]);

  return (
    <div className={`rcci-container ${className}`} role="dialog" aria-label="Revenue CSV import">
      <div className="rcci-header">
        <h2 className="rcci-title">Import Historical Revenue</h2>
        {onCancel && (
          <button
            type="button"
            className="rcci-close"
            onClick={onCancel}
            aria-label="Close import wizard"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      <StepIndicator currentStep={step} />

      <div className="rcci-content">
        {step === 'upload' && <UploadStep onFileParsed={handleFileParsed} />}
        {step === 'map' && (
          <MapStep headers={headers} mapping={mapping} onMappingChange={setMapping} />
        )}
        {step === 'preview' && (
          <PreviewStep
            rows={previewRows}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        )}
        {step === 'confirm' && (
          <ConfirmStep
            rows={previewRows}
            onConfirm={commitImport}
            isCommitting={isCommitting}
            committed={committed}
          />
        )}
      </div>

      <div className="rcci-footer">
        {step !== 'upload' && step !== 'confirm' && (
          <Button variant="secondary" onClick={handleBack}>
            <ChevronLeft size={14} aria-hidden="true" />
            Back
          </Button>
        )}
        {step === 'map' && (
          <Button variant="primary" onClick={handleMappingConfirm}>
            Preview
            <ChevronRight size={14} aria-hidden="true" />
          </Button>
        )}
        {step === 'preview' && (
          <Button variant="primary" onClick={goToConfirm}>
            Import
            <ChevronRight size={14} aria-hidden="true" />
          </Button>
        )}
        {step === 'confirm' && (
          <Button variant="secondary" onClick={onCancel}>
            Done
          </Button>
        )}
      </div>
    </div>
  );
};

export default RevenueCalendarCsvImport;
