/**
 * KycDocumentCapture — Identity document capture with tips and lighting guidance (Issue #227).
 *
 * Features:
 * - Camera viewfinder frame with document alignment guides (passport/ID card corners)
 * - Tip carousel: lighting, glare/flash, edges/cropping, flat surface, finger-free
 * - Camera permission prompt with denied-fallback file-upload mode
 * - Portrait/landscape responsive layout
 * - Accessible: aria-live tips, keyboard-navigable, screen-reader fallback
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  Camera,
  Upload,
  Sun,
  Eye,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Smartphone,
  X,
  Image,
} from 'lucide-react';
import './KycDocumentCapture.css';

/* ─── Types ────────────────────────────────────────────────────────── */

export type DocumentType = 'passport' | 'id_card' | 'drivers_license';
export type CameraState = 'prompt' | 'requesting' | 'active' | 'denied' | 'error' | 'unavailable';

export interface KycDocumentCaptureProps {
  /** Document type being captured */
  documentType?: DocumentType;
  /** Called when a photo/file is captured */
  onCapture?: (file: File) => void;
  /** Called when the user skips camera and uses file upload */
  onUseFileUpload?: () => void;
  onClose?: () => void;
  className?: string;
}

/* ─── Tip Data ─────────────────────────────────────────────────────── */

interface Tip {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const CAPTURE_TIPS: Tip[] = [
  {
    icon: <Sun size={20} aria-hidden="true" />,
    title: 'Good Lighting',
    description:
      'Place your document in a well-lit area. Avoid direct sunlight or harsh shadows that can obscure text and photo.',
  },
  {
    icon: <Eye size={20} aria-hidden="true" />,
    title: 'Avoid Glare',
    description:
      'Tilt your document slightly to reduce reflections or glare from overhead lights. A matte surface helps.',
  },
  {
    icon: <Image size={20} aria-hidden="true" />,
    title: 'Show All Edges',
    description:
      'Ensure the entire document is visible within the frame — all four corners should be clearly visible.',
  },
  {
    icon: <Monitor size={20} aria-hidden="true" />,
    title: 'Flat Surface',
    description:
      'Place the document on a flat, uncluttered surface. Avoid holding it in your hand to prevent blur.',
  },
  {
    icon: <Smartphone size={20} aria-hidden="true" />,
    title: 'No Fingers or Objects',
    description:
      'Keep your fingers, pens, and other objects away from the document area. Only the document should be visible.',
  },
];

/* ─── Viewfinder Frame ─────────────────────────────────────────────── */

function ViewfinderFrame({ documentType }: { documentType: DocumentType }) {
  const isPassport = documentType === 'passport';
  return (
    <div
      className={`kdc-viewfinder ${isPassport ? 'kdc-viewfinder--passport' : 'kdc-viewfinder--landscape'}`}
      aria-hidden="true"
      data-testid="viewfinder-frame"
    >
      {/* Corner guides */}
      <div className="kdc-corner kdc-corner--tl" />
      <div className="kdc-corner kdc-corner--tr" />
      <div className="kdc-corner kdc-corner--bl" />
      <div className="kdc-corner kdc-corner--br" />
      {/* Center crosshair */}
      <div className="kdc-crosshair-v" />
      <div className="kdc-crosshair-h" />
      {/* Corner bracket labels */}
      <div className="kdc-viewfinder-label" data-testid="viewfinder-label">
        {isPassport ? 'Align passport photo page' : 'Align ID card within frame'}
      </div>
    </div>
  );
}

/* ─── Tip Carousel ─────────────────────────────────────────────────── */

function TipCarousel({ className = '' }: { className?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const liveId = useId();
  const tip = CAPTURE_TIPS[activeIndex];

  const goNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % CAPTURE_TIPS.length);
  }, []);

  const goPrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + CAPTURE_TIPS.length) % CAPTURE_TIPS.length);
  }, []);

  return (
    <div className={`kdc-tip-carousel ${className}`} data-testid="tip-carousel">
      <div className="kdc-tip-header">Capture Tips</div>
      <div
        className="kdc-tip-card glass-card"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        id={liveId}
        data-testid={`tip-card-${activeIndex}`}
      >
        <div className="kdc-tip-icon-wrap">{tip.icon}</div>
        <div className="kdc-tip-content">
          <div className="kdc-tip-title">{tip.title}</div>
          <p className="kdc-tip-desc">{tip.description}</p>
        </div>
      </div>
      <div className="kdc-tip-controls">
        <button
          type="button"
          className="kdc-tip-nav-btn"
          onClick={goPrev}
          aria-label="Previous tip"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <div className="kdc-tip-dots">
          {CAPTURE_TIPS.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`kdc-tip-dot ${i === activeIndex ? 'kdc-tip-dot--active' : ''}`}
              onClick={() => setActiveIndex(i)}
              aria-label={`Tip ${i + 1} of ${CAPTURE_TIPS.length}`}
              aria-current={i === activeIndex ? 'true' : undefined}
            />
          ))}
        </div>
        <button
          type="button"
          className="kdc-tip-nav-btn"
          onClick={goNext}
          aria-label="Next tip"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/* ─── Camera Active View ───────────────────────────────────────────── */

