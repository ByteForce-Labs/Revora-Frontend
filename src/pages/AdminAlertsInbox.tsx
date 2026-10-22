import React, { useState, useEffect } from 'react';
import { AlertsInboxTable } from '../components/AdminAlertsInbox/AlertsInboxTable';
import { Alert } from '../components/AdminAlertsInbox/types';
import { mockAlerts } from '../components/AdminAlertsInbox/alertsData';
import { Bell } from 'lucide-react';

const ACTION_PAST_TENSE: Record<'acknowledge' | 'assign' | 'resolve', string> = {
  acknowledge: 'acknowledged',
  assign: 'assigned',
  resolve: 'resolved',
};

export const AdminAlertsInbox: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Undo state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [previousState, setPreviousState] = useState<Alert[] | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setAlerts(mockAlerts);
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const handleAction = (id: string, action: 'acknowledge' | 'assign' | 'resolve') => {
    saveForUndo();
    
    setAlerts(current => current.map(alert => {
      if (alert.id === id) {
        let newStatus = alert.status;
        if (action === 'acknowledge') newStatus = 'acknowledged';
        if (action === 'assign') newStatus = 'assigned';
        if (action === 'resolve') newStatus = 'resolved';
        return { ...alert, status: newStatus };
      }
      return alert;
    }));

    showUndoToast(`Alert marked as ${ACTION_PAST_TENSE[action]}`);
  };

  const handleBulkAction = (ids: string[], action: 'acknowledge' | 'assign' | 'resolve') => {
    saveForUndo();

    setAlerts(current => current.map(alert => {
      if (ids.includes(alert.id)) {
        let newStatus = alert.status;
        if (action === 'acknowledge') newStatus = 'acknowledged';
        if (action === 'assign') newStatus = 'assigned';
        if (action === 'resolve') newStatus = 'resolved';
        return { ...alert, status: newStatus };
      }
      return alert;
    }));

    showUndoToast(`${ids.length} alerts marked as ${ACTION_PAST_TENSE[action]}`);
  };

  const saveForUndo = () => {
    setPreviousState([...alerts]);
  };

  const showUndoToast = (message: string) => {
    setToastMessage(message);
    if (undoTimeout) clearTimeout(undoTimeout);
    
    const timeout = setTimeout(() => {
      setToastMessage(null);
      setPreviousState(null);
    }, 5000);
    
    setUndoTimeout(timeout);
  };

  const handleUndo = () => {
    if (previousState) {
      setAlerts(previousState);
      setToastMessage(null);
      setPreviousState(null);
      if (undoTimeout) clearTimeout(undoTimeout);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Bell className="w-8 h-8 text-primary" />
            Alerts Inbox
          </h1>
          <p className="text-gray-400 mt-2 max-w-2xl">
            Monitor and triage cross-issuer alerts. Take quick actions or drill down for more details.
          </p>
        </div>
        
        {/* KPI Summary */}
        <div className="flex gap-4 items-center">
          <div className="bg-gray-800 border border-white/10 rounded-lg p-3 text-center min-w-[100px]">
            <div className="text-2xl font-bold text-red-500">
              {alerts.filter(a => a.severity === 'critical' && a.status !== 'resolved').length}
            </div>
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">Critical</div>
          </div>
          <div className="bg-gray-800 border border-white/10 rounded-lg p-3 text-center min-w-[100px]">
            <div className="text-2xl font-bold text-white">
              {alerts.filter(a => a.status === 'active').length}
            </div>
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">Active</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-center">
          {error}
        </div>
      ) : (
        <AlertsInboxTable 
          alerts={alerts}
          onAction={handleAction}
          onBulkAction={handleBulkAction}
        />
      )}

      {/* Undo Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 border border-white/10 shadow-2xl rounded-lg px-4 py-3 flex items-center gap-4 z-50 animate-fade-up">
          <span className="text-white text-sm">{toastMessage}</span>
          <button 
            onClick={handleUndo}
            className="text-primary font-medium text-sm hover:text-primary/80 transition-colors bg-white/5 px-3 py-1 rounded"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
};
