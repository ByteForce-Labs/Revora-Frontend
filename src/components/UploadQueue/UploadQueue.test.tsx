import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { UploadQueue } from './UploadQueue';
import type { UploadFile } from '../../hooks/useUploadQueue';

expect.extend(toHaveNoViolations);

/* ─── Fixtures ──────────────────────────────────────────────────────────── */

function makeItem(overrides: Partial<UploadFile> = {}): UploadFile {
  return {
    id: `id-${Math.random()}`,
    file: new File(['hello'], overrides.file?.name ?? 'document.pdf', { type: 'application/pdf' }),
    status: 'pending',
    progress: 0,
    ...overrides,
  };
}

const defaultProps = {
  queue: [] as UploadFile[],
  onAddFiles: vi.fn(),
  onRemove: vi.fn(),
  onRetry: vi.fn(),
  onUploadAll: vi.fn(),
  onClearComplete: vi.fn(),
  totalCount: 0,
  successCount: 0,
  errorCount: 0,
  uploadingCount: 0,
  overallProgress: 0,
};

function renderQueue(props: Partial<typeof defaultProps> = {}) {
  return render(<UploadQueue {...defaultProps} {...props} />);
}

/* ─── Drop Zone ─────────────────────────────────────────────────────────── */

describe('UploadQueue – drop zone', () => {
  it('renders the drop zone with accessible label', () => {
    renderQueue();
    expect(screen.getByTestId('upload-dropzone')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload files/i })).toBeInTheDocument();
  });

  it('opens file picker on click', async () => {
    renderQueue();
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByTestId('upload-dropzone'));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('opens file picker on Enter key', async () => {
    renderQueue();
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.keyDown(screen.getByTestId('upload-dropzone'), { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalled();
  });

  it('opens file picker on Space key', async () => {
    renderQueue();
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.keyDown(screen.getByTestId('upload-dropzone'), { key: ' ' });
    expect(clickSpy).toHaveBeenCalled();
  });

  it('calls onAddFiles when files are dropped', () => {
    const onAddFiles = vi.fn();
    renderQueue({ onAddFiles });
    const file = new File(['data'], 'report.pdf', { type: 'application/pdf' });
    const dt = { files: [file] } as unknown as DataTransfer;
    fireEvent.drop(screen.getByTestId('upload-dropzone'), { dataTransfer: dt });
    expect(onAddFiles).toHaveBeenCalledWith([file]);
  });

  it('adds drag-over class on dragover and removes on dragleave', () => {
    renderQueue();
    const zone = screen.getByTestId('upload-dropzone');
    fireEvent.dragOver(zone);
    expect(zone.className).toContain('upload-queue__dropzone--active');
    fireEvent.dragLeave(zone);
    expect(zone.className).not.toContain('upload-queue__dropzone--active');
  });

  it('calls onAddFiles when files are selected via input', async () => {
    const onAddFiles = vi.fn();
    renderQueue({ onAddFiles });
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    const file = new File(['x'], 'test.pdf');
    await userEvent.upload(input, file);
    expect(onAddFiles).toHaveBeenCalledWith([file]);
  });

  it('does not call onAddFiles when drop has no files', () => {
    const onAddFiles = vi.fn();
    renderQueue({ onAddFiles });
    const dt = { files: [] } as unknown as DataTransfer;
    fireEvent.drop(screen.getByTestId('upload-dropzone'), { dataTransfer: dt });
    expect(onAddFiles).not.toHaveBeenCalled();
  });
});

/* ─── Queue Rows ────────────────────────────────────────────────────────── */

describe('UploadQueue – queue rows', () => {
  it('renders a row for each queued file', () => {
    const queue = [makeItem({ file: new File([''], 'a.pdf') }), makeItem({ file: new File([''], 'b.pdf') })];
    renderQueue({ queue, totalCount: 2 });
    expect(screen.getAllByTestId('upload-queue-row')).toHaveLength(2);
    expect(screen.getByText('a.pdf')).toBeInTheDocument();
    expect(screen.getByText('b.pdf')).toBeInTheDocument();
  });

  it('shows "Pending" status for pending items', () => {
    renderQueue({ queue: [makeItem()], totalCount: 1 });
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows "Complete" status for successful items', () => {
    renderQueue({ queue: [makeItem({ status: 'success', progress: 100 })], totalCount: 1, successCount: 1 });
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('shows "Failed" status for error items', () => {
    renderQueue({ queue: [makeItem({ status: 'error' })], totalCount: 1, errorCount: 1 });
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('shows uploading percentage for uploading items', () => {
    renderQueue({ queue: [makeItem({ status: 'uploading', progress: 42 })], totalCount: 1, uploadingCount: 1 });
    expect(screen.getByText('Uploading 42%')).toBeInTheDocument();
  });

  it('shows error message when present', () => {
    renderQueue({
      queue: [makeItem({ status: 'error', errorMessage: 'Server rejected the file' })],
      totalCount: 1,
      errorCount: 1,
    });
    expect(screen.getByText('Server rejected the file')).toBeInTheDocument();
  });

  it('does not show error message when absent', () => {
    renderQueue({ queue: [makeItem({ status: 'error' })], totalCount: 1, errorCount: 1 });
    expect(screen.queryByText('Server rejected the file')).not.toBeInTheDocument();
  });

  it('shows file size in human-readable format', () => {
    const file = new File(['x'.repeat(2048)], 'big.pdf');
    renderQueue({ queue: [makeItem({ file })], totalCount: 1 });
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });

  it('formats bytes < 1024 as B', () => {
    const file = new File(['x'.repeat(512)], 'small.pdf');
    renderQueue({ queue: [makeItem({ file })], totalCount: 1 });
    expect(screen.getByText('512 B')).toBeInTheDocument();
  });

  it('formats bytes >= 1MB as MB', () => {
    const file = new File(['x'.repeat(1024 * 1024 * 2)], 'large.pdf');
    renderQueue({ queue: [makeItem({ file })], totalCount: 1 });
    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
  });

  it('calls onRemove with correct id when remove button clicked', () => {
    const onRemove = vi.fn();
    const item = makeItem({ id: 'abc-123' });
    renderQueue({ queue: [item], onRemove, totalCount: 1 });
    fireEvent.click(screen.getByTestId('remove-btn'));
    expect(onRemove).toHaveBeenCalledWith('abc-123');
  });

  it('shows retry button only for error items', () => {
    const queue = [
      makeItem({ id: 'err', status: 'error' }),
      makeItem({ id: 'ok', status: 'success', progress: 100 }),
    ];
    renderQueue({ queue, totalCount: 2, errorCount: 1, successCount: 1 });
    expect(screen.getAllByTestId('retry-btn')).toHaveLength(1);
  });

  it('calls onRetry with id and uploader when retry clicked', () => {
    const onRetry = vi.fn();
    const uploader = vi.fn();
    const item = makeItem({ id: 'retry-me', status: 'error' });
    renderQueue({ queue: [item], onRetry, uploader, totalCount: 1, errorCount: 1 });
    fireEvent.click(screen.getByTestId('retry-btn'));
    expect(onRetry).toHaveBeenCalledWith('retry-me', uploader);
  });

  it('does not call onRetry when uploader is not provided', () => {
    const onRetry = vi.fn();
    const item = makeItem({ id: 'retry-me', status: 'error' });
    renderQueue({ queue: [item], onRetry, uploader: undefined, totalCount: 1, errorCount: 1 });
    fireEvent.click(screen.getByTestId('retry-btn'));
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('applies success row class for successful items', () => {
    renderQueue({ queue: [makeItem({ status: 'success', progress: 100 })], totalCount: 1, successCount: 1 });
    const row = screen.getByTestId('upload-queue-row');
    expect(row.className).toContain('upload-queue__row--success');
  });

  it('applies error row class for failed items', () => {
    renderQueue({ queue: [makeItem({ status: 'error' })], totalCount: 1, errorCount: 1 });
    const row = screen.getByTestId('upload-queue-row');
    expect(row.className).toContain('upload-queue__row--error');
  });

  it('does not render the list when queue is empty', () => {
    renderQueue();
    expect(screen.queryByTestId('upload-queue-list')).not.toBeInTheDocument();
  });
});

/* ─── Summary Bar ───────────────────────────────────────────────────────── */

describe('UploadQueue – summary bar', () => {
  it('does not render summary when queue is empty', () => {
    renderQueue();
    expect(screen.queryByTestId('upload-queue-summary')).not.toBeInTheDocument();
  });

  it('renders summary when files are queued', () => {
    renderQueue({ queue: [makeItem()], totalCount: 1 });
    expect(screen.getByTestId('upload-queue-summary')).toBeInTheDocument();
  });

  it('shows "Upload all" button when pending files exist and not uploading', () => {
    renderQueue({ queue: [makeItem()], totalCount: 1, uploadingCount: 0 });
    expect(screen.getByTestId('upload-all-btn')).toBeInTheDocument();
  });

  it('hides "Upload all" button when uploading is in progress', () => {
    renderQueue({
      queue: [makeItem({ status: 'uploading', progress: 50 })],
      totalCount: 1,
      uploadingCount: 1,
    });
    expect(screen.queryByTestId('upload-all-btn')).not.toBeInTheDocument();
  });

  it('hides "Upload all" button when no pending files remain', () => {
    renderQueue({
      queue: [makeItem({ status: 'success', progress: 100 })],
      totalCount: 1,
      successCount: 1,
      uploadingCount: 0,
    });
    expect(screen.queryByTestId('upload-all-btn')).not.toBeInTheDocument();
  });

  it('calls onUploadAll when "Upload all" is clicked', () => {
    const onUploadAll = vi.fn();
    renderQueue({ queue: [makeItem()], onUploadAll, totalCount: 1 });
    fireEvent.click(screen.getByTestId('upload-all-btn'));
    expect(onUploadAll).toHaveBeenCalled();
  });

  it('shows "Clear done" button when success items exist', () => {
    renderQueue({
      queue: [makeItem({ status: 'success', progress: 100 })],
      totalCount: 1,
      successCount: 1,
    });
    expect(screen.getByTestId('clear-complete-btn')).toBeInTheDocument();
  });

  it('hides "Clear done" button when no success items', () => {
    renderQueue({ queue: [makeItem()], totalCount: 1, successCount: 0 });
    expect(screen.queryByTestId('clear-complete-btn')).not.toBeInTheDocument();
  });

  it('calls onClearComplete when "Clear done" is clicked', () => {
    const onClearComplete = vi.fn();
    renderQueue({
      queue: [makeItem({ status: 'success', progress: 100 })],
      onClearComplete,
      totalCount: 1,
      successCount: 1,
    });
    fireEvent.click(screen.getByTestId('clear-complete-btn'));
    expect(onClearComplete).toHaveBeenCalled();
  });

  it('shows overall progress in the progress bar', () => {
    renderQueue({ queue: [makeItem({ status: 'uploading', progress: 60 })], totalCount: 1, uploadingCount: 1, overallProgress: 60 });
    const bar = screen.getByRole('progressbar', { name: /overall upload progress/i });
    expect(bar).toHaveAttribute('aria-valuenow', '60');
  });

  it('shows "X of N uploaded" copy when all complete', () => {
    renderQueue({
      queue: [makeItem({ status: 'success', progress: 100 })],
      totalCount: 1,
      successCount: 1,
      errorCount: 0,
      overallProgress: 100,
    });
    expect(screen.getByText(/1 of 1 uploaded/i)).toBeInTheDocument();
  });

  it('shows failed count in summary when errors exist', () => {
    renderQueue({
      queue: [makeItem({ status: 'error' }), makeItem({ status: 'success', progress: 100 })],
      totalCount: 2,
      successCount: 1,
      errorCount: 1,
      overallProgress: 50,
    });
    expect(screen.getAllByText(/1 failed/i).length).toBeGreaterThan(0);
  });

  it('shows uploading copy when uploads are in progress', () => {
    renderQueue({
      queue: [makeItem({ status: 'uploading', progress: 30 })],
      totalCount: 1,
      uploadingCount: 1,
      overallProgress: 30,
    });
    expect(screen.getByText(/uploading 1 of 1 files/i)).toBeInTheDocument();
  });

  it('shows queued copy when files are pending', () => {
    renderQueue({ queue: [makeItem(), makeItem()], totalCount: 2 });
    expect(screen.getByText(/2 files queued/i)).toBeInTheDocument();
  });

  it('uses singular "file" for single queued item', () => {
    renderQueue({ queue: [makeItem()], totalCount: 1 });
    expect(screen.getByText(/1 file queued/i)).toBeInTheDocument();
  });
});

/* ─── Live Region ───────────────────────────────────────────────────────── */

describe('UploadQueue – live region', () => {
  it('renders a polite live region', () => {
    renderQueue();
    const region = screen.getByTestId('upload-live-region');
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
  });

  it('announces uploading state', () => {
    renderQueue({
      queue: [makeItem({ status: 'uploading', progress: 40 })],
      totalCount: 1,
      uploadingCount: 1,
      overallProgress: 40,
    });
    expect(screen.getByTestId('upload-live-region').textContent).toContain('Uploading 1 file');
  });

  it('announces all-success state', () => {
    renderQueue({
      queue: [makeItem({ status: 'success', progress: 100 })],
      totalCount: 1,
      successCount: 1,
      overallProgress: 100,
    });
    expect(screen.getByTestId('upload-live-region').textContent).toContain('All 1 files uploaded successfully');
  });

  it('announces error state', () => {
    renderQueue({
      queue: [makeItem({ status: 'error' }), makeItem({ status: 'success', progress: 100 })],
      totalCount: 2,
      successCount: 1,
      errorCount: 1,
      overallProgress: 50,
    });
    expect(screen.getByTestId('upload-live-region').textContent).toContain('1 file failed');
  });

  it('live region is empty when idle with no files', () => {
    renderQueue();
    expect(screen.getByTestId('upload-live-region').textContent).toBe('');
  });
});

/* ─── Accessibility ─────────────────────────────────────────────────────── */

describe('UploadQueue – accessibility', () => {
  it('has no axe violations with empty queue', async () => {
    const { container } = renderQueue();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with mixed-status queue', async () => {
    const queue = [
      makeItem({ status: 'pending' }),
      makeItem({ status: 'uploading', progress: 50 }),
      makeItem({ status: 'success', progress: 100 }),
      makeItem({ status: 'error', errorMessage: 'Timeout' }),
    ];
    const { container } = renderQueue({
      queue,
      totalCount: 4,
      successCount: 1,
      errorCount: 1,
      uploadingCount: 1,
      overallProgress: 50,
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('remove button has accessible label including filename', () => {
    const item = makeItem({ file: new File([''], 'my-report.pdf') });
    renderQueue({ queue: [item], totalCount: 1 });
    expect(screen.getByRole('button', { name: /remove my-report\.pdf from queue/i })).toBeInTheDocument();
  });

  it('retry button has accessible label including filename', () => {
    const item = makeItem({ file: new File([''], 'broken.pdf'), status: 'error' });
    renderQueue({ queue: [item], totalCount: 1, errorCount: 1 });
    expect(screen.getByRole('button', { name: /retry upload for broken\.pdf/i })).toBeInTheDocument();
  });

  it('progress bar has accessible role and value', () => {
    renderQueue({
      queue: [makeItem({ status: 'uploading', progress: 75 })],
      totalCount: 1,
      uploadingCount: 1,
      overallProgress: 75,
    });
    const bar = screen.getByRole('progressbar', { name: /overall upload progress/i });
    expect(bar).toHaveAttribute('aria-valuenow', '75');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('file list has accessible label', () => {
    renderQueue({ queue: [makeItem()], totalCount: 1 });
    expect(screen.getByRole('list', { name: /upload queue/i })).toBeInTheDocument();
  });

  it('drop zone is keyboard focusable', () => {
    renderQueue();
    const zone = screen.getByTestId('upload-dropzone');
    expect(zone).toHaveAttribute('tabindex', '0');
  });
});

/* ─── Edge Cases ────────────────────────────────────────────────────────── */

describe('UploadQueue – edge cases', () => {
  it('renders 50 rows without crashing', () => {
    const queue = Array.from({ length: 50 }, (_, i) =>
      makeItem({ file: new File([''], `file-${i}.pdf`) }),
    );
    renderQueue({ queue, totalCount: 50 });
    expect(screen.getAllByTestId('upload-queue-row')).toHaveLength(50);
  });

  it('handles file with very long name gracefully', () => {
    const longName = 'a'.repeat(200) + '.pdf';
    const item = makeItem({ file: new File([''], longName) });
    renderQueue({ queue: [item], totalCount: 1 });
    const el = screen.getByText(longName);
    expect(el).toBeInTheDocument();
  });

  it('handles offline-like scenario: all files in error state', () => {
    const queue = Array.from({ length: 5 }, () =>
      makeItem({ status: 'error', errorMessage: 'Network unavailable' }),
    );
    renderQueue({ queue, totalCount: 5, errorCount: 5 });
    expect(screen.getAllByTestId('retry-btn')).toHaveLength(5);
    expect(screen.getAllByText('Network unavailable')).toHaveLength(5);
  });

  it('shows correct summary when all files succeed', () => {
    const queue = Array.from({ length: 3 }, () =>
      makeItem({ status: 'success', progress: 100 }),
    );
    renderQueue({ queue, totalCount: 3, successCount: 3, overallProgress: 100 });
    expect(screen.getByText(/3 of 3 uploaded/i)).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    renderQueue({ className: 'my-custom-class' });
    expect(screen.getByTestId('upload-queue').className).toContain('my-custom-class');
  });

  it('forwards accept prop to file input', () => {
    renderQueue({ accept: '.pdf,.docx' });
    expect(screen.getByTestId('file-input')).toHaveAttribute('accept', '.pdf,.docx');
  });

  it('does not crash when drop event has null dataTransfer.files', () => {
    const onAddFiles = vi.fn();
    renderQueue({ onAddFiles });
    fireEvent.drop(screen.getByTestId('upload-dropzone'), { dataTransfer: { files: null } });
    expect(onAddFiles).not.toHaveBeenCalled();
  });

  it('renders progress ring for each status variant without crashing', () => {
    const statuses: Array<UploadFile['status']> = ['pending', 'uploading', 'success', 'error'];
    const queue = statuses.map((status) => makeItem({ status, progress: status === 'success' ? 100 : 50 }));
    renderQueue({ queue, totalCount: 4, successCount: 1, errorCount: 1, uploadingCount: 1 });
    expect(screen.getAllByTestId('upload-queue-row')).toHaveLength(4);
  });

  it('summary bar fill uses success colour class when all complete with no errors', () => {
    const queue = [makeItem({ status: 'success', progress: 100 })];
    renderQueue({ queue, totalCount: 1, successCount: 1, errorCount: 0, overallProgress: 100 });
    const summary = screen.getByTestId('upload-queue-summary');
    const fill = summary.querySelector('.upload-queue__summary-bar-fill');
    expect(fill?.className).toContain('upload-queue__summary-bar-fill--complete');
  });

  it('summary bar fill does not use success colour when errors exist', () => {
    const queue = [
      makeItem({ status: 'success', progress: 100 }),
      makeItem({ status: 'error' }),
    ];
    renderQueue({ queue, totalCount: 2, successCount: 1, errorCount: 1, overallProgress: 50 });
    const summary = screen.getByTestId('upload-queue-summary');
    const fill = summary.querySelector('.upload-queue__summary-bar-fill');
    expect(fill?.className).not.toContain('upload-queue__summary-bar-fill--complete');
  });

  it('row list aria-label uses singular when one file', () => {
    renderQueue({ queue: [makeItem()], totalCount: 1 });
    expect(screen.getByRole('list', { name: /upload queue, 1 file$/i })).toBeInTheDocument();
  });

  it('row list aria-label uses plural when multiple files', () => {
    renderQueue({ queue: [makeItem(), makeItem()], totalCount: 2 });
    expect(screen.getByRole('list', { name: /upload queue, 2 files/i })).toBeInTheDocument();
  });
});
