import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, Info, Bell, X, Volume2, VolumeX, Send } from 'lucide-react';
import { api } from '../services/api';

export const EmergencyBanner = () => {
  const [activeAlert, setActiveAlert] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

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
        <div className="flex items-start sm:items-center justify-between gap-3">
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
              <div className="mt-1 flex items-center gap-2 text-[11px] opacity-80">
                <span>Dispatched via <strong>Amazon SNS</strong> (SMS + Email + Push)</span>
                <span>•</span>
                <span>From: {activeAlert.senderName || 'VIT Chennai Campus Security'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
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
