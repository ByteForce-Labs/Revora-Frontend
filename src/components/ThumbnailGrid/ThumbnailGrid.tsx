import React, { useCallback, useId, useRef, useState } from 'react';
import {
  FileImage,
  FileText,
  FileSpreadsheet,
  FileCode,
  Film,
  FolderOpen,
  Eye,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  FileType,
  type LucideIcon,
} from 'lucide-react';
import './ThumbnailGrid.css';

export interface ThumbnailFile {
  id: string;
  name: string;
  size: number;
  type: string;
  previewUrl?: string;
}

export interface ThumbnailGridProps {
  files: ThumbnailFile[];
  onView: (file: ThumbnailFile) => void;
  onReplace: (file: ThumbnailFile) => void;
  onRemove: (fileId: string) => void;
  onReorder?: (fileIds: string[]) => void;
  className?: string;
  dir?: 'ltr' | 'rtl';
}

/* ─── File-type icon map ──────────────────────────────────── */

const FILE_TYPE_ICONS: Record<string, LucideIcon> = {
  image: FileImage,
  video: Film,
  pdf: FileText,
  spreadsheet: FileSpreadsheet,
  code: FileCode,
  archive: FolderOpen,
};

function getFileTypeCategory(mimeType: string, extension: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'pdf';
  if (/\.(xlsx?|csv|ods)$/i.test(extension)) return 'spreadsheet';
  if (/\.(js|ts|tsx|jsx|py|java|cpp|go|rs)$/i.test(extension)) return 'code';
  if (/\.(zip|tar|gz|rar|7z)$/i.test(extension)) return 'archive';
  return 'other';
}

function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx === -1 ? '' : filename.substring(idx);
}

/* ─── Human-readable file size ────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ─── Live region for reorder announcements ───────────────── */

function useReorderAnnouncement() {
  const [announcement, setAnnouncement] = useState('');
  const id = useId();
  const say = useCallback((msg: string) => setAnnouncement(msg), []);
  return { announcement, say, id };
}

/* ─── Thumbnail Tile ──────────────────────────────────────── */

interface TileProps {
  file: ThumbnailFile;
  index: number;
  total: number;
  onView: (f: ThumbnailFile) => void;
  onReplace: (f: ThumbnailFile) => void;
  onRemove: (id: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  labelId: string;
}

const ThumbnailTile: React.FC<TileProps> = ({
  file,
  index,
  total,
  onView,
  onReplace,
  onRemove,
  onMoveUp,
  onMoveDown,
  labelId,
}) => {
  const ext = getFileExtension(file.name);
  const typeCat = getFileTypeCategory(file.type, ext);
  const IconComponent = FILE_TYPE_ICONS[typeCat] || FileType;

  const isPreviewable = typeCat === 'image' || (file.previewUrl != null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); onMoveUp?.(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); onMoveDown?.(); }
    },
    [onMoveUp, onMoveDown],
  );

  return (
    <div
      className="thumbnail-grid__tile"
      role="listitem"
      aria-labelledby={labelId}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-testid={`thumbnail-tile-${file.id}`}
      data-index={index}
    >
      {/* Preview area */}
      <div className="thumbnail-grid__preview">
        {isPreviewable ? (
          <img
            className="thumbnail-grid__preview-img"
            src={file.previewUrl}
            alt=""
            loading="lazy"
          />
        ) : (
          <div className="thumbnail-grid__preview-icon">
            <IconComponent size={32} />
          </div>
        )}

        {/* Hover/focus overlay with quick actions */}
        <div className="thumbnail-grid__overlay">
          <button
            type="button"
            className="thumbnail-grid__action-btn"
            aria-label={`View ${file.name}`}
            onClick={() => onView(file)}
            data-testid={`view-btn-${file.id}`}
          >
            <Eye size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="thumbnail-grid__action-btn"
            aria-label={`Replace ${file.name}`}
            onClick={() => onReplace(file)}
            data-testid={`replace-btn-${file.id}`}
          >
            <Upload size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="thumbnail-grid__action-btn thumbnail-grid__action-btn--remove"
            aria-label={`Remove ${file.name}`}
            onClick={() => onRemove(file.id)}
            data-testid={`remove-btn-${file.id}`}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Reorder arrows */}
      <div className="thumbnail-grid__reorder">
        <button
          type="button"
          className="thumbnail-grid__reorder-btn"
          aria-label={`Move ${file.name} up`}
          disabled={index === 0}
          onClick={onMoveUp}
          tabIndex={-1}
          data-testid={`move-up-btn-${file.id}`}
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        <span className="thumbnail-grid__reorder-index">{index + 1}</span>
        <button
          type="button"
          className="thumbnail-grid__reorder-btn"
          aria-label={`Move ${file.name} down`}
          disabled={index === total - 1}
          onClick={onMoveDown}
          tabIndex={-1}
          data-testid={`move-down-btn-${file.id}`}
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>

      {/* Metadata */}
      <div className="thumbnail-grid__meta">
        <span
          id={labelId}
          className="thumbnail-grid__filename"
          title={file.name}
        >
          {file.name}
        </span>
        <span className="thumbnail-grid__filesize">{formatBytes(file.size)}</span>
      </div>
    </div>
  );
};

/* ─── ThumbnailGrid ───────────────────────────────────────── */

export const ThumbnailGrid: React.FC<ThumbnailGridProps> = ({
  files,
  onView,
  onReplace,
  onRemove,
  onReorder,
  className = '',
  dir = 'ltr',
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const baseLabelId = useId();
  const { announcement, say, id: liveId } = useReorderAnnouncement();

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      const next = [...files];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      onReorder?.(next.map((f) => f.id));
      say(`Moved ${files[index].name} to position ${index}`);
    },
    [files, onReorder, say],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= files.length - 1) return;
      const next = [...files];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      onReorder?.(next.map((f) => f.id));
      say(`Moved ${files[index].name} to position ${index + 2}`);
    },
    [files, onReorder, say],
  );

  if (files.length === 0) {
    return (
      <div
        className={`thumbnail-grid thumbnail-grid--empty ${className}`}
        role="region"
        aria-label="Uploaded documents grid, empty"
        data-testid="thumbnail-grid"
        dir={dir}
      >
        <p className="thumbnail-grid__empty-text">No uploaded documents yet.</p>
      </div>
    );
  }

  return (
    <>
      {/* Live region for reorder announcements (outside role=list) */}
      <div
        id={liveId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="thumbnail-live-region"
      >
        {announcement}
      </div>
      <div
        ref={gridRef}
        className={`thumbnail-grid ${className}`}
        role="list"
        aria-label={`Uploaded documents grid, ${files.length} file${files.length !== 1 ? 's' : ''}`}
        data-testid="thumbnail-grid"
        dir={dir}
      >
        {files.map((file, idx) => (
          <ThumbnailTile
            key={file.id}
            file={file}
            index={idx}
            total={files.length}
            onView={onView}
            onReplace={onReplace}
            onRemove={onRemove}
            onMoveUp={() => handleMoveUp(idx)}
            onMoveDown={() => handleMoveDown(idx)}
            labelId={`${baseLabelId}-${idx}`}
          />
        ))}
      </div>
    </>
  );
};

ThumbnailGrid.displayName = 'ThumbnailGrid';
