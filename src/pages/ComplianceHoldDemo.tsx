import React, { useState } from "react";
import { ComplianceHoldBanner, ComplianceHold, ComplianceSeverity } from "../components/ComplianceHoldBanner";
import { RemediationChecklist, RemediationStep } from "../components/RemediationChecklist";

const ComplianceHoldDemo: React.FC = () => {
  const [holds, setHolds] = useState<ComplianceHold[]>([
    {
      id: "kyc-1",
      type: "kyc",
      severity: "blocking" as ComplianceSeverity,
      title: "Identity verification required",
      message: "Complete identity verification to continue using your account",
    },
    {
      id: "aml-1",
      type: "aml",
      severity: "warning" as ComplianceSeverity,
      title: "Additional information needed",
      message: "Provide your tax identification number to meet regulatory requirements",
      canDismiss: true,
    },
  ]);

  const [steps, setSteps] = useState<RemediationStep[]>([
    {
      id: "step-1",
      title: "Upload government ID",
      description: "Provide a valid passport or driver's license",
      completed: false,
      actionLabel: "Upload now",
      onAction: (id) => console.log("Action clicked:", id),
    },
    {
      id: "step-2",
      title: "Take a selfie",
      description: "Follow the on-screen instructions for facial verification",
      completed: false,
      actionLabel: "Start verification",
      onAction: (id) => console.log("Action clicked:", id),
    },
    {
      id: "step-3",
      title: "Provide tax ID",
      description: "Enter your tax identification number for AML compliance",
      completed: false,
      actionLabel: "Enter now",
      onAction: (id) => console.log("Action clicked:", id),
    },
  ]);

  const handleDismiss = (holdId: string) => {
    setHolds((prev) => prev.filter((hold) => hold.id !== holdId));
  };

  const handleStepAction = (stepId: string) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, completed: true } : step
      )
    );
  };

  const handleToggleSeverity = () => {
    setHolds((prev) =>
      prev.map((hold) => ({
        ...hold,
        severity: (hold.severity === "blocking" ? "info" : "blocking") as typeof hold.severity,
      }))
    );
  };

  const handleReset = () => {
    setHolds([
      {
        id: "kyc-1",
        type: "kyc",
        severity: "blocking" as ComplianceSeverity,
        title: "Identity verification required",
        message: "Complete identity verification to continue using your account",
      },
      {
        id: "aml-1",
        type: "aml",
        severity: "warning" as ComplianceSeverity,
        title: "Additional information needed",
        message: "Provide your tax identification number to meet regulatory requirements",
        canDismiss: true,
      },
    ]);
    setSteps([
      {
        id: "step-1",
        title: "Upload government ID",
        description: "Provide a valid passport or driver's license",
        completed: false,
        actionLabel: "Upload now",
        onAction: handleStepAction,
      },
      {
        id: "step-2",
        title: "Take a selfie",
        description: "Follow the on-screen instructions for facial verification",
        completed: false,
        actionLabel: "Start verification",
        onAction: handleStepAction,
      },
      {
        id: "step-3",
        title: "Provide tax ID",
        description: "Enter your tax identification number for AML compliance",
        completed: false,
        actionLabel: "Enter now",
        onAction: handleStepAction,
      },
    ]);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-[#e5e7eb]">
          Compliance Hold Components Demo
        </h1>
        <p className="text-[#cbd5e1] mb-8">
          Interactive demonstration of the ComplianceHoldBanner and RemediationChecklist components
        </p>

        <div className="flex gap-4 mb-8">
          <button
            onClick={handleToggleSeverity}
            className="px-4 py-2 bg-[#3b82f6] text-white rounded-lg hover:bg-[#2563eb] transition-colors"
            type="button"
          >
            Toggle Severity
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-[rgba(148,163,184,0.2)] text-[#e5e7eb] rounded-lg hover:bg-[rgba(148,163,184,0.3)] transition-colors"
            type="button"
          >
            Reset Demo
          </button>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4 text-[#e5e7eb]">
              Compliance Hold Banner
            </h2>
            <ComplianceHoldBanner holds={holds} onDismiss={handleDismiss} />
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-[#e5e7eb]">
              Remediation Checklist
            </h2>
            <RemediationChecklist
              steps={steps.map((step) => ({
                ...step,
                onAction: handleStepAction,
              }))}
            />
          </section>

          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold mb-4 text-[#e5e7eb]">
              Usage Guidelines
            </h2>
            <ul className="space-y-2 text-[#cbd5e1]">
              <li>• Click "Toggle Severity" to switch between blocking and info severity</li>
              <li>• Click the X icon on dismissible holds to remove them</li>
              <li>• Click action buttons in the checklist to mark steps as complete</li>
              <li>• Watch the progress bar update as you complete steps</li>
              <li>• Use "Reset Demo" to restore the initial state</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ComplianceHoldDemo;
