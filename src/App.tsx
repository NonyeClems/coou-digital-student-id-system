import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { AdminDashboard } from './components/AdminDashboard';
import { StudentPortal } from './components/StudentPortal';
import { Scanner } from './components/Scanner';
import { Navbar } from './components/Navbar';
import { SyncStatusIndicator } from './components/SyncStatusIndicator';
import { VerificationPortal } from './VerificationPortal';
import { IdCard, QrCode, LogIn, Eye, EyeOff } from 'lucide-react';
import { UNIVERSITY_NAME } from './constants';
import { isEmailIdentifier } from './lib/utils';
import { useOnlineStatus } from './hooks/useOnlineStatus';

function friendlyAuthError(err: any, identifierWasRegNo: boolean): string {
  const code: string = err?.code || '';
  if (code === 'auth/network-request-failed') {
    return 'You appear to be offline. Signing in requires an internet connection the first time on a device.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(code)) {
    return identifierWasRegNo
      ? 'Sign-in failed. Check your password — or, if you have not created an account yet, ' +
        'sign up first using the email address on your student record.'
      : 'Incorrect email or password.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Try logging in instead.';
  }
  if (code === 'auth/weak-password') {
    return 'Password is too weak — use at least 6 characters.';
  }
  return err?.message || 'An unexpected error occurred. Please try again.';
}

