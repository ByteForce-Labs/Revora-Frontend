/**
 * OnChainStatusBadge — on-chain confirmation badge with metadata tooltip (Issue #256).
 *
 * Pointer-fine: hover/focus reveals a tooltip panel.
 * Coarse pointer / touch: toggles the same panel as a popover.
 */

import React, { useCallback, useEffect, useId, useState } from 'react';


import { Check, Copy, ExternalLink, Link2 } from 'lucide-react';
import type { StellarExplorerNetwork } from './onChainMetadataUtils';
import {
  formatBlockNumber,
  formatConfirmations,
  formatTimeSince,
  resolveExplorerUrl,
  truncateHash,
} from './onChainMetadataUtils';
import './OnChainStatusBadge.css';

export interface OnChainMetadata {
  /** Ledger sequence or block height */
  blockNumber?: number | string;
  /** Full transaction hash (hex) */
  transactionHash?: string;
  confirmations?: number;
  /** ISO timestamp when the transaction was confirmed */
  confirmedAt?: string;
  /** Override default Stellar Expert URL */
  explorerUrl?: string;
  network?: StellarExplorerNetwork;
}

export interface OnChainStatusBadgeProps {
  metadata: OnChainMetadata;
  /** Accessible label prefix for the badge control */
  ariaLabel?: string;
}

type CopyField = 'block' | 'hash';

function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const sync = () => setCoarse(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return coarse;
}

interface MetadataFieldProps {
  label: string;
  displayValue: string;
  copyValue?: string;
  copyField: CopyField;
  copiedField: CopyField | null;
  onCopy: (field: CopyField, value: string) => void;
}

const MetadataField: React.FC<MetadataFieldProps> = ({
  label,
  displayValue,
  copyValue,
  copyField,
  copiedField,
  onCopy,
}) => {
  const canCopy = Boolean(copyValue?.trim());
  const copied = copiedField === copyField;

  return (
    <div className="ocb-field">
      <span className="ocb-field__label">{label}</span>
      <div className="ocb-field__row">
        <span className="ocb-field__value" title={copyValue ?? displayValue}>
          {displayValue}
        </span>
        <button
          type="button"
          className={`ocb-copy-btn ${copied ? 'ocb-copy-btn--copied' : ''}`}
          disabled={!canCopy}
          aria-label={
            copied
              ? `${label} copied to clipboard`
              : canCopy
                ? `Copy ${label.toLowerCase()}`
                : `${label} unavailable`
          }
          onClick={() => {
            if (copyValue) onCopy(copyField, copyValue);
          }}
        >
          {copied ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <Copy size={14} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
};

export const OnChainStatusBadge: React.FC<OnChainStatusBadgeProps> = ({
  metadata,
  ariaLabel = 'On-chain confirmation details',
}) => {
  const panelId = useId();
  const liveId = useId();
  const coarsePointer = useCoarsePointer();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<CopyField | null>(null);
  const [copyAnnouncement, setCopyAnnouncement] = useState('');

  const blockDisplay = formatBlockNumber(metadata.blockNumber);
  const blockCopy =
    metadata.blockNumber !== undefined &&
    metadata.blockNumber !== null &&
    String(metadata.blockNumber).trim() !== ''
      ? String(metadata.blockNumber).trim()
      : undefined;

  const hashRaw = metadata.transactionHash?.trim() ?? '';
  const hashDisplay = hashRaw ? truncateHash(hashRaw) : '—';
  const hashCopy = hashRaw || undefined;

  const confirmationsDisplay = formatConfirmations(metadata.confirmations);
  const timeSinceDisplay = formatTimeSince(metadata.confirmedAt);
  const explorerUrl = resolveExplorerUrl(metadata);

  const panelVisible = coarsePointer ? popoverOpen : undefined;

  const handleCopy = async (field: CopyField, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    const message =
      field === 'block'
        ? 'Block number copied to clipboard.'
        : 'Transaction hash copied to clipboard.';
    setCopyAnnouncement(message);
    window.setTimeout(() => {
      setCopiedField(null);
      setCopyAnnouncement('');
    }, 2000);
  };

  useEffect(() => {
    if (!popoverOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPopoverOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [popoverOpen]);

  const handleTriggerClick = () => {
    if (coarsePointer) {
      setPopoverOpen((open) => !open);
    }
  };

  return (
    <span
      className={`ocb-root ${popoverOpen ? 'ocb-root--open' : ''}`}
      data-testid="onchain-status-badge"
    >
      <button
        type="button"
        className="ocb-badge"
        aria-label={ariaLabel}
        aria-expanded={coarsePointer ? popoverOpen : undefined}
        aria-controls={panelId}
        onClick={handleTriggerClick}
      >
        <Link2 size={12} aria-hidden="true" />
        <span>On-chain</span>
      </button>

      <div
        id={panelId}
        className="ocb-panel"
        role="tooltip"
        aria-hidden={panelVisible === false ? true : undefined}
      >
        <p className="ocb-panel__title">On-chain metadata</p>
        <div className="ocb-panel__grid">
          <MetadataField
            label="Block"
            displayValue={blockDisplay}
            copyValue={blockCopy}
            copyField="block"
            copiedField={copiedField}
            onCopy={handleCopy}
          />
          <MetadataField
            label="Hash"
            displayValue={hashDisplay}
            copyValue={hashCopy}
            copyField="hash"
            copiedField={copiedField}
            onCopy={handleCopy}
          />
          <div className="ocb-field">
            <span className="ocb-field__label">Confirmations</span>
            <div className="ocb-field__row">
              <span className="ocb-field__value">{confirmationsDisplay}</span>
            </div>
          </div>
          <div className="ocb-field">
            <span className="ocb-field__label">Time since</span>
            <div className="ocb-field__row">
              <span className="ocb-field__value">{timeSinceDisplay}</span>
            </div>
          </div>
        </div>

        {explorerUrl ? (
          <a
            className="ocb-explorer-link"
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in explorer
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : (
          <span className="ocb-explorer-link ocb-explorer-link--disabled">
            Explorer link unavailable
          </span>
        )}
      </div>

      <span id={liveId} role="status" aria-live="polite" className="ocb-sr-only">
        {copyAnnouncement}
      </span>
    </span>
  );
};

export default OnChainStatusBadge;
