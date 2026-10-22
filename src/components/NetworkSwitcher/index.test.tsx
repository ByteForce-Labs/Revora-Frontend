import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as barrel from './index';
import {
  NetworkSwitcher,
  NetworkSwitcherPanel,
  ChainMismatchModal,
  NetworkSwitcherBadge,
  NetworkSwitcherContext,
  NetworkSwitcherProvider,
  useNetworkSwitcher,
} from './index';
import { RecentNetworksProvider } from '../RecentNetworksProvider/RecentNetworksProvider';
import { ChainMismatchModal as ChainMismatchModalDirect } from './ChainMismatchModal';
import { NetworkSwitcherContext as NetworkSwitcherContextDirect } from './NetworkSwitcherContext';
import { useNetworkSwitcher as useNetworkSwitcherDirect } from '../../hooks/useNetworkSwitcher';
import type { Network, ChainMismatchModalProps, NetworkSwitcherBadgeProps } from './index';

describe('NetworkSwitcher barrel (index.ts) — public contract', () => {
  it('re-exports the full runtime surface of the module', () => {
    expect(barrel.NetworkSwitcher).toBe(NetworkSwitcher);
    expect(typeof barrel.NetworkSwitcher).toBe('function');
    expect(typeof barrel.NetworkSwitcherPanel).toBe('function');
    expect(typeof barrel.ChainMismatchModal).toBe('function');
    expect(typeof barrel.NetworkSwitcherBadge).toBe('function');
    expect(typeof barrel.NetworkSwitcherProvider).toBe('function');
  });

  it('exports the same NetworkSwitcherContext identity as the source module', () => {
    expect(barrel.NetworkSwitcherContext).toBe(NetworkSwitcherContextDirect);
  });

  it('exports the same useNetworkSwitcher hook identity as the hook module', () => {
    expect(barrel.useNetworkSwitcher).toBe(useNetworkSwitcherDirect);
  });

  it('re-exported ChainMismatchModal is the same component as the direct import', () => {
    expect(barrel.ChainMismatchModal).toBe(ChainMismatchModalDirect);
  });

  it('keeps type-only exports assignable to their expected prop shapes (compile-time contract)', () => {
    const network: Network = { id: 'ethereum', name: 'Ethereum' };
    expect(network.id).toBe('ethereum');

    const modalProps: ChainMismatchModalProps = { isOpen: true, className: 'x' };
    expect(modalProps.isOpen).toBe(true);

    const badgeProps: NetworkSwitcherBadgeProps = { className: 'y' };
    expect(badgeProps.className).toBe('y');
  });

  it('does not leak internal-only symbols through the barrel', () => {
    expect((barrel as Record<string, unknown>)['getChainMetadata']).toBeUndefined();
    expect((barrel as Record<string, unknown>)['NetworkSwitcherContextValue']).toBeUndefined();
  });
});

