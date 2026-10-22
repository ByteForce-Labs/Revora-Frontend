import React from 'react';
import { Check, AlertTriangle, XCircle, HelpCircle, type LucideIcon } from 'lucide-react';

export type HealthStatus = 'healthy' | 'degraded' | 'outage' | 'unknown';

export interface StatusGlyphProps {
  status: HealthStatus;
  className?: string;
}

const STATUS_CONFIG: Record<HealthStatus, {
  icon: LucideIcon;
  label: string;
  shapeClass: string;
}> = {
  healthy: {
    icon: Check,
    label: 'Healthy',
    shapeClass: 'sg-glyph--healthy',
  },
  degraded: {
    icon: AlertTriangle,
    label: 'Degraded',
    shapeClass: 'sg-glyph--degraded',
  },
  outage: {
    icon: XCircle,
    label: 'Outage',
    shapeClass: 'sg-glyph--outage',
  },
  unknown: {
    icon: HelpCircle,
    label: 'Unknown',
    shapeClass: 'sg-glyph--unknown',
  },
};

export const StatusGlyph: React.FC<StatusGlyphProps> = ({ status, className = '' }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  const Icon = config.icon;

  return (
    <span
      className={`sg-glyph ${config.shapeClass} ${className}`}
      role="img"
      aria-label={`Status: ${config.label}`}
      data-status={status}
    >
      <Icon size={14} aria-hidden="true" />
    </span>
  );
};
