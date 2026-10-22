import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { axe } from 'jest-axe';
import ActivityDateGroup from './ActivityDateGroup';

describe('ActivityDateGroup', () => {
  it('renders date label correctly with proper ARIA attributes', () => {
    const testDate = 'August 29, 2026';
    render(<ActivityDateGroup date={testDate} />);

    const separator = screen.getByRole('separator');
    expect(separator).toBeInTheDocument();
    expect(separator).toHaveAttribute('aria-label', `Activities on ${testDate}`);
    expect(separator).toHaveClass('activity-date-group');

    const dateLabel = screen.getByText(testDate);
    expect(dateLabel).toBeInTheDocument();
    expect(dateLabel).toHaveClass('date-label', 'glass-card');
  });

  it('renders representative invalid, empty, or special date inputs gracefully', () => {
    const invalidInputs = ['', '   ', 'Invalid-Date-String', '2026-13-45'];

    invalidInputs.forEach((dateInput) => {
      const { unmount } = render(<ActivityDateGroup date={dateInput} />);
      const separator = screen.getByRole('separator');
      expect(separator).toBeInTheDocument();
      expect(separator).toHaveAttribute('aria-label', `Activities on ${dateInput}`);
      expect(separator.querySelector('.date-label')?.textContent).toBe(dateInput);
      unmount();
    });
  });

  it('meets accessibility standards without axe violations', async () => {
    // ActivityDateGroup renders an <li>, so for valid HTML structure in tests, wrap in a <ul> or test directly if axe allows
    const { container } = render(
      <div>
        <ActivityDateGroup date="Today" />
      </div>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
