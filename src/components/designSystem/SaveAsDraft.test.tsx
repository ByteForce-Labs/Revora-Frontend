import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { SaveAsDraft } from './SaveAsDraft';

describe('SaveAsDraft Component', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders initial state correctly', () => {
    render(<SaveAsDraft onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Save progress as draft/i })).toBeInTheDocument();
    expect(screen.queryByText(/Last saved at/i)).not.toBeInTheDocument();
  });

  it('shows saving state and then success message on successful save', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn().mockResolvedValueOnce(undefined);
    render(<SaveAsDraft onSave={onSave} />);
    
    const saveButton = screen.getByRole('button', { name: /Save progress as draft/i });
    fireEvent.click(saveButton);
    
    expect(onSave).toHaveBeenCalled();
    expect(screen.getByText(/Saving.../i)).toBeInTheDocument();
    
    // Fast forward enough for promise resolution and state updates
    await vi.advanceTimersByTimeAsync(0);
    
    expect(screen.getByText(/Draft saved/i)).toBeInTheDocument();
    expect(screen.queryByText(/Saving.../i)).not.toBeInTheDocument();
    
    // Fast-forward to clear success message
    await vi.advanceTimersByTimeAsync(3000);
    
    expect(screen.queryByText(/Draft saved/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Last saved at/i)).toBeInTheDocument();
  });

  it('shows error state and retry button on failed save', async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error('Network error'));
    render(<SaveAsDraft onSave={onSave} />);
    
    fireEvent.click(screen.getByRole('button', { name: /Save progress as draft/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
    
    const retryButton = screen.getByRole('button', { name: /Retry saving draft/i });
    expect(retryButton).toBeInTheDocument();
    
    // Click retry
    onSave.mockResolvedValueOnce(undefined);
    fireEvent.click(retryButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Draft saved/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Network error/i)).not.toBeInTheDocument();
  });

  it('manages focus on error for accessibility', async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error('Focus test'));
    render(<SaveAsDraft onSave={onSave} />);
    
    fireEvent.click(screen.getByRole('button', { name: /Save progress as draft/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Focus test/i)).toBeInTheDocument();
    });
    
    // The error container should be focused
    const errorContainer = screen.getByText(/Focus test/i).closest('.status-message.error');
    expect(errorContainer).toHaveFocus();
  });
});