describe('NetworkSwitcher barrel — rendered behavior through the public surface', () => {
  const networks = [
    { id: 'ethereum', name: 'Ethereum' },
    { id: 'polygon', name: 'Polygon' },
    { id: 'solana', name: 'Solana' },
  ];

  beforeEach(() => {
    const store: Record<string, string> = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
        clear: () => { Object.keys(store).forEach((key) => delete store[key]); },
      },
      writable: true,
    });
  });

  it('renders the exported NetworkSwitcher with current network name', () => {
    render(
      <RecentNetworksProvider>
        <NetworkSwitcher
          networks={networks}
          currentNetworkId="polygon"
          onNetworkChange={() => {}}
        />
      </RecentNetworksProvider>,
    );
    expect(screen.getByText('Polygon')).toBeInTheDocument();
  });

  it('falls back to "Select Network" for an unknown currentNetworkId (invalid input)', () => {
    render(
      <RecentNetworksProvider>
        <NetworkSwitcher
          networks={networks}
          currentNetworkId="not-a-network"
          onNetworkChange={() => {}}
        />
      </RecentNetworksProvider>,
    );
    expect(screen.getByText('Select Network')).toBeInTheDocument();
  });

  it('falls back to "Select Network" when currentNetworkId is omitted', () => {
    render(
      <RecentNetworksProvider>
        <NetworkSwitcher networks={networks} onNetworkChange={() => {}} />
      </RecentNetworksProvider>,
    );
    expect(screen.getByText('Select Network')).toBeInTheDocument();
  });

  it('renders the empty state when the networks list is empty (boundary)', () => {
    render(
      <RecentNetworksProvider>
        <NetworkSwitcher networks={[]} onNetworkChange={() => {}} />
      </RecentNetworksProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /select network/i }));
    expect(screen.getByText('No networks available')).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('renders the exported NetworkSwitcherPanel and reports selection to the consumer', () => {
    const onNetworkChange = vi.fn();
    render(
      <RecentNetworksProvider>
        <NetworkSwitcherPanel
          networks={networks}
          onNetworkChange={onNetworkChange}
          onClose={() => {}}
        />
      </RecentNetworksProvider>,
    );
    expect(screen.getByRole('listbox', { name: /select a network/i })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Solana'));
    expect(onNetworkChange).toHaveBeenCalledWith('solana');
  });

  it('renders the exported NetworkSwitcherBadge in the healthy state', () => {
    render(
      <NetworkSwitcherProvider initialConnectedChainId={137} initialAppChainId={137}>
        <NetworkSwitcherBadge />
      </NetworkSwitcherProvider>,
    );
    expect(screen.getByTestId('network-switcher-badge')).toBeInTheDocument();
    expect(screen.getByText('Polygon')).toBeInTheDocument();
  });
});

