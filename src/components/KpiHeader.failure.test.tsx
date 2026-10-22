/**
 * Regression coverage for the KpiItem failure/empty path in
 * `src/components/KpiHeader.tsx` (#736).
 *
 * Branch under guard
 * ------------------
 * `parseValue()` returns `null` when a metric string contains no numeric
 * fragment, and `AnimatedValue` then falls back to rendering the raw string
 * instead of animating (`if (!parsed || isNaN(parsed.num)) { ... return; }`).
 * Nothing else in the file asserts that fallback, so a refactor could silently
 * start rendering `NaN`/blank KPI cards for pending or unavailable metrics.
 *
 * This suite pins:
 *   - the fallback render for unparsable metric strings (the guarded branch)
 *   - the reduced-motion sibling branch
 *   - the neighbouring normal path (numeric strings still render)
 *   - boundary inputs: empty string, `-0`, sub-0.05 returns, NaN, Infinity
 */

import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Controllable reduced-motion flag (hoisted so the mock factory can see it).
const motion = vi.hoisted(() => ({ reduced: false }));

vi.mock("../hooks/useReducedMotion", () => ({
  useReducedMotion: () => motion.reduced,
}));

import { KpiHeader } from "./KpiHeader";

const BASE = {
  totalInvested: "$100,000",
  currentValue: "$103,000",
  totalReturn: 3,
  activeHoldings: 3,
};

afterEach(() => {
  motion.reduced = false;
});

function cardByLabel(label: RegExp | string) {
  return screen.getByText(label).closest('[data-testid="kpi-card"]') as HTMLElement;
}

describe("KpiHeader — KpiItem failure/empty path (#736)", () => {
  it.each(["N/A", "—", "Pending", "TBD", "n/a"])(
    "renders the unparsable currentValue %p verbatim instead of NaN",
    (value) => {
      render(<KpiHeader {...BASE} currentValue={value} />);

      const card = cardByLabel(/Current Value/i);
      expect(within(card).getByText(value)).toBeInTheDocument();
      expect(within(card).queryByText(/NaN/i)).toBeNull();
      expect(screen.getByTestId("kpi-header")).toBeInTheDocument();
    },
  );

  it("falls back to the raw string for an unparsable totalInvested", () => {
    render(<KpiHeader {...BASE} totalInvested="Awaiting data" />);

    const card = cardByLabel(/Total Invested/i);
    expect(within(card).getByText("Awaiting data")).toBeInTheDocument();
    expect(within(card).queryByText(/NaN/i)).toBeNull();
  });

  it("keeps the fallback branch for unparsable values under reduced motion", () => {
    motion.reduced = true;

    render(<KpiHeader {...BASE} currentValue="N/A" />);

    const card = cardByLabel(/Current Value/i);
    const value = within(card).getByText("N/A");
    expect(value).toBeInTheDocument();
    // Reduced motion swaps the animated span for the fade-in span.
    expect(value.closest(".animate-fade-in")).not.toBeNull();
  });

  it("renders the reduced-motion variant for a numeric value", () => {
    motion.reduced = true;

    render(<KpiHeader {...BASE} />);

    const card = cardByLabel(/Total Invested/i);
    const value = within(card).getByText("$100,000");
    expect(value.closest(".animate-fade-in")).not.toBeNull();
  });

  it("survives an empty metric string without crashing", () => {
    render(<KpiHeader {...BASE} currentValue="" totalInvested="" />);

    expect(screen.getByTestId("kpi-header")).toBeInTheDocument();
    expect(screen.getAllByTestId("kpi-card")).toHaveLength(4);
    // Unparsable -> rendered as-is, so no "$" survives the empty value.
    expect(cardByLabel(/Current Value/i)).toBeInTheDocument();
  });

  it("still renders numeric neighbours on the normal path", () => {
    render(<KpiHeader {...BASE} currentValue="$0" totalInvested="$1,234,567.89" />);

    expect(within(cardByLabel(/Total Invested/i)).getByText("$1,234,567.89")).toBeInTheDocument();
    expect(within(cardByLabel(/Current Value/i)).getByText("$0")).toBeInTheDocument();
  });
});

describe("KpiHeader — numeric boundaries for the neighbouring path (#736)", () => {
  it("treats a -0 return as non-negative and renders +0.0%", () => {
    render(<KpiHeader {...BASE} totalReturn={-0} />);

    expect(screen.getAllByText("+0.0%").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Increase of 0%/).length).toBeGreaterThan(0);
  });

  it("rounds a sub-0.05 return to 0.0 without flipping the sign", () => {
    render(<KpiHeader {...BASE} totalReturn={0.04} />);

    expect(screen.getAllByText("+0.0%").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Increase of 0.04%/).length).toBeGreaterThan(0);
  });

  it("renders a large positive return with one decimal", () => {
    render(<KpiHeader {...BASE} totalReturn={1234.56} />);

    expect(screen.getAllByText("+1234.6%").length).toBeGreaterThan(0);
  });

  it("renders a large negative return with the minus sign", () => {
    render(<KpiHeader {...BASE} totalReturn={-987.65} />);

    // (-987.65).toFixed(1) === "-987.6" because -987.65 is stored as -987.6499…
    expect(screen.getAllByText("-987.6%").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Decrease of 987.65%/).length).toBeGreaterThan(0);
  });

  it("does not crash on a NaN return and pins the degenerate formatting", () => {
    render(<KpiHeader {...BASE} totalReturn={Number.NaN} />);

    expect(screen.getByTestId("kpi-header")).toBeInTheDocument();
    // `change !== undefined` keeps the delta row mounted even for NaN.
    expect(screen.getAllByText("NaN%").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/of NaN%/).length).toBeGreaterThan(0);
  });

  it("does not crash on an Infinity return", () => {
    render(<KpiHeader {...BASE} totalReturn={Number.POSITIVE_INFINITY} />);

    expect(screen.getAllByText("+Infinity%").length).toBeGreaterThan(0);
  });

  it("renders zero and very large holdings counts", () => {
    const { unmount } = render(<KpiHeader {...BASE} activeHoldings={0} />);
    expect(within(cardByLabel(/Active Holdings/i)).getByText("0")).toBeInTheDocument();
    unmount();

    render(<KpiHeader {...BASE} activeHoldings={1_000_000} />);
    expect(within(cardByLabel(/Active Holdings/i)).getByText("1000000")).toBeInTheDocument();
  });
});
