import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Send, 
  Radio, 
  CheckCircle2, 
  AlertTriangle, 
  Bell, 
  Mail, 
  Users, 
  History, 
  Lock, 
  UserCheck,
  ShieldCheck,
  Info,
  PowerOff
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const SEVERITY_OPTIONS = [
  { 
    id: 'critical', 
    label: 'Critical Emergency', 
    activeColor: 'border-red-500 bg-red-50 dark:bg-red-950/60 text-red-900 dark:text-red-100 ring-2 ring-red-400', 
    badgeColor: 'bg-red-600 text-white',
    desc: 'Evacuation, active hazard, immediate shelter required' 
  },
  { 
    id: 'warning', 
    label: 'Safety Warning', 
    activeColor: 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-100 ring-2 ring-amber-400', 
    badgeColor: 'bg-amber-600 text-white',
    desc: 'Severe weather, facility closure, localized campus hazard' 
  },
  { 
    id: 'security', 
    label: 'Security Incident', 
    activeColor: 'border-purple-500 bg-purple-50 dark:bg-purple-950/60 text-purple-900 dark:text-purple-100 ring-2 ring-purple-400', 
    badgeColor: 'bg-purple-600 text-white',
    desc: 'Campus security response, restricted access zone' 
  },
  { 
    id: 'info', 
    label: 'Campus Notice / Drill', 
    activeColor: 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100 ring-2 ring-blue-400', 
    badgeColor: 'bg-blue-600 text-white',
    desc: 'Scheduled mock drill, public safety notice' 
  }
];

const CAMPUS_ZONES = [
  'Entire Campus (Campus-Wide)',
  'AB1',
  'AB2',
  'AB3',
  'AB4',
  'AB5',
  'ADMIN BLOCK',
  'BASKETBALL COURT',
  'CRICKET GROUND',
  'FOOTBALL GROUND',
  'GAZEBO',
  'GYMKHANA',
  'GYMNASIUM',
  'KASTURBA AUDITORIUM',
  'LASSI HOUSE',
  'LIBRARY',
  'MG AUDITORIUM',
  'NETAJI AUDITORIUM',
  'NORTH SQUARE',
  'SWIMMING POOL',
  'VMART',
  'VOC AUDITORIUM',
  'VOLLEYBALL COURT'
];

