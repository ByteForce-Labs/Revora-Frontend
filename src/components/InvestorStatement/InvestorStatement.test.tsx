/**
 * InvestorStatement.test.tsx
 * PDF/UA Investor Statement component tests
 *
 * Tests cover:
 * - Basic rendering with all sections
 * - Semantic HTML structure (headings, landmarks, tables)
 * - Accessibility attributes (ARIA, roles, labels, lang)
 * - Edge cases: empty allocations, empty performance
 * - Print overlay behavior
 */

import { render, screen, within } from "@testing-library/react";
import { InvestorStatement } from "./InvestorStatement";
import type { InvestorStatementProps } from "./InvestorStatement";
import type { AllocationSlice } from "../AllocationWidget";
import type { PerformanceDataPoint } from "../PerformanceTrendWidget";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ALLOCATIONS: AllocationSlice[] = [
  { id: "1", label: "TechFlow AI", value: 45000, percentage: 45 },
  { id: "2", label: "Quantum Ledger", value: 30000, percentage: 30 },
  { id: "3", label: "Nexus Pay", value: 25000, percentage: 25 },
];

const PERFORMANCE: PerformanceDataPoint[] = [
  { month: "Jul", value: 88000 },
  { month: "Aug", value: 90500 },
  { month: "Sep", value: 87000 },
  { month: "Oct", value: 91200 },
  { month: "Nov", value: 93400 },
  { month: "Dec", value: 95000 },
  { month: "Jan", value: 94100 },
  { month: "Feb", value: 97300 },
  { month: "Mar", value: 99800 },
  { month: "Apr", value: 101500 },
  { month: "May", value: 99200 },
  { month: "Jun", value: 103000 },
];

const DEFAULT_PROPS: InvestorStatementProps = {
  investorName: "John Doe",
  statementPeriod: "July 2024 – June 2025",
  totalInvested: "$100,000",
  currentValue: "$103,000",
  totalReturn: 3.0,
  activeHoldings: 3,
  allocations: ALLOCATIONS,
  performance: PERFORMANCE,
  accountId: "REV-ACC-001",
};

const renderStatement = (overrides: Partial<InvestorStatementProps> = {}) =>
  render(<InvestorStatement {...DEFAULT_PROPS} {...overrides} />);

