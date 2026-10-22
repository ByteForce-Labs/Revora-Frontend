import React, { useState } from 'react';
import { Alert, AlertStatus } from './types';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle,
  MoreVertical,
  Check,
  UserPlus,
  XCircle,
  Clock
} from 'lucide-react';
import { Button } from '../Button';

interface AlertRowProps {
  alert: Alert;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onAction: (id: string, action: 'acknowledge' | 'assign' | 'resolve') => void;
}

export const AlertRow: React.FC<AlertRowProps> = ({
  alert,
  isSelected,
  onSelect,
  onAction
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const getSeverityIcon = () => {
    switch (alert.severity) {
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-500" aria-label="Critical Severity" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-500" aria-label="High Severity" />;
      case 'medium':
        return <AlertCircle className="w-5 h-5 text-yellow-500" aria-label="Medium Severity" />;
      case 'low':
        return <Info className="w-5 h-5 text-blue-500" aria-label="Low Severity" />;
      default:
        return <Info className="w-5 h-5 text-slate-500" />;
    }
  };

  const getStatusBadge = () => {
    const statusStyles: Record<AlertStatus, string> = {
      active: 'bg-red-500/10 text-red-500 border-red-500/20',
      acknowledged: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      assigned: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      resolved: 'bg-green-500/10 text-green-500 border-green-500/20'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusStyles[alert.status]}`}>
        {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
      </span>
    );
  };

  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // seconds
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className={`p-4 border-b border-white/5 transition-colors duration-200 ${isSelected ? 'bg-primary/5' : 'hover:bg-white/5'} flex flex-col sm:flex-row gap-4 items-start sm:items-center relative group`}>
      {/* Checkbox for selection */}
      <div className="flex-shrink-0 pt-1 sm:pt-0">
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={() => onSelect(alert.id)}
          className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary focus:ring-primary focus:ring-offset-gray-900"
          aria-label={`Select alert: ${alert.title}`}
        />
      </div>

      {/* Severity Icon */}
      <div className="flex-shrink-0" title={`Severity: ${alert.severity}`}>
        {getSeverityIcon()}
      </div>

      {/* Main Content */}
      <div className="flex-grow min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-semibold text-white truncate max-w-full" title={alert.title}>
            {alert.title}
          </h2>
          {getStatusBadge()}
        </div>
        <p className="text-sm text-gray-400 line-clamp-1" title={alert.description}>
          <span className="font-medium text-gray-300">{alert.issuerName}</span> • {alert.description}
        </p>
      </div>

      {/* Meta & Actions */}
      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end mt-2 sm:mt-0">
        <div className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
          <Clock className="w-3 h-3" />
          {timeAgo(alert.createdAt)}
        </div>

        {/* Quick Triage Actions */}
        <div className="flex items-center gap-2">
          {alert.status !== 'resolved' && (
            <div className="hidden sm:flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => onAction(alert.id, 'acknowledge')}
                title="Acknowledge"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => onAction(alert.id, 'assign')}
                title="Assign"
              >
                <UserPlus className="w-4 h-4" />
              </Button>
              <Button 
                variant="primary" 
                size="sm"
                onClick={() => onAction(alert.id, 'resolve')}
                title="Resolve"
              >
                <CheckCircle className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Mobile menu trigger */}
          <div className="sm:hidden relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-gray-400 hover:text-white rounded-md hover:bg-white/10"
              aria-label="Alert actions"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-white/10 rounded-md shadow-xl z-10 overflow-hidden">
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2"
                  onClick={() => { onAction(alert.id, 'acknowledge'); setShowMenu(false); }}
                >
                  <Check className="w-4 h-4" /> Acknowledge
                </button>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2"
                  onClick={() => { onAction(alert.id, 'assign'); setShowMenu(false); }}
                >
                  <UserPlus className="w-4 h-4" /> Assign
                </button>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-primary hover:bg-white/10 flex items-center gap-2"
                  onClick={() => { onAction(alert.id, 'resolve'); setShowMenu(false); }}
                >
                  <CheckCircle className="w-4 h-4" /> Resolve
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
