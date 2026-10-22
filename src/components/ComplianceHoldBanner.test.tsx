import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe, toHaveNoViolations } from "jest-axe";
import { ComplianceHoldBanner } from "./ComplianceHoldBanner";
import type { ComplianceSeverity } from "./ComplianceHoldBanner";

expect.extend(toHaveNoViolations);

describe("ComplianceHoldBanner", () => {
  const mockHold = {
    id: "1",
    type: "kyc",
    severity: "blocking" as ComplianceSeverity,
    title: "Identity verification required",
    message: "Complete identity verification to continue",
  };

  describe("empty-result and failure paths", () => {
    it("renders nothing when holds array is empty", () => {
      const { container } = render(<ComplianceHoldBanner holds={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it("renders nothing when holds is null", () => {
      const { container } = render(<ComplianceHoldBanner holds={null as any} />);
      expect(container.firstChild).toBeNull();
    });

    it("renders nothing when holds is undefined", () => {
      const { container } = render(<ComplianceHoldBanner holds={undefined as any} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("neighboring normal path", () => {
    it("renders an element when holds array has valid items", () => {
      const { container } = render(<ComplianceHoldBanner holds={[mockHold]} />);
      expect(container.firstChild).not.toBeNull();
    });
  });

  describe("boundary behavior", () => {
    it("throws an explicit error when provided an invalid severity", () => {
      const invalidHold = { ...mockHold, severity: "invalid-severity" as any };
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        expect(() => {
          render(<ComplianceHoldBanner holds={[invalidHold]} />);
        }).toThrowError("Invalid ComplianceSeverity: invalid-severity");
      } finally {
        spy.mockRestore();
      }
    });
  });

  it("renders a single hold with correct content", () => {
    render(<ComplianceHoldBanner holds={[mockHold]} />);

    expect(screen.getByText("Identity verification required")).toBeInTheDocument();
    expect(screen.getByText("Complete identity verification to continue")).toBeInTheDocument();
  });

  it("renders multiple holds", () => {
    const holds = [
      mockHold,
      {
        id: "2",
        type: "aml",
        severity: "warning" as ComplianceSeverity,
        title: "Additional information needed",
        message: "Provide your tax identification number",
      },
    ];

    render(<ComplianceHoldBanner holds={holds} />);

    expect(screen.getByText("Identity verification required")).toBeInTheDocument();
    expect(screen.getByText("Additional information needed")).toBeInTheDocument();
  });

  it("shows hold count and legend trigger when multiple holds exist", () => {
    const holds = [
      mockHold,
      {
        id: "2",
        type: "aml",
        severity: "warning" as ComplianceSeverity,
        title: "Additional info needed",
        message: "Provide your tax ID",
      },
    ];

    render(<ComplianceHoldBanner holds={holds} />);

    expect(screen.getByText(/2 holds? active/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /about severity levels/i }),
    ).toBeInTheDocument();
  });

  it("renders severity badge for each hold", () => {
    const { container } = render(<ComplianceHoldBanner holds={[mockHold]} />);

    expect(
      container.querySelector('[data-testid="severity-badge-blocking"]'),
    ).toBeInTheDocument();
  });

  it("renders an Appeal button when hold is appealable and onAppeal is provided", () => {
    const appealableHold = {
      ...mockHold,
      appealable: true,
    };

    render(<ComplianceHoldBanner holds={[appealableHold]} onAppeal={vi.fn()} />);

    const appealButton = screen.getByRole("button", { name: /appeal identity verification/i });
    expect(appealButton).toBeInTheDocument();
  });

  it("does not render Appeal button when hold is not appealable", () => {
    render(<ComplianceHoldBanner holds={[mockHold]} onAppeal={vi.fn()} />);

    const appealButton = screen.queryByRole("button", { name: /appeal/i });
    expect(appealButton).not.toBeInTheDocument();
  });

  it("does not render Appeal button when onAppeal is not provided", () => {
    const appealableHold = {
      ...mockHold,
      appealable: true,
    };

    render(<ComplianceHoldBanner holds={[appealableHold]} />);

    const appealButton = screen.queryByRole("button", { name: /appeal/i });
    expect(appealButton).not.toBeInTheDocument();
  });

  it("opens appeal form dialog when Appeal button is clicked", () => {
    const appealableHold = {
      ...mockHold,
      appealable: true,
    };

    render(<ComplianceHoldBanner holds={[appealableHold]} onAppeal={vi.fn()} />);

    const appealButton = screen.getByRole("button", { name: /appeal identity verification/i });
    fireEvent.click(appealButton);

    expect(screen.getByText("Submit an Appeal")).toBeInTheDocument();
    expect(screen.getByText(/Appealing:/i)).toBeInTheDocument();
  });

  it("renders dismiss button when canDismiss is true and onDismiss is provided", () => {
    const dismissibleHold = {
      ...mockHold,
      canDismiss: true,
    };

    render(<ComplianceHoldBanner holds={[dismissibleHold]} onDismiss={vi.fn()} />);

    const dismissButton = screen.getByRole("button", { name: /dismiss/i });
    expect(dismissButton).toBeInTheDocument();
  });

  it("does not render dismiss button when canDismiss is false", () => {
    render(<ComplianceHoldBanner holds={[mockHold]} onDismiss={vi.fn()} />);

    const dismissButton = screen.queryByRole("button", { name: /dismiss/i });
    expect(dismissButton).not.toBeInTheDocument();
  });

  it("does not render dismiss button when onDismiss is not provided", () => {
    const dismissibleHold = {
      ...mockHold,
      canDismiss: true,
    };

    render(<ComplianceHoldBanner holds={[dismissibleHold]} />);

    const dismissButton = screen.queryByRole("button", { name: /dismiss/i });
    expect(dismissButton).not.toBeInTheDocument();
  });

  it("calls onDismiss with correct hold id when dismiss button is clicked", () => {
    const dismissibleHold = {
      ...mockHold,
      canDismiss: true,
    };
    const onDismiss = vi.fn();

    render(<ComplianceHoldBanner holds={[dismissibleHold]} onDismiss={onDismiss} />);

    const dismissButton = screen.getByRole("button", { name: /dismiss/i });
    fireEvent.click(dismissButton);

    expect(onDismiss).toHaveBeenCalledWith("1");
  });

  it("applies custom className", () => {
    const { container } = render(
      <ComplianceHoldBanner holds={[mockHold]} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("uses default id when not provided", () => {
    render(<ComplianceHoldBanner holds={[mockHold]} />);

    const banner = screen.getByRole("region", { name: /compliance holds/i });
    expect(banner).toHaveAttribute("id", "compliance-hold-banner");
  });

  it("uses custom id when provided", () => {
    render(<ComplianceHoldBanner holds={[mockHold]} id="custom-id" />);

    const banner = screen.getByRole("region", { name: /compliance holds/i });
    expect(banner).toHaveAttribute("id", "custom-id");
  });

  it("has correct ARIA attributes for blocking severity", () => {
    const { container } = render(<ComplianceHoldBanner holds={[mockHold]} />);
    const banner = container.querySelector('[role="alert"]');

    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("aria-live", "assertive");
    expect(banner).toHaveAttribute("aria-atomic", "true");
  });

  it("has correct ARIA attributes for warning severity", () => {
    const warningHold = {
      ...mockHold,
      severity: "warning" as ComplianceSeverity,
    };

    const { container } = render(<ComplianceHoldBanner holds={[warningHold]} />);
    const banner = container.querySelector('[role="alert"]');

    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("aria-live", "assertive");
  });

  it("has correct ARIA attributes for info severity", () => {
    const infoHold = {
      ...mockHold,
      severity: "advisory" as ComplianceSeverity,
    };

    const { container } = render(<ComplianceHoldBanner holds={[infoHold]} />);
    const banner = container.querySelector('[role="status"]');

    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("aria-live", "polite");
  });

  it("has region role with aria-label", () => {
    render(<ComplianceHoldBanner holds={[mockHold]} />);

    const region = screen.getByRole("region", { name: /compliance holds/i });
    expect(region).toBeInTheDocument();
  });

  it("handles multiple concurrent holds with different severities", () => {
    const holds = [
      {
        id: "1",
        type: "kyc",
        severity: "blocking" as ComplianceSeverity,
        title: "Blocking issue",
        message: "This blocks access",
      },
      {
        id: "2",
        type: "aml",
        severity: "warning" as ComplianceSeverity,
        title: "Warning issue",
        message: "This is a warning",
      },
      {
        id: "3",
        type: "document",
        severity: "advisory" as ComplianceSeverity,
        title: "Info issue",
        message: "This is informational",
      },
    ];

    render(<ComplianceHoldBanner holds={holds} />);

    expect(screen.getByText("Blocking issue")).toBeInTheDocument();
    expect(screen.getByText("Warning issue")).toBeInTheDocument();
    expect(screen.getByText("Info issue")).toBeInTheDocument();
  });

  it("dismiss button has correct aria-label", () => {
    const dismissibleHold = {
      ...mockHold,
      canDismiss: true,
      title: "Specific Hold Title",
    };

    render(<ComplianceHoldBanner holds={[dismissibleHold]} onDismiss={vi.fn()} />);

    const dismissButton = screen.getByRole("button", { name: /dismiss Specific Hold Title/i });
    expect(dismissButton).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const holds = [
      {
        id: "1",
        type: "kyc",
        severity: "blocking" as ComplianceSeverity,
        title: "Blocking issue",
        message: "This blocks access",
        canDismiss: true,
        appealable: true,
      },
      {
        id: "2",
        type: "aml",
        severity: "warning" as ComplianceSeverity,
        title: "Warning issue",
        message: "This is a warning",
        appealable: true,
      },
      {
        id: "3",
        type: "document",
        severity: "advisory" as ComplianceSeverity,
        title: "Info issue",
        message: "This is informational",
      },
    ];

    const { container } = render(
      <ComplianceHoldBanner holds={holds} onDismiss={vi.fn()} onAppeal={vi.fn()} />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
