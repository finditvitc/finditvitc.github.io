import React, { useState } from 'react';
import { 
  ShieldCheck, 
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
  GraduationCap,
  Building,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth, VIT_CHENNAI_SCHOOLS } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const LoginPage = ({ onOpenArchitecture }) => {
  const { theme, toggleTheme } = useTheme();
  const { 
    signInWithCognito, 
    signUpWithCognito, 
    confirmSignUp, 
    resendConfirmationCode,
    forgotPassword,
    confirmForgotPassword
  } = useAuth();

  // Mode: 'signin' | 'signup' | 'verify' | 'forgot' | 'reset_confirm'
  const [mode, setMode] = useState('signin');
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState(VIT_CHENNAI_SCHOOLS[0]);
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const resetMessages = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      await signInWithCognito(email, password);
    } catch (err) {
      if (err.code === 'UserNotConfirmedException') {
        setErrorMsg(err.message || 'Account not yet confirmed. Please verify with the 6-digit code sent to your email.');
        setMode('verify');
      } else if (err.code === 'NotAuthorizedException') {
        setErrorMsg('Incorrect email or password. Please verify your credentials.');
      } else if (err.code === 'UserNotFoundException') {
        setErrorMsg('No campus account found with this email address.');
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    resetMessages();

    const cleanEmail = email.trim().toLowerCase();

    // Client-side domain restriction to @vitstudent.ac.in
    if (!cleanEmail.endsWith('@vitstudent.ac.in')) {
      setErrorMsg('Registration is strictly restricted to VIT students with a valid @vitstudent.ac.in email address.');
      return;
    }

    if (!department) {
      setErrorMsg('Please select your VIT Chennai school.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await signUpWithCognito({
        email: cleanEmail,
        password,
        name,
        department
      });

      if (res.userConfirmed) {
        setSuccessMsg('Account registered and confirmed! Signing you in...');
        setTimeout(() => signInWithCognito(cleanEmail, password), 1000);
      } else {
        setSuccessMsg(`Registration initiated! A 6-digit confirmation code has been dispatched to ${cleanEmail}.`);
        setMode('verify');
      }
    } catch (err) {
      if (err.code === 'UsernameExistsException') {
        setErrorMsg('An account with this email already exists. Please Sign In.');
      } else if (err.code === 'InvalidPasswordException') {
        setErrorMsg('Password does not meet complexity requirements (minimum 8 characters with uppercase, lowercase, numbers & symbols).');
      } else {
        setErrorMsg(err.message || 'Registration failed. Please verify your details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmVerification = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      await confirmSignUp(email, verificationCode);
      setSuccessMsg('Email verified successfully! You can now sign in with your VIT credentials.');
      setTimeout(() => {
        setMode('signin');
        setVerificationCode('');
      }, 1500);
    } catch (err) {
      if (err.code === 'CodeMismatchException') {
        setErrorMsg('Invalid confirmation code. Please check the 6-digit code sent to your email.');
      } else if (err.code === 'ExpiredCodeException') {
        setErrorMsg('Confirmation code has expired. Please click "Resend Code" below.');
      } else {
        setErrorMsg(err.message || 'Verification failed. Please check the code.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      setErrorMsg('Please provide your student email address.');
      return;
    }
    resetMessages();
    setLoading(true);

    try {
      await resendConfirmationCode(email);
      setSuccessMsg(`A fresh 6-digit verification code was dispatched to ${email}.`);
      setResendCooldown(30);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to resend confirmation code.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      await forgotPassword(email);
      setSuccessMsg(`Password reset code sent to ${email}. Please check your inbox.`);
      setMode('reset_confirm');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to initiate password recovery.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmResetPassword = async (e) => {
    e.preventDefault();
    resetMessages();

    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      await confirmForgotPassword(email, verificationCode, newPassword);
      setSuccessMsg('Password reset successfully! Please sign in with your new password.');
      setTimeout(() => {
        setMode('signin');
        setPassword(newPassword);
        setVerificationCode('');
      }, 1500);
    } catch (err) {
      setErrorMsg(err.message || 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200 selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-20 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center text-white shadow-md shadow-primary/25 shrink-0">
              <span className="font-headline font-black text-base sm:text-lg tracking-tight">FI</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-headline font-black text-base sm:text-lg tracking-tight text-slate-900 dark:text-white truncate">
                  FindIt VITC
                </span>
                <span className="text-[9px] sm:text-[10px] uppercase font-label font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 dark:bg-primary/20 text-blue-600 dark:text-primary-fixed border border-blue-500/20 dark:border-primary/30 shrink-0">
                  AWS Serverless
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate hidden xs:block">
                VIT Chennai Lost &amp; Found + Emergency Broadcast Network
              </p>
            </div>
          </div>

          {/* Controls: Dark/Light Mode & Architecture */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-primary/50 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition shadow-sm"
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            <button
              onClick={onOpenArchitecture}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-primary/50 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-medium transition shadow-sm"
            >
              <Cloud className="w-4 h-4 text-blue-600 dark:text-primary-fixed" />
              <span className="hidden sm:inline">AWS Architecture</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex-1 w-full flex flex-col items-center justify-center">
        <div className="w-full max-w-md space-y-6">
          {/* Header Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-primary/10 border border-blue-200 dark:border-primary/30 text-blue-700 dark:text-primary-fixed text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-primary" />
              <span>VIT Chennai Student Authentication</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-headline font-black tracking-tight text-slate-900 dark:text-white">
              {mode === 'signin' && 'Welcome to FindIt VITC'}
              {mode === 'signup' && 'Student Registration'}
              {mode === 'verify' && 'Verify Student Email'}
              {mode === 'forgot' && 'Reset Your Password'}
              {mode === 'reset_confirm' && 'Set New Password'}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {mode === 'signin' && 'Sign in with your verified @vitstudent.ac.in account'}
              {mode === 'signup' && 'Exclusive access for VIT Chennai students (@vitstudent.ac.in)'}
              {mode === 'verify' && 'Enter the 6-digit confirmation code sent to your student email'}
              {mode === 'forgot' && 'We will dispatch a secure verification code to your email'}
              {mode === 'reset_confirm' && 'Enter the reset code and your new password'}
            </p>
          </div>

          {/* Authentication Card */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-8 shadow-xl dark:shadow-2xl backdrop-blur-md space-y-5 transition-colors">
            {/* Mode Switcher Tabs for SignIn / SignUp */}
            {(mode === 'signin' || mode === 'signup') && (
              <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setMode('signin'); resetMessages(); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                    mode === 'signin' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Student Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('signup'); resetMessages(); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                    mode === 'signup' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Register
                </button>
              </div>
            )}

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-500/50 text-xs text-red-700 dark:text-red-300 flex items-start gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <span className="flex-1">{errorMsg}</span>
              </div>
            )}

            {/* Success Message Alert */}
            {successMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/50 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span className="flex-1">{successMsg}</span>
              </div>
            )}

            {/* 1. SIGN IN FORM */}
            {mode === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    VIT Student Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.name2023@vitstudent.ac.in"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:bg-white dark:focus:bg-slate-900 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Password *
                    </label>
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); resetMessages(); }}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:bg-white dark:focus:bg-slate-900 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Authenticating with Cognito...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In with Cognito</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* 2. SIGN UP FORM (STUDENT ONLY - DOMAIN RESTRICTED) */}
            {mode === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Full Student Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:bg-white dark:focus:bg-slate-900 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    VIT Chennai School / Department *
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3 pointer-events-none" />
                    <select
                      required
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:bg-white dark:focus:bg-slate-900 focus:border-blue-600 dark:focus:border-blue-500 focus:outline-none transition"
                    >
                      {VIT_CHENNAI_SCHOOLS.map((school) => (
                        <option key={school} value={school} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                          {school}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    VIT Student Email Address (@vitstudent.ac.in) *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.name2023@vitstudent.ac.in"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:bg-white dark:focus:bg-slate-900 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
                    />
                  </div>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                    Registration is strictly restricted to valid @vitstudent.ac.in student addresses.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:bg-white dark:focus:bg-slate-900 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:bg-white dark:focus:bg-slate-900 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition"
                        title={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Password requires at least 8 chars with uppercase, lowercase, numbers &amp; symbols.
                </p>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Registering Student Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Register Student Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* 3. VERIFY EMAIL FORM */}
            {mode === 'verify' && (
              <form onSubmit={handleConfirmVerification} className="space-y-4 animate-fadeIn">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Account Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    6-Digit Email Confirmation Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-center font-mono tracking-widest text-lg focus:bg-white dark:focus:bg-slate-900 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || verificationCode.length < 6}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span>Verifying Code...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Code &amp; Activate</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || loading}
                    onClick={handleResendCode}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition disabled:opacity-50"
                  >
                    {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('signin'); resetMessages(); }}
                    className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            )}

            {/* 4. FORGOT PASSWORD FORM */}
            {mode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4 animate-fadeIn">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Your Registered VIT Student Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.name2023@vitstudent.ac.in"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:bg-white dark:focus:bg-slate-900 focus:border-blue-600 dark:focus:border-blue-500 focus:outline-none transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs tracking-wide transition flex items-center justify-center gap-2"
                >
                  {loading ? <span>Sending Reset Code...</span> : <span>Send Reset Code</span>}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setMode('signin'); resetMessages(); }}
                    className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
                  >
                    Cancel and Return to Sign In
                  </button>
                </div>
              </form>
            )}

            {/* 5. CONFIRM PASSWORD RESET FORM */}
            {mode === 'reset_confirm' && (
              <form onSubmit={handleConfirmResetPassword} className="space-y-4 animate-fadeIn">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Reset Code from Email *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="123456"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-center font-mono tracking-widest text-base focus:bg-white dark:focus:bg-slate-900 focus:border-blue-600 dark:focus:border-blue-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    New Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:bg-white dark:focus:bg-slate-900 focus:border-blue-600 dark:focus:border-blue-500 focus:outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition"
                      title={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wide transition flex items-center justify-center gap-2"
                >
                  {loading ? <span>Updating Password...</span> : <span>Set New Password &amp; Sign In</span>}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setMode('signin'); resetMessages(); }}
                    className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-5 text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <span className="font-bold text-slate-700 dark:text-slate-300">FindIt VITC</span> • Vellore Institute of Technology, Chennai
          </div>
          <div className="flex items-center gap-2">
            <span>Production Authentication via Amazon Cognito User Pool</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
