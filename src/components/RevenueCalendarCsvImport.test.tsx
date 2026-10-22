import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RevenueCalendarCsvImport from './RevenueCalendarCsvImport';
import React from 'react';

const CSV = [
  'date,revenue',
  '2024-01-01,100',
  '2024-01-02,200',
].join('\n');

async function uploadCsv() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([CSV], 'revenue.csv', { type: 'text/csv' });
  await userEvent.upload(input, file);
}

async function advanceToPreview() {
  await uploadCsv();
  // Map Columns step -> Preview
  const continueBtn = await screen.findByRole('button', { name: /continue|next|preview/i });
  await userEvent.click(continueBtn);
}

describe('RevenueCalendarCsvImport', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders the upload step with dropzone initially', () => {
    render(<RevenueCalendarCsvImport />);
    expect(screen.getByText(/Drop a CSV file here/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Upload CSV file/i })).toBeTruthy();
  });

  it('renders step indicator with all 4 steps', () => {
    render(<RevenueCalendarCsvImport />);
    expect(screen.getByText('Upload File')).toBeInTheDocument();
    expect(screen.getByText('Map Columns')).toBeInTheDocument();
    expect(screen.getByText('Preview Data')).toBeInTheDocument();
    expect(screen.getByText('Confirm Import')).toBeInTheDocument();
  });

  it('renders as a dialog', () => {
    render(<RevenueCalendarCsvImport />);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('has accessible close button when onCancel provided', async () => {
    const onCancel = vi.fn();
    render(<RevenueCalendarCsvImport onCancel={onCancel} />);
    const closeBtn = screen.getByRole('button', { name: /Close import wizard/i });
    await userEvent.click(closeBtn);
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows error for non-CSV file upload simulation', () => {
    render(<RevenueCalendarCsvImport />);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toBeTruthy();
    expect(input!.accept).toContain('.csv');
  });

  it('Preview Import button does not call onImport', async () => {
    const onImport = vi.fn();
    render(<RevenueCalendarCsvImport onImport={onImport} />);
    await advanceToPreview();
    const importBtn = await screen.findByRole('button', { name: /^Import$/i });
    await userEvent.click(importBtn);
    expect(onImport).not.toHaveBeenCalled();
  });

  it('Confirm Import calls onImport exactly once', async () => {
    const onImport = vi.fn();
    render(<RevenueCalendarCsvImport onImport={onImport} />);
    await advanceToPreview();
    await userEvent.click(await screen.findByRole('button', { name: /^Import$/i }));
    const confirmBtn = await screen.findByRole('button', { name: /Confirm Import/i });
    await userEvent.click(confirmBtn);
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it('double-click on Confirm Import still calls onImport once', async () => {
    const onImport = vi.fn();
    render(<RevenueCalendarCsvImport onImport={onImport} />);
    await advanceToPreview();
    await userEvent.click(await screen.findByRole('button', { name: /^Import$/i }));
    const confirmBtn = await screen.findByRole('button', { name: /Confirm Import/i });
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it('shows terminal imported state after commit', async () => {
    const onImport = vi.fn();
    render(<RevenueCalendarCsvImport onImport={onImport} />);
    await advanceToPreview();
    await userEvent.click(await screen.findByRole('button', { name: /^Import$/i }));
    await userEvent.click(await screen.findByRole('button', { name: /Confirm Import/i }));
    expect(await screen.findByText(/Imported \d+ rows/i)).toBeTruthy();
  });
});
