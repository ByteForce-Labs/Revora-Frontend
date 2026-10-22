/**
 * KycSelfieCapture — Selfie capture with permission primer, face-alignment
 * oval overlay, and review/retake screen (Issue #228).
 *
 * Flow:
 *   1. Permission primer — explains why camera is needed with privacy copy.
 *   2. Camera viewport — full-screen-like with face-alignment oval overlay.
 *   3. Preview & retake — captured image shown with confirm/retake actions.
 *
 * Features:
 * - Permission denied → file upload fallback
 * - Camera unavailable → informative error with troubleshooting tips
 * - WCAG 2.1 AA: aria-live regions, keyboard navigation, focus management
 * - Responsive: 3:4 viewport on desktop, 4:5 on mobile
 * - Design-token theming for light/dark mode
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  Camera,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Eye,
  X,
} from 'lucide-react';
import './KycSelfieCapture.css';

/* ─── Types ────────────────────────────────────────────────────────── */

export type SelfieCameraState =
  | 'primer'       // Permission primer screen
  | 'requesting'   // Browser is prompting for permission
  | 'active'       // Camera is live
  | 'denied'       // User denied camera permission
  | 'error'        // Camera hardware error
  | 'unavailable'; // No camera found

export interface KycSelfieCaptureProps {
  /** Called when a selfie photo is captured */
  onCapture?: (file: File) => void;
  /** Called when the user opts for file upload instead */
  onUseFileUpload?: () => void;
  onClose?: () => void;
  className?: string;
}

/* ─── Component ────────────────────────────────────────────────────── */

