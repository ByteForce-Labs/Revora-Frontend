import { act, render, renderHook, screen } from "@testing-library/react";
import { vi } from "vitest";
import {
  InvestorStatement,
  usePrintStatement,
  type InvestorStatementProps,
} from "./index";

const STATEMENT_PROPS: InvestorStatementProps = {
  investorName: "Jordan Lee",
  statementDate: "2025-06-30T12:00:00.000Z",
  statementPeriod: "H1 2025",
  totalInvested: "$10,000",
  currentValue: "$11,000",
  totalReturn: 10,
  activeHoldings: 1,
  allocations: [
    { id: "holding-1", label: "Northstar Fund", value: 11000, percentage: 100 },
  ],
  performance: [{ month: "Jun", value: 11000 }],
  accountId: "REV-1001",
};

describe("InvestorStatement public exports", () => {
  it("renders a statement through the package entry point", () => {
    render(<InvestorStatement {...STATEMENT_PROPS} />);

    expect(screen.getByRole("document")).toHaveAttribute(
      "aria-label",
      "Investor Statement for Jordan Lee — H1 2025"
    );
    expect(screen.getByText("Northstar Fund")).toBeInTheDocument();
    expect(screen.getAllByText("REV-1001").length).toBeGreaterThan(0);
  });

  it("throws a deterministic range error for an invalid currency code", () => {
    expect(() =>
      render(<InvestorStatement {...STATEMENT_PROPS} currency="INVALID" />)
    ).toThrow(RangeError);
  });
});

describe("usePrintStatement public export", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("transitions through print start and completion", () => {
    vi.useFakeTimers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    const { result } = renderHook(() => usePrintStatement());

    expect(result.current).toMatchObject({
      showStatement: false,
      isPrinting: false,
    });

    act(() => result.current.printStatement());
    expect(result.current.showStatement).toBe(true);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(printSpy).toHaveBeenCalledOnce();

    act(() => window.dispatchEvent(new Event("beforeprint")));
    expect(result.current.isPrinting).toBe(true);

    act(() => window.dispatchEvent(new Event("afterprint")));
    expect(result.current).toMatchObject({
      showStatement: false,
      isPrinting: false,
    });
  });

  it("cancels an active statement without opening the print dialog", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    const { result } = renderHook(() => usePrintStatement());

    act(() => result.current.printStatement());
    expect(result.current.showStatement).toBe(true);

    act(() => result.current.cancelStatement());
    expect(result.current).toMatchObject({
      showStatement: false,
      isPrinting: false,
    });
    expect(printSpy).not.toHaveBeenCalled();
  });
});
