/**
 * reportExport.ts
 * Issue #627 – Exportable report UX: deterministic, dependency-free
 * generators for CSV, XLSX (OOXML), and PDF report files.
 *
 * All generators are pure functions so the exact bytes can be unit-tested
 * without a DOM. The component layer is responsible for progress feedback,
 * download orchestration, and error recovery.
 */

export type ReportExportFormat = "pdf" | "csv" | "xlsx";
export type ReportExportScope = "current" | "filtered";

export interface ReportExportInput {
  reportPeriod: string;
  periodLabel: string;
  grossRevenue: number;
  currency: string;
  locale: string;
  notes: string;
  payoutEstimate: number;
}

export const REPORT_EXPORT_FORMATS: ReportExportFormat[] = ["pdf", "csv", "xlsx"];

export const REPORT_EXPORT_FORMAT_LABELS: Record<ReportExportFormat, string> = {
  pdf: "PDF",
  csv: "CSV",
  xlsx: "XLSX",
};

export const REPORT_EXPORT_MIME_TYPES: Record<ReportExportFormat, string> = {
  pdf: "application/pdf",
  csv: "text/csv;charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** Build the tabular dataset for the requested export scope. */
export function buildReportExportRows(
  scope: ReportExportScope,
  input: ReportExportInput
): string[][] {
  const revenue = String(input.grossRevenue);
  const payout = String(input.payoutEstimate);

  if (scope === "current") {
    return [
      ["Period", "Gross revenue", "Estimated payout"],
      [input.periodLabel, revenue, payout],
    ];
  }

  return [
    ["Period", "Gross revenue", "Currency", "Locale", "Estimated payout", "Notes"],
    [
      input.periodLabel,
      revenue,
      input.currency,
      input.locale,
      payout,
      input.notes,
    ],
  ];
}

export function reportExportFileName(
  scope: ReportExportScope,
  format: ReportExportFormat,
  reportPeriod: string
): string {
  const scopeSuffix = scope === "filtered" ? "-filtered" : "";
  return `revenue-report-${reportPeriod}${scopeSuffix}.${format}`;
}

/* ── CSV ─────────────────────────────────────────────────────────── */

export interface EscapeCsvCellOptions {
  isNumeric?: boolean;
}

export interface ToCsvOptions {
  numericColumns?: Array<number | string>;
}

const DEFAULT_NUMERIC_COLUMNS: readonly string[] = [
  "gross revenue",
  "estimated payout",
];

/**
 * Neutralise dangerous leading characters in CSV cells to mitigate formula injection (CWE-1236).
 * Prepends a single quote (') if the cell begins with '=', '+', '-', '@', TAB, or CR,
 * unless the cell is marked or detected as numeric.
 */
export function sanitizeCsvCell(
  value: string | number,
  optionsOrIsNumeric?: boolean | EscapeCsvCellOptions
): string {
  const isNumeric =
    typeof optionsOrIsNumeric === "boolean"
      ? optionsOrIsNumeric
      : Boolean(optionsOrIsNumeric?.isNumeric);

  if (typeof value === "number" || isNumeric) {
    return String(value ?? "");
  }

  const str = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Neutralise formula injection prefixes and apply CSV RFC-4180 quoting rules.
 */
export function escapeCsvCell(
  value: string | number,
  optionsOrIsNumeric?: boolean | EscapeCsvCellOptions
): string {
  const sanitized = sanitizeCsvCell(value, optionsOrIsNumeric);
  if (/[",\r\n]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

export function toCsv(
  rows: (string | number)[][],
  options?: ToCsvOptions
): string {
  if (rows.length === 0) {
    return "";
  }

  const headerRow = rows[0] ?? [];
  const numericIndices = new Set<number>();

  const configuredNumeric = options?.numericColumns ?? DEFAULT_NUMERIC_COLUMNS;

  headerRow.forEach((header, index) => {
    const headerStr = String(header ?? "").trim().toLowerCase();
    for (const item of configuredNumeric) {
      if (typeof item === "number" && item === index) {
        numericIndices.add(index);
      } else if (
        typeof item === "string" &&
        item.trim().toLowerCase() === headerStr
      ) {
        numericIndices.add(index);
      }
    }
  });

  if (options?.numericColumns) {
    for (const item of options.numericColumns) {
      if (typeof item === "number") {
        numericIndices.add(item);
      }
    }
  }

  return (
    rows
      .map((row, rowIndex) => {
        return row
          .map((cell, colIndex) => {
            const isNumericCol =
              rowIndex > 0 && numericIndices.has(colIndex);
            return escapeCsvCell(cell, isNumericCol);
          })
          .join(",");
      })
      .join("\r\n") + "\r\n"
  );
}

/* ── XLSX (minimal OOXML, stored ZIP, inline strings) ─────────────── */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnLetter(index: number): string {
  let n = index;
  let out = "";
  while (n >= 0) {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  }
  return out;
}

function sheetXml(rows: string[][]): string {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, colIndex) => {
          const ref = `${columnLetter(colIndex)}${rowIndex + 1}`;
          if (cell !== "" && /^-?\d+(\.\d+)?$/.test(cell)) {
            return `<c r="${ref}"><v>${cell}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(
            cell
          )}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${body}</sheetData>` +
    "</worksheet>"
  );
}

function xlsxParts(rows: string[][]): Array<{ name: string; data: Uint8Array }> {
  const encode = (text: string) => new TextEncoder().encode(text);
  return [
    {
      name: "[Content_Types].xml",
      data: encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          "</Types>"
      ),
    },
    {
      name: "_rels/.rels",
      data: encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          "</Relationships>"
      ),
    },
    {
      name: "xl/workbook.xml",
      data: encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          "<sheets><sheet name=\"Revenue Report\" sheetId=\"1\" r:id=\"rId1\"/></sheets>" +
          "</workbook>"
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
          '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
          "</Relationships>"
      ),
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: encode(sheetXml(rows)),
    },
    {
      name: "xl/styles.xml",
      data: encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
          '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
          '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
          '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
          '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
          '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
          "</styleSheet>"
      ),
    },
  ];
}

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Write a minimal, valid ZIP archive with stored (uncompressed) entries.
 * Only used internally for the XLSX package; keeps the export dependency-free.
 */
export function zipStore(
  entries: Array<{ name: string; data: Uint8Array }>
): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);

    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true); // local file header signature
    localView.setUint16(4, 20, true); // version needed
    localView.setUint16(6, 0, true); // flags
    localView.setUint16(8, 0, true); // compression: store
    localView.setUint16(10, 0, true); // mod time
    localView.setUint16(12, 0x21, true); // mod date (fixed)
    localView.setUint32(14, crc, true);
    localView.setUint32(18, entry.data.length, true); // compressed size
    localView.setUint32(22, entry.data.length, true); // uncompressed size
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true); // extra length
    local.set(nameBytes, 30);
    chunks.push(local, entry.data);

    const centralEntry = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralEntry.buffer);
    centralView.setUint32(0, 0x02014b50, true); // central directory signature
    centralView.setUint16(4, 20, true); // version made by
    centralView.setUint16(6, 20, true); // version needed
    centralView.setUint16(8, 0, true); // flags
    centralView.setUint16(10, 0, true); // compression: store
    centralView.setUint16(12, 0, true); // mod time
    centralView.setUint16(14, 0x21, true); // mod date
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, entry.data.length, true);
    centralView.setUint32(24, entry.data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true); // extra
    centralView.setUint16(32, 0, true); // comment
    centralView.setUint16(34, 0, true); // disk number start
    centralView.setUint16(36, 0, true); // internal attributes
    centralView.setUint32(38, 0, true); // external attributes
    centralView.setUint32(42, offset, true); // local header offset
    centralEntry.set(nameBytes, 46);
    central.push(centralEntry);

    offset += local.length + entry.data.length;
  }

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
  eocdView.setUint16(4, 0, true); // disk number
  eocdView.setUint16(6, 0, true); // central dir start disk
  eocdView.setUint16(8, entries.length, true); // entries on this disk
  eocdView.setUint16(10, entries.length, true); // total entries
  eocdView.setUint32(12, centralSize, true);
  eocdView.setUint32(16, offset, true); // central dir offset
  eocdView.setUint16(20, 0, true); // comment length

  const totalSize = offset + centralSize + eocd.length;
  const output = new Uint8Array(totalSize);
  let cursor = 0;
  for (const chunk of chunks) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  for (const chunk of central) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  output.set(eocd, cursor);
  return output;
}

