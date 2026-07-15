import { useEffect, useState } from 'react';
import { Student } from '../types';
import { cn, toDocId } from '../lib/utils';
import { useAuth } from '../AuthContext';
import {
  Search,
  UserPlus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  CloudUpload,
  WifiOff,
  LogOut,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  removeStudent,
  subscribeToAllStudents,
  StudentListItem,
} from '../lib/students';
import { StudentRegistrationForm } from './StudentRegistrationForm';

export function AdminDashboard() {
  const { logout } = useAuth();
  const online = useOnlineStatus();
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: 'synced' | 'queued'; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Live registry subscription: serves the persistent cache when offline and
  // flags records whose local changes are still waiting to reach the server.
  useEffect(() => {
    // Don't declare "no records" from an empty first cache snapshot while the
    // server is still being consulted (see the same pattern in StudentPortal).
    const settleTimer = setTimeout(() => setLoading(false), 4000);
    const unsubscribe = subscribeToAllStudents(
      (state) => {
        setStudents(state.students);
        setFromCache(state.fromCache);
        if (state.students.length > 0 || !state.fromCache || !navigator.onLine) {
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error subscribing to students:', error);
        setLoading(false);
      }
    );
    return () => {
      clearTimeout(settleTimer);
      unsubscribe();
    };
  }, []);

  const showNotice = (kind: 'synced' | 'queued', text: string) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(null), 6000);
  };

  const handleDelete = async (docId: string) => {
    if (deletingId === docId) {
      try {
        const outcome = await removeStudent(docId);
        setDeletingId(null);
        if (!outcome.synced) {
          showNotice('queued', 'Record deleted on this device — the deletion will sync automatically.');
        }
      } catch (error: any) {
        console.error("Error deleting student:", error);
        setDeletingId(null);
        alert(`Failed to delete student from database. ${error?.message ? `(${error.message})` : 'Please try again.'}`);
      }
    } else {
      setDeletingId(docId);
      // Auto-reset confirmation after 4 seconds
      setTimeout(() => setDeletingId(current => current === docId ? null : current), 4000);
    }
  };

  const openCreate = () => {
    setEditingStudent(null);
    setIsModalOpen(true);
  };

  const openEdit = (student: Student) => {
    setEditingStudent(student);
    setIsModalOpen(true);
  };

  const term = searchTerm.toLowerCase();
  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(term) ||
    s.id.toLowerCase().includes(term) ||
    s.email.toLowerCase().includes(term)
  );

  const statusBadge = (student: StudentListItem) => (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-[10px] uppercase font-black px-2.5 py-1 rounded-full border shadow-xs",
      student.status === 'active' ? "text-emerald-700 bg-emerald-50 border-emerald-100" :
      student.status === 'suspended' ? "text-amber-700 bg-amber-50 border-amber-100" :
      "text-slate-500 bg-slate-50 border-slate-100"
    )}>
      {student.status === 'active' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
       student.status === 'suspended' ? <AlertCircle className="w-3.5 h-3.5" /> :
       <XCircle className="w-3.5 h-3.5" />}
      {student.status}
    </span>
  );

  const pendingBadge = (student: StudentListItem) =>
    student.pendingSync ? (
      <span className="inline-flex items-center gap-1 text-[9px] uppercase font-black px-2 py-0.5 rounded-full border text-sky-700 bg-sky-50 border-sky-100">
        <CloudUpload className="w-3 h-3" />
        Sync pending
      </span>
    ) : null;

  const rowActions = (student: StudentListItem) => (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={() => openEdit(student)}
        className="p-2 text-slate-400 hover:text-university-green hover:bg-slate-50 transition-all rounded-lg"
        title="Edit Record"
      >
        <Edit2 className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleDelete(student.docId || toDocId(student.id))}
        className={cn(
          "p-2 transition-all rounded-lg",
          deletingId === student.docId
            ? "text-white bg-red-500 hover:bg-red-600 font-bold px-3 text-xs"
            : "text-slate-400 hover:text-red-500 hover:bg-red-50"
        )}
        title="Delete Record"
      >
        {deletingId === student.docId ? 'Confirm' : <Trash2 className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              'px-5 py-4 rounded-2xl border flex items-center gap-3 font-bold text-sm shadow-sm',
              notice.kind === 'synced'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : 'bg-sky-50 text-sky-700 border-sky-100'
            )}
          >
            {notice.kind === 'synced'
              ? <CheckCircle2 className="w-5 h-5 shrink-0" />
              : <CloudUpload className="w-5 h-5 shrink-0" />}
            {notice.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-university-green uppercase tracking-tight">University Registry</h2>
          <p className="text-slate-500 text-sm font-medium">Manage student identification records and digital ID status.</p>
          {(!online || fromCache) && (
            <p className="text-amber-600 text-[10px] font-black uppercase tracking-widest mt-1 flex items-center gap-1.5">
              <WifiOff className="w-3 h-3" />
              Offline — showing locally saved registry
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={openCreate}
            className="bg-university-green hover:bg-university-green/90 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-100"
          >
            <UserPlus className="w-5 h-5 text-university-yellow" />
            Register New Student
          </button>

          <button
            onClick={logout}
            className="bg-red-50 hover:bg-red-100 text-red-600 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/30">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, registration number or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-university-green focus:border-transparent outline-none transition-all text-sm"
            />
          </div>
        </div>

        {/* Mobile: card list */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            <p className="px-6 py-12 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">Accessing Database...</p>
          ) : filteredStudents.length === 0 ? (
            <p className="px-6 py-12 text-center text-slate-400 font-medium italic">No student records found.</p>
          ) : (
            filteredStudents.map((student) => (
              <div key={student.docId} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <img
                    src={student.passportURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&q=80"}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover ring-2 ring-white shadow-sm shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 leading-tight truncate">{student.name}</p>
                    <p className="text-xs font-medium text-slate-400 truncate">{student.email}</p>
                    <p className="font-mono text-xs font-black text-university-green mt-1">{student.id}</p>
                  </div>
                  {rowActions(student)}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-bold text-slate-600">{student.department}</span>
                  <span className="text-slate-300">·</span>
                  <span className="uppercase font-black text-slate-400 text-[10px]">{student.level}</span>
                  {statusBadge(student)}
                  {pendingBadge(student)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-400 text-[10px] font-black border-b border-slate-100 uppercase tracking-widest">
                <th className="px-6 py-4">Student Identity</th>
                <th className="px-6 py-4">Registration Number</th>
                <th className="px-6 py-4">Department & Level</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">Accessing Database...</td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium italic">No student records found.</td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.docId} className="hover:bg-university-green/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={student.passportURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&q=80"}
                          alt=""
                          className="w-12 h-12 rounded-xl object-cover ring-2 ring-white shadow-sm"
                        />
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-university-green transition-colors leading-none">{student.name}</p>
                          <p className="text-xs font-medium text-slate-400 mt-1">{student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-black text-university-green bg-university-green/10 px-3 py-1 rounded-lg border border-university-green/5">
                        {student.id}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div className="font-bold text-slate-700">{student.department}</div>
                      <div className="text-[10px] uppercase font-black text-slate-400 mt-0.5">{student.level}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1">
                        {statusBadge(student)}
                        {pendingBadge(student)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {rowActions(student)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registration / edit modal — the same workflow students use */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-university-green/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl relative overflow-hidden border-t-8 border-university-green max-h-[92dvh] flex flex-col"
            >
              <div className="p-5 sm:p-8 border-b border-slate-100 relative shrink-0">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight pr-10">
                  {editingStudent ? 'Update Registry Record' : 'Register New Student'}
                </h3>
                <p className="text-slate-500 text-sm font-medium mt-1">
                  {editingStudent
                    ? 'Modify the existing information for this student.'
                    : 'The same registration workflow students use — identical fields and validation.'}
                </p>
              </div>

              <div className="p-5 sm:p-8 overflow-y-auto">
                <StudentRegistrationForm
                  mode="admin"
                  initial={editingStudent}
                  onCancel={() => setIsModalOpen(false)}
                  onSaved={(record, outcome) => {
                    setIsModalOpen(false);
                    setEditingStudent(null);
                    showNotice(
                      outcome.synced ? 'synced' : 'queued',
                      outcome.synced
                        ? `${record.name} (${record.id}) has been saved to the registry.`
                        : `${record.name} (${record.id}) was saved on this device and will sync to the registry automatically.`
                    );
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
