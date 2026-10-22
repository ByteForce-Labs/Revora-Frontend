import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Columns,
  SlidersHorizontal,
  X,
  ChevronRight,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import './LedgerTable.css';

// Global density modes (matches DensityProvider)
export type DensityMode = 'comfortable' | 'cozy' | 'compact';
// Legacy alias kept for backward compat
export type Density = DensityMode;

export interface Column<T> {
  key: string;
  label: string;
  defaultVisible?: boolean;
  width?: string;
  render: (row: T) => React.ReactNode;
}

export interface LedgerDrawerConfig<T = unknown> {
  /** URL query param used for the deep-link permalink. When set, opening a row's
   *  detail drawer writes `?param=<rowKey>` via history.replaceState and, on
   *  mount/popstate, restores the drawer for the matching row. */
  deepLinkParam?: string;
  /** Optional heading shown in the drawer header (defaults to the row key). */
  title?: (row: T) => string;
  /** Optional custom footer actions rendered under the detail. Receives the row
   *  and a close callback. */
  footer?: (row: T, close: () => void) => React.ReactNode;
}

export type DetailMode = 'inline' | 'drawer';

export interface LedgerTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  rowDetail?: (row: T) => React.ReactNode;
  pageSize?: number;
  defaultDensity?: DensityMode;
  stickyHeader?: boolean;
  ariaLabel?: string;
  groupableColumns?: { key: keyof T; label: string }[];
  renderGroupHeader?: (groupValue: any, items: T[]) => React.ReactNode;
  /** How row detail is revealed. Defaults to 'inline' (legacy expanding panel). */
  detailMode?: DetailMode;
  /** Configuration for the row-detail side drawer (used when detailMode='drawer'). */
  drawer?: LedgerDrawerConfig<T>;
}

const DENSITY_CLASS: Record<DensityMode, string> = {
  comfortable: 'lt-density--comfortable',
  cozy:        'lt-density--cozy',
  compact:     'lt-density--compact',
};

const ROW_HEIGHTS: Record<DensityMode, number> = {
  comfortable: 56,
  cozy:        48,
  compact:     36,
};

const OVERSCAN = 5;

// ─── Deep-link permalink helpers (Issue #628) ────────────────────────

function readPermalinkKey(param: string): string | null {
  return new URLSearchParams(window.location.search).get(param);
}

function buildPermalink(param: string, key: string | number): string {
  const url = new URL(window.location.href);
  url.searchParams.set(param, String(key));
  return url.toString();
}