export function toXlsxBytes(rows: string[][]): Uint8Array {
  return zipStore(xlsxParts(rows));
}

/* ── PDF (minimal single-page, Helvetica) ─────────────────────────── */

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function toPdfBytes(rows: string[][]): Uint8Array {
  const encoder = new TextEncoder();
  const pageWidth = 612;
  const leftMargin = 50;
  const lineHeight = 20;
  const top = 760;

  const lines: string[] = [];
  lines.push("Revenue Report");
  rows.forEach((row) => {
    lines.push(row.join("   "));
  });

  let content = "BT\n/F1 12 Tf\n";
  lines.forEach((line, index) => {
    const y = top - index * lineHeight;
    content += `1 0 0 1 ${leftMargin} ${y} Tm (${escapePdfText(line)}) Tj\n`;
  });
  content += "ET";

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"
  );
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`
  );
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  // /Length and xref offsets are byte counts of the UTF-8 encoded document.
  objects.push(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);

  let pdf =
    "%PDF-1.4\n";
  const offsets: number[] = [];
  let byteLength = encoder.encode(pdf).length;
  objects.forEach((body, index) => {
    offsets.push(byteLength);
    const chunk = `${index + 1} 0 obj\n${body}\nendobj\n`;
    pdf += chunk;
    byteLength += encoder.encode(chunk).length;
  });

  const xrefOffset = byteLength;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return encoder.encode(pdf);
}
