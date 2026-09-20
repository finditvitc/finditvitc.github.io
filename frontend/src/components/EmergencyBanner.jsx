import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, Info, Bell, X, Volume2, VolumeX, Send, PowerOff, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const EmergencyBanner = () => {
  const { currentUser, isAdmin } = useAuth();
  const [activeAlert, setActiveAlert] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [terminating, setTerminating] = useState(false);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, []);

  const loadAlerts = async () => {
    try {
      const data = await api.getAlerts();
      const active = data.alerts?.find(a => a.active);
      if (active) {
        setActiveAlert(active);
        setDismissed(false);
      } else {
        setActiveAlert(null);
      }
    } catch (err) {
      console.error("Failed to load alerts:", err);
    }
  };

  const handleTerminate = async () => {
    if (!activeAlert) return;
    const confirmStandDown = window.confirm(
      `Terminate Campus Alert: "${activeAlert.title}"?\n\nThis will stand down the emergency and immediately remove this active broadcast across the campus grid.`
    );
    if (!confirmStandDown) return;

    setTerminating(true);
    try {
      await api.terminateAlert(activeAlert.id, currentUser?.name || currentUser?.email || 'Campus Safety Admin');
      setActiveAlert(null);
      setDismissed(true);
    } catch (err) {
      alert(`Failed to terminate alert: ${err.message}`);
    } finally {
      setTerminating(false);
    }
  };

  if (!activeAlert || dismissed) {
    return null;
  }

  const isCritical = activeAlert.severity === 'critical';
  const isWarning = activeAlert.severity === 'warning';

  const bgClasses = isCritical
    ? 'bg-red-600 text-white shadow-lg animate-emergency'
    : isWarning
    ? 'bg-amber-500 text-slate-950 shadow-md'
    : 'bg-blue-600 text-white shadow-md';

  const icon = isCritical ? (
    <ShieldAlert className="w-6 h-6 shrink-0 animate-bounce" />
  ) : isWarning ? (
    <AlertTriangle className="w-6 h-6 shrink-0" />
  ) : (
    <Info className="w-6 h-6 shrink-0" />
  );

  return (
    <aside aria-label="Campus Emergency Alert" className={`${bgClasses} transition-all duration-300 relative z-50`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            {icon}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black tracking-wider text-xs uppercase px-2 py-0.5 rounded bg-black/25">
                  {activeAlert.severity} ALERT
                </span>
                <span className="font-semibold text-sm sm:text-base">
                  {activeAlert.title}
                </span>
                <span className="text-xs opacity-90 hidden md:inline">
                  • Zone: <strong className="underline">{activeAlert.zone}</strong>
                </span>
              </div>
              <p className="text-xs sm:text-sm mt-0.5 font-normal opacity-95">
                {activeAlert.message}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] opacity-80">
                <span>Dispatched via <strong>Amazon SNS &amp; SES</strong> (Campus Email + In-App Banner)</span>
                <span>•</span>
                <span>From: {activeAlert.senderName || 'VIT Chennai Campus Security'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {isAdmin && (
              <button
                onClick={handleTerminate}
                disabled={terminating}
                className="px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 text-white font-bold text-xs flex items-center gap-1.5 border border-white/30 transition shadow-sm"
                title="Admin: Stand down and terminate this emergency alert"
              >
                <PowerOff className="w-3.5 h-3.5" />
                <span>{terminating ? 'Ending...' : 'Terminate Alert'}</span>
              </button>
            )}

            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded-full hover:bg-black/20 transition text-inherit"
              title="Dismiss banner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
