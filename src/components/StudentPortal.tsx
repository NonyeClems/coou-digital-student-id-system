import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthContext';
import { Student } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { toPng } from 'html-to-image';
import {
  Download,
  Share2,
  Printer,
  Smartphone,
  WifiOff,
  RefreshCcw,
  CheckCircle2,
  AlertCircle,
  CloudUpload,
  UserPlus,
  LogOut,
  Trash2
} from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  removeStudent,
  subscribeToStudentByEmail,
  subscribeToStudentByRegNo,
} from '../lib/students';
import { ResponsiveIdCard } from './IdCard';
import { StudentRegistrationForm } from './StudentRegistrationForm';

export function StudentPortal() {
  const cardCaptureRef = useRef<HTMLDivElement>(null);
  const { user, profile, logout, linkStudentRecord } = useAuth();
  const online = useOnlineStatus();
  const [student, setStudent] = useState<Student | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [pendingSync, setPendingSync] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [justEnrolled, setJustEnrolled] = useState<'synced' | 'queued' | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // The registration number is the primary lookup: when the profile is linked
  // to a record we subscribe to that document directly; otherwise we fall
  // back to the account email and link the profile as soon as a record is
  // found. Live snapshots serve the persistent cache when offline, so the ID
  // card keeps working with no connection and across restarts.
  useEffect(() => {
    if (!user?.email) return;

    // Firestore's persistent cache replaces the old ad-hoc localStorage copy.
    localStorage.removeItem(`id_card_${user.uid}`);

    // While online, an empty first snapshot may just be the (still empty)
    // local cache answering before the server does — keep the loading state
    // until the server confirms, so an enrolled student never sees a flash of
    // "no record". The timer bounds the wait in case the network stalls.
    const settleTimer = setTimeout(() => setLoading(false), 4000);

    const handleState = (state: { student: Student | null; fromCache: boolean; pendingSync: boolean }) => {
      setStudent(state.student);
      setFromCache(state.fromCache);
      setPendingSync(state.pendingSync);
      if (state.student || !state.fromCache || !navigator.onLine) {
        setLoading(false);
      }
      if (state.student?.docId && profile && profile.studentId !== state.student.docId) {
        void linkStudentRecord(state.student.docId);
      }
    };
    const handleError = (error: Error) => {
      console.error('Error subscribing to student record:', error);
      setLoading(false);
    };

    const unsubscribe = profile?.studentId
      ? subscribeToStudentByRegNo(profile.studentId, handleState, handleError)
      : subscribeToStudentByEmail(user.email, handleState, handleError);
    return () => {
      clearTimeout(settleTimer);
      unsubscribe();
    };
  }, [user?.email, user?.uid, profile?.studentId]);

  const handleDownload = async () => {
    if (!cardCaptureRef.current) return;
    try {
      const dataUrl = await toPng(cardCaptureRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `COOU-ID-${student?.id}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Failed to generate image', error);
      alert('Could not download image. Please try again.');
    }
  };

  const handlePrint = () => window.print();

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'COOU Digital Identity',
          text: `Verify my student identity. Name: ${student?.name}, Dept: ${student?.department}, RegNo: ${student?.id}`,
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Error sharing', error);
        }
      }
    } else {
      alert("Sharing is not supported on this device/browser.");
    }
  };

  const handleDeleteRegistration = async () => {
    if (!user || !student) return;
    if (isConfirmingDelete) {
      try {
        await removeStudent(student.docId || student.id);
        setIsConfirmingDelete(false);
        setIsEnrolling(true);
      } catch (error: any) {
        console.error("Error deleting student registration:", error);
        setIsConfirmingDelete(false);
        alert(`Failed to delete record from database. ${error?.message ? `(${error.message})` : 'Please try again.'}`);
      }
    } else {
      setIsConfirmingDelete(true);
      setTimeout(() => setIsConfirmingDelete(false), 3000);
    }
  };

  if (loading && !student) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="w-12 h-12 border-4 border-university-green border-t-university-yellow rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">Synchronizing Identity record...</p>
      </div>
    );
  }

  if (!student) {
    if (isEnrolling) {
      return (
        <div className="max-w-2xl mx-auto bg-white rounded-3xl p-5 sm:p-8 border border-slate-200 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-5 sm:p-8 hidden sm:block">
            <div className="bg-university-green/5 p-3 rounded-2xl rotate-6">
              <UserPlus className="w-6 h-6 text-university-green" />
            </div>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">Identity Enrollment</h2>
          <p className="text-slate-500 font-medium mt-1 mb-6 sm:mb-8 text-sm sm:text-base">
            Complete your registration to generate your Digital Student ID.
          </p>

          {!online && (
            <div className="mb-6 bg-amber-50 text-amber-700 p-4 rounded-xl text-xs font-bold border border-amber-100 flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              You are offline — your registration will be saved on this device and synchronized automatically.
            </div>
          )}

          <StudentRegistrationForm
            mode="student"
            lockedEmail={user?.email ?? ''}
            defaultName={user?.displayName ?? ''}
            submitLabel="Submit Enrollment"
            onCancel={() => setIsEnrolling(false)}
            onSaved={(record, outcome) => {
              void linkStudentRecord(record.docId!);
              setIsEnrolling(false);
              setJustEnrolled(outcome.synced ? 'synced' : 'queued');
              setTimeout(() => setJustEnrolled(null), 8000);
            }}
          />
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 text-center space-y-6 shadow-xl">
        <div className="w-20 h-20 bg-university-green/5 text-university-green rounded-full flex items-center justify-center mx-auto ring-8 ring-university-green/5">
          <Smartphone className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">No Registry Record</h2>
          <p className="text-slate-500 font-medium">
            Your account is verified, but we couldn't find a linked student registry record.
          </p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-400 font-medium border border-slate-100">
          Register below to receive your Digital Student ID, or contact the Registrar if you believe
          you were already enrolled{!online && ' (you are currently offline)'}.
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setIsEnrolling(true)}
            className="flex items-center justify-center gap-2 w-full py-4 bg-university-green hover:bg-university-green/90 text-white rounded-xl font-black transition-all shadow-lg shadow-emerald-100 uppercase tracking-widest text-xs"
          >
            <UserPlus className="w-4 h-4 text-university-yellow" />
            Start Self-Enrollment
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold transition-all uppercase tracking-widest text-[10px]"
          >
            <RefreshCcw className="w-3 h-3" />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const offlineView = !online || fromCache;

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
      <AnimatePresence>
        {justEnrolled && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={
              justEnrolled === 'synced'
                ? 'bg-emerald-50 text-emerald-700 px-5 py-4 rounded-2xl border border-emerald-100 flex items-center gap-3 font-bold text-sm shadow-sm'
                : 'bg-sky-50 text-sky-700 px-5 py-4 rounded-2xl border border-sky-100 flex items-center gap-3 font-bold text-sm shadow-sm'
            }
          >
            {justEnrolled === 'synced' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <CloudUpload className="w-5 h-5 shrink-0" />
            )}
            {justEnrolled === 'synced'
              ? 'Enrollment submitted successfully! Your Digital Student ID has been generated below.'
              : 'Enrollment saved on this device! Your Digital Student ID is ready below and will sync to the university registry automatically.'}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight">Identity Portal</h2>
          <div className="text-slate-500 flex items-center gap-1.5 font-bold text-xs uppercase tracking-widest mt-1">
            {offlineView ? (
              <WifiOff className="w-3 h-3 text-amber-500" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
            {offlineView ? 'Offline (Local Copy)' : 'Secure Live Connection'}
            {pendingSync && (
              <span className="inline-flex items-center gap-1 text-sky-600 normal-case tracking-normal bg-sky-50 border border-sky-100 rounded-full px-2 py-0.5">
                <CloudUpload className="w-3 h-3" />
                Pending sync
              </span>
            )}
          </div>
        </div>

        {student.status !== 'active' && (
          <div className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 border border-red-100 animate-pulse uppercase tracking-widest self-start">
            <AlertCircle className="w-4 h-4" />
            Registry {student.status === 'suspended' ? 'Suspended' : 'Alumni'}
          </div>
        )}
      </div>

      {/* Digital ID Card (landscape, scales to fit any screen) */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <ResponsiveIdCard student={student} captureRef={cardCaptureRef} />
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
        <button onClick={handleDownload} className="flex flex-col items-center justify-center gap-2 p-4 bg-white hover:bg-slate-50 transition-all border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-700 shadow-sm">
          <Download className="w-5 h-5 text-university-green mb-1" />
          Download
        </button>
        <button onClick={handlePrint} className="flex flex-col items-center justify-center gap-2 p-4 bg-white hover:bg-slate-50 transition-all border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-700 shadow-sm">
          <Printer className="w-5 h-5 text-university-green mb-1" />
          Print
        </button>
        <button onClick={handleShare} className="flex flex-col items-center justify-center gap-2 p-4 bg-white hover:bg-slate-50 transition-all border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-700 shadow-sm">
          <Share2 className="w-5 h-5 text-university-green mb-1" />
          Share
        </button>
        <button onClick={handleDeleteRegistration} className="flex flex-col items-center justify-center gap-2 p-4 bg-white hover:bg-red-50 transition-all border border-slate-200 hover:border-red-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-red-600 shadow-sm group">
          <Trash2 className="w-5 h-5 text-red-500 mb-1 group-hover:scale-110 transition-transform" />
          {isConfirmingDelete ? "Confirm" : "Delete"}
        </button>
        <button onClick={logout} className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center gap-2 p-4 bg-white hover:bg-slate-50 transition-all border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-700 shadow-sm group">
          <LogOut className="w-5 h-5 text-slate-400 mb-1 group-hover:text-slate-700 transition-colors" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
