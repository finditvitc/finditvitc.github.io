import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Send, 
  Radio, 
  CheckCircle2, 
  AlertTriangle, 
  Bell, 
  Mail, 
  Smartphone, 
  Users, 
  History, 
  Lock, 
  UserCheck,
  ShieldCheck,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const SEVERITY_OPTIONS = [
  { id: 'critical', label: 'Critical Emergency', color: 'border-emergency-crimson bg-red-50 text-emergency-crimson', desc: 'Evacuation, active hazard, immediate shelter required' },
  { id: 'warning', label: 'Safety Warning', color: 'border-amber-500 bg-amber-50 text-amber-800', desc: 'Severe weather, facility closure, localized campus hazard' },
  { id: 'security', label: 'Security Incident', color: 'border-purple-500 bg-purple-50 text-purple-800', desc: 'Campus security response, restricted access zone' },
  { id: 'info', label: 'Campus Notice / Drill', color: 'border-primary bg-primary-fixed/30 text-primary', desc: 'Scheduled mock drill, non-critical public safety memo' }
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
  const [channels, setChannels] = useState(['sms', 'email', 'in_app']);

  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(null);
  const [error, setError] = useState('');

  // Alerts History
  const [alerts, setAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  // Subscription tool
  const [subscribeEndpoint, setSubscribeEndpoint] = useState('');
  const [subscribeProtocol, setSubscribeProtocol] = useState('email');
  const [subMsg, setSubMsg] = useState('');

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
    if (!subscribeEndpoint) return;
    try {
      const res = await api.subscribeAlert(subscribeEndpoint, subscribeProtocol);
      setSubMsg(res.message);
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
        <div className="w-16 h-16 rounded-3xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-md">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900">Campus Security Clearance Required</h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Emergency alert broadcasting is strictly restricted to members of the{' '}
            <strong className="text-slate-700">Amazon Cognito "Admin" / "Security"</strong> user pool group.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm max-w-md mx-auto space-y-3">
          <p className="text-xs font-semibold text-slate-700">
            Current Profile: <span className="text-blue-600 font-bold">{currentUser?.name || currentUser?.email}</span> ({currentUser?.role || 'student'})
          </p>
          <p className="text-xs text-slate-500">
            If you require administrative dispatch privileges, please contact campus public safety administration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/40 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emergency-crimson text-white shadow-md shadow-emergency-crimson/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-headline font-black text-on-surface">Emergency Alert Broadcast Console</h1>
              <p className="text-xs text-outline font-body">
                Authorized Dispatcher: <strong>{currentUser?.name}</strong> ({currentUser?.department})
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-found-emerald/10 text-found-emerald text-xs font-label font-bold">
            <Radio className="w-3.5 h-3.5 animate-pulse text-found-emerald" />
            <span>Amazon SNS Active</span>
          </span>
        </div>
      </div>

      {broadcastSuccess && (
        <div className="p-5 rounded-2xl bg-found-emerald/10 border border-found-emerald/30 text-on-surface space-y-2 animate-fadeIn font-body">
          <div className="flex items-center gap-2 font-headline font-bold text-sm text-found-emerald">
            <CheckCircle2 className="w-5 h-5 text-found-emerald" />
            <span>Broadcast Successfully Dispatched via Amazon SNS!</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Alert: "<strong>{broadcastSuccess.title}</strong>" has been transmitted to registered campus student phones (SMS) and emails. The emergency banner has updated across all devices.
          </p>
          <div className="text-[11px] font-label font-mono text-found-emerald">
            SNS Message ID: {broadcastSuccess.snsMessageId || 'sns-dispatch-confirmed'}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-emergency-crimson flex items-center gap-2 font-body">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Broadcast Form on Left (7 cols), Logs & Tools on Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Broadcast Composer */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-3xl border border-outline-variant/50 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-outline-variant/30 pb-4">
            <h3 className="text-base font-headline font-bold text-on-surface">Create Campus Broadcast</h3>
            <p className="text-xs text-outline mt-0.5 font-body">
              Broadcast high-priority safety notices across VIT Chennai campus via SMS, email, and live app push.
            </p>
          </div>

          <form onSubmit={handleBroadcast} className="space-y-5">
            {/* Severity Level */}
            <div>
              <label className="block text-xs font-headline font-bold uppercase tracking-wider text-on-surface mb-2">
                Alert Urgency &amp; Severity *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SEVERITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSeverity(opt.id)}
                    className={`p-3 rounded-2xl border text-left transition ${
                      severity === opt.id
                        ? `${opt.color} ring-2 ring-primary/20 shadow-xs font-bold`
                        : 'border-outline-variant/50 hover:bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-headline font-bold">{opt.label}</span>
                      {severity === opt.id && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-outline font-normal mt-1 leading-snug font-body">
                      {opt.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-headline font-bold uppercase tracking-wider text-on-surface mb-1.5">
                Alert Headline / Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Heavy Rain & High Wind Warning — Relocate Indoors"
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/60 focus:border-emergency-crimson focus:ring-2 focus:ring-red-100 text-xs sm:text-sm font-body outline-none transition bg-surface-container-lowest"
              />
            </div>

            {/* Affected Zone */}
            <div>
              <label className="block text-xs font-headline font-bold uppercase tracking-wider text-on-surface mb-1.5">
                Target Campus Zone
              </label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/60 text-xs sm:text-sm outline-none bg-surface-container-lowest focus:border-emergency-crimson transition font-body"
              >
                {CAMPUS_ZONES.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>

            {/* Channels */}
            <div>
              <label className="block text-xs font-headline font-bold uppercase tracking-wider text-on-surface mb-2">
                Amazon SNS Broadcast Channels
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => toggleChannel('sms')}
                  className={`p-3 rounded-xl border text-xs font-headline font-semibold flex flex-col items-center justify-center gap-1.5 transition ${
                    channels.includes('sms')
                      ? 'border-primary bg-primary-fixed/30 text-primary'
                      : 'border-outline-variant/50 text-outline bg-surface-container'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>SMS Broadcast</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleChannel('email')}
                  className={`p-3 rounded-xl border text-xs font-headline font-semibold flex flex-col items-center justify-center gap-1.5 transition ${
                    channels.includes('email')
                      ? 'border-primary bg-primary-fixed/30 text-primary'
                      : 'border-outline-variant/50 text-outline bg-surface-container'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  <span>Campus Email</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleChannel('in_app')}
                  className={`p-3 rounded-xl border text-xs font-headline font-semibold flex flex-col items-center justify-center gap-1.5 transition ${
                    channels.includes('in_app')
                      ? 'border-primary bg-primary-fixed/30 text-primary'
                      : 'border-outline-variant/50 text-outline bg-surface-container'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  <span>In-App Banner</span>
                </button>
              </div>
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-xs font-headline font-bold uppercase tracking-wider text-on-surface mb-1.5">
                Emergency Message &amp; Instructions *
              </label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="State the nature of the emergency, actions required from students/faculty, and campus security contact..."
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/60 focus:border-emergency-crimson focus:ring-2 focus:ring-red-100 text-xs sm:text-sm font-body outline-none transition resize-none bg-surface-container-lowest"
              />
            </div>

            {/* Broadcast Submit Button */}
            <button
              type="submit"
              disabled={broadcasting}
              className={`w-full py-3.5 rounded-2xl text-white font-headline font-black text-xs sm:text-sm shadow-xl transition flex items-center justify-center gap-2 ${
                severity === 'critical'
                  ? 'bg-emergency-crimson hover:bg-emergency-crimson/90 shadow-emergency-crimson/30'
                  : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
              } ${broadcasting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {broadcasting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Publishing to Amazon SNS Topic...</span>
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
          {/* Subscription Tester */}
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/50 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary-fixed text-primary">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-headline font-bold text-sm text-on-surface">Student SNS Notification Registry</h4>
                <p className="text-[11px] text-outline font-body">Subscribe phone or email to emergency SNS topic</p>
              </div>
            </div>

            {subMsg && (
              <div className="p-3 rounded-xl bg-primary-fixed/40 border border-primary/20 text-xs text-primary font-body">
                {subMsg}
              </div>
            )}

            <form onSubmit={handleSubscribe} className="space-y-3 font-body">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSubscribeProtocol('email')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-headline font-semibold border ${
                    subscribeProtocol === 'email' ? 'bg-primary text-white border-primary' : 'bg-surface-container border-outline-variant/40 text-on-surface-variant'
                  }`}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => setSubscribeProtocol('sms')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-headline font-semibold border ${
                    subscribeProtocol === 'sms' ? 'bg-primary text-white border-primary' : 'bg-surface-container border-outline-variant/40 text-on-surface-variant'
                  }`}
                >
                  SMS (Phone)
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={subscribeEndpoint}
                  onChange={(e) => setSubscribeEndpoint(e.target.value)}
                  placeholder={subscribeProtocol === 'email' ? 'student@vitstudent.ac.in' : '+91 98765 43210'}
                  className="flex-1 px-3 py-2 rounded-xl border border-outline-variant/60 text-xs outline-none focus:border-primary bg-surface-container-lowest font-body"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-on-surface hover:bg-slate-800 text-white rounded-xl text-xs font-headline font-semibold transition shrink-0"
                >
                  Subscribe
                </button>
              </div>
            </form>
          </div>

          {/* Audit Log */}
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/50 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-outline" />
                <h4 className="font-headline font-bold text-sm text-on-surface">Broadcast Audit Log</h4>
              </div>
              <span className="text-xs font-label text-outline">{alerts.length} records</span>
            </div>

            {loadingAlerts ? (
              <div className="py-8 text-center text-xs text-outline font-body">Loading broadcast logs...</div>
            ) : alerts.length === 0 ? (
              <p className="text-xs text-outline italic text-center py-4 font-body">No broadcast history yet.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {alerts.map((al) => {
                  const isCrit = al.severity === 'critical';
                  return (
                    <div
                      key={al.id}
                      className="p-3.5 rounded-2xl border border-outline-variant/40 bg-surface-container/60 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[9px] font-label font-black uppercase px-2 py-0.5 rounded text-white ${
                          isCrit ? 'bg-emergency-crimson' : 'bg-amber-600'
                        }`}>
                          {al.severity}
                        </span>
                        <span className="text-[10px] text-outline font-label">
                          {new Date(al.createdAt).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>

                      <h5 className="text-xs font-headline font-bold text-on-surface">{al.title}</h5>
                      <p className="text-[11px] text-on-surface-variant line-clamp-2 leading-relaxed font-body">
                        {al.message}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-outline pt-1 border-t border-outline-variant/30 font-body">
                        <span>Zone: {al.zone}</span>
                        <span className="text-found-emerald font-semibold">Delivered (SNS)</span>
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
