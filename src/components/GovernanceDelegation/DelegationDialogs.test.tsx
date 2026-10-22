import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DelegationConfirmDialog, RevokeConfirmDialog } from './DelegationDialogs';

/**
 * Regression coverage for the failure / empty path in `DelegationDialogs.tsx`:
 * `if (!isOpen) return null;` at the top of the internal `Dialog`. That early
 * return is easy to lose during a refactor and, if it goes, a closed dialog
 * renders its content (and its confirm action) into the page. The suite below
 * pins the closed path, the open path and its callbacks, and the native
 * `<dialog>` wiring.
 */

describe('DelegationConfirmDialog / RevokeConfirmDialog', () => {
  // jsdom does not implement the <dialog> modal methods; the component calls
  // them from a useEffect when `isOpen` changes.
  // The stubs mirror the native behaviour of toggling the `open` attribute so
  // the dialog contents stay in the accessibility tree.
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing while closed', () => {
    const { container } = render(
      <DelegationConfirmDialog
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        delegateName="Alice Voter"
      />
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Confirm Delegation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm Delegate' })).not.toBeInTheDocument();
  });

  it('renders the confirmation copy with the delegate name when open', () => {
    render(
      <DelegationConfirmDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        delegateName="Alice Voter"
      />
    );

    expect(screen.getByText('Confirm Delegation')).toBeInTheDocument();
    expect(screen.getByText(/delegate your voting power to Alice Voter/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm Delegate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('invokes onConfirm exactly once when the confirm action is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <DelegationConfirmDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={onConfirm}
        delegateName="Alice Voter"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delegate' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('invokes onClose and never onConfirm when cancel is clicked', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <DelegationConfirmDialog
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        delegateName="Alice Voter"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('forwards the native dialog close event to onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <DelegationConfirmDialog
        isOpen
        onClose={onClose}
        onConfirm={vi.fn()}
        delegateName="Alice Voter"
      />
    );

    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();

    fireEvent(dialog as Element, new Event('close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls showModal when it flips from closed to open and not before', () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    const props = { onClose: vi.fn(), onConfirm: vi.fn(), delegateName: 'Alice Voter' };

    const { rerender } = render(<DelegationConfirmDialog isOpen={false} {...props} />);
    expect(showModal).not.toHaveBeenCalled();

    rerender(<DelegationConfirmDialog isOpen {...props} />);
    expect(showModal).toHaveBeenCalledTimes(1);
  });

  it('wires the revoke confirmation copy and actions', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<RevokeConfirmDialog isOpen onClose={onClose} onConfirm={onConfirm} />);

    expect(screen.getByText('Revoke Delegation')).toBeInTheDocument();
    expect(screen.getByText(/regain your voting power immediately/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders nothing for a closed revoke dialog', () => {
    const { container } = render(
      <RevokeConfirmDialog isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Revoke Delegation')).not.toBeInTheDocument();
  });
});
