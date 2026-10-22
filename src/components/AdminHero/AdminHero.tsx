import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Info, X, ShieldAlert, type LucideIcon } from 'lucide-react';
import { StatusGlyph, HealthStatus } from './StatusGlyph';
import './AdminHero.css';

export interface AdminTileData {
  id: string;
  label: string;
  value: string;
  status: HealthStatus;
  detail?: string;
  href: string;
}

export type IncidentSeverity = 'critical' | 'warning' | 'info';

export interface IncidentData {
  id: string;
  severity: IncidentSeverity;
  title: string;
  message: string;
}

export interface AdminHeroProps {
  tiles: AdminTileData[];
  incident?: IncidentData | null;
  onDismissIncident?: (incidentId: string) => void;
  className?: string;
  id?: string;
}

const SEVERITY_CONFIG: Record<IncidentSeverity, {
  icon: LucideIcon;
  bgClass: string;
  borderClass: string;
  textClass: string;
  iconClass: string;
}> = {
  critical: {
    icon: ShieldAlert,
    bgClass: 'ah-incident--critical',
    borderClass: '',
    textClass: '',
    iconClass: '',
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'ah-incident--warning',
    borderClass: '',
    textClass: '',
    iconClass: '',
  },
  info: {
    icon: Info,
    bgClass: 'ah-incident--info',
    borderClass: '',
    textClass: '',
    iconClass: '',
  },
};

function AdminTile({ tile }: { tile: AdminTileData }) {
  return (
    <div className="ah-tile" role="listitem" data-testid={`ah-tile-${tile.id}`}>
      <div className="ah-tile-header">
        <StatusGlyph status={tile.status} />
        <span className="ah-tile-label">{tile.label}</span>
      </div>
      <div className="ah-tile-value">{tile.value}</div>
      {tile.detail && (
        <div className="ah-tile-detail">{tile.detail}</div>
      )}
      <Link
        to={tile.href}
        className="ah-tile-link"
        aria-label={`View details for ${tile.label}`}
      >
        View details
      </Link>
    </div>
  );
}

function IncidentBanner({
  incident,
  onDismiss,
}: {
  incident: IncidentData;
  onDismiss?: (id: string) => void;
}) {
  const config = SEVERITY_CONFIG[incident.severity];
  const Icon = config.icon;

  return (
    <div
      className={`ah-incident ${config.bgClass}`}
      role="alert"
      aria-live="assertive"
      data-testid={`ah-incident-${incident.id}`}
    >
      <Icon size={20} aria-hidden="true" />
      <div className="ah-incident-body">
        <p className="ah-incident-title">{incident.title}</p>
        <p className="ah-incident-message">{incident.message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="ah-incident-dismiss"
          onClick={() => onDismiss(incident.id)}
          aria-label={`Dismiss incident: ${incident.title}`}
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export const AdminHero: React.FC<AdminHeroProps> = ({
  tiles,
  incident,
  onDismissIncident,
  className = '',
  id = 'admin-hero',
}) => {
  return (
    <section
      className={`ah-root ${className}`}
      id={id}
      aria-labelledby={`${id}-heading`}
    >
      <div className="ah-header">
        <h1 id={`${id}-heading`} className="ah-title">Admin Dashboard</h1>
        <p className="ah-subtitle">System health and compliance overview</p>
      </div>

      {incident && (
        <IncidentBanner
          incident={incident}
          onDismiss={onDismissIncident}
        />
      )}

      <div
        className="ah-tiles"
        role="list"
        aria-label="System health tiles"
      >
        {tiles.map((tile) => (
          <AdminTile key={tile.id} tile={tile} />
        ))}
      </div>
    </section>
  );
};
