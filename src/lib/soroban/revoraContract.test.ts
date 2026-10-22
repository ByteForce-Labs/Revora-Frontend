/**
 * Unit tests for revoraContract.ts
 * Tests the read-only Soroban client with mocked rpc.Server
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rpc } from '@stellar/stellar-sdk';
import {
  CONTRACT_METHODS,
  getAdmin,
  getToken,
  getPeriodIds,
  getPeriod,
  hasClaimed,
  getBeneficiaries,
  getUnclaimedSummary,
  getAuthorizedOfferings,
  getContractSummary,
  setRpcServerFactory,
  resetRpcServerFactory,
  type Period,
} from './revoraContract';

// Mock the stellar-sdk RPC Server
vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: class MockServer {
        queryContract: ReturnType<typeof vi.fn>;
        constructor(url: string) {
          this.queryContract = vi.fn();
        }
      },
    },
  };
});

describe('revoraContract', () => {
  let mockServer: InstanceType<ReturnType<typeof rpc.Server>>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockServer = new rpc.Server('https://test.rpc');
    setRpcServerFactory(() => mockServer);
  });

  afterEach(() => {
    resetRpcServerFactory();
  });

  describe('CONTRACT_METHODS', () => {
    it('contains all expected method names', () => {
      expect(CONTRACT_METHODS.GET_ADMIN).toBe('get_admin');
      expect(CONTRACT_METHODS.GET_TOKEN).toBe('get_token');
      expect(CONTRACT_METHODS.GET_PERIOD).toBe('get_period');
      expect(CONTRACT_METHODS.GET_PERIOD_IDS).toBe('get_period_ids');
      expect(CONTRACT_METHODS.HAS_CLAIMED).toBe('has_claimed');
      expect(CONTRACT_METHODS.GET_BENEFICIARIES).toBe('get_beneficiaries');
      expect(CONTRACT_METHODS.UNCLAIMED_SUMMARY).toBe('unclaimed_summary');
      expect(CONTRACT_METHODS.GET_AUTHORIZED_OFFERINGS).toBe('get_authorized_offerings');
    });
  });

  describe('getAdmin', () => {
    it('successfully queries admin address', async () => {
      const adminAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      mockServer.queryContract.mockResolvedValue({ result: adminAddress, isReadCall: true });

      const result = await getAdmin();

      expect(mockServer.queryContract).toHaveBeenCalledWith(
        expect.any(String),
        CONTRACT_METHODS.GET_ADMIN,
        undefined,
        expect.any(String),
      );
      expect(result).toBe(adminAddress);
    });

    it('propagates errors from RPC call', async () => {
      const error = new Error('Network error');
      mockServer.queryContract.mockRejectedValue(error);

      await expect(getAdmin()).rejects.toThrow('Network error');
    });
  });

  describe('getToken', () => {
    it('successfully queries token address', async () => {
      const tokenAddress = 'CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      mockServer.queryContract.mockResolvedValue({ result: tokenAddress, isReadCall: true });

      const result = await getToken();

      expect(mockServer.queryContract).toHaveBeenCalledWith(
        expect.any(String),
        CONTRACT_METHODS.GET_TOKEN,
        undefined,
        expect.any(String),
      );
      expect(result).toBe(tokenAddress);
    });
  });

  describe('getPeriodIds', () => {
    it('successfully queries period IDs', async () => {
      const periodIds = [1, 2, 3];
      mockServer.queryContract.mockResolvedValue({ result: periodIds, isReadCall: true });

      const result = await getPeriodIds();

      expect(mockServer.queryContract).toHaveBeenCalledWith(
        expect.any(String),
        CONTRACT_METHODS.GET_PERIOD_IDS,
        undefined,
        expect.any(String),
      );
      expect(result).toEqual(periodIds);
    });
  });

  describe('getPeriod', () => {
    it('successfully queries period metadata', async () => {
      const period: Period = {
        start_ledger: 1000,
        end_ledger: 2000,
        revenue_amount: BigInt(1000000),
        is_complete: true,
      };
      mockServer.queryContract.mockResolvedValue({ result: period, isReadCall: true });

      const result = await getPeriod(1);

      expect(mockServer.queryContract).toHaveBeenCalledWith(
        expect.any(String),
        CONTRACT_METHODS.GET_PERIOD,
        { period_id: 1 },
        expect.any(String),
      );
      expect(result).toEqual(period);
    });

    it('returns null on simulation error', async () => {
      const error = new Error('Period not found');
      mockServer.queryContract.mockRejectedValue(error);

      const result = await getPeriod(999);

      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      const error = new Error('RPC timeout');
      mockServer.queryContract.mockRejectedValue(error);

      const result = await getPeriod(1);

      expect(result).toBeNull();
    });
  });

  describe('hasClaimed', () => {
    it('successfully queries claim status', async () => {
      mockServer.queryContract.mockResolvedValue({ result: true, isReadCall: true });

      const result = await hasClaimed(1, 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');

      expect(mockServer.queryContract).toHaveBeenCalledWith(
        expect.any(String),
        CONTRACT_METHODS.HAS_CLAIMED,
        { period_id: 1, address: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' },
        expect.any(String),
      );
      expect(result).toBe(true);
    });
  });

  describe('getBeneficiaries', () => {
    it('successfully queries beneficiary list', async () => {
      const beneficiaries = ['GXXX1', 'GXXX2', 'GXXX3'];
      mockServer.queryContract.mockResolvedValue({ result: beneficiaries, isReadCall: true });

      const result = await getBeneficiaries(1);

      expect(mockServer.queryContract).toHaveBeenCalledWith(
        expect.any(String),
        CONTRACT_METHODS.GET_BENEFICIARIES,
        { period_id: 1 },
        expect.any(String),
      );
      expect(result).toEqual(beneficiaries);
    });

    it('returns null on error', async () => {
      const error = new Error('Period not found');
      mockServer.queryContract.mockRejectedValue(error);

      const result = await getBeneficiaries(999);

      expect(result).toBeNull();
    });
  });

  describe('getUnclaimedSummary', () => {
    it('successfully queries unclaimed summary', async () => {
      const summary = {
        1: BigInt(500000),
        2: BigInt(300000),
      };
      mockServer.queryContract.mockResolvedValue({ result: summary, isReadCall: true });

      const result = await getUnclaimedSummary();

      expect(mockServer.queryContract).toHaveBeenCalledWith(
        expect.any(String),
        CONTRACT_METHODS.UNCLAIMED_SUMMARY,
        undefined,
        expect.any(String),
      );
      expect(result).toEqual([
        { period_id: 1, amount: BigInt(500000) },
        { period_id: 2, amount: BigInt(300000) },
      ]);
    });
  });

  describe('getAuthorizedOfferings', () => {
    it('successfully queries authorized offerings', async () => {
      const offerings = ['CXXX1', 'CXXX2'];
      mockServer.queryContract.mockResolvedValue({ result: offerings, isReadCall: true });

      const result = await getAuthorizedOfferings();

      expect(mockServer.queryContract).toHaveBeenCalledWith(
        expect.any(String),
        CONTRACT_METHODS.GET_AUTHORIZED_OFFERINGS,
        undefined,
        expect.any(String),
      );
      expect(result).toEqual(offerings);
    });
  });

  describe('getContractSummary', () => {
    it('successfully fetches complete contract summary', async () => {
      const admin = 'GADMIN';
      const token = 'CTOKEN';
      const periodIds = [1, 2, 3];
      const authorizedOfferings = ['COFFERING1', 'COFFERING2'];

      mockServer.queryContract
        .mockResolvedValueOnce({ result: admin, isReadCall: true })
        .mockResolvedValueOnce({ result: token, isReadCall: true })
        .mockResolvedValueOnce({ result: periodIds, isReadCall: true })
        .mockResolvedValueOnce({ result: authorizedOfferings, isReadCall: true });

      const result = await getContractSummary();

      expect(result).toEqual({
        admin,
        token,
        periodCount: 3,
        periodIds,
        authorizedOfferingsCount: 2,
      });
    });

    it('propagates errors from RPC calls', async () => {
      mockServer.queryContract.mockRejectedValue(new Error('Network failure'));

      await expect(getContractSummary()).rejects.toThrow('Failed to fetch contract summary');
    });

    it('handles partial failures gracefully', async () => {
      mockServer.queryContract
        .mockResolvedValueOnce({ result: 'GADMIN', isReadCall: true })
        .mockRejectedValueOnce(new Error('Token query failed'));

      await expect(getContractSummary()).rejects.toThrow('Failed to fetch contract summary');
    });
  });
});
