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
  { id: 'critical', label: 'Critical Emergency', color: 'border-red-500 bg-red-50 text-red-700', desc: 'Evacuation, active threat, immediate shelter required' },
  { id: 'warning', label: 'Safety Warning', color: 'border-amber-500 bg-amber-50 text-amber-800', desc: 'Severe weather, building closure, localized hazard' },
  { id: 'security', label: 'Security Incident', color: 'border-purple-500 bg-purple-50 text-purple-800', desc: 'Law enforcement response, restricted access zone' },
  { id: 'info', label: 'Campus Notice / Drill', color: 'border-blue-500 bg-blue-50 text-blue-700', desc: 'Scheduled fire drill, non-critical public safety memo' }
];

const CAMPUS_ZONES = [
  'Entire Campus (Campus-Wide)',
  'Science & Engineering Quad',
  'North Campus Residential Halls',
  'South Campus Residence Complexes',
  'Student Center & Dining Commons',
  'Main Library & Study Commons',
  'Athletic Center & Stadium'
];

export const AdminAlertPanel = () => {
  const { currentUser, isAdmin, switchUser, demoUsers } = useAuth();

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

  // If user is not admin, show permission prompt with one-click profile switch
  if (!isAdmin) {
    const adminUser = demoUsers.find(u => u.role === 'admin');

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
            Current Profile: <span className="text-blue-600 font-bold">{currentUser?.name}</span> ({currentUser?.role})
          </p>
          {adminUser && (
            <button
              onClick={() => switchUser(adminUser)}
              className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition flex items-center justify-center gap-2"
            >
              <UserCheck className="w-4 h-4" />
              <span>Switch to Security Officer Profile ({adminUser.name})</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-600 text-white shadow-md shadow-red-600/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Emergency Alert Broadcast Console</h1>
              <p className="text-xs text-slate-500">
                Authorized Dispatcher: <strong>{currentUser?.name}</strong> ({currentUser?.department})
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-600" />
            <span>Amazon SNS Active</span>
          </span>
        </div>
      </div>

      {broadcastSuccess && (
        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2 animate-fadeIn">
          <div className="flex items-center gap-2 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Broadcast Successfully Dispatched via Amazon SNS!</span>
          </div>
          <p className="text-xs text-emerald-800 leading-relaxed">
            Alert: "<strong>{broadcastSuccess.title}</strong>" has been transmitted to registered campus student phones (SMS) and emails. The emergency banner has updated across all devices.
          </p>
          <div className="text-[11px] font-mono text-emerald-700">
            SNS Message ID: {broadcastSuccess.snsMessageId || 'sns-dispatch-confirmed'}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Broadcast Form on Left (7 cols), Logs & Tools on Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Broadcast Composer */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900">Create Campus Broadcast</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Broadcast high-priority safety notices across campus via SMS, email, and live app push.
            </p>
          </div>

          <form onSubmit={handleBroadcast} className="space-y-5">
            {/* Severity Level */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Alert Urgency & Severity *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SEVERITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSeverity(opt.id)}
                    className={`p-3 rounded-2xl border text-left transition ${
                      severity === opt.id
                        ? `${opt.color} ring-2 ring-blue-500/20 shadow-xs font-bold`
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{opt.label}</span>
                      {severity === opt.id && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-slate-500 font-normal mt-1 leading-snug">
                      {opt.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Alert Headline / Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Flash Flood & High Wind Warning — Seek Shelter"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 text-xs sm:text-sm outline-none transition"
              />
            </div>

            {/* Affected Zone */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Target Campus Zone
              </label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none bg-white focus:border-red-500 transition"
              >
                {CAMPUS_ZONES.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>

            {/* Channels */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Amazon SNS Broadcast Channels
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => toggleChannel('sms')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition ${
                    channels.includes('sms')
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-slate-200 text-slate-400 bg-slate-50'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>SMS Broadcast</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleChannel('email')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition ${
                    channels.includes('email')
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-slate-200 text-slate-400 bg-slate-50'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  <span>Campus Email</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleChannel('in_app')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition ${
                    channels.includes('in_app')
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-slate-200 text-slate-400 bg-slate-50'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  <span>In-App Banner</span>
                </button>
              </div>
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Emergency Message & Instructions *
              </label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="State the nature of the emergency, actions required from students/faculty, and campus police contact..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 text-xs sm:text-sm outline-none transition resize-none"
              />
            </div>

            {/* Broadcast Submit Button */}
            <button
              type="submit"
              disabled={broadcasting}
              className={`w-full py-3.5 rounded-2xl text-white font-black text-xs sm:text-sm shadow-xl transition flex items-center justify-center gap-2 ${
                severity === 'critical'
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-600/30'
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
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">Student SNS Notification Registry</h4>
                <p className="text-[11px] text-slate-500">Subscribe phone or email to emergency SNS topic</p>
              </div>
            </div>

            {subMsg && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
                {subMsg}
              </div>
            )}

            <form onSubmit={handleSubscribe} className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSubscribeProtocol('email')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${
                    subscribeProtocol === 'email' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => setSubscribeProtocol('sms')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${
                    subscribeProtocol === 'sms' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 border-slate-200 text-slate-600'
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
                  placeholder={subscribeProtocol === 'email' ? 'student@university.edu' : '+15551234567'}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition shrink-0"
                >
                  Subscribe
                </button>
              </div>
            </form>
          </div>

          {/* Audit Log */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                <h4 className="font-bold text-sm text-slate-900">Broadcast Audit Log</h4>
              </div>
              <span className="text-xs text-slate-400">{alerts.length} records</span>
            </div>

            {loadingAlerts ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading broadcast logs...</div>
            ) : alerts.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">No broadcast history yet.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {alerts.map((al) => {
                  const isCrit = al.severity === 'critical';
                  return (
                    <div
                      key={al.id}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                          isCrit ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {al.severity}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(al.createdAt).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>

                      <h5 className="text-xs font-bold text-slate-900">{al.title}</h5>
                      <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                        {al.message}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
                        <span>Zone: {al.zone}</span>
                        <span className="text-emerald-600 font-medium">Delivered (SNS)</span>
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
