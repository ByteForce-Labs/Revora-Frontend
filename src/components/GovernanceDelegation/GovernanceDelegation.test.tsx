import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { GovernanceDelegation } from './GovernanceDelegation';
import '@testing-library/jest-dom';

expect.extend(toHaveNoViolations);

describe('GovernanceDelegation', () => {
  // Polyfill for dialog methods in jsdom
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
  });

  it('renders without crashing and has no accessibility violations', async () => {
    const { container } = render(<GovernanceDelegation />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
    expect(screen.getByText('Governance Delegation')).toBeInTheDocument();
  });

  it('allows searching and selecting a delegate', async () => {
    render(<GovernanceDelegation />);
    
    // Type in search
    const searchInput = screen.getByPlaceholderText('Search by name or address...');
    fireEvent.change(searchInput, { target: { value: 'Alice' } });
    
    // Select Alice
    const result = screen.getByText('Alice Voter');
    fireEvent.click(result);
    
    // Check if Alice's profile is loaded
    expect(screen.getByTestId('delegate-card-del-1')).toBeInTheDocument();
    expect(screen.getByText('1,500,000 VP')).toBeInTheDocument();
  });

  it('allows delegating power and revoking it', async () => {
    render(<GovernanceDelegation />);
    
    // Select Bob
    const searchInput = screen.getByPlaceholderText('Search by name or address...');
    fireEvent.change(searchInput, { target: { value: 'Bob' } });
    fireEvent.click(screen.getByText('Bob Stake'));
    
    // Click Delegate Power
    const delegateButton = screen.getByRole('button', { name: /Delegate to Bob Stake/i });
    fireEvent.click(delegateButton);
    
    // Dialog should open
    expect(screen.getByText('Confirm Delegation')).toBeInTheDocument();
    
    // Confirm delegation
    const confirmButton = screen.getByRole('button', { name: 'Confirm Delegate' });
    fireEvent.click(confirmButton);
    
    // Wait for state update
    await waitFor(() => {
      // Button should now be Revoke Delegation
      expect(screen.getByRole('button', { name: /Revoke delegation from Bob Stake/i })).toBeInTheDocument();
    });

    // Now revoke
    const revokeButton = screen.getByRole('button', { name: /Revoke delegation from Bob Stake/i });
    fireEvent.click(revokeButton);

    // Dialog should open
    expect(screen.getByRole('heading', { name: 'Revoke Delegation' })).toBeInTheDocument();

    // Confirm revoke
    const confirmRevokeButton = screen.getByRole('button', { name: 'Revoke' });
    fireEvent.click(confirmRevokeButton);

    await waitFor(() => {
      // Profile state should be empty
      expect(screen.getByText('Select a delegate to view their profile.')).toBeInTheDocument();
    });
  });
});
