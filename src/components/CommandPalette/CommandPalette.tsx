/**
 * CommandPalette
 *
 * A WCAG 2.1 AA compliant command palette with:
 *  - Grouped results (Navigate / Actions / Settings)
 *  - Per-group result limits
 *  - Recent Actions section (top 5 most-recent, per-user, persisted)
 *  - Clear-history control
 *  - Empty-query state that emphasises recents (or a "start typing" prompt)
 *  - Full keyboard navigation: ↑/↓ move through items, Enter activates,
 *    Escape closes
 *  - Inline confirmation for destructive commands (Issue #500):
 *    destructive rows swap into a two-button confirm/cancel row with a
 *    500ms activation delay
 *  - Focus trap, body scroll lock, focus restore on close
 *  - RTL-aware (logical CSS properties + [dir="rtl"] overrides in CSS)
 *  - Reduced-motion safe
 *
 * Accessibility roles:
 *  - role="dialog" aria-modal on the container
 *  - role="combobox" on the search <input> with aria-controls pointing at the
 *    result listbox
 *  - role="listbox" + aria-label on the results wrapper
 *  - role="option" aria-selected on each result item
 *  - role="status" aria-live="polite" for announcements (result count)
 *  - role="group" aria-label on each section within the listbox
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  Search,
  Home,
  LayoutDashboard,
  Bell,
  Keyboard,
  PlusCircle,
  Download,
  LogOut,
  AlignJustify,
  UserCog,
  ShieldCheck,
  Globe,
  ClipboardList,
  Monitor,
  Calendar,
  BarChart2,
  Clock,
  X,
  ChevronRight,
  AlertTriangle,
  LoaderCircle,
  type LucideIcon,
} from 'lucide-react';
import type { CommandItem, CommandGroup } from './commandPaletteData';
import {
  COMMAND_GROUPS,
  groupSearchResults,
  searchCommands,
} from './commandPaletteData';
import { formatKeyLabels, shortcutAriaLabel } from '../../utils/keyLabels';
import './CommandPalette.css';

// ---------------------------------------------------------------------------
// Icon resolver
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  LayoutDashboard,
  Search,
  BarChart2,
  Calendar,
  ClipboardList,
  Monitor,
  Bell,
  Keyboard,
  PlusCircle,
  Download,
  LogOut,
  AlignJustify,
  UserCog,
  ShieldCheck,
  Globe,
  Clock,
  ChevronRight,
  AlertTriangle,
  LoaderCircle,
  X,
};

function CommandIcon({
  name,
  size = 16,
}: {
  name?: string;
  size?: number;
}) {
  if (!name) return null;
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon size={size} aria-hidden={true} />;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  isMac: boolean;
  /** Stable user id — scopes recent-actions storage key */
  userId?: string;
  /** Recent commands from useCommandPalette hook */
  recentCommands: CommandItem[];
  /** Called after the user activates a command */
  onCommandExecute: (item: CommandItem) => void;
  /** Called when the user clicks "Clear history" */
  onClearRecent: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette({
  isOpen,
  onClose,
  isMac,
  recentCommands,
  onCommandExecute,
  onClearRecent,
}: CommandPaletteProps) {
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const inputId = `${dialogId}-input`;
  const bodyId = `${dialogId}-body`;
  const statusId = `${dialogId}-status`;

  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Ref mirror of confirmingItemId so the keyboard handler never captures stale state. */
  const confirmingItemIdRef = useRef<string | null>(null);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [announcement, setAnnouncement] = useState('');
  /** When set, the row for this id is in inline-confirmation mode. */
  const [confirmingItemId, setConfirmingItemId] = useState<string | null>(null);
  /** Whether the confirm button's 500ms activation delay has elapsed. */
  const [confirmDelayElapsed, setConfirmDelayElapsed] = useState(false);

  // Keep ref in sync with state
  useEffect(() => {
    confirmingItemIdRef.current = confirmingItemId;
  }, [confirmingItemId]);

  // ------------------------------------------------------------------
  // Derived state
  // ------------------------------------------------------------------

  /** Items grouped & limited for a non-empty query */
  const searchResultGroups = query.trim()
    ? groupSearchResults(searchCommands(query))
    : [];

  /** Total flat list of items currently visible — used for keyboard nav */
  const flatItems: CommandItem[] = query.trim()
    ? searchResultGroups.flatMap((sg) => sg.items)
    : recentCommands.length > 0
      ? recentCommands
      : [];

  const hasResults = flatItems.length > 0;
  const showEmptyQuery = !query.trim() && recentCommands.length === 0;
  const showNoResults = query.trim().length > 0 && flatItems.length === 0;

  // ------------------------------------------------------------------
  // Reset on open/close
  // ------------------------------------------------------------------

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setQuery('');
      setActiveIndex(-1);
      setConfirmingItemId(null);
      setConfirmDelayElapsed(false);
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus({ preventScroll: true });
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      // Defer one tick so the dialog has rendered
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isOpen]);

  // Reset active index when results change (but not during confirmation)
  useEffect(() => {
    if (!confirmingItemId) {
      setActiveIndex(-1);
    }
  }, [query, confirmingItemId]);

  // Announce result count to screen readers
  useEffect(() => {
    if (!isOpen) return;
    if (query.trim() && flatItems.length > 0) {
      setAnnouncement(
        `${flatItems.length} result${flatItems.length === 1 ? '' : 's'} found`,
      );
    } else if (query.trim() && flatItems.length === 0) {
      setAnnouncement('No results found');
    } else {
      setAnnouncement('');
    }
  }, [flatItems.length, query, isOpen]);

  // ------------------------------------------------------------------
  // Handlers (defined before effects that reference them)
  // ------------------------------------------------------------------

  const handleActivate = useCallback(
    (item: CommandItem) => {
      // If item is destructive, enter inline confirmation instead of executing
      if (item.destructive) {
        setConfirmingItemId(item.id);
        setAnnouncement(
          `Confirm ${item.confirmLabel ?? item.label}. Press Escape to cancel.`,
        );
        return;
      }
      onCommandExecute(item);
      item.onExecute?.();
      onClose();
    },
    [onCommandExecute, onClose],
  );

  const handleConfirm = useCallback(
    (item: CommandItem) => {
      onCommandExecute(item);
      item.onExecute?.();
      onClose();
    },
    [onCommandExecute, onClose],
  );

  const handleCancelConfirm = useCallback(() => {
    setConfirmingItemId(null);
    confirmingItemIdRef.current = null; // sync ref immediately for synchronous Escape handling
    setConfirmDelayElapsed(false);
    setAnnouncement('Confirmation cancelled');
  }, []);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        // If in confirmation, cancel confirmation; otherwise close palette
        if (confirmingItemId) {
          handleCancelConfirm();
        } else {
          onClose();
        }
      }
    },
    [onClose, confirmingItemId, handleCancelConfirm],
  );

  // ------------------------------------------------------------------
  // Focus trap
  // ------------------------------------------------------------------

  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;

    const dialog = dialogRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        // If in confirmation mode, cancel confirmation instead of closing
        if (confirmingItemIdRef.current) {
          handleCancelConfirm();
        } else {
          onClose();
        }
        return;
      }

      // Disable arrow nav and Enter while confirming (focus stays on buttons)
      if (confirmingItemIdRef.current) return;

      // ↓ / ↑ navigate through flat items
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (flatItems.length === 0) return;
        setActiveIndex((prev) => {
          if (e.key === 'ArrowDown') {
            return prev < flatItems.length - 1 ? prev + 1 : 0;
          } else {
            return prev > 0 ? prev - 1 : flatItems.length - 1;
          }
        });
        return;
      }

      // Enter activates highlighted item
      if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        const item = flatItems[activeIndex];
        if (item) {
          handleActivate(item);
        }
        return;
      }

      // Tab: cycle focusable elements (input → close btn, wrapping)
      if (e.key === 'Tab') {
        const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, flatItems, activeIndex, handleCancelConfirm, handleActivate]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0) return;
    const item = dialogRef.current?.querySelector<HTMLElement>(
      `[data-cp-index="${activeIndex}"]`,
    );
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // ------------------------------------------------------------------
  // Inline confirmation — 500ms activation delay
  // ------------------------------------------------------------------

  useEffect(() => {
    if (confirmingItemId) {
      setConfirmDelayElapsed(false);
      delayTimerRef.current = setTimeout(() => {
        setConfirmDelayElapsed(true);
      }, 500);
      return () => {
        if (delayTimerRef.current) {
          clearTimeout(delayTimerRef.current);
          delayTimerRef.current = null;
        }
      };
    } else {
      setConfirmDelayElapsed(false);
    }
  }, [confirmingItemId]);

  // Focus cancel button when entering confirmation mode
  useEffect(() => {
    if (confirmingItemId && confirmCancelRef.current) {
      confirmCancelRef.current.focus();
    }
  }, [confirmingItemId]);

  // Clear confirmation when user types at least 2 chars (avoids accidental cancel on single keystroke)
  useEffect(() => {
    if (confirmingItemId && query.trim().length >= 2) {
      setConfirmingItemId(null);
    }
  }, [query]);

  // ------------------------------------------------------------------
  // Confirm item lookup
  // ------------------------------------------------------------------

  /** The item currently being confirmed, if any. */
  const confirmingItem = confirmingItemId
    ? flatItems.find((item) => item.id === confirmingItemId) ?? null
    : null;

  // ------------------------------------------------------------------
  // Early return
  // ------------------------------------------------------------------

  if (!isOpen) return null;

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------

  function renderShortcut(item: CommandItem) {
    if (!item.shortcutKeys || item.shortcutKeys.length === 0) return null;
    const labels = formatKeyLabels(item.shortcutKeys, isMac);
    const ariaText = shortcutAriaLabel(item.shortcutKeys, isMac);
    return (
      <span className="cp-result-shortcut" aria-label={ariaText}>
        {labels.map((key, i) => (
          <kbd key={i} className="cp-shortcut-key">
            {key}
          </kbd>
        ))}
      </span>
    );
  }

  /**
   * Render the inline confirm/cancel row that replaces a destructive command.
   * Includes a 500ms activation delay on the confirm button.
   * Rendered OUTSIDE the listbox to avoid aria-required-children violations.
   */
  function renderConfirmRow(item: CommandItem) {
    return (
      <div
        className="cp-confirm-row"
        role="status"
        aria-live="polite"
        aria-label={`Confirm ${item.confirmLabel ?? item.label}`}
        data-testid={`cp-confirm-row-${item.id}`}
      >
          <div className="cp-confirm-icon-col">
            <span className="cp-confirm-icon" aria-hidden="true">
              <AlertTriangle size={18} />
            </span>
          </div>
          <div className="cp-confirm-content">
            <span className="cp-confirm-title">
              {item.confirmLabel ?? item.label}
            </span>
            {item.confirmDescription && (
              <span className="cp-confirm-desc">
                {item.confirmDescription}
              </span>
            )}
          </div>
          <div className="cp-confirm-actions">
            <button
              type="button"
              className="cp-confirm-cancel-btn"
              ref={confirmCancelRef}
              onClick={handleCancelConfirm}
              data-testid={`cp-confirm-cancel-${item.id}`}
            >
              Cancel
            </button>
            <button
              type="button"
              className="cp-confirm-btn"
              disabled={!confirmDelayElapsed}
              onClick={() => handleConfirm(item)}
              data-testid={`cp-confirm-btn-${item.id}`}
            >
              {confirmDelayElapsed ? (
                item.confirmLabel ?? 'Confirm'
              ) : (
                <span className="cp-confirm-delaying">
                  <LoaderCircle size={12} aria-hidden="true" className="cp-confirm-spinner" />
                  <span>Please wait&hellip;</span>
                </span>
              )}
            </button>
          </div>
      </div>
    );
  }

  function renderResultItem(item: CommandItem, index: number) {
    // If this item is in confirmation mode, skip it (confirm row is rendered separately)
    if (item.id === confirmingItemId) {
      return null;
    }

    const isActive = index === activeIndex;
    return (
      <li key={item.id} role="none">
        <button
          type="button"
          role="option"
          aria-selected={isActive}
          className="cp-result-item"
          data-cp-index={index}
          onClick={() => handleActivate(item)}
          onMouseEnter={() => setActiveIndex(index)}
          tabIndex={-1}
        >
          <span className="cp-result-icon" aria-hidden="true">
            <CommandIcon name={item.icon} size={16} />
          </span>
          <span className="cp-result-text">
            <span className="cp-result-label">{item.label}</span>
            {item.description && (
              <span className="cp-result-desc">{item.description}</span>
            )}
          </span>
          {renderShortcut(item)}
        </button>
      </li>
    );
  }

  /**
   * Render grouped results for a non-empty query.
   * Each CommandGroup that has matches appears as a labelled section.
   */
  function renderSearchGroups() {
    let runningIndex = 0;
    return searchResultGroups.map(({ group, items }) => {
      const sectionItems = items.map((item) => {
        const el = renderResultItem(item, runningIndex);
        runningIndex++;
        return el;
      });
      return (
        <div
          key={group.key}
          className="cp-group-section"
          role="group"
          aria-label={group.label}
        >
          <div className="cp-group-header">
            <h3 className="cp-group-label">{group.label}</h3>
          </div>
          <ul
            className="cp-result-list"
            role="listbox"
            aria-label={`${group.label} commands`}
          >
            {sectionItems}
          </ul>
        </div>
      );
    });
  }

  /**
   * Render Recent Actions section (empty-query state).
   * All items share a flat index space starting at 0.
   */
  function renderRecentSection() {
    return (
      <div
        className="cp-group-section"
        role="group"
        aria-label="Recent"
      >
        <div className="cp-group-header">
          <h3 className="cp-group-label">Recent</h3>
          {recentCommands.length > 0 && (
            <button
              type="button"
              className="cp-clear-btn"
              onClick={onClearRecent}
              aria-label="Clear recent command history"
            >
              <X size={10} aria-hidden="true" />
              Clear history
            </button>
          )}
        </div>
        <ul
          className="cp-result-list"
          role="listbox"
          aria-label="Recent commands"
        >
          {recentCommands.map((item, i) =>
            renderResultItem(item, i),
          )}
        </ul>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div
      className="cp-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={handleOverlayClick}
      data-testid="command-palette-overlay"
    >
      {/* Hidden title for screen readers */}
      <span id={titleId} className="cp-sr-only">
        Command Palette
      </span>

      {/* Live region for result count announcements */}
      <div
        id={statusId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="cp-sr-only"
      >
        {announcement}
      </div>

      <div
        className="cp-dialog glass-card"
        ref={dialogRef}
        data-testid="command-palette-dialog"
      >
        {/* ── Search header ──────────────────────────────────────────── */}
        <div className="cp-header">
          <Search
            size={18}
            className="cp-search-icon"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={bodyId}
            aria-expanded={hasResults}
            aria-activedescendant={
              activeIndex >= 0 ? `cp-item-${activeIndex}` : undefined
            }
            className="cp-input"
            placeholder="Search commands…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <span className="cp-esc-hint" aria-hidden="true">
            <kbd className="cp-esc-key">Esc</kbd>
            <span>to close</span>
          </span>
        </div>

        {/* ── Results body ───────────────────────────────────────────── */}
        <div className="cp-body" id={bodyId}>
          {/* Inline confirm row rendered OUTSIDE the listbox */}
          {confirmingItem && renderConfirmRow(confirmingItem)}

          {/* Case 1: empty query, no recents */}
          {showEmptyQuery && (
            <div className="cp-empty-query" data-testid="cp-empty-query">
              <div className="cp-empty-icon" aria-hidden="true">
                <Search size={22} aria-hidden="true" />
              </div>
              <p className="cp-empty-title">Search commands</p>
              <p className="cp-empty-hint">
                Type to search Navigate, Actions, and Settings commands. Your
                most recent actions will appear here.
              </p>
            </div>
          )}

          {/* Case 2: empty query, has recents — show Recent section */}
          {!query.trim() && recentCommands.length > 0 && renderRecentSection()}

          {/* Case 3: non-empty query, has results — show grouped results */}
          {query.trim() && hasResults && renderSearchGroups()}

          {/* Case 4: non-empty query, no results */}
          {showNoResults && (
            <div className="cp-no-results" data-testid="cp-no-results">
              <p className="cp-no-results-title">No results</p>
              <p className="cp-no-results-hint">
                Nothing matched{' '}
                <span className="cp-no-results-query">
                  &quot;{query}&quot;
                </span>
              </p>
            </div>
          )}
        </div>

        {/* ── Footer hint ────────────────────────────────────────────── */}
        <div className="cp-footer" aria-hidden="true">
          <div className="cp-footer-hint">
            <span className="cp-footer-hint-item">
              <kbd className="cp-esc-key">↑</kbd>
              <kbd className="cp-esc-key">↓</kbd>
              <span>navigate</span>
            </span>
            <span className="cp-footer-hint-item">
              <kbd className="cp-esc-key">↵</kbd>
              <span>select</span>
            </span>
            <span className="cp-footer-hint-item">
              <kbd className="cp-esc-key">Esc</kbd>
              <span>close</span>
            </span>
          </div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {isMac ? '⌘K' : 'Ctrl+K'}
          </span>
        </div>
      </div>
    </div>
  );
}