// The component also renders a print-only cover page that repeats the header
// metadata, so scope header assertions to the on-screen document header.
const statementHeader = () =>
  within(document.querySelector(".statement-header") as HTMLElement);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("InvestorStatement — PDF/UA Compliance", () => {
  // ─── Basic Rendering ────────────────────────────────────────────────────

  it("renders the statement container with testid", () => {
    renderStatement();
    expect(screen.getByTestId("investor-statement")).toBeInTheDocument();
  });

  it("renders the document title", () => {
    renderStatement();
    expect(
      statementHeader().getByRole("heading", { level: 1, name: /Investor Statement/i })
    ).toBeInTheDocument();
  });

  it("renders investor name", () => {
    renderStatement();
    expect(statementHeader().getByText("John Doe")).toBeInTheDocument();
  });

  it("renders account ID when provided", () => {
    renderStatement();
    expect(statementHeader().getByText("REV-ACC-001")).toBeInTheDocument();
  });

  it("renders statement period", () => {
    renderStatement();
    expect(statementHeader().getByText("July 2024 – June 2025")).toBeInTheDocument();
  });

  it("renders date generated", () => {
    renderStatement();
    // Should render a date in the format "Month Day, Year"
    const datePattern = /\w+ \d{1,2}, \d{4}/;
    expect(statementHeader().getByText(datePattern)).toBeInTheDocument();
  });

  // ─── Semantic HTML Structure ────────────────────────────────────────────

  it("uses <article> as root element", () => {
    renderStatement();
    const article = screen.getByTestId("investor-statement");
    expect(article.tagName).toBe("ARTICLE");
  });

  it("has <header> for document metadata", () => {
    renderStatement();
    const header = document.querySelector(".statement-header");
    expect(header?.tagName).toBe("HEADER");
  });

  it("has three <section> elements for content sections", () => {
    renderStatement();
    const sections = document.querySelectorAll(
      ".investor-statement section"
    );
    // Portfolio Summary, Allocation, Performance
    expect(sections.length).toBeGreaterThanOrEqual(3);
  });

  it("has <footer> for disclaimers", () => {
    renderStatement();
    const footer = document.querySelector(".statement-footer");
    expect(footer?.tagName).toBe("FOOTER");
  });

  it("renders section headings with correct hierarchy (h2)", () => {
    renderStatement();
    const h2Elements = document.querySelectorAll(
      ".investor-statement h2"
    );
    expect(h2Elements.length).toBeGreaterThanOrEqual(3);
    expect(h2Elements[0]).toHaveTextContent("Portfolio Summary");
    expect(h2Elements[1]).toHaveTextContent("Portfolio Allocation");
    expect(h2Elements[2]).toHaveTextContent("Performance History");
  });

  // ─── Tables & Data ──────────────────────────────────────────────────────

  it("renders KPI summary table with proper structure", () => {
    renderStatement();
    const kpiTable = document.querySelector(".statement-kpi-table");
    expect(kpiTable).toBeInTheDocument();
    expect(kpiTable?.querySelector("thead")).toBeInTheDocument();
    expect(kpiTable?.querySelector("tbody")).toBeInTheDocument();
  });

  it("renders allocation data table with headers", () => {
    renderStatement();
    const tables = document.querySelectorAll(".statement-data-table");
    expect(tables.length).toBeGreaterThanOrEqual(1);
    const allocationTable = tables[0];
    expect(allocationTable.querySelector("thead")).toBeInTheDocument();
    expect(
      allocationTable.querySelector('th[scope="col"]')
    ).toBeInTheDocument();
  });

  it("renders performance data table with headers and footer", () => {
    renderStatement();
    const tables = document.querySelectorAll(".statement-data-table");
    expect(tables.length).toBeGreaterThanOrEqual(1);
    const perfTable = tables[tables.length - 1];
    expect(perfTable.querySelector("thead")).toBeInTheDocument();
    expect(perfTable.querySelector("tfoot")).toBeInTheDocument();
  });

  it("renders allocation bar chart items", () => {
    renderStatement();
    const barItems = document.querySelectorAll(
      ".statement-allocation-item"
    );
    expect(barItems.length).toBe(3);
    expect(barItems[0]).toHaveTextContent("TechFlow AI");
    expect(barItems[1]).toHaveTextContent("Quantum Ledger");
    expect(barItems[2]).toHaveTextContent("Nexus Pay");
  });

  it("shows total row in allocation table", () => {
    renderStatement();
    const totalRow = document.querySelector(".statement-total-row");
    expect(totalRow).toBeInTheDocument();
    expect(totalRow).toHaveTextContent("Total");
  });

  // ─── Accessibility Attributes ───────────────────────────────────────────

  it("has lang='en' attribute on the article", () => {
    renderStatement();
    const article = screen.getByTestId("investor-statement");
    expect(article).toHaveAttribute("lang", "en");
  });

  it("has role='document' on the article", () => {
    renderStatement();
    const article = screen.getByTestId("investor-statement");
    expect(article).toHaveAttribute("role", "document");
  });

  it("has aria-label on the article describing the statement", () => {
    renderStatement();
    const article = screen.getByTestId("investor-statement");
    expect(article).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Investor Statement")
    );
  });

  it("has aria-labelledby on each section", () => {
    renderStatement();
    const sections = document.querySelectorAll(
      ".investor-statement section:not(.print-only)"
    );
    sections.forEach((section) => {
      expect(section).toHaveAttribute("aria-labelledby");
    });
  });

  it("uses role='doc-note' on the disclaimer", () => {
    renderStatement();
    const disclaimer = document.querySelector(".statement-header + .statement-disclaimer");
    expect(disclaimer).toHaveAttribute("role", "doc-note");
  });

  it("uses role='doc-endnotes' on the footer", () => {
    renderStatement();
    const footer = document.querySelector(".statement-footer");
    expect(footer).toHaveAttribute("role", "doc-endnotes");
  });

  it("has aria-label on data tables", () => {
    renderStatement();
    const tables = document.querySelectorAll(".statement-data-table");
    tables.forEach((table) => {
      expect(table).toHaveAttribute("aria-label");
    });
  });

  it("has role='progressbar' on allocation bar fills", () => {
    renderStatement();
    const progressBars = document.querySelectorAll(
      '[role="progressbar"]'
    );
    expect(progressBars.length).toBeGreaterThanOrEqual(3);
  });

  it("uses sr-only caption on data tables", () => {
    renderStatement();
    const captions = document.querySelectorAll(
      ".statement-data-table caption.sr-only"
    );
    expect(captions.length).toBeGreaterThanOrEqual(1);
  });

  it("has aria-live='polite' on performance summary", () => {
    renderStatement();
    const summary = document.querySelector(
      ".statement-performance-summary"
    );
    expect(summary).toHaveAttribute("aria-live", "polite");
  });

  // ─── Edge Cases ─────────────────────────────────────────────────────────

  it("shows empty state when no allocations provided", () => {
    renderStatement({ allocations: [] });
    expect(
      screen.getByText("No holdings to display.")
    ).toBeInTheDocument();
  });

  it("shows empty state when no performance data provided", () => {
    renderStatement({ performance: [] });
    expect(
      screen.getByText("No performance data available.")
    ).toBeInTheDocument();
  });

  it("renders without accountId gracefully", () => {
    renderStatement({ accountId: undefined });
    expect(screen.getByTestId("investor-statement")).toBeInTheDocument();
    expect(screen.queryByText("REV-ACC-001")).not.toBeInTheDocument();
  });

  it("handles a single allocation", () => {
    const singleAlloc: AllocationSlice[] = [
      { id: "1", label: "Solo Fund", value: 10000, percentage: 100 },
    ];
    renderStatement({ allocations: singleAlloc });
    expect(screen.getByText("Solo Fund")).toBeInTheDocument();
    expect(screen.getAllByText("100.0%").length).toBeGreaterThan(0);
  });

  it("handles single month performance", () => {
    const singlePerf: PerformanceDataPoint[] = [
      { month: "Jan", value: 50000 },
    ];
    renderStatement({ performance: singlePerf });
    expect(screen.getByText("Jan")).toBeInTheDocument();
  });

  it("renders performance summary with change text", () => {
    renderStatement();
    expect(
      screen.getByText(/Portfolio value changed from/i)
    ).toBeInTheDocument();
  });

  it("displays total return with correct sign", () => {
    renderStatement({ totalReturn: 5.5 });
    expect(screen.getByText("+5.50%")).toBeInTheDocument();
  });

  it("displays negative total return correctly", () => {
    renderStatement({ totalReturn: -2.3 });
    expect(screen.getByText("-2.30%")).toBeInTheDocument();
  });

  // ─── Disclaimer List ────────────────────────────────────────────────────

  it("renders disclaimer list items", () => {
    renderStatement();
    const disclaimers = document.querySelectorAll(
      ".statement-disclaimer-list li"
    );
    expect(disclaimers.length).toBeGreaterThanOrEqual(4);
  });

  it("renders copyright notice", () => {
    renderStatement();
    const copyright = document.querySelector(".statement-copyright");
    expect(copyright).toBeInTheDocument();
    expect(copyright).toHaveTextContent("Revora Platform");
  });
});