export const AdminAlertPanel = () => {
  const { currentUser, isAdmin } = useAuth();

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('warning');
  const [zone, setZone] = useState(CAMPUS_ZONES[0]);
  const [channels, setChannels] = useState(['email', 'in_app']);

  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(null);
  const [error, setError] = useState('');

  // Alerts History
  const [alerts, setAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  // Subscription tool
  const [subscribeEndpoint, setSubscribeEndpoint] = useState('');
  const [subMsg, setSubMsg] = useState('');

  // Termination state
  const [terminatingId, setTerminatingId] = useState(null);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const data = await api.getAlerts();
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoadingAlerts(false);
    }
  };

  const handleTerminateAlert = async (alertId, alertTitle) => {
    const isAll = alertId === 'all';
    const confirmMsg = isAll
      ? 'Stand down ALL active campus emergency alerts?\n\nThis will immediately remove active banners across all student screens and mark alerts as resolved in DynamoDB.'
      : `Stand down emergency alert: "${alertTitle}"?\n\nThis will immediately remove the emergency banner for all campus users.`;

    if (!window.confirm(confirmMsg)) return;

    setTerminatingId(alertId);
    setError('');
    try {
      await api.terminateAlert(alertId, currentUser?.name || currentUser?.email || 'Campus Security Dispatch');
      await loadAlerts();
    } catch (err) {
      setError(`Failed to terminate alert: ${err.message}`);
    } finally {
      setTerminatingId(null);
    }
  };

  const toggleChannel = (channelId) => {
    if (channels.includes(channelId)) {
      if (channels.length > 1) {
        setChannels(channels.filter(c => c !== channelId));
      }
    } else {
      setChannels([...channels, channelId]);
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setError('Please provide both an alert title and safety instructions.');
      return;
    }

    setBroadcasting(true);
    setError('');
    setBroadcastSuccess(null);

    try {
      const payload = {
        title: title.trim(),
        message: message.trim(),
        severity,
        zone,
        channels,
        senderName: currentUser?.name || 'Campus Police Dispatch',
        senderEmail: currentUser?.email || 'security@campus.edu',
        isAdmin: true
      };

      const result = await api.broadcastAlert(payload);
      setBroadcastSuccess(result.alert);
      setTitle('');
      setMessage('');
      loadAlerts();
    } catch (err) {
      setError(err.message || 'Failed to dispatch alert via Amazon SNS.');
    } finally {
      setBroadcasting(false);
    }
  };

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!subscribeEndpoint.trim()) return;
    try {
      const res = await api.subscribeAlert(subscribeEndpoint.trim(), 'email');
      setSubMsg(res.message || `Confirmation email sent to ${subscribeEndpoint.trim()}`);
      setSubscribeEndpoint('');
      setTimeout(() => setSubMsg(''), 6000);
    } catch (err) {
      setSubMsg('Subscription error: ' + err.message);
    }
  };

  // If user is not admin, show permission prompt
  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto shadow-md">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Campus Security Clearance Required</h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Emergency alert broadcasting is strictly restricted to members of the{' '}
            <strong className="text-slate-900 dark:text-slate-200">Amazon Cognito "Admin" / "Security"</strong> user pool group.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm max-w-md mx-auto space-y-3">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Current Profile: <span className="text-blue-600 dark:text-blue-400 font-bold">{currentUser?.name || currentUser?.email}</span> ({currentUser?.role || 'student'})
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            If you require administrative dispatch privileges, please contact campus public safety administration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-red-600 text-white shadow-md shadow-red-600/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-headline font-black text-slate-900 dark:text-white">
                Emergency Alert Broadcast Console
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-body mt-0.5">
                Authorized Dispatcher: <strong className="text-slate-900 dark:text-slate-200">{currentUser?.name}</strong> ({currentUser?.department})
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-600 dark:text-emerald-400" />
            <span>AWS SNS / SES Active</span>
          </span>
        </div>
      </div>

      {broadcastSuccess && (
        <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 space-y-2 animate-fadeIn font-body">
          <div className="flex items-center gap-2 font-headline font-bold text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Broadcast Successfully Dispatched via Amazon SNS &amp; SES!</span>
          </div>
          <p className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
            Alert "<strong>{broadcastSuccess.title}</strong>" has been transmitted to registered campus student emails and live emergency banners.
          </p>
          <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 pt-1">
            AWS Dispatch ID: {broadcastSuccess.snsMessageId || 'sns-dispatch-confirmed'}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200 flex items-center gap-2 font-body">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Broadcast Form on Left (7 cols), Logs & Tools on Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Broadcast Composer */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h3 className="text-base font-headline font-bold text-slate-900 dark:text-white">Create Campus Broadcast</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-body">
              Broadcast high-priority safety notices across VIT Chennai campus via verified email and live app banner push.
            </p>
          </div>

          <form onSubmit={handleBroadcast} className="space-y-5">
            {/* Severity Level */}
            <div>
              <label className="block text-xs font-headline font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-2">
                Alert Urgency &amp; Severity *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SEVERITY_OPTIONS.map((opt) => {
                  const isSelected = severity === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSeverity(opt.id)}
                      className={`p-3.5 rounded-2xl border text-left transition ${
                        isSelected
                          ? `${opt.activeColor} shadow-xs font-bold`
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-headline font-bold text-slate-900 dark:text-white">{opt.label}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 font-normal mt-1 leading-snug font-body">
                        {opt.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-headline font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-1.5">
                Alert Headline / Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Heavy Rain & High Wind Warning — Relocate Indoors"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-body"
              />
            </div>

            {/* Affected Zone */}
            <div>
              <label className="block text-xs font-headline font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-1.5">
                Target Campus Zone
              </label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-body font-medium"
              >
                {CAMPUS_ZONES.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>

            {/* Channels (Email + In-App Banner) */}
            <div>
              <label className="block text-xs font-headline font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-2">
                Emergency Broadcast Channels
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => toggleChannel('email')}
                  className={`p-3.5 rounded-2xl border text-xs font-headline font-bold flex flex-col items-center justify-center gap-1.5 transition ${
                    channels.includes('email')
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 ring-2 ring-blue-400'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span>Campus Email Dispatch</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleChannel('in_app')}
                  className={`p-3.5 rounded-2xl border text-xs font-headline font-bold flex flex-col items-center justify-center gap-1.5 transition ${
                    channels.includes('in_app')
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 ring-2 ring-blue-400'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span>In-App Banner Push</span>
                </button>
              </div>
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-xs font-headline font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-1.5">
                Emergency Message &amp; Instructions *
              </label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="State the nature of the emergency, actions required from students/faculty, and campus security contact..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs sm:text-sm font-body outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none leading-relaxed"
              />
            </div>

            {/* Broadcast Submit Button */}
            <button
              type="submit"
              disabled={broadcasting}
              className={`w-full py-3.5 rounded-2xl text-white font-headline font-black text-xs sm:text-sm shadow-xl transition flex items-center justify-center gap-2 ${
                severity === 'critical'
                  ? 'bg-red-600 hover:bg-red-500 shadow-red-600/30'
                  : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
              } ${broadcasting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {broadcasting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Publishing Broadcast to AWS SNS &amp; SES...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>BROADCAST CAMPUS EMERGENCY ALERT NOW</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: History & Notification Subscription tool */}
        <div className="lg:col-span-5 space-y-6">
          {/* Subscription Box */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-headline font-bold text-sm text-slate-900 dark:text-white">
                  Campus Emergency Email Registry
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-body">
                  Subscribe student email to receive instant safety notices
                </p>
              </div>
            </div>

            {subMsg && (
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200 font-body">
                {subMsg}
              </div>
            )}

            <form onSubmit={handleSubscribe} className="space-y-3 font-body">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  required
                  value={subscribeEndpoint}
                  onChange={(e) => setSubscribeEndpoint(e.target.value)}
                  placeholder="student@vitstudent.ac.in"
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs outline-none focus:ring-2 focus:ring-blue-500 font-body"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-headline font-bold shadow-md shadow-blue-600/20 transition shrink-0"
                >
                  Subscribe
                </button>
              </div>
            </form>
          </div>

          {/* Audit Log & Active Emergency Controls */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                <h4 className="font-headline font-bold text-sm text-slate-900 dark:text-white">Broadcast Audit Log</h4>
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{alerts.length} records</span>
            </div>

            {/* Active Emergency Summary Banner */}
            {alerts.filter(a => a.active).length > 0 && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 space-y-2.5 font-body animate-fadeIn">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                    </span>
                    <span className="text-xs font-headline font-black text-red-900 dark:text-red-200 uppercase tracking-wider">
                      {alerts.filter(a => a.active).length} Active {alerts.filter(a => a.active).length === 1 ? 'Emergency' : 'Emergencies'} Live
                    </span>
                  </div>
                  <button
                    onClick={() => handleTerminateAlert('all')}
                    disabled={terminatingId === 'all'}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[11px] font-headline font-bold shadow-sm transition flex items-center gap-1.5"
                    title="Stand down and remove all active alert banners"
                  >
                    <PowerOff className="w-3 h-3" />
                    <span>{terminatingId === 'all' ? 'Ending All...' : 'Stand Down All'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-red-700 dark:text-red-300 leading-snug">
                  Active alerts are pinned to the global header banner for all students. Click <strong>Terminate</strong> below to stand down an incident.
                </p>
              </div>
            )}

            {loadingAlerts ? (
              <div className="py-8 text-center text-xs text-slate-400 font-body">Loading broadcast logs...</div>
            ) : alerts.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic text-center py-4 font-body">No broadcast history yet.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
                {alerts.map((al) => {
                  const isCrit = al.severity === 'critical';
                  const isTerminating = terminatingId === al.id;
                  return (
                    <div
                      key={al.id}
                      className={`p-4 rounded-2xl border transition space-y-2.5 ${
                        al.active
                          ? 'border-red-400 dark:border-red-600 bg-red-50/50 dark:bg-red-950/40 shadow-sm ring-1 ring-red-400/30'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded text-white ${
                            isCrit ? 'bg-red-600' : 'bg-amber-600'
                          }`}>
                            {al.severity}
                          </span>
                          {al.active ? (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-600/20 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                              Live Active
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              Resolved
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {new Date(al.createdAt).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>

                      <h5 className="text-xs font-headline font-bold text-slate-900 dark:text-white">{al.title}</h5>
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed font-body">
                        {al.message}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200 dark:border-slate-700/60 font-body">
                        <span>Zone: <strong className="text-slate-700 dark:text-slate-300">{al.zone}</strong></span>
                        
                        {al.active ? (
                          <button
                            onClick={() => handleTerminateAlert(al.id, al.title)}
                            disabled={isTerminating}
                            className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-headline font-bold text-[11px] flex items-center gap-1 shadow-xs transition"
                            title="Stand down this emergency alert"
                          >
                            <PowerOff className="w-3 h-3" />
                            <span>{isTerminating ? 'Ending...' : 'Terminate Alert'}</span>
                          </button>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400 italic text-[10px]">
                            {al.resolvedAt ? `Stood down on ${new Date(al.resolvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Delivered (SNS / SES)'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
