import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AccessibleChart } from './AccessibleChart';

describe('AccessibleChart', () => {
  const mockData = [
    { label: 'A', value: 10, patternId: 'pattern-stripe' as const },
    { label: 'B', value: 20, patternId: 'pattern-dots' as const },
  ];

  it('renders the chart title', () => {
    render(<AccessibleChart title="Test Chart" data={mockData} />);
    expect(screen.getByText('Test Chart')).toBeInTheDocument();
  });

  it('renders the tabular fallback', () => {
    render(<AccessibleChart title="Test Chart" data={mockData} />);
    const table = screen.getByRole('table', { name: 'Test Chart' });
    expect(table).toBeInTheDocument();
    
    // Check table content (labels also appear in the chart, so scope to the table)
    const cells = within(table);
    expect(cells.getByText('A')).toBeInTheDocument();
    expect(cells.getByText('10')).toBeInTheDocument();
    expect(cells.getByText('B')).toBeInTheDocument();
    expect(cells.getByText('20')).toBeInTheDocument();
  });

  it('handles empty data', () => {
    render(<AccessibleChart title="Empty Chart" data={[]} />);
    expect(screen.getByRole('table', { name: 'Empty Chart' })).toBeInTheDocument();
  });
});
