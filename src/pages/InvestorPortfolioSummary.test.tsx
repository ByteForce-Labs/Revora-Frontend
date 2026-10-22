/**
 * InvestorPortfolioSummary.test.tsx
 * Issue #163 – Investor Portfolio Summary page
 * Coverage target ≥95% on InvestorPortfolioSummary.tsx
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { InvestorPortfolioSummary } from "./InvestorPortfolioSummary";
import type { AllocationSlice } from "../components/AllocationWidget";
import type { PerformanceDataPoint } from "../components/PerformanceTrendWidget";

const ALLOCS: AllocationSlice[] = [
  { id: "1", label: "TechFlow AI", value: 45000, percentage: 45 },
  { id: "2", label: "Quantum Ledger", value: 30000, percentage: 30 },
  { id: "3", label: "Nexus Pay", value: 25000, percentage: 25 },
];

const PERF: PerformanceDataPoint[] = [
  { month: "Jan", value: 90000 },
  { month: "Feb", value: 95000 },
  { month: "Mar", value: 103000 },
];

const renderPage = (overrides = {}) =>
  render(
    <MemoryRouter>
      <InvestorPortfolioSummary __allocations={ALLOCS} __performance={PERF} {...overrides} />
    </MemoryRouter>
  );

describe("InvestorPortfolioSummary", () => {
  it("renders portfolio-summary testid", () => {
    renderPage();
    expect(screen.getByTestId("portfolio-summary")).toBeInTheDocument();
  });

  it("renders page heading", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: /Portfolio Overview/i })).toBeInTheDocument();
  });

  it("renders back navigation link to /investor/portal", () => {
    renderPage();
    const link = screen.getByRole("link", { name: /Back to Investor Discovery/i });
    expect(link).toHaveAttribute("href", "/investor/portal");
  });

  it("renders the dashboard hero", () => {
    renderPage();
    expect(screen.getByRole("region", { name: /Portfolio Overview/i })).toBeInTheDocument();
  });

  it("renders allocation widget", () => {
    renderPage();
    expect(screen.getByTestId("allocation-widget")).toBeInTheDocument();
  });

  it("renders performance widget", () => {
    renderPage();
    expect(screen.getByTestId("performance-widget")).toBeInTheDocument();
  });

  it("computes totalInvested from allocations", () => {
    renderPage();
    // 45000+30000+25000 = 100000 → $100,000 (appears in KPI + allocation bar)
    expect(screen.getAllByText("$100,000").length).toBeGreaterThan(0);
  });

  it("shows currentValue = last performance point", () => {
    renderPage();
    // last point value = 103000 → $103,000
    expect(screen.getByText("$103,000")).toBeInTheDocument();
  });

  it("shows activeHoldings = 3", () => {
    renderPage();
    // KPI header "3" for activeHoldings
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders with default mock data when no props given", () => {
    render(
      <MemoryRouter>
        <InvestorPortfolioSummary />
      </MemoryRouter>
    );
    expect(screen.getByTestId("portfolio-summary")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("handles empty allocations gracefully", () => {
    renderPage({ __allocations: [] });
    // totalInvested = 0, currentValue = last perf value
    expect(screen.getByTestId("portfolio-summary")).toBeInTheDocument();
  });

  it("handles empty performance gracefully (currentValue falls back to totalInvested)", () => {
    renderPage({ __performance: [] });
    expect(screen.getByTestId("portfolio-summary")).toBeInTheDocument();
  });

  it("handles single holding", () => {
    renderPage({
      __allocations: [{ id: "1", label: "Solo Fund", value: 10000, percentage: 100 }],
    });
    expect(screen.getByText("Solo Fund")).toBeInTheDocument();
  });

  it("renders subtitle text", () => {
    renderPage();
    expect(
      screen.getByText(/Track your personal returns and manage upcoming actions/i)
    ).toBeInTheDocument();
  });
});