describe('NetworkSwitcher barrel — provider state transitions', () => {
  function Probe({ onState }: { onState: (s: ReturnType<typeof useNetworkSwitcher>) => void }) {
    const state = useNetworkSwitcher();
    onState(state);
    return null;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in the default state (Polygon app chain, mismatched Ethereum wallet, modal closed)', () => {
    let snapshot: ReturnType<typeof useNetworkSwitcher> | undefined;
    render(
      <NetworkSwitcherProvider initialConnectedChainId={1}>
        <Probe onState={(s) => { snapshot = s; }} />
      </NetworkSwitcherProvider>,
    );

    expect(snapshot).toBeDefined();
    expect(snapshot!.appChainId).toBe(137);
    expect(snapshot!.connectedChainId).toBe(1);
    expect(snapshot!.isMismatch).toBe(true);
    expect(snapshot!.isModalOpen).toBe(false);
    expect(snapshot!.isSwitching).toBe(false);
    expect(snapshot!.appChain.name).toBe('Polygon PoS');
  });

  it('toggles the mismatch modal open → closed via openModal/closeModal', () => {
    let snapshot: ReturnType<typeof useNetworkSwitcher> | undefined;
    render(
      <NetworkSwitcherProvider>
        <Probe onState={(s) => { snapshot = s; }} />
      </NetworkSwitcherProvider>,
    );

    expect(snapshot!.isModalOpen).toBe(false);
    act(() => { snapshot!.openModal(); });
    expect(snapshot!.isModalOpen).toBe(true);
    act(() => { snapshot!.closeModal(); });
    expect(snapshot!.isModalOpen).toBe(false);
  });

  it('clears isMismatch when the wallet disconnects (guard against false alerts)', () => {
    let snapshot: ReturnType<typeof useNetworkSwitcher> | undefined;
    render(
      <NetworkSwitcherProvider initialIsWalletConnected={false}>
        <Probe onState={(s) => { snapshot = s; }} />
      </NetworkSwitcherProvider>,
    );

    expect(snapshot!.connectedChainId).not.toBe(snapshot!.appChainId);
    expect(snapshot!.isMismatch).toBe(false);
  });

  it('accepts string chain IDs and resolves mismatch once both chains align', () => {
    let snapshot: ReturnType<typeof useNetworkSwitcher> | undefined;
    render(
      <NetworkSwitcherProvider
        initialConnectedChainId="0x89"
        initialAppChainId="137"
      >
        <Probe onState={(s) => { snapshot = s; }} />
      </NetworkSwitcherProvider>,
    );

    expect(snapshot!.connectedChainId).toBe(137);
    expect(snapshot!.appChainId).toBe(137);
    expect(snapshot!.isMismatch).toBe(false);
  });

  it('switches wallet chain: pending flag set during request, then chains align and modal closes', async () => {
    let resolveSwitch: () => void = () => {};
    const onWalletSwitchRequested = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveSwitch = resolve; }),
    );

    let snapshot: ReturnType<typeof useNetworkSwitcher> | undefined;
    render(
      <NetworkSwitcherProvider
        onWalletSwitchRequested={onWalletSwitchRequested}
      >
        <Probe onState={(s) => { snapshot = s; }} />
      </NetworkSwitcherProvider>,
    );

    snapshot!.switchWalletChain();
    await Promise.resolve();
    expect(onWalletSwitchRequested).toHaveBeenCalledWith(137);
    expect(snapshot!.isSwitching).toBe(true);

    resolveSwitch();
    await vi.waitFor(() => {
      expect(snapshot!.connectedChainId).toBe(137);
      expect(snapshot!.isModalOpen).toBe(false);
      expect(snapshot!.isSwitching).toBe(false);
    });
  });

  it('retains modal state and rejects switch when the wallet switch request fails (failure path)', async () => {
    const onWalletSwitchRequested = vi.fn().mockRejectedValue(new Error('wallet denied'));

    let snapshot: ReturnType<typeof useNetworkSwitcher> | undefined;
    render(
      <NetworkSwitcherProvider onWalletSwitchRequested={onWalletSwitchRequested}>
        <Probe onState={(s) => { snapshot = s; }} />
      </NetworkSwitcherProvider>,
    );

    snapshot!.openModal();
    await expect(snapshot!.switchWalletChain()).resolves.toBeUndefined();
    await vi.waitFor(() => {
      expect(snapshot!.isSwitching).toBe(false);
      expect(snapshot!.connectedChainId).toBe(1);
    });
    expect(snapshot!.isModalOpen).toBe(true);
  });

  it('ignores a second switch request while one is pending (isSwitching guard)', async () => {
    let resolveSwitch!: () => void;
    const onWalletSwitchRequested = vi.fn(
      () => new Promise<void>((resolve) => { resolveSwitch = resolve; }),
    );

    let snapshot: ReturnType<typeof useNetworkSwitcher> | undefined;
    render(
      <NetworkSwitcherProvider onWalletSwitchRequested={onWalletSwitchRequested}>
        <Probe onState={(s) => { snapshot = s; }} />
      </NetworkSwitcherProvider>,
    );

    // Start a switch and hold it pending.
    await act(async () => {
      void snapshot!.switchWalletChain();
    });
    expect(onWalletSwitchRequested).toHaveBeenCalledTimes(1);
    expect(snapshot!.isSwitching).toBe(true);

    // A second request must hit the isSwitching guard.
    await act(async () => {
      void snapshot!.switchWalletChain();
    });
    expect(onWalletSwitchRequested).toHaveBeenCalledTimes(1);
    expect(snapshot!.isSwitching).toBe(true);

    // Resolving the first request completes the switch.
    await act(async () => {
      resolveSwitch();
    });
    expect(snapshot!.isSwitching).toBe(false);
    expect(snapshot!.connectedChainId).toBe(137);
    expect(snapshot!.isModalOpen).toBe(false);
  });

  it('changeAppChain aligns app chain with the wallet chain, closes the modal, and notifies consumers', () => {
    const onAppChainChanged = vi.fn();
    let snapshot: ReturnType<typeof useNetworkSwitcher> | undefined;
    render(
      <NetworkSwitcherProvider onAppChainChanged={onAppChainChanged}>
        <Probe onState={(s) => { snapshot = s; }} />
      </NetworkSwitcherProvider>,
    );

    act(() => { snapshot!.changeAppChain(); });
    expect(snapshot!.appChainId).toBe(1);
    expect(snapshot!.isMismatch).toBe(false);
    expect(snapshot!.isModalOpen).toBe(false);
    expect(onAppChainChanged).toHaveBeenCalledWith(1);
  });

  it('changeAppChain(137) with no explicit argument still aligns to connected wallet chain', () => {
    let snapshot: ReturnType<typeof useNetworkSwitcher> | undefined;
    render(
      <NetworkSwitcherProvider initialConnectedChainId={42161}>
        <Probe onState={(s) => { snapshot = s; }} />
      </NetworkSwitcherProvider>,
    );

    act(() => { snapshot!.changeAppChain(); });
    expect(snapshot!.appChainId).toBe(42161);
  });

  it('routes setAppChainId through parseChainId and notifies onAppChainChanged', () => {
    const onAppChainChanged = vi.fn();
    let snapshot: ReturnType<typeof useNetworkSwitcher> | undefined;
    render(
      <NetworkSwitcherProvider onAppChainChanged={onAppChainChanged}>
        <Probe onState={(s) => { snapshot = s; }} />
      </NetworkSwitcherProvider>,
    );

    snapshot!.setAppChainId('0x89');
    expect(snapshot!.appChainId).toBe(137);
    expect(snapshot!.appChain.name).toBe('Polygon PoS');
    expect(onAppChainChanged).toHaveBeenCalledWith(137);
  });

  it('uses the generic wallet capability profile for unrecognized wallet names (invalid input)', () => {
    let snapshot: ReturnType<typeof useNetworkSwitcher> | undefined;
    render(
      <NetworkSwitcherProvider initialWalletName="Totally Unknown Wallet">
        <Probe onState={(s) => { snapshot = s; }} />
      </NetworkSwitcherProvider>,
    );

    expect(snapshot!.walletCapability.type).toBe('generic');
    expect(snapshot!.walletCapability.name).toBe('Totally Unknown Wallet');
    expect(snapshot!.walletCapability.supportsAutoSwitch).toBe(true);
  });

  it('resolves recognized wallet names to their capability profile', () => {
    let snapshot: ReturnType<typeof useNetworkSwitcher> | undefined;
    render(
      <NetworkSwitcherProvider initialWalletName="WalletConnect">
        <Probe onState={(s) => { snapshot = s; }} />
      </NetworkSwitcherProvider>,
    );

    expect(snapshot!.walletCapability.type).toBe('walletconnect');
    expect(snapshot!.walletCapability.supportsAutoSwitch).toBe(false);
  });

  it('falls back to the Polygon app chain metadata for an unknown chain ID (invalid input)', () => {
    let snapshot: ReturnType<typeof useNetworkSwitcher> | undefined;
    render(
      <NetworkSwitcherProvider initialAppChainId={999999}>
        <Probe onState={(s) => { snapshot = s; }} />
      </NetworkSwitcherProvider>,
    );

    expect(snapshot!.appChainId).toBe(999999);
    expect(snapshot!.appChain.name).toBe('Unknown Network (Chain ID: 999999)');
    expect(snapshot!.appChain.color).toBe('#94a3b8');
  });
});

