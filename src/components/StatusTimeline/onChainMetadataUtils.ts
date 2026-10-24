/**
 * Formatting helpers for on-chain status badge metadata (Issue #256).
 */

import { APP_STELLAR_NETWORK } from '../../constants/stellar';

export const DEFAULT_HASH_HEAD = 6;
export const DEFAULT_HASH_TAIL = 4;

export function truncateHash(
  hash: string,
  head = DEFAULT_HASH_HEAD,
  tail = DEFAULT_HASH_TAIL,
): string {
  const trimmed = hash.trim();
  if (!trimmed) return '';
  if (trimmed.length <= head + tail + 1) return trimmed;
  return `${trimmed.slice(0, head)}…${trimmed.slice(-tail)}`;
}

export function formatBlockNumber(value: number | string | undefined): string {
  if (value === undefined || value === null || value === '') return '—';
  const raw = typeof value === 'number' ? String(value) : value.trim();
  if (!raw) return '—';
  if (!/^\d+$/.test(raw)) return raw;
  try {
    return BigInt(raw).toLocaleString('en-US');
  } catch {
    return raw;
  }
}

export function formatConfirmations(value: number | undefined): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  if (value < 0) return '—';
  return value.toLocaleString('en-US');
}

export function formatTimeSince(iso: string | undefined, nowMs = Date.now()): string {
  if (!iso) return '—';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '—';

  const diffSec = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  const diffYear = Math.floor(diffDay / 365);
  return `${diffYear}y ago`;
}

export type StellarExplorerNetwork = 'testnet' | 'public';

export function buildStellarExplorerTxUrl(
  transactionHash: string,
  network: StellarExplorerNetwork = APP_STELLAR_NETWORK,
): string {
  const hash = transactionHash.trim();
  return `https://stellar.expert/explorer/${network}/tx/${encodeURIComponent(hash)}`;
}

export function resolveExplorerUrl(
  metadata: {
    transactionHash?: string;
    explorerUrl?: string;
    network?: StellarExplorerNetwork;
  },
): string | undefined {
  if (metadata.explorerUrl?.trim()) return metadata.explorerUrl.trim();
  const hash = metadata.transactionHash?.trim();
  if (!hash) return undefined;
  return buildStellarExplorerTxUrl(hash, metadata.network ?? APP_STELLAR_NETWORK);
}
