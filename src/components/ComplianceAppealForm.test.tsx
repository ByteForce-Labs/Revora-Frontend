/**
 * Tests for ComplianceAppealForm (Issue #286).
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { ComplianceAppealForm } from "./ComplianceAppealForm";

expect.extend(toHaveNoViolations);

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("ComplianceAppealForm", () => {
  const defaultProps = {
    holdId: "hold-1",
    holdTitle: "Identity verification required",
    isOpen: true,
  };

  beforeEach(() => {
    localStorageMock.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the dialog when isOpen is true", () => {
    render(<ComplianceAppealForm {...defaultProps} />);

    expect(screen.getByText("Submit an Appeal")).toBeInTheDocument();
    expect(screen.getByText(/Appealing:/i)).toBeInTheDocument();
    expect(screen.getByText(/Identity verification required/i)).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <ComplianceAppealForm {...defaultProps} isOpen={false} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("has a reason category select", () => {
    render(<ComplianceAppealForm {...defaultProps} />);

    expect(screen.getByLabelText("Reason for appeal")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("has an explanation textarea", () => {
    render(<ComplianceAppealForm {...defaultProps} />);

    expect(screen.getByLabelText("Explanation")).toBeInTheDocument();
  });

  it("has a file dropzone area", () => {
    render(<ComplianceAppealForm {...defaultProps} />);

    expect(
      screen.getByText(/Drop files here or click to upload/i),
    ).toBeInTheDocument();
  });

  it("shows autosave chip when form has content", () => {
    render(<ComplianceAppealForm {...defaultProps} />);

    const select = screen.getByLabelText("Reason for appeal");
    fireEvent.change(select, { target: { value: "incorrect_info" } });

    const textarea = screen.getByLabelText("Explanation");
    fireEvent.change(textarea, { target: { value: "This information is incorrect." } });

    // The autosave chip appears when any content exists
    expect(screen.getByText(/Saving draft/i)).toBeInTheDocument();
  });

  it("disables submit button until reason is selected", () => {
    render(<ComplianceAppealForm {...defaultProps} />);

    const submitButton = screen.getByRole("button", { name: /submit appeal/i });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Reason for appeal"), {
      target: { value: "incorrect_info" },
    });

    expect(submitButton).not.toBeDisabled();
  });

  it("shows confirmation screen after successful submission", async () => {
    render(<ComplianceAppealForm {...defaultProps} />);

    // Fill form
    fireEvent.change(screen.getByLabelText("Reason for appeal"), {
      target: { value: "incorrect_info" },
    });

    fireEvent.change(screen.getByLabelText("Explanation"), {
      target: { value: "This is a test appeal." },
    });

    // Submit
    const submitButton = screen.getByRole("button", { name: /submit appeal/i });
    fireEvent.click(submitButton);
    // Flush the simulated 1.5s submission delay
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });

    // Wait for simulated submission
    await waitFor(() => {
      expect(screen.getByText("Appeal submitted")).toBeInTheDocument();
    });

    expect(screen.getByText(/has been received/i)).toBeInTheDocument();
    expect(screen.getByText(/1–3 business days/i)).toBeInTheDocument();
  });

  it("shows error on submission failure", async () => {
    const onReject = vi.fn().mockRejectedValue(new Error("Network error"));

    render(
      <ComplianceAppealForm {...defaultProps} onSubmit={onReject} />,
    );

    fireEvent.change(screen.getByLabelText("Reason for appeal"), {
      target: { value: "incorrect_info" },
    });

    fireEvent.change(screen.getByLabelText("Explanation"), {
      target: { value: "Test appeal." },
    });

    fireEvent.click(screen.getByRole("button", { name: /submit appeal/i }));
    // Flush the simulated 1.5s submission delay
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("calls the provided onSubmit with correct data", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <ComplianceAppealForm {...defaultProps} onSubmit={onSubmit} />,
    );

    fireEvent.change(screen.getByLabelText("Reason for appeal"), {
      target: { value: "already_verified" },
    });

    fireEvent.change(screen.getByLabelText("Explanation"), {
      target: { value: "Already verified via support." },
    });

    fireEvent.click(screen.getByRole("button", { name: /submit appeal/i }));
    // Flush the simulated 1.5s submission delay
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        holdId: "hold-1",
        reason: "already_verified",
        explanation: "Already verified via support.",
        attachments: [],
      });
    });
  });

  it("shows draft restored banner when a draft exists in localStorage", () => {
    localStorageMock.getItem.mockReturnValueOnce(
      JSON.stringify({
        holdId: "hold-1",
        reason: "incorrect_info",
        explanation: "Saved draft explanation",
        attachmentNames: ["doc.pdf"],
        updatedAt: new Date().toISOString(),
      }),
    );

    render(<ComplianceAppealForm {...defaultProps} />);

    expect(screen.getByText(/Draft restored/i)).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<ComplianceAppealForm {...defaultProps} onClose={onClose} />);

    const closeButton = screen.getByLabelText("Close appeal form");
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has a review timeline on the confirmation screen", async () => {
    render(<ComplianceAppealForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Reason for appeal"), {
      target: { value: "incorrect_info" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit appeal/i }));
    // Flush the simulated 1.5s submission delay
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });

    await waitFor(() => {
      expect(screen.getByText("Submitted")).toBeInTheDocument();
      expect(screen.getByText("In Review")).toBeInTheDocument();
      expect(screen.getByText("Decision")).toBeInTheDocument();
    });
  });

  it("closes confirmation when Close button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <ComplianceAppealForm {...defaultProps} onClose={onClose} />,
    );

    fireEvent.change(screen.getByLabelText("Reason for appeal"), {
      target: { value: "incorrect_info" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit appeal/i }));
    // Flush the simulated 1.5s submission delay
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });

    await waitFor(() => {
      expect(screen.getByText("Appeal submitted")).toBeInTheDocument();
    });

    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has no axe violations", async () => {
    const { container } = render(<ComplianceAppealForm {...defaultProps} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
