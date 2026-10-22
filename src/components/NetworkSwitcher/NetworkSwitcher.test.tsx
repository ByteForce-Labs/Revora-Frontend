import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { NetworkSwitcher } from './NetworkSwitcher';
import { RecentNetworksProvider } from '../RecentNetworksProvider/RecentNetworksProvider';

const networks = [
  { id: 'ethereum', name: 'Ethereum' },
  { id: 'polygon', name: 'Polygon' },
  { id: 'solana', name: 'Solana' },
  { id: 'arbitrum', name: 'Arbitrum' },
];

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
  localStorageMock.clear();
});

function renderWithProvider(ui: React.ReactElement) {
  return render(<RecentNetworksProvider>{ui}</RecentNetworksProvider>);
}

describe('NetworkSwitcher', () => {
  it('renders trigger with current network name', () => {
    renderWithProvider(
      <NetworkSwitcher
        networks={networks}
        currentNetworkId="polygon"
        onNetworkChange={() => {}}
      />,
    );
    expect(screen.getByText('Polygon')).toBeInTheDocument();
  });

  it('renders "Select Network" when no current network', () => {
    renderWithProvider(
      <NetworkSwitcher networks={networks} onNetworkChange={() => {}} />,
    );
    expect(screen.getByText('Select Network')).toBeInTheDocument();
  });

  it('opens panel on trigger click', () => {
    renderWithProvider(
      <NetworkSwitcher networks={networks} onNetworkChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /select network/i }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('shows all networks in panel', () => {
    renderWithProvider(
      <NetworkSwitcher networks={networks} onNetworkChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /select network/i }));
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  it('calls onNetworkChange when a network is selected', () => {
    const onChange = vi.fn();
    renderWithProvider(
      <NetworkSwitcher networks={networks} onNetworkChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /select network/i }));
    fireEvent.click(screen.getByText('Solana'));
    expect(onChange).toHaveBeenCalledWith('solana');
  });

  it('closes panel after selecting a network', () => {
    renderWithProvider(
      <NetworkSwitcher networks={networks} onNetworkChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /select network/i }));
    fireEvent.click(screen.getByText('Solana'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes panel on Escape', () => {
    renderWithProvider(
      <NetworkSwitcher networks={networks} onNetworkChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /select network/i }));
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('supports arrow key navigation in panel', () => {
    renderWithProvider(
      <NetworkSwitcher networks={networks} onNetworkChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /select network/i }));
    const listbox = screen.getByRole('listbox');
    const options = screen.getAllByRole('option');
    options[0].focus();
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(options[1]);
    fireEvent.keyDown(listbox, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(options[0]);
    fireEvent.keyDown(listbox, { key: 'End' });
    expect(document.activeElement).toBe(options[options.length - 1]);
    fireEvent.keyDown(listbox, { key: 'Home' });
    expect(document.activeElement).toBe(options[0]);
  });

  it('shows recents section after networks are used', () => {
    const onChange = vi.fn();
    renderWithProvider(
      <NetworkSwitcher networks={networks} onNetworkChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /select network/i }));
    fireEvent.click(screen.getByText('Ethereum'));
    fireEvent.click(screen.getByRole('button', { name: /select network/i }));
    fireEvent.click(screen.getByText('Polygon'));
    fireEvent.click(screen.getByRole('button', { name: /select network/i }));
    expect(screen.getByText('Recent Networks')).toBeInTheDocument();
  });

  it('renders separator between recents and all networks', () => {
    const onChange = vi.fn();
    renderWithProvider(
      <NetworkSwitcher networks={networks} onNetworkChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /select network/i }));
    fireEvent.click(screen.getByText('Ethereum'));
    fireEvent.click(screen.getByRole('button', { name: /select network/i }));
    fireEvent.click(screen.getByText('Polygon'));
    fireEvent.click(screen.getByRole('button', { name: /select network/i }));
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('closes on close button click', () => {
    renderWithProvider(
      <NetworkSwitcher networks={networks} onNetworkChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /select network/i }));
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('has accessible aria attributes', () => {
    renderWithProvider(
      <NetworkSwitcher
        networks={networks}
        currentNetworkId="solana"
        onNetworkChange={() => {}}
      />,
    );
    const trigger = screen.getByRole('button', { name: /current network: solana/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
