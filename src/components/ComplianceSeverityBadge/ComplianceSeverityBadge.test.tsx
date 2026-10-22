/**
 * Tests for ComplianceSeverityBadge and ComplianceSeverityLegend (Issue #285).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { ComplianceSeverityBadge, ComplianceSeverityLegend } from './index';

expect.extend(toHaveNoViolations);

/* ─── ComplianceSeverityBadge ──────────────────────────────────────── */

describe('ComplianceSeverityBadge', () => {
  it('renders a compact badge by default with icon only', () => {
    const { container } = render(
      <ComplianceSeverityBadge severity="advisory" />,
    );
    const badge = container.querySelector('[data-testid^="severity-badge"]');
    expect(badge).toHaveAttribute('data-variant', 'compact');
    expect(badge).toHaveAttribute('data-severity', 'advisory');
  });

  it('renders a detailed badge with label', () => {
    render(
      <ComplianceSeverityBadge severity="warning" variant="detailed" />,
    );
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('renders for all three severity tiers', () => {
    const tiers = ['advisory', 'warning', 'blocking'] as const;
    tiers.forEach((tier) => {
      const { container } = render(
        <ComplianceSeverityBadge severity={tier} />,
      );
      expect(
        container.querySelector(`[data-severity="${tier}"]`),
      ).toBeInTheDocument();
    });
  });

  it('uses custom label when provided', () => {
    render(
      <ComplianceSeverityBadge severity="blocking" variant="detailed" label="Critical" />,
    );
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('renders as text when asText is true', () => {
    const { container } = render(
      <ComplianceSeverityBadge severity="advisory" asText />,
    );
    expect(container.querySelector('.csb-text')).toBeInTheDocument();
    expect(container.querySelector('.csb-badge')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ComplianceSeverityBadge severity="warning" className="my-custom-class" />,
    );
    expect(container.querySelector('.my-custom-class')).toBeInTheDocument();
  });

  it('has no axe violations for each tier', async () => {
    const tiers = ['advisory', 'warning', 'blocking'] as const;
    for (const tier of tiers) {
      const { container } = render(
        <ComplianceSeverityBadge severity={tier} variant="detailed" />,
      );
      expect(await axe(container)).toHaveNoViolations();
    }
  });
});

/* ─── ComplianceSeverityLegend ─────────────────────────────────────── */

describe('ComplianceSeverityLegend', () => {
  it('renders a trigger button', () => {
    render(<ComplianceSeverityLegend />);
    expect(
      screen.getByRole('button', { name: /about severity levels/i }),
    ).toBeInTheDocument();
  });

  it('shows the legend popover when trigger is clicked', () => {
    render(<ComplianceSeverityLegend />);
    const trigger = screen.getByRole('button', { name: /about severity levels/i });
    fireEvent.click(trigger);

    expect(screen.getByTestId('severity-legend-popover')).toBeInTheDocument();
    expect(screen.getByText('Severity Levels')).toBeInTheDocument();
    expect(screen.getByText('Advisory')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Blocking')).toBeInTheDocument();
  });

  it('hides the popover when trigger is clicked again', () => {
    render(<ComplianceSeverityLegend />);
    const trigger = screen.getByRole('button', { name: /about severity levels/i });

    fireEvent.click(trigger);
    expect(screen.getByTestId('severity-legend-popover')).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByTestId('severity-legend-popover')).not.toBeInTheDocument();
  });

  it('hides the popover on Escape key', () => {
    render(<ComplianceSeverityLegend />);
    const trigger = screen.getByRole('button', { name: /about severity levels/i });

    fireEvent.click(trigger);
    expect(screen.getByTestId('severity-legend-popover')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('severity-legend-popover')).not.toBeInTheDocument();
  });

  it('describes each severity tier in the popover', () => {
    render(<ComplianceSeverityLegend />);
    fireEvent.click(screen.getByRole('button', { name: /about severity levels/i }));

    expect(screen.getByText(/Informational notice/i)).toBeInTheDocument();
    expect(screen.getByText(/Attention recommended/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Action required/i).length).toBeGreaterThan(0);
  });

  it('has no axe violations', async () => {
    const { container } = render(<ComplianceSeverityLegend />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
