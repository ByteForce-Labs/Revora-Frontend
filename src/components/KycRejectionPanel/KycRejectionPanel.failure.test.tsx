/**
 * Regression coverage for the `KycRejectionPanelProps` empty/failure path in
 * `src/components/KycRejectionPanel/KycRejectionPanel.tsx` (#738).
 *
 * Branch under guard
 * ------------------
 *   `if (!reasons || reasons.length === 0) return null;`
 *
 * The panel must render *nothing* (no empty region, no stray footer) when the
 * decision engine returns no rejection reasons, and it must never throw for a
 * missing/`null` prop. The sibling suite covers the populated happy path, so
 * this file focuses on the guarded branch plus the malformed-input neighbours
 * that feed it.
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { KycRejectionPanel } from "./KycRejectionPanel";
import type { KycRejectionReason } from "./kycRejectionTaxonomy";

function renderPanel(props: React.ComponentProps<typeof KycRejectionPanel>) {
  return render(<KycRejectionPanel {...props} />);
}

describe("KycRejectionPanel — empty/failure path (#738)", () => {
  it("renders nothing for an empty reason list", () => {
    const { container } = renderPanel({ reasons: [] });

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("kyc-rejection-panel")).not.toBeInTheDocument();
  });

  it("renders nothing (and does not throw) for a null reason list", () => {
    const { container } = renderPanel({ reasons: null as unknown as KycRejectionReason[] });

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("renders nothing (and does not throw) for an undefined reason list", () => {
    const { container } = renderPanel({ reasons: undefined as unknown as KycRejectionReason[] });

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("kyc-support-fallback")).not.toBeInTheDocument();
  });

  it("does not call the navigation callback when there is nothing to render", () => {
    const onNavigateToStep = vi.fn();

    renderPanel({ reasons: [], onNavigateToStep });

    expect(onNavigateToStep).not.toHaveBeenCalled();
  });

  it("renders the panel as soon as a single reason is supplied (neighbour path)", () => {
    renderPanel({ reasons: [{ id: "only", code: "ID_BLURRY" }] });

    expect(screen.getByTestId("kyc-rejection-panel")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText(/1 issue needs your attention/i)).toBeInTheDocument();
  });
});

describe("KycRejectionPanel — malformed reasons (#738)", () => {
  it.each([
    ["unknown code", "VENDOR_XYZ", "UNCLEAR", /Contact support: Needs clarification/i],
    ["empty code", "", "UNCLEAR", /Contact support: Needs clarification/i],
    ["whitespace-only code", "   ", "UNCLEAR", /Contact support: Needs clarification/i],
  ])("normalises %s to a resolvable CTA", (_label, code, expectedCode, ctaName) => {
    renderPanel({ reasons: [{ id: "r", code }] });

    const item = screen.getByTestId("kyc-rejection-item-r");
    expect(item).toHaveAttribute("data-code", expectedCode);
    // Every normalised reason still exposes exactly one actionable CTA.
    expect(within(item).getByRole("link", { name: ctaName })).toHaveAttribute(
      "href",
      "/support/kyc",
    );
  });

  it("normalises a lowercase canonical code to its corrective-action CTA", () => {
    renderPanel({ reasons: [{ id: "r", code: "id blurry" }] });

    const item = screen.getByTestId("kyc-rejection-item-r");
    expect(item).toHaveAttribute("data-code", "ID_BLURRY");
    // Non-support reasons expose a single corrective-action button instead of a support link.
    expect(
      within(item).getByRole("button", { name: /Re-upload ID: ID photo unclear/i }),
    ).toBeInTheDocument();
  });

  it("falls back to UNCLEAR for a null code", () => {
    renderPanel({ reasons: [{ id: "null-code", code: null as unknown as string }] });

    const item = screen.getByTestId("kyc-rejection-item-null-code");
    expect(item).toHaveAttribute("data-code", "UNCLEAR");
    expect(within(item).getByRole("link", { name: /Contact support: Needs clarification/i })).toBeInTheDocument();
  });

  it("treats a whitespace-only reviewer detail as absent", () => {
    renderPanel({ reasons: [{ id: "ws", code: "ID_BLURRY", detail: "   \n\t " }] });

    const item = screen.getByTestId("kyc-rejection-item-ws");
    expect(item.textContent ?? "").not.toMatch(/Reviewer note/i);
  });

  it("appends a normalised reviewer note for a real detail", () => {
    renderPanel({ reasons: [{ id: "note", code: "ID_BLURRY", detail: "  corners cut off  " }] });

    expect(screen.getByText(/Reviewer note: corners cut off/)).toBeInTheDocument();
  });

  it("keeps duplicate codes as distinct list items when the ids differ", () => {
    renderPanel({
      reasons: [
        { id: "dup-1", code: "LIVENESS_FAILED" },
        { id: "dup-2", code: "LIVENESS_FAILED" },
      ],
    });

    expect(screen.getByTestId("kyc-rejection-item-dup-1")).toBeInTheDocument();
    expect(screen.getByTestId("kyc-rejection-item-dup-2")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Retake liveness check/i })).toHaveLength(2);
    expect(screen.getByText(/2 issues need your attention/i)).toBeInTheDocument();
  });

  it("defaults the support href to the canonical KYC support route", () => {
    renderPanel({ reasons: [{ id: "d", code: "UNCLEAR" }] });

    const supportLinks = screen.getAllByRole("link", { name: /Contact support/i });
    for (const link of supportLinks) {
      expect(link).toHaveAttribute("href", "/support/kyc");
    }
  });

  it("does not invoke onNavigateToStep for support-only reasons", async () => {
    const user = userEvent.setup();
    const onNavigateToStep = vi.fn();

    renderPanel({ reasons: [{ id: "s", code: "UNCLEAR" }], onNavigateToStep });

    await user.click(screen.getByRole("link", { name: /Contact support: Needs clarification/i }));

    expect(onNavigateToStep).not.toHaveBeenCalled();
  });
});