function AppContent() {
  const { user, profile, loading, login, signup, resetPassword } = useAuth();
  const online = useOnlineStatus();
  const [loginError, setLoginError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const location = useLocation();

  // Reset the auth form whenever there's no signed-in user (fresh load or
  // just logged out), so the next person on this browser doesn't see a
  // previous session's leftover email/name/messages.
  useEffect(() => {
    if (!user) {
      setIdentifier('');
      setPassword('');
      setName('');
      setLoginError('');
      setSuccessMessage('');
      setMode('login');
      setShowPassword(false);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setLoginError('');
    setSuccessMessage('');

    if (mode === 'login') {
      if (!identifier || !password) {
        setLoginError('Please enter your email or registration number, and your password.');
        return;
      }
      setSubmitting(true);
      try {
        await login(identifier, password);
      } catch (err: any) {
        setLoginError(
          err?.code ? friendlyAuthError(err, !isEmailIdentifier(identifier)) : (err?.message || 'An error occurred during login.')
        );
      } finally {
        setSubmitting(false);
      }
    } else if (mode === 'signup') {
      if (!identifier || !password || !name) {
        setLoginError('Please fill in all fields.');
        return;
      }
      if (!isEmailIdentifier(identifier)) {
        setLoginError('Please sign up with a valid email address (you can log in with your registration number afterwards).');
        return;
      }
      setSubmitting(true);
      try {
        await signup(identifier, password, name);
        setSuccessMessage('Account created successfully! Logging you in...');
      } catch (err: any) {
        setLoginError(friendlyAuthError(err, false));
      } finally {
        setSubmitting(false);
      }
    } else if (mode === 'reset') {
      if (!identifier || !isEmailIdentifier(identifier)) {
        setLoginError('Please enter your email address.');
        return;
      }
      setSubmitting(true);
      try {
        await resetPassword(identifier);
        setSuccessMessage('Password reset email sent! Check your inbox.');
        setTimeout(() => setMode('login'), 3000);
      } catch (err: any) {
        setLoginError(friendlyAuthError(err, false));
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-university-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Allow public verification routes (QR landing page and scanner) even if not logged in
  if (!user && !location.pathname.startsWith('/verify') && location.pathname !== '/scanner') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <SyncStatusIndicator />
        <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl max-w-lg w-full text-center space-y-6 border-t-4 border-university-green">
          <div className="w-16 h-16 bg-university-green/10 rounded-full flex items-center justify-center mx-auto">
            <IdCard className="w-8 h-8 text-university-green" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-university-green uppercase tracking-wider">{UNIVERSITY_NAME}</h2>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">Student Identification Number System</h1>
          </div>
          <p className="text-slate-600 text-sm">
            {mode === 'login' && 'Log in with your registration number or email to access your digital ID card.'}
            {mode === 'signup' && 'Register a new account to enroll your student identification record.'}
            {mode === 'reset' && 'Enter your email to receive a password reset link.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {loginError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-bold border border-red-100 text-center">
                {loginError}
              </div>
            )}
            {successMessage && (
              <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg text-xs font-bold border border-emerald-100 text-center">
                {successMessage}
              </div>
            )}

            {mode === 'signup' && (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</label>
                <input
                  type="text"
                  placeholder="Enter your full name..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-university-green focus:border-transparent text-sm"
                  required
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {mode === 'login' ? 'Registration Number or Email' : 'Email Address'}
              </label>
              <input
                type={mode === 'login' ? 'text' : 'email'}
                placeholder={mode === 'login' ? 'e.g. 2021/CS/1234 or your email...' : 'Enter COOU email address...'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-university-green focus:border-transparent text-sm"
                required
              />
            </div>

            {mode !== 'reset' && (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-university-green focus:border-transparent text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-university-green cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-university-green hover:bg-university-green/90 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-emerald-100 mt-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn className="w-5 h-5" />
              )}
              {mode === 'login' && (submitting ? 'Signing In...' : 'Login to COOU Account')}
              {mode === 'signup' && (submitting ? 'Creating Account...' : 'Create Account')}
              {mode === 'reset' && (submitting ? 'Sending...' : 'Send Reset Instructions')}
            </button>
          </form>

          {mode === 'login' && !online && (
            <p className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2 uppercase tracking-wider">
              You are offline — sign-in works only if you have signed in on this device before.
            </p>
          )}

          <div className="flex flex-col gap-2 pt-2 text-xs font-bold text-slate-500">
            {mode === 'login' && (
              <>
                <button onClick={() => { setMode('signup'); setLoginError(''); setSuccessMessage(''); }} className="hover:text-university-green cursor-pointer">
                  Don't have an account? Sign Up
                </button>
                <button onClick={() => { setMode('reset'); setLoginError(''); setSuccessMessage(''); }} className="hover:text-university-green cursor-pointer">
                  Forgot Password?
                </button>
              </>
            )}
            {mode === 'signup' && (
              <button onClick={() => { setMode('login'); setLoginError(''); setSuccessMessage(''); }} className="hover:text-university-green cursor-pointer">
                Already have an account? Login
              </button>
            )}
            {mode === 'reset' && (
              <button onClick={() => { setMode('login'); setLoginError(''); setSuccessMessage(''); }} className="hover:text-university-green cursor-pointer">
                Back to Login
              </button>
            )}
          </div>

          <div className="pt-6 border-t border-slate-100">
            <NavigateToScanner />
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {user && <Navbar />}
      <SyncStatusIndicator />

      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 max-w-7xl">
        <Routes>
          <Route path="/" element={
            profile?.role === 'admin' || profile?.role === 'staff' ? (
              <AdminDashboard />
            ) : (
              <StudentPortal />
            )
          } />
          <Route path="/scanner" element={<ScannerPage />} />
          <Route path="/verify/:studentId" element={<VerificationPortal />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <footer className="py-12 text-center space-y-2 px-4">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
          &copy; {new Date().getFullYear()} {UNIVERSITY_NAME}
        </p>
        <p className="text-slate-300 text-[10px]">Registry & Records Information System</p>
      </footer>
    </div>
  );
}

function ScannerPage() {
  const navigate = useNavigate();
  return <Scanner onClose={() => navigate('/')} />;
}

function NavigateToScanner() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/scanner')}
      className="text-sm font-bold text-university-green hover:text-university-green/80 flex items-center justify-center gap-2 mx-auto cursor-pointer"
    >
       <QrCode className="w-5 h-5 text-university-yellow" />
       Verify Student Identity
    </button>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
