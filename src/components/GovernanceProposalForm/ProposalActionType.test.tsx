import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { GovernanceProposalForm } from "./GovernanceProposalForm";

const noop = () => {};

beforeEach(() => {
  localStorage.clear();
});

describe("ProposalActionType preview handling", () => {
  it("does not show the autosave chip while idle", () => {
    render(<GovernanceProposalForm onSubmit={noop} />);

    expect(screen.queryByText("Saving...")).not.toBeInTheDocument();
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("renders an unknown action type without an action detail", async () => {
    localStorage.setItem(
      "gov-proposal-draft",
      JSON.stringify({
        title: "Unknown Action Proposal",
        abstract: "A valid abstract for an unknown action type.",
        actions: [{ id: "unknown-action", type: "unsupported_action" }],
      }),
    );

    const user = userEvent.setup();
    render(<GovernanceProposalForm onSubmit={noop} />);
    await user.click(screen.getByLabelText(/Go to step 4: Preview/i));

    expect(
      screen.getByRole("region", { name: "Step 4: Proposal preview" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Actions (1)")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.queryByText(/Transfer/)).not.toBeInTheDocument();
  });

  it("uses placeholders when a transfer action omits optional fields", async () => {
    localStorage.setItem(
      "gov-proposal-draft",
      JSON.stringify({
        title: "Boundary Action Proposal",
        abstract: "A valid abstract for a transfer with omitted fields.",
        actions: [{ id: "empty-transfer", type: "transfer" }],
      }),
    );

    const user = userEvent.setup();
    render(<GovernanceProposalForm onSubmit={noop} />);
    await user.click(screen.getByLabelText(/Go to step 4: Preview/i));

    expect(screen.getAllByText(/Transfer/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});
