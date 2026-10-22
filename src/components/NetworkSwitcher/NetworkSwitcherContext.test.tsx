import React, { useContext } from "react";
import { render, screen, act, renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	NetworkSwitcherContext,
	NetworkSwitcherProvider,
} from "./NetworkSwitcherContext";
import type {
	NetworkSwitcherContextValue,
	NetworkSwitcherProviderProps,
} from "./NetworkSwitcherContext";
import { DEFAULT_APP_CHAIN_ID, getChainMetadata } from "../../constants/chains";
import { getWalletCapability } from "../../constants/walletCapabilities";

describe("NetworkSwitcherContext", () => {
	describe("Context default contract", () => {
		it("defaults to null when consumed outside NetworkSwitcherProvider via useContext", () => {
			let capturedValue: NetworkSwitcherContextValue | null =
				"sentinel" as unknown as NetworkSwitcherContextValue;
			const Consumer = () => {
				capturedValue = useContext(NetworkSwitcherContext);
				return null;
			};

			render(<Consumer />);
			expect(capturedValue).toBeNull();
		});

		it("defaults to null when consumed outside NetworkSwitcherProvider via NetworkSwitcherContext.Consumer", () => {
			let capturedValue: NetworkSwitcherContextValue | null =
				"sentinel" as unknown as NetworkSwitcherContextValue;

			render(
				<NetworkSwitcherContext.Consumer>
					{(value) => {
						capturedValue = value;
						return <span data-testid="consumer-rendered">done</span>;
					}}
				</NetworkSwitcherContext.Consumer>,
			);

			expect(screen.getByTestId("consumer-rendered")).toBeInTheDocument();
			expect(capturedValue).toBeNull();
		});

		it("provides a valid NetworkSwitcherContextValue when rendered within NetworkSwitcherProvider", () => {
			let capturedValue: NetworkSwitcherContextValue | null = null;
			const Consumer = () => {
				capturedValue = useContext(NetworkSwitcherContext);
				return null;
			};

			render(
				<NetworkSwitcherProvider>
					<Consumer />
				</NetworkSwitcherProvider>,
			);

			expect(capturedValue).not.toBeNull();
			expect(typeof capturedValue?.switchWalletChain).toBe("function");
			expect(typeof capturedValue?.changeAppChain).toBe("function");
			expect(typeof capturedValue?.setConnectedChainId).toBe("function");
			expect(typeof capturedValue?.setAppChainId).toBe("function");
			expect(typeof capturedValue?.setWalletName).toBe("function");
			expect(typeof capturedValue?.setIsWalletConnected).toBe("function");
			expect(typeof capturedValue?.openModal).toBe("function");
			expect(typeof capturedValue?.closeModal).toBe("function");
		});
	});

	describe("NetworkSwitcherProvider — Default initialization state", () => {
		it("initializes with default values for all public context properties", () => {
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider>{children}</NetworkSwitcherProvider>
				),
			});

			const ctx = result.current!;
			expect(ctx.connectedChainId).toBe(1);
			expect(ctx.appChainId).toBe(DEFAULT_APP_CHAIN_ID);
			expect(ctx.appChainId).toBe(137);
			expect(ctx.walletName).toBe("MetaMask");
			// Without an explicit connected chain the wallet defaults to disconnected (#982)
			expect(ctx.isWalletConnected).toBe(false);
			expect(ctx.isModalOpen).toBe(false);
			expect(ctx.isSwitching).toBe(false);
			expect(ctx.isMismatch).toBe(false); // no mismatch until a wallet reports a chain

			// Derived chain metadata
			expect(ctx.connectedChain).toEqual(getChainMetadata(1));
			expect(ctx.connectedChain.name).toBe("Ethereum Mainnet");
			expect(ctx.appChain).toEqual(getChainMetadata(137));
			expect(ctx.appChain.name).toBe("Polygon PoS");

			// Derived wallet capability
			expect(ctx.walletCapability).toEqual(getWalletCapability("MetaMask"));
			expect(ctx.walletCapability.supportsAutoSwitch).toBe(true);
		});
	});

	describe("NetworkSwitcherProviderProps — Initialization overrides", () => {
		it("accepts numeric, decimal string, and hex string initialConnectedChainId", () => {
			const { result: numericRes } = renderHook(
				() => useContext(NetworkSwitcherContext),
				{
					wrapper: ({ children }) => (
						<NetworkSwitcherProvider initialConnectedChainId={42161}>
							{children}
						</NetworkSwitcherProvider>
					),
				},
			);
			expect(numericRes.current?.connectedChainId).toBe(42161);
			expect(numericRes.current?.connectedChain.name).toBe("Arbitrum One");

			const { result: hexRes } = renderHook(
				() => useContext(NetworkSwitcherContext),
				{
					wrapper: ({ children }) => (
						<NetworkSwitcherProvider initialConnectedChainId="0xa4b1">
							{children}
						</NetworkSwitcherProvider>
					),
				},
			);
			expect(hexRes.current?.connectedChainId).toBe(42161);

			const { result: decStrRes } = renderHook(
				() => useContext(NetworkSwitcherContext),
				{
					wrapper: ({ children }) => (
						<NetworkSwitcherProvider initialConnectedChainId="10">
							{children}
						</NetworkSwitcherProvider>
					),
				},
			);
			expect(decStrRes.current?.connectedChainId).toBe(10);
			expect(decStrRes.current?.connectedChain.name).toBe("OP Mainnet");
		});

		it("accepts initialAppChainId and computes isMismatch as false when initial chains match", () => {
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider
						initialConnectedChainId={137}
						initialAppChainId={137}
					>
						{children}
					</NetworkSwitcherProvider>
				),
			});

			expect(result.current?.connectedChainId).toBe(137);
			expect(result.current?.appChainId).toBe(137);
			expect(result.current?.isMismatch).toBe(false);
		});

		it("respects initialWalletName and loads corresponding capability", () => {
			const { result: wcResult } = renderHook(
				() => useContext(NetworkSwitcherContext),
				{
					wrapper: ({ children }) => (
						<NetworkSwitcherProvider initialWalletName="WalletConnect">
							{children}
						</NetworkSwitcherProvider>
					),
				},
			);
			expect(wcResult.current?.walletName).toBe("WalletConnect");
			expect(wcResult.current?.walletCapability.type).toBe("walletconnect");
			expect(wcResult.current?.walletCapability.supportsAutoSwitch).toBe(false);

			const { result: ledgerResult } = renderHook(
				() => useContext(NetworkSwitcherContext),
				{
					wrapper: ({ children }) => (
						<NetworkSwitcherProvider initialWalletName="Ledger Hardware">
							{children}
						</NetworkSwitcherProvider>
					),
				},
			);
			expect(ledgerResult.current?.walletCapability.type).toBe("ledger");
			expect(ledgerResult.current?.walletCapability.supportsAutoSwitch).toBe(
				false,
			);
		});

		it("respects initialIsWalletConnected: false and suppresses mismatch", () => {
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider
						initialConnectedChainId={1}
						initialAppChainId={137}
						initialIsWalletConnected={false}
					>
						{children}
					</NetworkSwitcherProvider>
				),
			});

			expect(result.current?.isWalletConnected).toBe(false);
			expect(result.current?.isMismatch).toBe(false);
		});

		it("respects initialIsModalOpen: true", () => {
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider initialIsModalOpen={true}>
						{children}
					</NetworkSwitcherProvider>
				),
			});

			expect(result.current?.isModalOpen).toBe(true);
		});
	});

	describe("Valid network changes and primary state transitions", () => {
		it("updates connected chain and resolves mismatch when connected chain matches app chain", () => {
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider
						initialConnectedChainId={1}
						initialAppChainId={137}
					>
						{children}
					</NetworkSwitcherProvider>
				),
			});

			expect(result.current?.isMismatch).toBe(true);

			act(() => {
				result.current?.setConnectedChainId(137);
			});

			expect(result.current?.connectedChainId).toBe(137);
			expect(result.current?.connectedChain.name).toBe("Polygon PoS");
			expect(result.current?.isMismatch).toBe(false);
		});

		it("updates connected chain using hex chain ID format (both lower and upper case 0x/0X)", () => {
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider
						initialConnectedChainId={1}
						initialAppChainId={137}
					>
						{children}
					</NetworkSwitcherProvider>
				),
			});

			act(() => {
				result.current?.setConnectedChainId("0xa"); // OP Mainnet (10)
			});
			expect(result.current?.connectedChainId).toBe(10);
			expect(result.current?.connectedChain.name).toBe("OP Mainnet");

			act(() => {
				result.current?.setConnectedChainId("0X2105"); // Base Mainnet (8453)
			});
			expect(result.current?.connectedChainId).toBe(8453);
			expect(result.current?.connectedChain.name).toBe("Base Mainnet");
		});

		it("updates app chain and notifies onAppChainChanged listener", () => {
			const onAppChainChanged = vi.fn();
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider
						initialConnectedChainId={1}
						initialAppChainId={137}
						onAppChainChanged={onAppChainChanged}
					>
						{children}
					</NetworkSwitcherProvider>
				),
			});

			act(() => {
				result.current?.setAppChainId(1);
			});

			expect(result.current?.appChainId).toBe(1);
			expect(result.current?.appChain.name).toBe("Ethereum Mainnet");
			expect(result.current?.isMismatch).toBe(false);
			expect(onAppChainChanged).toHaveBeenCalledWith(1);
		});

		it("setAppChainId parses hex string and works cleanly when onAppChainChanged is omitted", () => {
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider
						initialConnectedChainId={1}
						initialAppChainId={137}
					>
						{children}
					</NetworkSwitcherProvider>
				),
			});

			expect(() => {
				act(() => {
					result.current?.setAppChainId("0x1");
				});
			}).not.toThrow();

			expect(result.current?.appChainId).toBe(1);
			expect(result.current?.isMismatch).toBe(false);
		});

		it("changeAppChain with explicit targetChainId updates app chain, notifies listener, and closes modal", () => {
			const onAppChainChanged = vi.fn();
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider
						initialConnectedChainId={1}
						initialAppChainId={137}
						initialIsModalOpen={true}
						onAppChainChanged={onAppChainChanged}
					>
						{children}
					</NetworkSwitcherProvider>
				),
			});

			expect(result.current?.isModalOpen).toBe(true);

			act(() => {
				result.current?.changeAppChain(42161);
			});

			expect(result.current?.appChainId).toBe(42161);
			expect(result.current?.appChain.name).toBe("Arbitrum One");
			expect(result.current?.isModalOpen).toBe(false);
			expect(onAppChainChanged).toHaveBeenCalledWith(42161);
		});

		it("changeAppChain without targetChainId defaults to connectedChainId, resolves mismatch, and closes modal", () => {
			const onAppChainChanged = vi.fn();
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider
						initialConnectedChainId={1}
						initialAppChainId={137}
						initialIsModalOpen={true}
						onAppChainChanged={onAppChainChanged}
					>
						{children}
					</NetworkSwitcherProvider>
				),
			});

			expect(result.current?.isMismatch).toBe(true);

			act(() => {
				result.current?.changeAppChain();
			});

			expect(result.current?.appChainId).toBe(1);
			expect(result.current?.isMismatch).toBe(false);
			expect(result.current?.isModalOpen).toBe(false);
			expect(onAppChainChanged).toHaveBeenCalledWith(1);
		});

		it("updates walletName and recalculates walletCapability", () => {
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider>{children}</NetworkSwitcherProvider>
				),
			});

			expect(result.current?.walletCapability.supportsAutoSwitch).toBe(true);

			act(() => {
				result.current?.setWalletName("WalletConnect");
			});

			expect(result.current?.walletName).toBe("WalletConnect");
			expect(result.current?.walletCapability.supportsAutoSwitch).toBe(false);
		});

		it("toggles isWalletConnected and recalculates mismatch state accordingly", () => {
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider
						initialConnectedChainId={1}
						initialAppChainId={137}
					>
						{children}
					</NetworkSwitcherProvider>
				),
			});

			expect(result.current?.isMismatch).toBe(true);

			act(() => {
				result.current?.setIsWalletConnected(false);
			});
			expect(result.current?.isWalletConnected).toBe(false);
			expect(result.current?.isMismatch).toBe(false);

			act(() => {
				result.current?.setIsWalletConnected(true);
			});
			expect(result.current?.isWalletConnected).toBe(true);
			expect(result.current?.isMismatch).toBe(true);
		});

		it("manages modal open and close actions", () => {
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider>{children}</NetworkSwitcherProvider>
				),
			});

			expect(result.current?.isModalOpen).toBe(false);

			act(() => {
				result.current?.openModal();
			});
			expect(result.current?.isModalOpen).toBe(true);

			act(() => {
				result.current?.closeModal();
			});
			expect(result.current?.isModalOpen).toBe(false);
		});
	});

	describe("Programmatic wallet chain switching (switchWalletChain)", () => {
		beforeEach(() => {
			vi.useRealTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("executes successful switch using provided onWalletSwitchRequested callback", async () => {
			let resolveSwitch: () => void = () => {};
			const switchPromise = new Promise<void>((resolve) => {
				resolveSwitch = resolve;
			});
			const onWalletSwitchRequested = vi.fn().mockReturnValue(switchPromise);

			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider
						initialConnectedChainId={1}
						initialAppChainId={137}
						initialIsModalOpen={true}
						onWalletSwitchRequested={onWalletSwitchRequested}
					>
						{children}
					</NetworkSwitcherProvider>
				),
			});

			expect(result.current?.isSwitching).toBe(false);
			expect(result.current?.isMismatch).toBe(true);

			let switchActionPromise: Promise<void> | undefined;
			act(() => {
				switchActionPromise = result.current?.switchWalletChain();
			});

			// Synchronously indicates switching in progress
			expect(result.current?.isSwitching).toBe(true);
			expect(onWalletSwitchRequested).toHaveBeenCalledWith(137);

			// Resolve async switch request
			await act(async () => {
				resolveSwitch();
				await switchActionPromise;
			});

			expect(result.current?.isSwitching).toBe(false);
			expect(result.current?.connectedChainId).toBe(137);
			expect(result.current?.isMismatch).toBe(false);
			expect(result.current?.isModalOpen).toBe(false);
		});

		it("executes default switch with simulated delay when onWalletSwitchRequested is omitted", async () => {
			vi.useFakeTimers();

			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider
						initialConnectedChainId={1}
						initialAppChainId={137}
						initialIsModalOpen={true}
					>
						{children}
					</NetworkSwitcherProvider>
				),
			});

			let switchActionPromise: Promise<void> | undefined;
			act(() => {
				switchActionPromise = result.current?.switchWalletChain();
			});

			expect(result.current?.isSwitching).toBe(true);
			expect(result.current?.connectedChainId).toBe(1);

			// Advance simulated timer past 600ms
			await act(async () => {
				vi.advanceTimersByTime(650);
				await switchActionPromise;
			});

			expect(result.current?.isSwitching).toBe(false);
			expect(result.current?.connectedChainId).toBe(137);
			expect(result.current?.isMismatch).toBe(false);
			expect(result.current?.isModalOpen).toBe(false);
		});

		it("retains previous state and modal open on switch rejection/failure", async () => {
			const onWalletSwitchRequested = vi
				.fn()
				.mockRejectedValue(new Error("User rejected chain switch"));

			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider
						initialConnectedChainId={1}
						initialAppChainId={137}
						initialIsModalOpen={true}
						onWalletSwitchRequested={onWalletSwitchRequested}
					>
						{children}
					</NetworkSwitcherProvider>
				),
			});

			await act(async () => {
				await result.current?.switchWalletChain();
			});

			expect(result.current?.isSwitching).toBe(false);
			expect(result.current?.connectedChainId).toBe(1);
			expect(result.current?.isMismatch).toBe(true);
			expect(result.current?.isModalOpen).toBe(true); // Retains modal open on error
		});

		it("prevents concurrent wallet switch requests when switch is already in progress", async () => {
			let resolveFirst: () => void = () => {};
			const pendingPromise = new Promise<void>((resolve) => {
				resolveFirst = resolve;
			});
			const onWalletSwitchRequested = vi.fn().mockReturnValue(pendingPromise);

			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider
						initialConnectedChainId={1}
						initialAppChainId={137}
						onWalletSwitchRequested={onWalletSwitchRequested}
					>
						{children}
					</NetworkSwitcherProvider>
				),
			});

			let firstCall: Promise<void> | undefined;
			act(() => {
				firstCall = result.current?.switchWalletChain();
			});

			expect(result.current?.isSwitching).toBe(true);
			expect(onWalletSwitchRequested).toHaveBeenCalledTimes(1);

			// Second invocation while first is pending
			act(() => {
				result.current?.switchWalletChain();
			});

			// Should not call onWalletSwitchRequested again
			expect(onWalletSwitchRequested).toHaveBeenCalledTimes(1);

			await act(async () => {
				resolveFirst();
				await firstCall;
			});

			expect(result.current?.isSwitching).toBe(false);
		});
	});

	describe("Representative invalid inputs and boundary/fallback paths", () => {
		it("handles unknown / unsupported chain IDs gracefully with fallback metadata", () => {
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider
						initialConnectedChainId={999999}
						initialAppChainId={888888}
					>
						{children}
					</NetworkSwitcherProvider>
				),
			});

			expect(result.current?.connectedChainId).toBe(999999);
			expect(result.current?.connectedChain.name).toBe(
				"Unknown Network (Chain ID: 999999)",
			);
			expect(result.current?.appChainId).toBe(888888);
			expect(result.current?.appChain.name).toBe(
				"Unknown Network (Chain ID: 888888)",
			);
			expect(result.current?.isMismatch).toBe(true);
		});

		it("handles non-numeric string input to setConnectedChainId gracefully", () => {
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider>{children}</NetworkSwitcherProvider>
				),
			});

			act(() => {
				result.current?.setConnectedChainId("invalid-chain-id");
			});

			// parseInt('invalid-chain-id', 10) -> NaN
			expect(Number.isNaN(result.current?.connectedChainId)).toBe(true);
			expect(result.current?.connectedChain.id).toBe(0);
			expect(result.current?.connectedChain.name).toBe(
				"Unknown Network (Chain ID: NaN)",
			);
		});

		it("handles zero and negative chain IDs safely", () => {
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider>{children}</NetworkSwitcherProvider>
				),
			});

			act(() => {
				result.current?.setConnectedChainId(0);
			});
			expect(result.current?.connectedChainId).toBe(0);
			expect(result.current?.connectedChain.name).toBe(
				"Unknown Network (Chain ID: 0)",
			);

			act(() => {
				result.current?.setConnectedChainId(-1);
			});
			expect(result.current?.connectedChainId).toBe(-1);
			expect(result.current?.connectedChain.name).toBe(
				"Unknown Network (Chain ID: -1)",
			);
		});

		it("handles unrecognized wallet names by falling back to generic capability with custom name", () => {
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider initialWalletName="CustomWeb3Wallet">
						{children}
					</NetworkSwitcherProvider>
				),
			});

			expect(result.current?.walletCapability.type).toBe("generic");
			expect(result.current?.walletCapability.name).toBe("CustomWeb3Wallet");
			expect(result.current?.walletCapability.supportsAutoSwitch).toBe(true);
		});

		it("handles empty string wallet name by falling back to default generic capability", () => {
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider>{children}</NetworkSwitcherProvider>
				),
			});

			act(() => {
				result.current?.setWalletName("");
			});

			expect(result.current?.walletName).toBe("");
			expect(result.current?.walletCapability.type).toBe("generic");
			expect(result.current?.walletCapability.name).toBe("Web3 Wallet");
		});

		it("handles null and undefined initial chain props safely", () => {
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider
						initialConnectedChainId={null as unknown as number}
						initialAppChainId={undefined}
					>
						{children}
					</NetworkSwitcherProvider>
				),
			});

			expect(result.current?.connectedChainId).toBe(0);
			expect(result.current?.appChainId).toBe(DEFAULT_APP_CHAIN_ID);
		});
	});

	describe("Deterministic observable behavior for consumers", () => {
		it("maintains referential stability of value object across re-renders when state has not changed", () => {
			let renderCount = 0;
			const values: NetworkSwitcherContextValue[] = [];

			const Consumer = () => {
				renderCount++;
				const val = useContext(NetworkSwitcherContext);
				if (val) values.push(val);
				return <span>render count: {renderCount}</span>;
			};

			const { rerender } = render(
				<NetworkSwitcherProvider>
					<Consumer />
				</NetworkSwitcherProvider>,
			);

			// Re-render provider with same props and same children
			rerender(
				<NetworkSwitcherProvider>
					<Consumer />
				</NetworkSwitcherProvider>,
			);

			expect(values.length).toBe(2);
			expect(values[0]).toBe(values[1]); // Strict referential equality
		});

		it("maintains referential stability of state setter callbacks across state changes", () => {
			const { result } = renderHook(() => useContext(NetworkSwitcherContext), {
				wrapper: ({ children }) => (
					<NetworkSwitcherProvider>{children}</NetworkSwitcherProvider>
				),
			});

			const initialSetConnected = result.current?.setConnectedChainId;
			const initialSetWalletName = result.current?.setWalletName;
			const initialSetIsWalletConnected = result.current?.setIsWalletConnected;
			const initialOpenModal = result.current?.openModal;
			const initialCloseModal = result.current?.closeModal;

			act(() => {
				result.current?.setConnectedChainId(137);
				result.current?.setWalletName("Rabby Wallet");
			});

			expect(result.current?.setConnectedChainId).toBe(initialSetConnected);
			expect(result.current?.setWalletName).toBe(initialSetWalletName);
			expect(result.current?.setIsWalletConnected).toBe(
				initialSetIsWalletConnected,
			);
			expect(result.current?.openModal).toBe(initialOpenModal);
			expect(result.current?.closeModal).toBe(initialCloseModal);
		});

		it("updates context value and triggers consumer re-render on state change", () => {
			const Consumer = () => {
				const ctx = useContext(NetworkSwitcherContext);
				return (
					<div>
						<span data-testid="connected-id">{ctx?.connectedChainId}</span>
						<span data-testid="mismatch-status">
							{ctx?.isMismatch ? "mismatched" : "aligned"}
						</span>
						<button onClick={() => ctx?.setConnectedChainId(137)}>
							Align Chain
						</button>
					</div>
				);
			};

			render(
				<NetworkSwitcherProvider
					initialConnectedChainId={1}
					initialAppChainId={137}
				>
					<Consumer />
				</NetworkSwitcherProvider>,
			);

			expect(screen.getByTestId("connected-id").textContent).toBe("1");
			expect(screen.getByTestId("mismatch-status").textContent).toBe(
				"mismatched",
			);

			act(() => {
				screen.getByText("Align Chain").click();
			});

			expect(screen.getByTestId("connected-id").textContent).toBe("137");
			expect(screen.getByTestId("mismatch-status").textContent).toBe("aligned");
		});
	});
});
