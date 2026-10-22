/**
 * Tests for KycDocumentCapture (Issue #227).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { KycDocumentCapture, DocumentType } from './KycDocumentCapture';

expect.extend(toHaveNoViolations);

// Mock getUserMedia
const mockGetUserMedia = vi.fn();
Object.defineProperty(navigator, 'mediaDevices', {
  value: { getUserMedia: mockGetUserMedia },
  configurable: true,
});

const createMockStream = (trackStopSpy: ReturnType<typeof vi.fn>) => ({
  getTracks: () => [{ stop: trackStopSpy }],
});

const setupCanvasMock = () => {
  const mockContext = {
    drawImage: vi.fn(),
  };
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockContext);
  HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
    callback(new Blob(['mock'], { type: 'image/jpeg' }));
  });
};

describe('KycDocumentCapture', () => {
  let trackStopSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGetUserMedia.mockReset();
    trackStopSpy = vi.fn();
    Object.defineProperty(global, 'URL', {
      value: {
        createObjectURL: vi.fn(() => 'blob:mock-url'),
        revokeObjectURL: vi.fn(),
      },
      configurable: true,
    });
    setupCanvasMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('renders with camera permission prompt by default', () => {
      render(<KycDocumentCapture />);

      expect(screen.getByTestId('kyc-document-capture')).toBeInTheDocument();
      expect(screen.getByTestId('camera-prompt')).toBeInTheDocument();
      expect(
        screen.getByText('Camera Access Required'),
      ).toBeInTheDocument();
    });

    it('renders the appropriate document type label', () => {
      render(<KycDocumentCapture documentType="passport" />);

      expect(
        screen.getByText(/photo of your passport photo page/i),
      ).toBeInTheDocument();
    });

    it('renders with document type "id_card" by default', () => {
      render(<KycDocumentCapture />);

      expect(
        screen.getByText(/photo of your government-issued ID card/i),
      ).toBeInTheDocument();
    });

    it('renders driver\'s license label', () => {
      render(<KycDocumentCapture documentType="drivers_license" />);

      expect(
        screen.getByText(/photo of your driver's license/i),
      ).toBeInTheDocument();
    });
  });

  describe('Tip Carousel', () => {
    it('renders tip carousel on the permission prompt', () => {
      render(<KycDocumentCapture />);

      expect(screen.getByTestId('tip-carousel')).toBeInTheDocument();
      expect(screen.getByText('Capture Tips')).toBeInTheDocument();
    });

    it('shows the first tip by default', () => {
      render(<KycDocumentCapture />);

      expect(screen.getByTestId('tip-card-0')).toBeInTheDocument();
      expect(screen.getByText('Good Lighting')).toBeInTheDocument();
    });

    it('navigates tips with next button', () => {
      render(<KycDocumentCapture />);

      const nextBtn = screen.getByLabelText('Next tip');
      fireEvent.click(nextBtn);

      expect(screen.getByTestId('tip-card-1')).toBeInTheDocument();
      expect(screen.getByText('Avoid Glare')).toBeInTheDocument();
    });

    it('navigates tips with previous button', () => {
      render(<KycDocumentCapture />);

      const nextBtn = screen.getByLabelText('Next tip');
      fireEvent.click(nextBtn);
      fireEvent.click(nextBtn);

      const prevBtn = screen.getByLabelText('Previous tip');
      fireEvent.click(prevBtn);

      expect(screen.getByTestId('tip-card-1')).toBeInTheDocument();
    });

    it('wraps around from last tip to first', () => {
      render(<KycDocumentCapture />);

      const nextBtn = screen.getByLabelText('Next tip');
      // Click 5 times to go through all 5 tips and wrap
      for (let i = 0; i < 5; i++) {
        fireEvent.click(nextBtn);
      }

      expect(screen.getByTestId('tip-card-0')).toBeInTheDocument();
    });

    it('allows jumping to a specific tip via dot buttons', () => {
      render(<KycDocumentCapture />);

      const dot3 = screen.getByLabelText('Tip 3 of 5');
      fireEvent.click(dot3);

      expect(screen.getByTestId('tip-card-2')).toBeInTheDocument();
      expect(screen.getByText('Show All Edges')).toBeInTheDocument();
    });

    it('marks the active dot with aria-current', () => {
      render(<KycDocumentCapture />);

      const firstDot = screen.getByLabelText('Tip 1 of 5');
      expect(firstDot).toHaveAttribute('aria-current', 'true');
    });
  });

  describe('Camera Request Flow', () => {
    it('shows requesting state when Enable Camera is clicked', () => {
      mockGetUserMedia.mockImplementation(
        () => new Promise(() => {}), // never resolves
      );

      render(<KycDocumentCapture />);
      fireEvent.click(screen.getByText('Enable Camera'));

      expect(screen.getByText('Requesting access…')).toBeInTheDocument();
    });

    it('shows denied state when camera permission is denied', async () => {
      mockGetUserMedia.mockRejectedValue(
        new DOMException('Permission denied', 'NotAllowedError'),
      );

      render(<KycDocumentCapture />);
      fireEvent.click(screen.getByText('Enable Camera'));

      // Wait for async rejection
      expect(await screen.findByTestId('camera-denied')).toBeInTheDocument();
      expect(screen.getByText('Camera Access Denied')).toBeInTheDocument();
    });

    it('shows denied state for unavailable cameras', async () => {
      mockGetUserMedia.mockRejectedValueOnce(
        new DOMException('No camera found', 'NotFoundError')
      );

      render(<KycDocumentCapture />);
      fireEvent.click(screen.getByText('Enable Camera'));

      expect(await screen.findByTestId('camera-denied')).toBeInTheDocument();
    });
  });

  describe('File Upload Fallback', () => {
    it('shows file upload button on permission prompt', () => {
      render(<KycDocumentCapture />);

      expect(
        screen.getByText('Upload a photo instead'),
      ).toBeInTheDocument();
    });

    it('shows file upload option in denied state', async () => {
      mockGetUserMedia.mockRejectedValue(
        new DOMException('Permission denied', 'NotAllowedError'),
      );

      render(<KycDocumentCapture />);
      fireEvent.click(screen.getByText('Enable Camera'));

      expect(await screen.findByText(/Select a photo from your device/i)).toBeInTheDocument();
    });

    it('shows retry camera button in denied state', async () => {
      mockGetUserMedia.mockRejectedValue(
        new DOMException('Permission denied', 'NotAllowedError'),
      );

      render(<KycDocumentCapture />);
      fireEvent.click(screen.getByText('Enable Camera'));

      expect(await screen.findByText(/Try camera again/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has no axe violations on permission prompt', async () => {
      const { container } = render(<KycDocumentCapture />);

      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations on denied fallback', async () => {
      mockGetUserMedia.mockRejectedValue(
        new DOMException('Permission denied', 'NotAllowedError'),
      );

      const { container } = render(<KycDocumentCapture />);
      fireEvent.click(screen.getByText('Enable Camera'));

      await screen.findByTestId('camera-denied');
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('Camera stream attachment and capture flow', () => {
    it('attaches stream to video.srcObject and calls play() after camera activation', async () => {
      const mockTrack = { stop: vi.fn(), kind: 'video' };
      const fakeStream = {
        getTracks: vi.fn().mockReturnValue([mockTrack]),
        getVideoTracks: vi.fn().mockReturnValue([mockTrack]),
      } as unknown as MediaStream;

      const playSpy = vi.fn().mockResolvedValue(undefined);
      window.HTMLMediaElement.prototype.play = playSpy;

      mockGetUserMedia.mockResolvedValue(fakeStream);

      render(<KycDocumentCapture />);
      fireEvent.click(screen.getByText('Enable Camera'));

      const video = (await screen.findByTestId('camera-video')) as HTMLVideoElement;
      expect(video).toBeTruthy();
      expect(video.srcObject).toBe(fakeStream);
      expect(playSpy).toHaveBeenCalled();
    });

    it('keeps capture button disabled until loadedmetadata fires with non-zero videoWidth', async () => {
      const mockTrack = { stop: vi.fn(), kind: 'video' };
      const fakeStream = {
        getTracks: vi.fn().mockReturnValue([mockTrack]),
        getVideoTracks: vi.fn().mockReturnValue([mockTrack]),
      } as unknown as MediaStream;
      window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);

      mockGetUserMedia.mockResolvedValue(fakeStream);

      render(<KycDocumentCapture />);
      fireEvent.click(screen.getByText('Enable Camera'));

      const captureBtn = await screen.findByRole('button', { name: /take photo/i });
      const video = screen.getByTestId('camera-video') as HTMLVideoElement;

      // Initially disabled before metadata
      expect(captureBtn).toBeDisabled();

      // If loadedmetadata fires with videoWidth === 0, stays disabled
      Object.defineProperty(video, 'videoWidth', { value: 0, configurable: true });
      fireEvent(video, new Event('loadedmetadata'));
      expect(captureBtn).toBeDisabled();

      // Once loadedmetadata fires with non-zero videoWidth, becomes enabled
      Object.defineProperty(video, 'videoWidth', { value: 1280, configurable: true });
      Object.defineProperty(video, 'videoHeight', { value: 720, configurable: true });
      fireEvent(video, new Event('loadedmetadata'));

      expect(captureBtn).toBeEnabled();
    });

    it('handles null blob from toBlob with a visible error and keeps stream running for retry', async () => {
      const mockTrack = { stop: vi.fn(), kind: 'video' };
      const fakeStream = {
        getTracks: vi.fn().mockReturnValue([mockTrack]),
        getVideoTracks: vi.fn().mockReturnValue([mockTrack]),
      } as unknown as MediaStream;
      window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);

      mockGetUserMedia.mockResolvedValue(fakeStream);

      HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
        drawImage: vi.fn(),
      }) as unknown as typeof HTMLCanvasElement.prototype.getContext;

      // First produce null blob
      HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
        callback(null);
      });

      render(<KycDocumentCapture />);
      fireEvent.click(screen.getByText('Enable Camera'));

      const captureBtn = await screen.findByRole('button', { name: /take photo/i });
      const video = screen.getByTestId('camera-video') as HTMLVideoElement;

      Object.defineProperty(video, 'videoWidth', { value: 1280, configurable: true });
      Object.defineProperty(video, 'videoHeight', { value: 720, configurable: true });
      fireEvent(video, new Event('loadedmetadata'));
      expect(captureBtn).toBeEnabled();

      // Click capture with null blob
      fireEvent.click(captureBtn);

      // Visible error shown
      const errorMsg = await screen.findByRole('alert');
      expect(errorMsg).toHaveTextContent(/failed to capture document/i);

      // Stream is not stopped (kept running for retry)
      expect(mockTrack.stop).not.toHaveBeenCalled();

      // Now retry when toBlob produces a valid blob
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/doc-ok');
      (HTMLCanvasElement.prototype.toBlob as ReturnType<typeof vi.fn>).mockImplementation((callback) => {
        callback(new Blob(['document-data'], { type: 'image/jpeg' }));
      });

      fireEvent.click(captureBtn);

      // Transitions to preview and stops stream on success
      await screen.findByText(/Use this photo/i);
      expect(mockTrack.stop).toHaveBeenCalled();
    });
  });
});