export default function KycSelfieCapture({
  onCapture,
  onUseFileUpload,
  onClose,
  className,
}: KycSelfieCaptureProps) {
  const titleId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturedImageRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const [cameraState, setCameraState] = useState<SelfieCameraState>('primer');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

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
      if (capturedImageRef.current) {
        URL.revokeObjectURL(capturedImageRef.current);
      }
    };
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current && typeof streamRef.current.getTracks === 'function') {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsVideoReady(false);
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
    } else {
      setIsVideoReady(false);
    }
  }, [cameraState]);

  const startCamera = useCallback(async () => {
    setCameraState('requesting');
    setIsVideoReady(false);
    setCaptureError(null);
    await Promise.resolve();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState('unavailable');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setCameraState('active');
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      if (err instanceof DOMException || err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraState('denied');
        } else if (err.name === 'NotFoundError') {
          setCameraState('unavailable');
        } else {
          setCameraState('error');
        }
      } else {
        setCameraState('error');
      }
    }
  }, []);

  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (e.currentTarget.videoWidth > 0) {
      setIsVideoReady(true);
    }
  }, []);

  const capturePhoto = useCallback(() => {
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
      setCaptureError('Failed to capture photo. Please try again.');
      return;
    }

    // Mirror the image horizontally for selfie (front camera)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        setCaptureError(null);
        const file = new File([blob], 'selfie.png', { type: 'image/png' });
        setCapturedFile(file);
        const objectUrl = URL.createObjectURL(blob);
        capturedImageRef.current = objectUrl;
        setCapturedImage(objectUrl);
        setIsCapturing(false);
        stopStream();
      } else {
        setCaptureError('Failed to capture photo. Please try again.');
        setIsCapturing(false);
      }
    }, 'image/png');
  }, [isVideoReady, isCapturing, stopStream]);

  const handleRetake = useCallback(() => {
    if (capturedImageRef.current) {
      URL.revokeObjectURL(capturedImageRef.current);
      capturedImageRef.current = null;
    }
    setCapturedImage(null);
    setCapturedFile(null);
    setCaptureError(null);
    startCamera();
  }, [startCamera]);

  const handleConfirm = useCallback(() => {
    if (capturedFile && onCapture) {
      onCapture(capturedFile);
    }
    if (capturedImageRef.current) {
      URL.revokeObjectURL(capturedImageRef.current);
      capturedImageRef.current = null;
    }
  }, [capturedFile, onCapture]);

  const handleFallbackUpload = useCallback(() => {
    onUseFileUpload?.();
  }, [onUseFileUpload]);

  // ── Render: Permission Primer ────────────────────────────────────────

  if (cameraState === 'primer') {
    return (
      <div className={`ksc-container${className ? ` ${className}` : ''}`}>
        <div className="ksc-header">
          <h2 id={titleId} className="ksc-title">Verify Your Identity</h2>
          <p className="ksc-subtitle">Take a selfie to complete verification</p>
          {onClose && (
            <button
              type="button"
              className="ksc-close-btn"
              onClick={onClose}
              aria-label="Close selfie capture"
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="ksc-permission-primer" role="region" aria-labelledby={titleId}>
          <Camera className="ksc-permission-primer__icon" aria-hidden="true" />
          <h3 className="ksc-permission-primer__heading">Camera access needed</h3>
          <ul className="ksc-permission-primer__reason-list">
            <li className="ksc-permission-primer__reason">
              <Shield className="ksc-permission-primer__reason-icon" size={16} aria-hidden="true" />
              <span>Match your face to the ID document you provided</span>
            </li>
            <li className="ksc-permission-primer__reason">
              <Eye className="ksc-permission-primer__reason-icon" size={16} aria-hidden="true" />
              <span>Prevent unauthorised account access or fraud</span>
            </li>
            <li className="ksc-permission-primer__reason">
              <Camera className="ksc-permission-primer__reason-icon" size={16} aria-hidden="true" />
              <span>Real-time liveness check for security</span>
            </li>
          </ul>
          <p className="ksc-permission-primer__privacy-note">
            Your photo is encrypted in transit and at rest. It is used solely for
            identity verification and retained only for the duration required by
            our <a href="/privacy" target="_blank" rel="noopener noreferrer">data-retention policy</a>.
            You can request deletion at any time.
          </p>
          <div className="ksc-permission-primer__actions">
            <button
              type="button"
              className="ksc-btn ksc-btn--primary"
              onClick={startCamera}
              aria-label="Allow camera access"
            >
              <Camera size={16} aria-hidden="true" />
              Continue with camera
            </button>
            <button
              type="button"
              className="ksc-btn ksc-btn--secondary"
              onClick={handleFallbackUpload}
            >
              <Upload size={16} aria-hidden="true" />
              Upload a photo instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Camera Requesting ────────────────────────────────────────

  if (cameraState === 'requesting') {
    return (
      <div className={`ksc-container${className ? ` ${className}` : ''}`}>
        <div className="ksc-header">
          <h2 id={titleId} className="ksc-title">Starting camera…</h2>
          <p className="ksc-subtitle">Please allow camera access when prompted</p>
          {onClose && (
            <button
              type="button"
              className="ksc-close-btn"
              onClick={onClose}
              aria-label="Close selfie capture"
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="ksc-fallback">
          <RefreshCw className="ksc-fallback__icon" aria-hidden="true" />
          <h3 className="ksc-fallback__heading">Waiting for camera permission…</h3>
          <p className="ksc-fallback__text">
            Check your browser prompt and grant permission to use the camera.
          </p>
        </div>
      </div>
    );
  }

  // ── Render: Camera Denied / Unavailable / Error ──────────────────────

  if (cameraState === 'denied' || cameraState === 'unavailable' || cameraState === 'error') {
    const heading =
      cameraState === 'denied'
        ? 'Camera access denied'
        : cameraState === 'unavailable'
        ? 'No camera found'
        : 'Camera error';

    const message =
      cameraState === 'denied'
        ? 'Camera permission was denied. Please allow camera access in your browser settings, or upload a photo instead.'
        : cameraState === 'unavailable'
        ? 'No compatible camera device was detected. Please connect a camera or upload a photo.'
        : 'An error occurred while attempting to access your camera. Please try again or upload a photo.';

    return (
      <div className={`ksc-container${className ? ` ${className}` : ''}`}>
        <div className="ksc-header">
          <h2 id={titleId} className="ksc-title">Verify Your Identity</h2>
          <p className="ksc-subtitle">Take a selfie to complete verification</p>
          {onClose && (
            <button
              type="button"
              className="ksc-close-btn"
              onClick={onClose}
              aria-label="Close selfie capture"
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="ksc-denied" role="alert">
          <AlertTriangle className="ksc-denied__icon" aria-hidden="true" />
          <h3 className="ksc-denied__heading">{heading}</h3>
          <p className="ksc-denied__text">{message}</p>
          <div className="ksc-permission-primer__actions">
            <button
              type="button"
              className="ksc-btn ksc-btn--primary"
              onClick={startCamera}
              aria-label="Try again"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Try again
            </button>
            <button
              type="button"
              className="ksc-btn ksc-btn--secondary"
              onClick={handleFallbackUpload}
              aria-label="Upload a photo"
            >
              <Upload size={16} aria-hidden="true" />
              Upload a photo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Preview & Retake ──────────────────────────────────────────

  if (capturedImage) {
    return (
      <div className={`ksc-container${className ? ` ${className}` : ''}`}>
        <div className="ksc-header">
          <h2 id={titleId} className="ksc-title">Review Your Selfie</h2>
          <p className="ksc-subtitle">Make sure your face is clearly visible and well-lit</p>
          {onClose && (
            <button
              type="button"
              className="ksc-close-btn"
              onClick={onClose}
              aria-label="Close selfie capture"
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="ksc-preview">
          <img
            src={capturedImage}
            alt="Captured selfie"
            className="ksc-preview__image"
          />
          <div className="ksc-preview__actions">
            <button
              type="button"
              className="ksc-btn ksc-btn--secondary"
              onClick={handleRetake}
              aria-label="Retake photo"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Retake photo
            </button>
            <button
              type="button"
              className="ksc-btn ksc-btn--primary"
              onClick={handleConfirm}
              aria-label="Use this photo"
            >
              <CheckCircle2 size={16} aria-hidden="true" />
              Use this photo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Active Camera Viewport ────────────────────────────────────

  return (
    <div className={`ksc-container${className ? ` ${className}` : ''}`}>
      <div className="ksc-header">
        <h2 id={titleId} className="ksc-title">Take a Selfie</h2>
        <p className="ksc-subtitle">Align your face inside the oval frame</p>
        {onClose && (
          <button
            type="button"
            className="ksc-close-btn"
            onClick={onClose}
            aria-label="Close selfie capture"
          >
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="ksc-camera-viewport">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label="Camera feed"
          onLoadedMetadata={handleLoadedMetadata}
        />
        <div className="ksc-face-oval" aria-hidden="true">
          <span className="ksc-face-oval__label">Align your face within the frame</span>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {captureError && (
        <div className="ksc-capture-error" role="alert">
          {captureError}
        </div>
      )}

      <div className="ksc-camera-toolbar">
        <button
          type="button"
          className="ksc-capture-btn"
          onClick={capturePhoto}
          aria-label="Capture photo"
          aria-busy={isCapturing}
          disabled={!isVideoReady || isCapturing}
        >
          <span className="ksc-capture-btn__inner" />
        </button>
      </div>
    </div>
  );
}