function CameraActiveView({
  documentType,
  videoRef,
  onCapture,
  onSwitchToUpload,
}: {
  documentType: DocumentType;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onCapture: (file: File) => void;
  onSwitchToUpload: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoadedMetadata = () => {
      if (video.videoWidth > 0) {
        setIsVideoReady(true);
      }
    };

    if (video.videoWidth > 0) {
      setIsVideoReady(true);
    }

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [videoRef]);

  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (e.currentTarget.videoWidth > 0) {
      setIsVideoReady(true);
    }
  }, []);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isVideoReady || isCapturing) return;

    setIsCapturing(true);
    setCaptureError(null);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsCapturing(false);
      setCaptureError('Failed to capture document. Please try again.');
      return;
    }

    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCaptureError('Failed to capture document. Please try again.');
        setIsCapturing(false);
        return;
      }
      setCaptureError(null);
      setIsCapturing(false);
      const file = new File([blob], `document-capture-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });
      onCapture(file);
    }, 'image/jpeg');
  }, [videoRef, isVideoReady, isCapturing, onCapture]);

  return (
    <div className="kdc-camera-active" data-testid="camera-active">
      <div className="kdc-video-wrap">
        <video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          autoPlay
          playsInline
          muted
          className="kdc-video"
          data-testid="camera-video"
          onLoadedMetadata={handleLoadedMetadata}
        />
        <ViewfinderFrame documentType={documentType} />
      </div>
      <canvas ref={canvasRef} className="kdc-canvas" aria-hidden="true" />
      {captureError && (
        <div className="kdc-capture-error" role="alert">
          {captureError}
        </div>
      )}
      <TipCarousel className="kdc-tip-below-video" />
      <div className="kdc-camera-actions">
        <button
          type="button"
          className="kdc-btn kdc-btn--capture"
          onClick={handleCapture}
          aria-label="Take photo"
          aria-busy={isCapturing}
          disabled={!isVideoReady || isCapturing}
        >
          <Camera size={24} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="kdc-btn kdc-btn--ghost"
          onClick={onSwitchToUpload}
        >
          <Upload size={16} aria-hidden="true" />
          Upload file instead
        </button>
      </div>
    </div>
  );
}

/* ─── Camera Permission Prompt ─────────────────────────────────────── */

function CameraPermissionPrompt({
  onRequestCamera,
  onUseFileUpload,
  isRequesting,
}: {
  onRequestCamera: () => void;
  onUseFileUpload: () => void;
  isRequesting: boolean;
}) {
  return (
    <div className="kdc-prompt" data-testid="camera-prompt">
      <div className="kdc-prompt-icon">
        <Camera size={40} aria-hidden="true" />
      </div>
      <h3 className="kdc-prompt-title">Camera Access Required</h3>
      <p className="kdc-prompt-desc">
        We need access to your camera to capture a photo of your identity document.
      </p>
      <TipCarousel />
      <div className="kdc-prompt-actions">
        <button
          type="button"
          className="kdc-btn kdc-btn--primary"
          onClick={onRequestCamera}
          disabled={isRequesting}
          aria-busy={isRequesting}
        >
          {isRequesting ? 'Requesting access…' : 'Enable Camera'}
        </button>
        <button
          type="button"
          className="kdc-btn kdc-btn--secondary"
          onClick={onUseFileUpload}
        >
          <Upload size={16} aria-hidden="true" />
          Upload a photo instead
        </button>
      </div>
    </div>
  );
}

/* ─── Camera Denied / File Upload Fallback ─────────────────────────── */

function CameraDeniedFallback({
  onRetry,
  onCapture,
}: {
  onRetry: () => void;
  onCapture: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      onCapture(file);
    },
    [onCapture],
  );

  return (
    <div className="kdc-prompt" data-testid="camera-denied">
      <div className="kdc-prompt-icon kdc-prompt-icon--warning">
        <AlertTriangle size={40} aria-hidden="true" />
      </div>
      <h3 className="kdc-prompt-title">Camera Access Denied</h3>
      <p className="kdc-prompt-desc">
        Camera access was denied or is unavailable. You can upload a clear photo of your
        document instead. Make sure the entire document is visible and well-lit.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="kdc-file-input-hidden"
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        type="button"
        className="kdc-btn kdc-btn--primary kdc-btn--full"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={16} aria-hidden="true" />
        Select a photo from your device
      </button>
      <button
        type="button"
        className="kdc-btn kdc-btn--ghost"
        onClick={onRetry}
      >
        <RefreshCw size={14} aria-hidden="true" />
        Try camera again
      </button>
    </div>
  );
}

/* ─── Captured Preview ─────────────────────────────────────────────── */

function CapturedPreview({
  imageUrl,
  onRetake,
  onConfirm,
}: {
  imageUrl: string;
  onRetake: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="kdc-captured" data-testid="captured-preview">
      <div className="kdc-captured-icon">
        <CheckCircle2 size={48} aria-hidden="true" />
      </div>
      <h3 className="kdc-captured-title">Document Captured</h3>
      <img
        src={imageUrl}
        alt="Captured document preview"
        className="kdc-captured-image"
      />
      <div className="kdc-captured-actions">
        <button
          type="button"
          className="kdc-btn kdc-btn--secondary"
          onClick={onRetake}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Retake
        </button>
        <button
          type="button"
          className="kdc-btn kdc-btn--primary"
          onClick={onConfirm}
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          Use this photo
        </button>
      </div>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────── */

export const KycDocumentCapture: React.FC<KycDocumentCaptureProps> = ({
  documentType = 'id_card',
  onCapture,
  onUseFileUpload: externalUseFileUpload,
  onClose,
  className = '',
}) => {
  const [cameraState, setCameraState] = useState<CameraState>('prompt');
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturedUrlRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Cleanup stream and object URL on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current && typeof streamRef.current.getTracks === 'function') {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (capturedUrlRef.current) {
        URL.revokeObjectURL(capturedUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (cameraState === 'active' && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      try {
        const playPromise = video.play?.();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      } catch {
        // Ignore play interruption or unsupported environments
      }
    }
  }, [cameraState]);

  const requestCamera = useCallback(async () => {
    setCameraState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setCameraState('active');
    } catch (err) {
      if (!isMountedRef.current) return;
      if ((err as DOMException).name === 'NotAllowedError') {
        setCameraState('denied');
      } else {
        setCameraState('unavailable');
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current && typeof streamRef.current.getTracks === 'function') {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleCapture = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      capturedUrlRef.current = url;
      setCapturedUrl(url);
      stopCamera();
    },
    [stopCamera],
  );

  const handleRetake = useCallback(() => {
    if (capturedUrlRef.current) {
      URL.revokeObjectURL(capturedUrlRef.current);
      capturedUrlRef.current = null;
    }
    setCapturedUrl(null);
    setCameraState('prompt');
  }, []);

  const handleConfirmCapture = useCallback(() => {
    if (capturedUrl && onCapture) {
      // Fetch the file from the blob URL
      fetch(capturedUrl)
        .then((r) => r.blob())
        .then((blob) => {
          const file = new File([blob], `document-${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });
          onCapture(file);
        })
        .catch(() => {
          // Fallback: if fetch fails, we still have the blob URL
          // Parent component should handle the URL
        });
    }
    if (capturedUrlRef.current) {
      URL.revokeObjectURL(capturedUrlRef.current);
      capturedUrlRef.current = null;
    }
    handleRetake();
  }, [capturedUrl, onCapture, handleRetake]);

  const handleUseFileUpload = useCallback(() => {
    stopCamera();
    externalUseFileUpload?.();
  }, [externalUseFileUpload, stopCamera]);

  const handleFileCapture = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      capturedUrlRef.current = url;
      setCapturedUrl(url);
    },
    [],
  );

  return (
    <div className={`kdc-container ${className}`} data-testid="kyc-document-capture">
      {/* Header */}
      <div className="kdc-header">
        <h2 className="kdc-title">Capture Identity Document</h2>
        <p className="kdc-subtitle">
          {documentType === 'passport'
            ? 'Take a photo of your passport photo page'
            : documentType === 'drivers_license'
              ? 'Take a photo of your driver\'s license'
              : 'Take a photo of your government-issued ID card'}
        </p>
        {onClose && (
          <button
            type="button"
            className="kdc-close-btn"
            onClick={onClose}
            aria-label="Close document capture"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Body */}
      {capturedUrl ? (
        <CapturedPreview
          imageUrl={capturedUrl}
          onRetake={handleRetake}
          onConfirm={handleConfirmCapture}
        />
      ) : cameraState === 'active' ? (
        <CameraActiveView
          documentType={documentType}
          videoRef={videoRef}
          onCapture={handleCapture}
          onSwitchToUpload={handleUseFileUpload}
        />
      ) : cameraState === 'denied' || cameraState === 'unavailable' ? (
        <CameraDeniedFallback
          onRetry={requestCamera}
          onCapture={handleFileCapture}
        />
      ) : (
        <CameraPermissionPrompt
          onRequestCamera={requestCamera}
          onUseFileUpload={handleUseFileUpload}
          isRequesting={cameraState === 'requesting'}
        />
      )}
    </div>
  );
};
