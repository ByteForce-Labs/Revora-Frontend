import { describe, it, expect } from 'vitest';
import {
  DEFAULT_HASH_HEAD,
  DEFAULT_HASH_TAIL,
  truncateHash,
  formatBlockNumber,
  formatConfirmations,
  formatTimeSince,
  buildStellarExplorerTxUrl,
  resolveExplorerUrl,
} from './onChainMetadataUtils';

describe('truncateHash', () => {
  it('truncates long hashes with the default head and tail contract', () => {
    const hash = 'abcdef1234567890deadbeef';
    expect(truncateHash(hash)).toBe(
      `${hash.slice(0, DEFAULT_HASH_HEAD)}…${hash.slice(-DEFAULT_HASH_TAIL)}`,
    );
  });

  it('returns short hashes unchanged at the default boundary', () => {
    const boundaryHash = `${'a'.repeat(DEFAULT_HASH_HEAD)}${'b'.repeat(DEFAULT_HASH_TAIL)}`;
    expect(truncateHash(boundaryHash)).toBe(boundaryHash);
    expect(truncateHash('abc123')).toBe('abc123');
  });

  it('returns empty for blank input', () => {
    expect(truncateHash('')).toBe('');
    expect(truncateHash('   ')).toBe('');
  });
});

describe('formatBlockNumber', () => {
  it('formats numeric strings with grouping', () => {
    expect(formatBlockNumber('123456789012345')).toBe('123,456,789,012,345');
  });

  it('formats numbers', () => {
    expect(formatBlockNumber(42000)).toBe('42,000');
  });

  it('returns em dash when missing', () => {
    expect(formatBlockNumber(undefined)).toBe('—');
    expect(formatBlockNumber('')).toBe('—');
  });

  it('passes through non-numeric strings', () => {
    expect(formatBlockNumber('pending')).toBe('pending');
  });
});

describe('formatConfirmations', () => {
  it('formats valid counts', () => {
    expect(formatConfirmations(1284)).toBe('1,284');
  });

  it('returns em dash for invalid values', () => {
    expect(formatConfirmations(undefined)).toBe('—');
    expect(formatConfirmations(-1)).toBe('—');
  });
});

describe('formatTimeSince', () => {
  const now = Date.parse('2026-07-27T12:00:00.000Z');

  it('formats seconds', () => {
    expect(formatTimeSince('2026-07-27T11:59:30.000Z', now)).toBe('30s ago');
  });

  it('formats hours', () => {
    expect(formatTimeSince('2026-07-27T09:00:00.000Z', now)).toBe('3h ago');
  });

  it('returns em dash for missing or invalid timestamps', () => {
    expect(formatTimeSince(undefined, now)).toBe('—');
    expect(formatTimeSince('not-a-date', now)).toBe('—');
  });
});

describe('buildStellarExplorerTxUrl', () => {
  it('builds testnet network URL by default', () => {
    expect(buildStellarExplorerTxUrl('abc123')).toBe(
      'https://stellar.expert/explorer/testnet/tx/abc123',
    );
  });

  it('encodes hash segments', () => {
    expect(buildStellarExplorerTxUrl('a/b')).toBe(
      'https://stellar.expert/explorer/testnet/tx/a%2Fb',
    );
  });

  it('builds public network URL when explicitly specified', () => {
    expect(buildStellarExplorerTxUrl('abc123', 'public')).toBe(
      'https://stellar.expert/explorer/public/tx/abc123',
    );
  });
});

describe('resolveExplorerUrl', () => {
  it('prefers explicit explorer URL', () => {
    expect(
      resolveExplorerUrl({
        explorerUrl: 'https://example.com/tx/1',
        transactionHash: 'abc',
      }),
    ).toBe('https://example.com/tx/1');
  });

  it('falls back to stellar expert when hash present', () => {
    expect(
      resolveExplorerUrl({ transactionHash: 'deadbeef', network: 'testnet' }),
    ).toBe('https://stellar.expert/explorer/testnet/tx/deadbeef');
  });

  it('returns undefined without hash or URL', () => {
    expect(resolveExplorerUrl({})).toBeUndefined();
    expect(resolveExplorerUrl({ transactionHash: '   ' })).toBeUndefined();
  });
});
