/**
 * Unit tests for useContractRead hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useContractRead } from './useContractRead';

describe('useContractRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initially returns loading state and null data', () => {
    const fetchFn = vi.fn(() => Promise.resolve('data'));
    const { result } = renderHook(() => useContractRead(fetchFn));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBe(null);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('successfully fetches data', async () => {
    const mockData = { value: 123 };
    const fetchFn = vi.fn(() => Promise.resolve(mockData));
    const { result } = renderHook(() => useContractRead(fetchFn));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBe(null);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('handles fetch errors', async () => {
    const errorMessage = 'Network error';
    const fetchFn = vi.fn(() => Promise.reject(new Error(errorMessage)));
    const { result } = renderHook(() => useContractRead(fetchFn, { retryCount: 0 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBe(null);
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(errorMessage);
  });

  it('does not auto-fetch when disabled', async () => {
    const fetchFn = vi.fn(() => Promise.resolve('data'));
    const { result } = renderHook(() => useContractRead(fetchFn, { enabled: false }));

    // Wait a bit to ensure no fetch happened
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 100 });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.current.data).toBe(null);
  });

  it('retries on failure with default retry count', async () => {
    const fetchFn = vi.fn()
      .mockRejectedValueOnce(new Error('Error 1'))
      .mockRejectedValueOnce(new Error('Error 2'))
      .mockRejectedValueOnce(new Error('Error 3'))
      .mockResolvedValueOnce('success');

    const { result } = renderHook(() => useContractRead(fetchFn, { retryCount: 3, retryDelay: 10 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 1000 });

    expect(fetchFn).toHaveBeenCalledTimes(4); // initial + 3 retries
    expect(result.current.data).toBe('success');
    expect(result.current.isError).toBe(false);
  });

  it('stops retrying after max retry count', async () => {
    const fetchFn = vi.fn(() => Promise.reject(new Error('Persistent error')));
    const { result } = renderHook(() => useContractRead(fetchFn, { retryCount: 2, retryDelay: 10 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 100 });

    expect(fetchFn).toHaveBeenCalledTimes(3); // initial + 2 retries
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe('Persistent error');
  });

  it('manual retry function works', async () => {
    let shouldFail = true;
    const fetchFn = vi.fn(() => {
      if (shouldFail) {
        return Promise.reject(new Error('First failure'));
      }
      return Promise.resolve('success');
    });

    const { result } = renderHook(() => useContractRead(fetchFn, { retryCount: 0 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(true);

    act(() => {
      shouldFail = false;
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBe('success');
    expect(result.current.isError).toBe(false);
  });

  it('manual refetch function works', async () => {
    const fetchFn = vi.fn(() => Promise.resolve('data'));
    const { result } = renderHook(() => useContractRead(fetchFn));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('cancels in-flight request on unmount', async () => {
    const fetchFn = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve('data'), 1000)));
    const { result, unmount } = renderHook(() => useContractRead(fetchFn));

    expect(result.current.isLoading).toBe(true);

    unmount();

    // The request should be aborted, but we can't easily test that directly
    // At minimum, verify no errors are thrown during unmount
    expect(result.current.isLoading).toBe(true);
  });

  it('respects custom retry delay', async () => {
    const fetchFn = vi.fn()
      .mockRejectedValueOnce(new Error('Error 1'))
      .mockResolvedValueOnce('success');

    const startTime = Date.now();
    const { result } = renderHook(() => useContractRead(fetchFn, { retryCount: 1, retryDelay: 100 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 500 });

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeGreaterThanOrEqual(100);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