describe('NetworkSwitcher barrel — hook and modal error/boundary behavior', () => {
  it('renders the exported ChainMismatchModal as an accessible dialog with focus trapped to it', async () => {
    render(
      <NetworkSwitcherProvider initialIsModalOpen initialConnectedChainId={1}>
        <ChainMismatchModal />
      </NetworkSwitcherProvider>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Network Mismatch Detected')).toBeInTheDocument();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes the exported ChainMismatchModal via Escape through the external onClose handler', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <NetworkSwitcherProvider initialIsModalOpen>
        <ChainMismatchModal onClose={onClose} />
      </NetworkSwitcherProvider>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dismisses the modal on Escape via the context close even while the chain mismatch persists (boundary)', async () => {
    const user = userEvent.setup();
    render(
      <NetworkSwitcherProvider initialIsModalOpen initialConnectedChainId={1}>
        <ChainMismatchModal />
      </NetworkSwitcherProvider>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    // closeModal() records the dismissed chain (#982), so the dialog stays
    // closed while the wallet remains on the same mismatched chain.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('throws a deterministic error when useNetworkSwitcher is used outside the provider (failure path)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Orphan() {
      useNetworkSwitcher();
      return null;
    }
    try {
      expect(() => render(<Orphan />)).toThrowError(
        'useNetworkSwitcher must be used within a <NetworkSwitcherProvider>',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
