import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { IdCard, LogOut, QrCode, ShieldCheck, User, Search, LayoutDashboard } from 'lucide-react';
import { UNIVERSITY_NAME } from '../constants';

export function Navbar() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminOrStaff = profile?.role === 'admin' || profile?.role === 'staff';

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white border-b border-university-green/10 sticky top-0 z-40 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="bg-university-green p-1.5 rounded-lg shadow-md rotate-3">
            <IdCard className="w-5 h-5 text-university-yellow" />
          </div>
          <div className="hidden sm:block text-left">
             <span className="text-sm font-black text-university-green uppercase tracking-tight block leading-none">COOU</span>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Registry</span>
          </div>
        </Link>

        <div className="flex items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {isAdminOrStaff ? (
              <>
                <button
                  onClick={() => navigate('/')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                    isActive('/') 
                      ? 'bg-white text-university-green shadow-sm' 
                      : 'text-slate-500 hover:text-university-green'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden md:inline">Dashboard</span>
                </button>
                <button
                  onClick={() => navigate('/')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                    isActive('/') 
                      ? 'text-university-green' 
                      : 'text-slate-500 hover:text-university-green'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span className="hidden md:inline">Search</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate('/')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                  isActive('/') 
                    ? 'bg-white text-university-green shadow-sm' 
                    : 'text-slate-500 hover:text-university-green'
                }`}
              >
                <User className="w-4 h-4" />
                ID Card
              </button>
            )}
            
            <button
              onClick={() => navigate('/scanner')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                isActive('/scanner')
                  ? 'bg-white text-university-green shadow-sm' 
                  : 'text-slate-500 hover:text-university-green'
              }`}
            >
              <QrCode className="w-4 h-4" />
              Verify
            </button>
          </div>

          <div className="h-6 w-[1px] bg-slate-200 mx-1 md:mx-2 hidden sm:block" />

          <div className="flex items-center gap-2 md:gap-3">
            <div className="text-right hidden md:block">
              <p className="text-sm font-bold text-slate-800 leading-none">{profile?.displayName}</p>
              <p className="text-[9px] font-black text-university-green uppercase tracking-tighter mt-1 flex items-center justify-end gap-1">
                {profile?.role === 'admin' ? (
                  <>
                    <ShieldCheck className="w-2.5 h-2.5 text-university-yellow" />
                    ADMINISTRATOR
                  </>
                ) : profile?.role === 'staff' ? (
                  <>
                    <User className="w-2.5 h-2.5 text-blue-500" />
                    UNIVERSITY STAFF
                  </>
                ) : (
                  'REGISTERED STUDENT'
                )}
              </p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-600 transition-colors bg-slate-50 border border-slate-200 rounded-lg shadow-xs"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

