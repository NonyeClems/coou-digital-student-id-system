import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { Student } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { toPng } from 'html-to-image';
import { 
  Download, 
  Share2, 
  Smartphone, 
  WifiOff, 
  RefreshCcw, 
  CheckCircle2,
  AlertCircle,
  MapPin,
  Calendar,
  Building,
  UserPlus,
  Camera,
  LogOut,
  Trash2
} from 'lucide-react';
import { cn, calculateLevel, compressImage, generateStudentId } from '../lib/utils';
import { DEPARTMENTS } from '../constants';
import { db } from '../lib/firebase';
import { doc, setDoc, getDoc, getDocs, collection, query, where, deleteDoc, limit } from 'firebase/firestore';

export function StudentPortal() {
  const idCardRef = useRef<HTMLDivElement>(null);
  const { user, profile, logout } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmittingEnrollment, setIsSubmittingEnrollment] = useState(false);
  const [enrollError, setEnrollError] = useState('');
  const [justEnrolled, setJustEnrolled] = useState(false);

  const [enrollData, setEnrollData] = useState({
    name: user?.displayName || '',
    department: DEPARTMENTS[0],
    admissionYear: 2025,
    registrationNumber: '',
    passportURL: '',
    phone: '',
    gender: 'Male',
    dob: '',
    bloodGroup: 'O+',
    religion: 'Christianity'
  });

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!user?.email) return;

    const fetchStudent = async () => {
      try {
        const q = query(collection(db, 'students'), where('email', '==', user.email), limit(1));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const studentDoc = querySnapshot.docs[0];
          const studentData = { ...studentDoc.data() as Student, docId: studentDoc.id };
          setStudent(studentData);
          setOfflineMode(false);
          localStorage.setItem(`id_card_${user.uid}`, JSON.stringify(studentData));
        } else {
          // No record in the database (never enrolled, or a previous record was
          // deleted). Clear any stale local cache so the student can freshly
          // re-enroll instead of being stuck looking at an old cached record.
          localStorage.removeItem(`id_card_${user.uid}`);
          setStudent(null);
          setOfflineMode(false);
        }
      } catch (error) {
        console.error("Error fetching student profile:", error);
        // Only fall back to cache here (a real connectivity/permission error),
        // not when the database legitimately returned no record.
        const cached = localStorage.getItem(`id_card_${user.uid}`);
        if (cached) {
          setStudent(JSON.parse(cached));
          setOfflineMode(true);
        } else {
          setStudent(null);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();
  }, [user]);

  const handleDownload = async () => {
    if (!idCardRef.current) return;
    try {
      const dataUrl = await toPng(idCardRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `COOU-ID-${student?.id}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Failed to generate image', error);
      alert('Could not download image. Please try again.');
    }
  };

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
        const docId = student.docId || student.id;
        await deleteDoc(doc(db, 'students', docId));
        localStorage.removeItem(`id_card_${user.uid}`);
        setStudent(null);
        setIsEnrolling(true);
        setIsConfirmingDelete(false);
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

  const handleEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollError('');

    if (!user?.email || !enrollData.name || !enrollData.passportURL || !enrollData.registrationNumber) {
       setEnrollError("Please complete all compulsory fields including Registration Number and upload a verified photograph.");
       return;
    }

    const studentId = enrollData.registrationNumber;
    setIsSubmittingEnrollment(true);
    try {
      const docId = studentId;

      // Prevent silently overwriting another student's record that already
      // uses this registration number.
      const existingDoc = await getDoc(doc(db, 'students', docId));
      if (existingDoc.exists() && (existingDoc.data() as Student).email !== user.email) {
        setEnrollError("This Registration Number is already registered to another account. Please verify and try again.");
        return;
      }

      const newStudent: Student = {
        name: enrollData.name,
        email: user.email,
        phone: enrollData.phone,
        gender: enrollData.gender,
        dob: enrollData.dob,
        bloodGroup: enrollData.bloodGroup,
        religion: enrollData.religion,
        department: enrollData.department,
        admissionYear: enrollData.admissionYear,
        level: calculateLevel(enrollData.admissionYear),
        passportURL: enrollData.passportURL,
        id: studentId,
        docId: docId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'active'
      };

      await setDoc(doc(db, 'students', docId), newStudent);

      localStorage.setItem(`id_card_${user.uid}`, JSON.stringify(newStudent));
      setStudent(newStudent);
      setIsEnrolling(false);
      setJustEnrolled(true);
      setTimeout(() => setJustEnrolled(false), 6000);
    } catch (error) {
      console.error("Error self-enrolling", error);
      setEnrollError("Failed to submit enrollment. Please check your connection and try again, or contact administration.");
    } finally {
      setIsSubmittingEnrollment(false);
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
        <div className="max-w-2xl mx-auto bg-white rounded-3xl p-8 border border-slate-200 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8">
             <div className="bg-university-green/5 p-3 rounded-2xl rotate-6">
                <UserPlus className="w-6 h-6 text-university-green" />
             </div>
          </div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Identity Enrollment</h2>
          <p className="text-slate-500 font-medium mt-1 mb-8">Complete your biometric registration to generate your Digital Student ID.</p>

          {enrollError && (
            <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border border-red-100 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {enrollError}
            </div>
          )}

          <form onSubmit={handleEnrollment} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Legal Name</label>
                <input required type="text" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800"
                  value={enrollData.name} onChange={e => setEnrollData({...enrollData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Faculty/Department</label>
                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800"
                  value={enrollData.department} onChange={e => setEnrollData({...enrollData, department: e.target.value})}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admission Year</label>
                 <input type="number" required min="1990" max="2030"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800"
                    value={enrollData.admissionYear || ''} 
                    onChange={e => setEnrollData({...enrollData, admissionYear: parseInt(e.target.value) || 0})} />
                 <p className="text-[9px] font-bold text-university-green uppercase tracking-wider mt-1 ml-1 opacity-80">
                    Calculated Level: {calculateLevel(enrollData.admissionYear)}
                 </p>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registration Number *</label>
                 <input type="text" required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800 uppercase"
                    placeholder="Enter Registration Number"
                    value={enrollData.registrationNumber} 
                    onChange={e => setEnrollData({...enrollData, registrationNumber: e.target.value.toUpperCase()})} />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone Number</label>
                 <input type="tel"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800"
                    placeholder="e.g. 08012345678"
                    value={enrollData.phone} 
                    onChange={e => setEnrollData({...enrollData, phone: e.target.value})} />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date of Birth</label>
                 <input type="date"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800"
                    value={enrollData.dob} 
                    onChange={e => setEnrollData({...enrollData, dob: e.target.value})} />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gender</label>
                 <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800"
                    value={enrollData.gender} onChange={e => setEnrollData({...enrollData, gender: e.target.value})}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                 </select>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Blood Group</label>
                 <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800"
                    value={enrollData.bloodGroup} onChange={e => setEnrollData({...enrollData, bloodGroup: e.target.value})}>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                 </select>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Religion</label>
                 <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-university-green focus:bg-white transition-all font-bold text-slate-800"
                    value={enrollData.religion} onChange={e => setEnrollData({...enrollData, religion: e.target.value})}>
                    <option value="Christianity">Christianity</option>
                    <option value="Islam">Islam</option>
                    <option value="Other">Other</option>
                 </select>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Official Passport Photograph</label>
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                   <label className="flex-1 cursor-pointer group">
                     <div className="px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl hover:border-university-green hover:bg-university-green/5 transition-all text-center flex items-center justify-center gap-2">
                        {isUploading ? (
                           <div className="w-4 h-4 border-2 border-university-green border-t-transparent rounded-full animate-spin" />
                        ) : (
                           <Camera className="w-4 h-4 text-slate-400 group-hover:text-university-green" />
                        )}
                        <span className="text-xs font-bold text-slate-500 group-hover:text-university-green">
                          {isUploading ? "Processing Image..." : enrollData.passportURL ? "Change Initialized Photograph" : "Upload Image Files (Auto-compressed)"}
                        </span>
                     </div>
                     <input type="file" accept="image/*" className="hidden"
                       onChange={async (e) => {
                         const file = e.target.files?.[0];
                         if (!file) return;
                         setIsUploading(true);
                         try {
                           const base64 = await compressImage(file);
                           setEnrollData({...enrollData, passportURL: base64});
                         } catch(err) {
                           alert("Failed to process image");
                         } finally {
                           setIsUploading(false);
                         }
                       }} />
                   </label>
                   <div className="w-16 h-16 rounded-xl border-2 border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                     {enrollData.passportURL ? (
                       <img src={enrollData.passportURL} className="w-full h-full object-cover" />
                     ) : (
                       <UserPlus className="w-6 h-6 text-slate-300" />
                     )}
                   </div>
                </div>
              </div>
            </div>
            <div className="pt-6 flex gap-3">
              <button type="button" onClick={() => { setIsEnrolling(false); setEnrollError(''); }}
                disabled={isSubmittingEnrollment}
                className="flex-1 px-8 py-4 rounded-xl border border-slate-200 font-bold text-slate-500 hover:bg-slate-50 transition-all uppercase text-xs tracking-widest disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={isSubmittingEnrollment}
                className="flex-1 px-8 py-4 rounded-xl bg-university-green text-white font-bold hover:bg-university-green/90 transition-all shadow-lg shadow-emerald-100 uppercase text-xs tracking-widest flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                {isSubmittingEnrollment && (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                )}
                {isSubmittingEnrollment ? "Submitting..." : "Submit Enrollment"}
              </button>
            </div>
          </form>
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-6 shadow-xl">
        <div className="w-20 h-20 bg-university-green/5 text-university-green rounded-full flex items-center justify-center mx-auto ring-8 ring-university-green/5">
          <Smartphone className="w-10 h-10" />
        </div>
        <div className="space-y-2">
           <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Access Restricted</h2>
           <p className="text-slate-500 font-medium">
             Your account is verified, but we couldn't find a linked student registry record. 
           </p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-400 font-medium border border-slate-100">
           Contact the University Digital Services or Registrar to enroll your biometric data and secure your Digital Student ID.
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

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <AnimatePresence>
        {justEnrolled && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-emerald-50 text-emerald-700 px-5 py-4 rounded-2xl border border-emerald-100 flex items-center gap-3 font-bold text-sm shadow-sm"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            Enrollment submitted successfully! Your Digital Student ID has been generated below.
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Identity Portal</h2>
          <div className="text-slate-500 flex items-center gap-1.5 font-bold text-xs uppercase tracking-widest mt-1">
            {offlineMode ? <WifiOff className="w-3 h-3 text-amber-500" /> : <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
            {offlineMode ? "Offline (Accessing Local Cache)" : "Secure Live Connection"}
          </div>
        </div>
        
        {student.status !== 'active' && (
          <div className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 border border-red-100 animate-pulse uppercase tracking-widest">
            <AlertCircle className="w-4 h-4" />
            Registry Suspended
          </div>
        )}
      </div>

      {/* Digital ID Card */}
      <motion.div 
        ref={idCardRef}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={cn(
          "relative bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border-2 transition-all duration-500",
          student.status === 'active' ? "border-university-green/20 ring-1 ring-university-green/5" : "border-slate-200 opacity-75 grayscale"
        )}
      >
        {/* Header background design */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-university-green overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-university-yellow/10 rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-20 w-32 h-32 bg-white/5 rounded-full translate-y-1/2" />
        </div>

        <div className="relative pt-12 px-8 pb-10 flex flex-col md:flex-row gap-10">
          {/* Portrait and Side Info */}
          <div className="flex flex-col items-center gap-6 md:w-56">
            <div className="relative">
              <div className="p-1 px-1 pb-1.5 bg-white rounded-3xl shadow-2xl ring-4 ring-white">
                <img 
                  src={student.passportURL} 
                  alt={student.name} 
                  className="w-48 h-56 object-cover rounded-[1.25rem]"
                />
              </div>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-university-yellow px-5 py-2 rounded-full shadow-lg border-2 border-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-university-green" />
                <span className="text-[10px] uppercase font-black text-university-green tracking-[0.15em]">Verified</span>
              </div>
            </div>

            <div className="bg-university-green/5 p-5 rounded-2xl w-full border border-university-green/10 text-center">
                <p className="text-[10px] font-black text-slate-400 font-mono uppercase tracking-[0.2em] mb-1">Registration NO.</p>
                <p className="text-xl font-black text-university-green font-mono tracking-tight">{student.id}</p>
            </div>
          </div>

          {/* Details and QR */}
          <div className="flex-1 flex flex-col justify-between pt-4">
            <div className="space-y-8">
              <div>
                <p className="text-[10px] font-black text-university-yellow uppercase tracking-[0.3em] mb-2 bg-university-green/10 px-3 py-1 rounded-full inline-block">Official Student Name</p>
                <h3 className="text-4xl font-black text-slate-900 leading-[1.1] uppercase tracking-tighter">{student.name}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4">
                <div className="flex items-center gap-4 col-span-1 md:col-span-2">
                  <div className="w-10 h-10 rounded-2xl bg-university-green/10 flex items-center justify-center shrink-0">
                    <Building className="w-5 h-5 text-university-green" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Academic Faculty</p>
                    <p className="text-sm font-black text-slate-700 uppercase tracking-tight">{student.department}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-university-green/10 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-university-green" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Academic Level</p>
                    <p className="text-sm font-black text-slate-700 uppercase tracking-tight">{student.level}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-university-green/10 flex items-center justify-center shrink-0">
                    <div className="w-5 h-5 text-university-green font-black flex items-center justify-center">{student.bloodGroup || 'O+'}</div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Blood Group</p>
                    <p className="text-sm font-black text-slate-700 uppercase tracking-tight">{student.bloodGroup || 'Not Specified'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-university-green/10 flex items-center justify-center shrink-0">
                    <div className="w-5 h-5 text-university-green font-black flex items-center justify-center text-xs">DOB</div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Date of Birth</p>
                    <p className="text-sm font-black text-slate-700 uppercase tracking-tight">{student.dob ? new Date(student.dob).toLocaleDateString() : 'Not Specified'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-university-green/10 flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5 text-university-green" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Contact Line</p>
                    <p className="text-sm font-black text-slate-700 uppercase tracking-tight">{student.phone || 'Not Specified'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 pt-10 border-t border-slate-100 flex items-end justify-between gap-6">
              <div className="space-y-3">
                 <div className="flex items-center gap-2 text-[10px] font-black text-university-green/60 uppercase tracking-widest">
                    <MapPin className="w-3.5 h-3.5" />
                    COOU Main Campus
                 </div>
                 <div className="text-[10px] text-slate-400 font-medium leading-relaxed max-w-[200px]">
                    This digital identity remains valid for the duration of studentship unless otherwise revoked by the Registrar.
                 </div>
              </div>

              <div className="bg-white p-3 border-2 border-university-green/10 rounded-3xl shadow-inner relative group">
                <div className="absolute inset-0 bg-university-yellow/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />
                <QRCodeSVG 
                  value={`${window.location.origin}/verify/${student.docId}`} 
                  size={110} 
                  level="H" 
                  aria-label="Student ID verification QR code"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Security Bar */}
        <div className="h-3 bg-linear-to-r from-university-green via-university-yellow to-university-green border-t border-white/20" />
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button onClick={handleDownload} className="flex flex-col items-center justify-center gap-2 p-4 bg-white hover:bg-slate-50 transition-all border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-700 shadow-sm">
          <Download className="w-5 h-5 text-university-green mb-1" />
          Download
        </button>
        <button onClick={handleShare} className="flex flex-col items-center justify-center gap-2 p-4 bg-white hover:bg-slate-50 transition-all border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-700 shadow-sm">
          <Share2 className="w-5 h-5 text-university-green mb-1" />
          Share
        </button>
        <button onClick={handleDeleteRegistration} className="flex flex-col items-center justify-center gap-2 p-4 bg-white hover:bg-red-50 transition-all border border-slate-200 hover:border-red-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-red-600 shadow-sm group">
          <Trash2 className="w-5 h-5 text-red-500 mb-1 group-hover:scale-110 transition-transform" />
          {isConfirmingDelete ? "Confirm" : "Delete"}
        </button>
        <button onClick={logout} className="flex flex-col items-center justify-center gap-2 p-4 bg-white hover:bg-slate-50 transition-all border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-700 shadow-sm group">
          <LogOut className="w-5 h-5 text-slate-400 mb-1 group-hover:text-slate-700 transition-colors" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
