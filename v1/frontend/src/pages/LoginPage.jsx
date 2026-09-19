import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  UserCheck, 
  Lock, 
  Mail, 
  Key, 
  Sparkles, 
  Cloud, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle,
  Database,
  Radio,
  FileImage,
  Zap,
  Server
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage = ({ onOpenArchitecture }) => {
  const { 
    demoUsers, 
    switchUser, 
    signInWithCognito, 
    signUpWithCognito, 
    loginWithEmail 
  } = useAuth();

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [role, setRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleQuickLogin = (user) => {
    switchUser(user);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        await signInWithCognito(email, password);
      } else {
        await signUpWithCognito({
          email,
          password,
          name,
          department,
          role
        });
        setSuccessMsg('Account registered successfully! Signing you in...');
        setTimeout(() => {
          loginWithEmail(email, role);
        }, 1000);
      }
    } catch (err) {
      console.warn('Authentication error:', err);
      // Fallback check for preset demo credentials
      const cleanEmail = email.trim().toLowerCase();
      const matched = demoUsers.find(u => u.email.toLowerCase() === cleanEmail);
      if (matched && (!password || matched.password === password || password.length >= 6)) {
        switchUser(matched);
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPresetToForm = (user) => {
    setEmail(user.email);
    setPassword(user.password || 'StudentPass123!');
    setRole(user.role);
    setMode('signin');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
              <span className="font-black text-lg tracking-tight">CF</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight text-white">CampusFind</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  AWS Serverless
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Lost & Found + Real-Time Emergency Broadcast Network</p>
            </div>
          </div>

          <button
            onClick={onOpenArchitecture}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-700 hover:border-blue-500/50 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition shadow-sm"
          >
            <Cloud className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">AWS Architecture</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full space-y-12">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Computer Vision + Instant Campus Safety Alerts</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Campus Lost & Found + Emergency Alert System
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Report misplaced campus belongings, match items with <strong className="text-slate-200">Amazon Rekognition</strong> vision analysis, and broadcast priority safety bulletins via <strong className="text-slate-200">Amazon SNS</strong>.
          </p>

          {/* AWS Tech Stack Pill Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-[11px] text-slate-300">
              <Lock className="w-3 h-3 text-purple-400" /> Amazon Cognito
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-[11px] text-slate-300">
              <FileImage className="w-3 h-3 text-amber-400" /> Amazon S3
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-[11px] text-slate-300">
              <Zap className="w-3 h-3 text-blue-400" /> Rekognition AI
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-[11px] text-slate-300">
              <Database className="w-3 h-3 text-emerald-400" /> DynamoDB
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-[11px] text-slate-300">
              <Radio className="w-3 h-3 text-red-400" /> Amazon SNS
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-[11px] text-slate-300">
              <Server className="w-3 h-3 text-cyan-400" /> AWS Lambda
            </span>
          </div>
        </div>

        {/* 1-Click Quick Login Preset Accounts */}
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              1-Click Demo Profile Switcher
            </h2>
            <p className="text-xs text-slate-500">
              Select an authorized campus profile below to immediately access the application with pre-configured role permissions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {demoUsers.map((user) => {
              const isAdmin = user.role === 'admin' || (user.groups || []).includes('Admin');
              return (
                <div
                  key={user.id}
                  className={`rounded-2xl border p-5 transition-all flex flex-col justify-between relative overflow-hidden backdrop-blur-sm group hover:scale-[1.02] ${
                    isAdmin
                      ? 'bg-gradient-to-b from-red-950/40 via-slate-900 to-slate-900 border-red-500/40 hover:border-red-500 shadow-lg shadow-red-950/50'
                      : 'bg-gradient-to-b from-blue-950/40 via-slate-900 to-slate-900 border-blue-500/30 hover:border-blue-500 shadow-lg shadow-blue-950/50'
                  }`}
                >
                  {/* Decorative badge glow */}
                  <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-10 pointer-events-none ${
                    isAdmin ? 'bg-red-500' : 'bg-blue-500'
                  }`} />

                  <div className="space-y-4">
                    {/* User Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-700 shrink-0"
                        />
                        <div>
                          <h3 className="font-bold text-white text-base leading-tight group-hover:text-blue-300 transition">
                            {user.name}
                          </h3>
                          <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded mt-1 ${
                            isAdmin 
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}>
                            {user.role} {isAdmin ? '• EMERGENCY ACCESS' : '• CAMPUS ACCESS'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Department & Email Details */}
                    <div className="space-y-1.5 text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Department</span>
                        <span className="text-slate-300 font-medium">{user.department}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Email Address</span>
                        <span className="text-slate-300 font-mono text-[11px]">{user.email}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Preset Password</span>
                        <span className="text-amber-300 font-mono text-[11px] font-semibold">{user.password || 'StudentPass123!'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 1-Click Login CTA */}
                  <div className="pt-4 mt-2 space-y-2">
                    <button
                      onClick={() => handleQuickLogin(user)}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs tracking-wide transition shadow-md flex items-center justify-center gap-2 text-white ${
                        isAdmin
                          ? 'bg-red-600 hover:bg-red-500 shadow-red-600/30'
                          : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                      }`}
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>1-Click Login as {user.name.split(' ')[0]}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPresetToForm(user)}
                      className="w-full text-center text-[11px] text-slate-400 hover:text-slate-200 transition py-1"
                    >
                      Autofill in Cognito form below ↓
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cognito Custom Sign-In / Sign-Up Form */}
        <div className="max-w-md mx-auto bg-slate-950/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">
          <div className="text-center space-y-1">
            <h3 className="text-lg font-bold text-white">
              {mode === 'signin' ? 'Amazon Cognito Sign In' : 'Create Campus Account'}
            </h3>
            <p className="text-xs text-slate-400">
              {mode === 'signin' 
                ? 'Authenticate via AWS Cognito User Pool with USER_PASSWORD_AUTH'
                : 'Register a new student or faculty account'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => { setMode('signin'); setErrorMsg(''); }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                mode === 'signin' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setErrorMsg(''); }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                mode === 'signup' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/50 text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-xs text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Maya Lin"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:border-blue-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Department / Major
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Electrical Engineering"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:border-blue-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Account Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-blue-500 focus:outline-none transition"
                  >
                    <option value="student">Student (General Access)</option>
                    <option value="admin">Campus Security Officer (Admin)</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Campus Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@campus.edu"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:border-blue-500 focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Password *
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:border-blue-500 focus:outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Must be at least 8 characters with upper, lower, numbers & symbols.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating with Cognito...</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In to CampusFind' : 'Register New Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <span className="font-bold text-slate-400">CampusFind</span> • AWS Advanced Cloud Computing Rebuild
          </div>
          <div className="flex items-center gap-2">
            <span>Powered by AWS Serverless Infrastructure</span>
            <span>•</span>
            <button
              onClick={onOpenArchitecture}
              className="text-blue-400 hover:text-blue-300 font-semibold underline"
            >
              View System Architecture
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
