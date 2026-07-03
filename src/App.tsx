import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { AdminDashboard } from './components/AdminDashboard';
import { StudentPortal } from './components/StudentPortal';
import { Scanner } from './components/Scanner';
import { Navbar } from './components/Navbar';
import { VerificationPortal } from './VerificationPortal';
import { motion, AnimatePresence } from 'motion/react';
import { IdCard, QrCode, LogIn } from 'lucide-react';
import { UNIVERSITY_NAME, APP_NAME } from './constants';

function AppContent() {
  const { user, profile, loading, login, signup, resetPassword } = useAuth();
  const [loginError, setLoginError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const location = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setSuccessMessage('');

    if (mode === 'login') {
      if (!email || !password) {
        setLoginError('Please enter your email and password.');
        return;
      }
      try {
        await login(email, password);
      } catch (err: any) {
        setLoginError(err.message || 'An error occurred during login.');
      }
    } else if (mode === 'signup') {
      if (!email || !password || !name) {
        setLoginError('Please fill in all fields.');
        return;
      }
      try {
        await signup(email, password, name);
        setSuccessMessage('Account created successfully! Logging you in...');
      } catch (err: any) {
        setLoginError(err.message || 'An error occurred during registration.');
      }
    } else if (mode === 'reset') {
      if (!email) {
        setLoginError('Please enter your email address.');
        return;
      }
      try {
        await resetPassword(email);
        setSuccessMessage('Password reset email sent! Check your inbox.');
        setTimeout(() => setMode('login'), 3000);
      } catch (err: any) {
        setLoginError(err.message || 'An error occurred while sending reset email.');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-8 h-8 border-4 border-university-green border-t-transparent rounded-full"
        />
      </div>
    );
  }

  // Allow public verification routes even if not logged in
  if (!user && !location.pathname.startsWith('/verify')) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full text-center space-y-6 border-t-4 border-university-green"
        >
          <div className="w-16 h-16 bg-university-green/10 rounded-full flex items-center justify-center mx-auto">
            <IdCard className="w-8 h-8 text-university-green" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-university-green uppercase tracking-wider">{UNIVERSITY_NAME}</h2>
            <h1 className="text-2xl font-black text-slate-900 leading-tight">Student Identification Number System</h1>
          </div>
          <p className="text-slate-600 text-sm">
            {mode === 'login' && 'Access your secure digital ID card or manage university identification records.'}
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</label>
              <input
                type="email"
                placeholder="Enter COOU email address..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-university-green focus:border-transparent text-sm"
                required
              />
            </div>

            {mode !== 'reset' && (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</label>
                <input
                  type="password"
                  placeholder="Enter your password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-university-green focus:border-transparent text-sm"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-university-green hover:bg-university-green/90 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-emerald-100 mt-2 cursor-pointer"
            >
              <LogIn className="w-5 h-5" />
              {mode === 'login' && 'Login to COOU Account'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'reset' && 'Send Reset Instructions'}
            </button>
          </form>

          <div className="flex flex-col gap-2 pt-2 text-xs font-bold text-slate-500">
            {mode === 'login' && (
              <>
                <button onClick={() => { setMode('signup'); setLoginError(''); setSuccessMessage(''); }} className="hover:text-university-green transition-colors cursor-pointer">
                  Don't have an account? Sign Up
                </button>
                <button onClick={() => { setMode('reset'); setLoginError(''); setSuccessMessage(''); }} className="hover:text-university-green transition-colors cursor-pointer">
                  Forgot Password?
                </button>
              </>
            )}
            {mode === 'signup' && (
              <button onClick={() => { setMode('login'); setLoginError(''); setSuccessMessage(''); }} className="hover:text-university-green transition-colors cursor-pointer">
                Already have an account? Login
              </button>
            )}
            {mode === 'reset' && (
              <button onClick={() => { setMode('login'); setLoginError(''); setSuccessMessage(''); }} className="hover:text-university-green transition-colors cursor-pointer">
                Back to Login
              </button>
            )}
          </div>
          
          <div className="pt-6 border-t border-slate-100">
            <NavigateToScanner />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {user && <Navbar />}
      
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <Routes>
          <Route path="/" element={
            profile?.role === 'admin' || profile?.role === 'staff' ? (
              <AdminDashboard />
            ) : (
              <StudentPortal />
            )
          } />
          <Route path="/scanner" element={<Scanner onClose={() => {}} />} />
          <Route path="/verify/:studentId" element={<VerificationPortal />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <footer className="py-12 text-center space-y-2">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
          &copy; {new Date().getFullYear()} {UNIVERSITY_NAME}
        </p>
        <p className="text-slate-300 text-[10px]">Registry & Records Information System</p>
      </footer>
    </div>
  );
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