function applyPermalink(param: string, key: string | number | null): void {
  const url = new URL(window.location.href);
  if (key === null) {
    url.searchParams.delete(param);
  } else {
    url.searchParams.set(param, String(key));
  }
  try {
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch {
    /* history API unavailable (e.g. some test/SSR envs) — best effort */
  }
}

type FlattenedRow<T> = 
  | { isGroup: true; key: string; value: any; items: T[] }
  | { isGroup: false; row: T };

function LedgerTable<T>({
  data,
  columns,
  rowKey,
  rowDetail,
  pageSize = 50,
  defaultDensity = 'cozy',
  stickyHeader = true,
  ariaLabel = 'Ledger table',
  groupableColumns,
  renderGroupHeader,
  detailMode = 'inline',
  drawer,
}: LedgerTableProps<T>) {
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() =>
    new Set(columns.filter((c) => c.defaultVisible !== false).map((c) => c.key)),
  );
  const [density, setDensity] = useState<DensityMode>(defaultDensity);
  const [currentPage, setCurrentPage] = useState(0);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showDensityMenu, setShowDensityMenu] = useState(false);
  const [selectedRow, setSelectedRow] = useState<string | number | null>(null);
  const [detailRow, setDetailRow] = useState<string | number | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [scrollTop, setScrollTop] = useState(0);
  
  const [groupBy, setGroupBy] = useState<keyof T | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const columnMenuRef = useRef<HTMLDivElement>(null);
  const densityMenuRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const deepLinkParam = drawer?.deepLinkParam;

  const closeDetail = useCallback(() => {
    setDetailRow(null);
    setCopyState('idle');
  }, []);

  /** Copy the deep-link permalink for a row to the clipboard (with fallback). */
  const handleCopyPermalink = useCallback(
    async (row: T) => {
      if (!deepLinkParam) return false;
      const url = buildPermalink(deepLinkParam, rowKey(row));
      let ok = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          ok = true;
        }
      } catch {
        ok = false;
      }
      if (!ok) {
        try {
          if (document.execCommand) {
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            ok = true;
          }
        } catch {
          ok = false;
        }
      }
      setCopyState(ok ? 'copied' : 'failed');
      window.setTimeout(() => setCopyState('idle'), 2000);
      return ok;
    },
    [deepLinkParam, rowKey],
  );

  // Drawer side-effects: focus management + body scroll lock.
  useEffect(() => {
    if (detailMode !== 'drawer') return;
    if (detailRow != null) {
      prevFocusRef.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = 'hidden';
      const timer = window.setTimeout(() => closeBtnRef.current?.focus(), 0);
      return () => {
        window.clearTimeout(timer);
        document.body.style.overflow = '';
        if (prevFocusRef.current && document.contains(prevFocusRef.current)) {
          prevFocusRef.current.focus();
        }
      };
    }
    return undefined;
  }, [detailMode, detailRow]);

  const flattenedData = useMemo(() => {
    if (!groupBy) {
      return data.map(row => ({ isGroup: false, row } as FlattenedRow<T>));
    }

    const groups = new Map<any, T[]>();
    data.forEach(row => {
      const val = row[groupBy];
      if (!groups.has(val)) groups.set(val, []);
      groups.get(val)!.push(row);
    });

    const flat: FlattenedRow<T>[] = [];
    groups.forEach((items, value) => {
      const groupKey = String(value);
      flat.push({ isGroup: true, key: groupKey, value, items });
      if (!collapsedGroups.has(groupKey)) {
        items.forEach(row => flat.push({ isGroup: false, row }));
      }
    });
    return flat;
  }, [data, groupBy, collapsedGroups]);

  const totalPages = Math.max(1, Math.ceil(flattenedData.length / pageSize));
  
  // reset to page 0 if grouping changes
  useEffect(() => {
    setCurrentPage(0);
  }, [groupBy]);

  const pageData = useMemo(
    () => flattenedData.slice(currentPage * pageSize, (currentPage + 1) * pageSize),
    [flattenedData, currentPage, pageSize],
  );

  const filteredColumns = useMemo(
    () => columns.filter((c) => visibleColumns.has(c.key)),
    [columns, visibleColumns],
  );

  const rowHeight = ROW_HEIGHTS[density] ?? ROW_HEIGHTS.cozy;

  const [containerHeight, setContainerHeight] = useState(400);
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalHeight = pageData.length * rowHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const endIndex = Math.min(
    pageData.length,
    Math.ceil((scrollTop + containerHeight) / rowHeight) + OVERSCAN,
  );
  const visibleRows = useMemo(
    () => pageData.slice(startIndex, endIndex),
    [pageData, startIndex, endIndex],
  );

  const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
  const [focusedColumnIndex, setFocusedColumnIndex] = useState<number>(-1);
  const [focusBounds, setFocusBounds] = useState<{ left: number; width: number } | null>(null);
  const focusedRowRef = useRef<HTMLDivElement | null>(null);

  const totalCols = (rowDetail ? 1 : 0) + filteredColumns.length;

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    const current = scrollRef.current;
    if (current) {
      observer.observe(current);
    }
    return () => {
      if (current) observer.unobserve(current);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setShowColumnMenu(false);
      }
      if (densityMenuRef.current && !densityMenuRef.current.contains(e.target as Node)) {
        setShowDensityMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateFocusBounds = useCallback(() => {
    if (selectedRowIndex < 0 || focusedColumnIndex < 0 || !focusedRowRef.current) {
      setFocusBounds(null);
      return;
    }
    const children = focusedRowRef.current.children;
    if (children && children[focusedColumnIndex]) {
      const cellEl = children[focusedColumnIndex] as HTMLElement;
      setFocusBounds({
        left: cellEl.offsetLeft,
        width: cellEl.offsetWidth,
      });
    } else {
      setFocusBounds(null);
    }
  }, [selectedRowIndex, focusedColumnIndex]);

  useEffect(() => {
    updateFocusBounds();
  }, [updateFocusBounds, selectedRowIndex, focusedColumnIndex, startIndex, endIndex, filteredColumns, density, scrollTop, containerHeight]);

  /** Locate a row by deep-link key, restore it in the right page, and scroll to it. */
  const focusRowByKey = useCallback(
    (key: string) => {
      let foundIdx = -1;
      for (let i = 0; i < flattenedData.length; i++) {
        const item = flattenedData[i];
        if (!item.isGroup && String(rowKey(item.row)) === key) {
          foundIdx = i;
          break;
        }
      }
      if (foundIdx < 0) return false;
      const page = Math.floor(foundIdx / pageSize);
      setCurrentPage(page);
      const inPageIdx = foundIdx - page * pageSize;
      setSelectedRowIndex(inPageIdx);
      setSelectedRow(key);
      setDetailRow(key);
      const targetTop = Math.max(0, inPageIdx * rowHeight - 40);
      setScrollTop(targetTop);
      if (scrollRef.current) scrollRef.current.scrollTop = targetTop;
      return true;
    },
    [flattenedData, pageSize, rowHeight, rowKey],
  );

  // Restore the drawer from a deep-link on mount and on back/forward navigation.
  useEffect(() => {
    if (detailMode !== 'drawer' || !deepLinkParam) return;
    const key = readPermalinkKey(deepLinkParam);
    if (key != null) focusRowByKey(key);
    const onPopState = () => {
      const k = readPermalinkKey(deepLinkParam);
      if (k == null) {
        setDetailRow(null);
      } else {
        focusRowByKey(k);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [detailMode, deepLinkParam, focusRowByKey]);

  // Keep the ?param=<rowKey> deep link in sync with the open drawer. Runs after
  // the restore effect so a deep-linked mount is not clobbered before it is read.
  useEffect(() => {
    if (detailMode !== 'drawer' || !deepLinkParam) return;
    applyPermalink(deepLinkParam, detailRow);
  }, [detailMode, deepLinkParam, detailRow]);

  const toggleColumn = useCallback((key: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const cycleDensity = useCallback(() => {
    setDensity((prev) => {
      const order: DensityMode[] = ['comfortable', 'cozy', 'compact'];
      const idx = order.indexOf(prev);
      return order[(idx + 1) % order.length];
    });
  }, []);

  const handleRowClick = useCallback(
    (row: T, index: number) => {
      const key = rowKey(row);
      if (rowDetail) {
        setDetailRow((prev) => (prev === key ? null : key));
      }
      setSelectedRow(key);
      setSelectedRowIndex(index);
    },
    [rowKey, rowDetail],
  );

  const handleCellClick = useCallback(
    (row: T, index: number, colIndex: number, e: React.MouseEvent) => {
      e.stopPropagation();
      handleRowClick(row, index);
      setFocusedColumnIndex(colIndex);
    },
    [handleRowClick],
  );

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const maxIndex = pageData.length - 1;
      const isRtl = scrollRef.current
        ? getComputedStyle(scrollRef.current).direction === 'rtl' || document.dir === 'rtl'
        : false;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedRowIndex((prev) => {
            const next = Math.min(prev + 1, maxIndex);
            if (next >= 0) {
              const item = pageData[next];
              if (!item.isGroup) {
                setSelectedRow(rowKey(item.row));
                if (rowDetail) setDetailRow(rowKey(item.row));
              }
            }
            return next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedRowIndex((prev) => {
            const next = Math.max(prev - 1, 0);
            if (next >= 0) {
              const item = pageData[next];
              if (!item.isGroup) {
                setSelectedRow(rowKey(item.row));
                if (rowDetail) setDetailRow(rowKey(item.row));
              }
            }
            return next;
          });
          break;
        case 'ArrowRight':
          e.preventDefault();
          setFocusedColumnIndex((prev) => {
            if (isRtl) {
              return Math.max(-1, prev - 1);
            } else {
              return Math.min(totalCols - 1, prev + 1);
            }
          });
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setFocusedColumnIndex((prev) => {
            if (isRtl) {
              return Math.min(totalCols - 1, prev + 1);
            } else {
              return Math.max(-1, prev - 1);
            }
          });
          break;
        case 'Home':
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            setSelectedRowIndex(0);
          } else {
            setFocusedColumnIndex(0);
          }
          break;
        case 'End':
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            setSelectedRowIndex(maxIndex);
          } else {
            setFocusedColumnIndex(Math.max(0, totalCols - 1));
          }
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (selectedRowIndex >= 0 && selectedRowIndex <= maxIndex) {
            const item = pageData[selectedRowIndex];
            if (item.isGroup) {
              toggleGroup(item.key);
            } else {
              handleRowClick(item.row, selectedRowIndex);
            }
          }
          break;
        case 'Escape':
          closeDetail();
          break;
      }
    },
    [pageData, selectedRowIndex, totalCols, rowKey, rowDetail, handleRowClick, toggleGroup, closeDetail],
  );

  if (columns.length === 0) {
    return (
      <div className="lt-empty" role="status">
        <p>No columns defined.</p>
      </div>
    );
  }

  return (
    <div className="lt-root" role="region" aria-label={ariaLabel}>
      <div className="lt-toolbar">
        <div className="lt-toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="lt-row-count">
            {data.length} row{data.length !== 1 ? 's' : ''}
          </span>
          {totalPages > 1 && (
            <span className="lt-page-info">
              Page {currentPage + 1} of {totalPages}
            </span>
          )}
          {groupableColumns && groupableColumns.length > 0 && (
            <select
              value={groupBy as string || ''}
              onChange={(e) => setGroupBy((e.target.value as keyof T) || null)}
              className="lt-group-select"
              aria-label="Group by"
            >
              <option value="">No Grouping</option>
              {groupableColumns.map(c => (
                <option key={String(c.key)} value={String(c.key)}>Group by {c.label}</option>
              ))}
            </select>
          )}
        </div>
        <div className="lt-toolbar-right">
          <div className="lt-control-group" ref={densityMenuRef}>
            <button
              type="button"
              className="lt-control-btn"
              onClick={cycleDensity}
              onMouseDown={() => setShowDensityMenu(!showDensityMenu)}
              aria-label={`Density: ${density}. Click to change.`}
              aria-expanded={showDensityMenu}
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              <span className="lt-control-label">{density}</span>
            </button>
          </div>
          <div className="lt-control-group" ref={columnMenuRef}>
            <button
              type="button"
              className="lt-control-btn"
              onClick={() => setShowColumnMenu(!showColumnMenu)}
              aria-label="Column visibility"
              aria-expanded={showColumnMenu}
              aria-haspopup="menu"
            >
              <Columns size={14} aria-hidden="true" />
              <span className="lt-control-label">Columns</span>
            </button>
            {showColumnMenu && (
              <div
                className="lt-column-menu lt-dropdown"
                role="menu"
                aria-label="Toggle column visibility"
              >
                {columns.map((col) => {
                  const isVisible = visibleColumns.has(col.key);
                  const isDisabled = isVisible && visibleColumns.size <= 1;
                  return (
                    <label
                      key={col.key}
                      className={`lt-column-menu-item ${isDisabled ? 'lt-column-menu-item--disabled' : ''}`}
                      role="menuitemcheckbox"
                      aria-checked={isVisible}
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => toggleColumn(col.key)}
                        disabled={isDisabled}
                        className="lt-column-menu-checkbox"
                      />
                      <span>{col.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="lt-pagination" role="navigation" aria-label="Table pagination">
          <button
            type="button"
            className="lt-page-btn"
            disabled={currentPage === 0}
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            aria-label="Previous page"
          >
            Previous
          </button>
          <span className="lt-page-indicator" aria-current="page">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            type="button"
            className="lt-page-btn"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className={`lt-table-wrap ${DENSITY_CLASS[density]}`}
        tabIndex={0}
        role="grid"
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
        onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
        aria-rowcount={flattenedData.length}
      >
        {stickyHeader && (
          <div className="lt-header" role="row">
            {rowDetail && (
              <div className="lt-cell lt-cell--detail" role="columnheader" aria-label="Detail">
                <span className="sr-only">Detail</span>
              </div>
            )}
            {filteredColumns.map((col) => (
              <div
                key={col.key}
                className="lt-cell lt-cell--header"
                role="columnheader"
                aria-label={col.label}
                style={col.width ? { width: col.width, minWidth: col.width } : undefined}
              >
                {col.label}
              </div>
            ))}
          </div>
        )}

        <div
          className="lt-body"
          role="rowgroup"
          style={{ height: totalHeight, position: 'relative' }}
        >
          {selectedRowIndex >= 0 && selectedRowIndex < pageData.length && (
            <div
              className={`lt-focus-ring-overlay ${focusedColumnIndex >= 0 ? 'lt-focus-ring-overlay--cell' : 'lt-focus-ring-overlay--row'}`}
              data-testid="focus-ring-overlay"
              role="presentation"
              aria-hidden="true"
              style={{
                top: selectedRowIndex * rowHeight,
                height: rowHeight,
                ...(focusBounds
                  ? { left: focusBounds.left, width: focusBounds.width }
                  : { left: 0, right: 0 }),
              }}
            />
          )}
          {visibleRows.map((item, i) => {
            const globalIndex = startIndex + i;
            const isRowFocused = selectedRowIndex === globalIndex;
            
            if (item.isGroup) {
              const isCollapsed = collapsedGroups.has(item.key);
              return (
                <div
                  key={`group-${item.key}`}
                  ref={isRowFocused ? focusedRowRef : undefined}
                  className={`lt-row lt-row--group ${selectedRowIndex === globalIndex ? 'lt-row--selected' : ''}`}
                  role="row"
                  aria-rowindex={globalIndex + 1}
                  aria-expanded={!isCollapsed}
                  style={{
                    position: 'absolute',
                    top: globalIndex * rowHeight,
                    left: 0,
                    right: 0,
                    height: rowHeight,
                  }}
                  onClick={() => toggleGroup(item.key)}
                  tabIndex={-1}
                >
                  <div className="lt-cell lt-cell--group-header" role="gridcell" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className="lt-group-toggle"
                      aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
                      tabIndex={-1} // Handled by row focus
                    >
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {renderGroupHeader ? renderGroupHeader(item.value, item.items) : (
                      <span className="font-medium">{String(item.value)} <span className="text-muted">({item.items.length})</span></span>
                    )}
                  </div>
                </div>
              );
            }

            const row = item.row;
            const key = rowKey(row);
            const isSelected = selectedRow === key;
            const isDetailOpen = detailRow === key;
            
            return (
              <React.Fragment key={key}>
                <div
                  ref={isRowFocused ? focusedRowRef : undefined}
                  className={`lt-row ${isSelected ? 'lt-row--selected' : ''} ${isRowFocused ? 'lt-row--focused' : ''}`}
                  role="row"
                  aria-rowindex={globalIndex + 1}
                  aria-selected={isSelected}
                  style={{
                    position: 'absolute',
                    top: globalIndex * rowHeight,
                    left: 0,
                    right: 0,
                    height: rowHeight,
                  }}
                  onClick={() => handleRowClick(row, globalIndex)}
                  tabIndex={-1}
                >
                  {rowDetail && (
                    <div
                      className={`lt-cell lt-cell--detail ${isRowFocused && focusedColumnIndex === 0 ? 'lt-cell--focused' : ''}`}
                      role="gridcell"
                      onClick={(e) => handleCellClick(row, globalIndex, 0, e)}
                    >
                      <button
                        type="button"
                        className="lt-detail-toggle"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailRow((prev) => (prev === key ? null : key));
                        }}
                        aria-label={isDetailOpen ? 'Close detail' : 'Open detail'}
                        aria-expanded={isDetailOpen}
                        tabIndex={-1}
                      >
                        <ChevronRight
                          size={14}
                          className={`lt-detail-icon ${isDetailOpen ? 'lt-detail-icon--open' : ''} icon-rtl`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  )}
                  {filteredColumns.map((col, cIdx) => {
                    const colIndex = rowDetail ? cIdx + 1 : cIdx;
                    const isCellFocused = isRowFocused && focusedColumnIndex === colIndex;
                    return (
                      <div
                        key={col.key}
                        className={`lt-cell ${isCellFocused ? 'lt-cell--focused' : ''}`}
                        role="gridcell"
                        style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                        onClick={(e) => handleCellClick(row, globalIndex, colIndex, e)}
                      >
                        {col.render(row)}
                      </div>
                    );
                  })}
                </div>
                {detailMode === 'inline' && isDetailOpen && rowDetail && (
                  <div
                    className="lt-detail-panel"
                    role="region"
                    aria-label={`Detail for row ${key}`}
                    style={{
                      position: 'absolute',
                      top: (globalIndex + 1) * rowHeight,
                      left: 0,
                      right: 0,
                    }}
                  >
                    <div className="lt-detail-content">
                      {rowDetail(row)}
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {detailMode === 'drawer' && detailRow != null && rowDetail && (() => {
        const matched = data.find((r) => String(rowKey(r)) === String(detailRow));
        if (!matched) return null;
        const title = drawer?.title ? drawer.title(matched) : `Entry ${rowKey(matched)}`;
        const permalink = deepLinkParam ? buildPermalink(deepLinkParam, rowKey(matched)) : null;
        return (
          <React.Fragment key={`drawer-${detailRow}`}>
            <div
              className="lt-drawer-backdrop"
              data-testid="lt-drawer-backdrop"
              onMouseDown={closeDetail}
              aria-hidden="true"
            />
            <div
              ref={dialogRef}
              className="lt-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              data-testid="lt-drawer"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  closeDetail();
                }
              }}
            >
              <div className="lt-drawer-header">
                <div className="lt-drawer-heading">
                  <h3 id={titleId} className="lt-drawer-title">{title}</h3>
                  {permalink && (
                    <p className="lt-drawer-permalink" data-testid="lt-drawer-permalink">
                      {permalink}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="lt-drawer-close"
                  ref={closeBtnRef}
                  onClick={closeDetail}
                  aria-label="Close row detail"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <div className="lt-drawer-body">{rowDetail(matched)}</div>
              <div className="lt-drawer-footer">
                {permalink != null && (
                  <button
                    type="button"
                    className="lt-drawer-copy"
                    onClick={() => handleCopyPermalink(matched)}
                    aria-label="Copy link to this ledger entry"
                  >
                    {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy link'}
                  </button>
                )}
                {drawer?.footer ? drawer.footer(matched, closeDetail) : (
                  <button type="button" className="lt-drawer-done" onClick={closeDetail}>
                    Done
                  </button>
                )}
              </div>
              {copyState !== 'idle' && (
                <div role="status" aria-live="polite" className="lt-drawer-copied-toast">
                  {copyState === 'copied'
                    ? 'Link copied to clipboard'
                    : 'Copy failed — select the link above to copy it manually'}
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })()}

      {data.length === 0 && (
        <div className="lt-empty" role="status">
          <p>No data to display.</p>
        </div>
      )}
    </div>
  );
}

LedgerTable.displayName = 'LedgerTable';

export default LedgerTable;
