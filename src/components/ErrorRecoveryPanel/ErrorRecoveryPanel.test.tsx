import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorRecoveryPanel } from './ErrorRecoveryPanel';
import { useErrorSnapshots, resetGlobalState } from '../../hooks/useErrorSnapshots';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Helper component to test with hook
const TestWrapper = () => {
  const { addSnapshot } = useErrorSnapshots();
  const [isOpen, setIsOpen] = React.useState(true);

  React.useEffect(() => {
    addSnapshot({
      group: 'Forms',
      title: 'Failed to save Draft A',
      onRetry: vi.fn(),
      onDiscard: vi.fn(),
    });
    addSnapshot({
      group: 'Forms',
      title: 'Failed to save Draft B',
    });
  }, [addSnapshot]);

  return <ErrorRecoveryPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />;
};

describe('ErrorRecoveryPanel', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('renders nothing when closed', () => {
    render(<ErrorRecoveryPanel isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId('error-panel')).toBeNull();
  });

  it('renders empty state when no snapshots', () => {
    render(<ErrorRecoveryPanel isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('error-panel-empty')).toBeInTheDocument();
  });

  it('renders grouped snapshots', () => {
    render(<TestWrapper />);
    expect(screen.getByText('Recovery Snapshots')).toBeInTheDocument();
    expect(screen.getByText('Forms')).toBeInTheDocument();
    expect(screen.getByText('Failed to save Draft A')).toBeInTheDocument();
    expect(screen.getByText('Failed to save Draft B')).toBeInTheDocument();
  });

  it('calls clearAll when Clear All is clicked', () => {
    render(<TestWrapper />);
    const clearAllBtn = screen.getByText('Clear All');
    fireEvent.click(clearAllBtn);
    expect(screen.getByTestId('error-panel-empty')).toBeInTheDocument();
  });

  it('removes item when discard is clicked', () => {
    render(<TestWrapper />);
    fireEvent.click(screen.getByRole('button', { name: 'Discard Failed to save Draft A' }));
    expect(screen.queryByText('Failed to save Draft A')).toBeNull();
    expect(screen.getByText('Failed to save Draft B')).toBeInTheDocument();
  });
});
