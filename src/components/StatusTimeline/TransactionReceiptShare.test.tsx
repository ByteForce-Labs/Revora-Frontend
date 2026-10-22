import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { axe } from 'jest-axe';
import { TransactionReceiptShare } from './TransactionReceiptShare';
import html2canvas from 'html2canvas';

// Mock html2canvas
vi.mock('html2canvas', () => {
  return {
    default: vi.fn().mockResolvedValue({
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock'),
      toBlob: vi.fn().mockImplementation((cb) => cb(new Blob(['mock'], { type: 'image/png' }))),
    }),
  };
});

describe('TransactionReceiptShare', () => {
  const defaultProps = {
    transactionId: 'TX-12345',
    date: 'Oct 24, 2023 14:30',
    amount: '1,500.00',
    currency: 'USDC',
    status: 'completed' as const,
    senderWallet: '0x123...abc',
    recipientWallet: '0x456...def',
  };

  const originalClipboard = navigator.clipboard;
  const mockWrite = vi.fn();
  
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        write: mockWrite,
      },
    });
    
    // Mock ClipboardItem
    // @ts-ignore
    global.ClipboardItem = vi.fn(function (data: unknown) { return data; });
    global.alert = vi.fn();
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
  });

  afterEach(() => {
    Object.assign(navigator, {
      clipboard: originalClipboard,
    });
    vi.clearAllMocks();
  });

  it('renders correctly and matches snapshot', () => {
    const { container } = render(<TransactionReceiptShare {...defaultProps} />);
    expect(screen.getByText('TX-12345')).toBeInTheDocument();
    expect(screen.getByText('1,500.00 USDC')).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('0x123...abc')).toBeInTheDocument();
    expect(screen.getByText('0x456...def')).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<TransactionReceiptShare {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('toggles hide amount', () => {
    render(<TransactionReceiptShare {...defaultProps} />);
    
    // Amount is initially visible
    expect(screen.getByText('1,500.00 USDC')).toBeInTheDocument();
    
    // Click hide amount
    const toggleBtn = screen.getByRole('button', { name: /hide amount/i });
    fireEvent.click(toggleBtn);
    
    // Amount is hidden
    expect(screen.queryByText('1,500.00 USDC')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Amount hidden')).toBeInTheDocument();
    expect(screen.getByText('••••••')).toBeInTheDocument();
    
    // Click show amount
    const showBtn = screen.getByRole('button', { name: /show amount/i });
    fireEvent.click(showBtn);
    
    // Amount is visible again
    expect(screen.getByText('1,500.00 USDC')).toBeInTheDocument();
  });

  it('handles download click', async () => {
    render(<TransactionReceiptShare {...defaultProps} />);
    const downloadBtn = screen.getByRole('button', { name: /download/i });
    
    // Mock anchor click
    const mockClick = vi.fn();
    const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue({
      click: mockClick,
    } as any);

    fireEvent.click(downloadBtn);
    
    await waitFor(() => {
      expect(html2canvas).toHaveBeenCalled();
      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockClick).toHaveBeenCalled();
    });
    
    mockCreateElement.mockRestore();
  });

  it('handles copy image click successfully', async () => {
    mockWrite.mockResolvedValueOnce(undefined);
    render(<TransactionReceiptShare {...defaultProps} />);
    const copyBtn = screen.getByRole('button', { name: /copy image/i });
    
    fireEvent.click(copyBtn);
    
    await waitFor(() => {
      expect(html2canvas).toHaveBeenCalled();
      expect(global.ClipboardItem).toHaveBeenCalled();
      expect(mockWrite).toHaveBeenCalled();
      expect(global.alert).toHaveBeenCalledWith('Receipt image copied to clipboard!');
    });
  });

  it('handles copy image fallback to download on clipboard error', async () => {
    mockWrite.mockRejectedValueOnce(new Error('Clipboard error'));
    render(<TransactionReceiptShare {...defaultProps} />);
    const copyBtn = screen.getByRole('button', { name: /copy image/i });
    
    // Mock anchor click for fallback
    const mockClick = vi.fn();
    const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue({
      click: mockClick,
    } as any);

    fireEvent.click(copyBtn);
    
    await waitFor(() => {
      expect(html2canvas).toHaveBeenCalled();
      expect(mockWrite).toHaveBeenCalled();
      // Should fallback to download
      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockClick).toHaveBeenCalled();
    });
    
    mockCreateElement.mockRestore();
  });
});
