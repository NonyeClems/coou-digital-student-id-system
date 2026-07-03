import React, { useEffect, useState } from 'react';
import { Student } from '../types';
import { generateStudentId, cn, calculateLevel, compressImage } from '../lib/utils';
import { DEPARTMENTS } from '../constants';
import { useAuth } from '../AuthContext';
import { 
  Search, 
  UserPlus, 
  Edit2, 
  Trash2, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Camera,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

export function AdminDashboard() {
  const { logout } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    registrationNumber: '',
    department: DEPARTMENTS[0],
    admissionYear: 2025,
    level: calculateLevel(2025),
    passportURL: '',
    status: 'active' as Student['status'],
    phone: '',
    gender: 'Male',
    dob: '',
    bloodGroup: 'O+',
    religion: 'Christianity'
  });

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const q = query(collection(db, 'students'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const fetchedStudents: Student[] = [];
        querySnapshot.forEach((doc) => {
          fetchedStudents.push({ ...doc.data() as Student, docId: doc.id });
        });
        setStudents(fetchedStudents);
      } catch (error) {
        console.error("Error fetching students:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let currentStudents = [...students];
      const studentId = formData.registrationNumber;

      if (editingStudent) {
        const docId = editingStudent.docId || studentId;
        const updatedData: Student = {
          ...editingStudent,
          ...formData,
          id: studentId,
          level: calculateLevel(formData.admissionYear),
          updatedAt: Date.now()
        };

        await setDoc(doc(db, 'students', docId), updatedData);

        const index = currentStudents.findIndex(s => s.docId === docId);
        if (index !== -1) {
          currentStudents[index] = updatedData;
        }
      } else {
        const docId = studentId;
        const newStudent: Student = {
          ...formData,
          level: calculateLevel(formData.admissionYear),
          id: studentId,
          docId: docId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await setDoc(doc(db, 'students', docId), newStudent);
        currentStudents.unshift(newStudent);
      }
      
      setStudents(currentStudents);

      setIsModalOpen(false);
      setEditingStudent(null);
      setFormData({
        name: '',
        email: '',
        registrationNumber: '',
        department: DEPARTMENTS[0],
        admissionYear: 2025,
        level: calculateLevel(2025),
        passportURL: '',
        status: 'active',
        phone: '',
        gender: 'Male',
        dob: '',
        bloodGroup: 'O+',
        religion: 'Christianity'
      });
    } catch (error) {
      console.error("Error saving student:", error);
      alert("Failed to save student record to database.");
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (docId: string) => {
    if (deletingId === docId) {
      try {
        await deleteDoc(doc(db, 'students', docId));
        const updatedStudents = students.filter(s => s.docId !== docId);
        setStudents(updatedStudents);
        setDeletingId(null);
      } catch (error) {
        console.error("Error deleting student:", error);
        alert("Failed to delete student from database.");
      }
    } else {
      setDeletingId(docId);
      // Auto-reset confirmation after 3 seconds
      setTimeout(() => setDeletingId(null), 3000);
    }
  };

  const openEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name,
      email: student.email,
      registrationNumber: student.id,
      department: student.department,
      admissionYear: student.admissionYear || 2025,
      level: student.level,
      passportURL: student.passportURL,
      status: student.status,
      phone: student.phone || '',
      gender: student.gender || 'Male',
      dob: student.dob || '',
      bloodGroup: student.bloodGroup || 'O+',
      religion: student.religion || 'Christianity'
    });
    setIsModalOpen(true);
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-university-green uppercase tracking-tight">University Registry</h2>
          <p className="text-slate-500 text-sm font-medium">Manage student identification records and digital ID status.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setEditingStudent(null);
              setFormData({
                name: '',
                email: '',
                registrationNumber: '',
                department: DEPARTMENTS[0],
                admissionYear: 2025,
                level: calculateLevel(2025),
                passportURL: '',
                status: 'active',
                phone: '',
                gender: 'Male',
                dob: '',
                bloodGroup: 'O+',
                religion: 'Christianity'
              });
              setIsModalOpen(true);
            }}
            className="bg-university-green hover:bg-university-green/90 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-100"
          >
            <UserPlus className="w-5 h-5 text-university-yellow" />
            Enroll New Student
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
              placeholder="Search by name, ID or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-university-green focus:border-transparent outline-none transition-all text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-400 text-[10px] font-black border-b border-slate-100 uppercase tracking-widest">
                <th className="px-6 py-4">Student Identity</th>
                <th className="px-6 py-4">Identity Number</th>
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
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => openEdit(student)}
                          className="p-2 text-slate-400 hover:text-university-green hover:bg-slate-50 transition-all rounded-lg"
                          title="Edit Record"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(student.docId)}
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl relative overflow-hidden border-t-8 border-university-green"
            >
              <div className="p-8 border-b border-slate-100 relative">
                 <div className="absolute top-0 right-0 p-8">
                    <div className="bg-university-green/5 p-3 rounded-2xl rotate-6">
                       <UserPlus className="w-6 h-6 text-university-green" />
                    </div>
                 </div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                  {editingStudent ? 'Update Registry Record' : 'New Enrollment'}
                </h3>
                <p className="text-slate-500 text-sm font-medium mt-1">
                  {editingStudent ? 'Modify the existing information for this student.' : 'Enter details below to generate a new digital identification number.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Student Name</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="Enter Full Legal Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Mailbox</label>
                    <input
                      required
                      type="email"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      placeholder="student@coou.edu.ng"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Faculty/Department</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800"
                      value={formData.department}
                      onChange={e => setFormData({...formData, department: e.target.value})}
                    >
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admission Year</label>
                    <input
                      type="number"
                      required
                      min="1990"
                      max="2030"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800"
                      value={formData.admissionYear || ''}
                      onChange={e => {
                        const year = parseInt(e.target.value) || 0;
                        setFormData({
                          ...formData, 
                          admissionYear: year,
                          level: calculateLevel(year)
                        })
                      }}
                    />
                    <p className="text-[9px] font-bold text-university-green uppercase tracking-wider mt-1 ml-1 opacity-80">
                      Calculated Level: {formData.level}
                    </p>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registration Number *</label>
                     <input
                        type="text" required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800 uppercase"
                        placeholder="Enter Registration Number"
                        value={formData.registrationNumber}
                        onChange={e => setFormData({...formData, registrationNumber: e.target.value.toUpperCase()})}
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone Number</label>
                     <input type="tel"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800"
                        placeholder="e.g. 08012345678"
                        value={formData.phone} 
                        onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date of Birth</label>
                     <input type="date"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800"
                        value={formData.dob} 
                        onChange={e => setFormData({...formData, dob: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gender</label>
                     <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800"
                        value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                     </select>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Blood Group</label>
                     <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800"
                        value={formData.bloodGroup} onChange={e => setFormData({...formData, bloodGroup: e.target.value})}>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                     </select>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Religion</label>
                     <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800"
                        value={formData.religion} onChange={e => setFormData({...formData, religion: e.target.value})}>
                        <option value="Christianity">Christianity</option>
                        <option value="Islam">Islam</option>
                        <option value="Other">Other</option>
                     </select>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verified Passport Photograph</label>
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                       <label className="flex-1 cursor-pointer group">
                         <div className="px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl hover:border-university-green hover:bg-university-green/5 transition-all text-center flex items-center justify-center gap-2">
                            {isUploading ? (
                               <div className="w-4 h-4 border-2 border-university-green border-t-transparent rounded-full animate-spin" />
                            ) : (
                               <Camera className="w-4 h-4 text-slate-400 group-hover:text-university-green" />
                            )}
                            <span className="text-xs font-bold text-slate-500 group-hover:text-university-green">
                              {isUploading ? "Processing Image..." : formData.passportURL ? "Change Initialized Photograph" : "Upload Image Files (Auto-compressed)"}
                            </span>
                         </div>
                         <input
                           type="file"
                           accept="image/*"
                           className="hidden"
                           onChange={async (e) => {
                             const file = e.target.files?.[0];
                             if (!file) return;
                             setIsUploading(true);
                             try {
                               const base64 = await compressImage(file);
                               setFormData({...formData, passportURL: base64});
                             } catch(err) {
                               alert("Failed to process image");
                             } finally {
                               setIsUploading(false);
                             }
                           }}
                         />
                       </label>
                      <div className="w-16 h-16 rounded-xl border-2 border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                        {formData.passportURL ? (
                          <img src={formData.passportURL} className="w-full h-full object-cover" />
                        ) : (
                          <UserPlus className="w-6 h-6 text-slate-300" />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registry Status</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800"
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value as any})}
                    >
                      <option value="active">Active/Enrolled</option>
                      <option value="suspended">Suspended/Withdrawn</option>
                      <option value="graduated">Alumni/Graduated</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 flex flex-col md:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-8 py-4 rounded-xl border border-slate-200 font-bold text-slate-500 hover:bg-slate-50 transition-all uppercase text-xs tracking-widest"
                  >
                    Discard Changes
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-8 py-4 rounded-xl bg-university-green text-white font-bold hover:bg-university-green/90 transition-all shadow-lg shadow-emerald-100 uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                  >
                    <span>{editingStudent ? 'Apply Updates' : 'Generate Student Number'}</span>
                    <CheckCircle2 className="w-4 h-4 text-university-yellow" />
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
