import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Student } from './types';
import { motion } from 'motion/react';
import { 
  CheckCircle2, 
  XCircle, 
  Building, 
  Calendar, 
  Smartphone, 
  ArrowLeft,
  ShieldCheck,
  MapPin
} from 'lucide-react';
import { UNIVERSITY_NAME } from './constants';
import { db } from './lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';

export function VerificationPortal() {
  const { studentId } = useParams<{ studentId: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;

    const performLookup = async () => {
      try {
        const docRef = doc(db, 'students', studentId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setStudent({ ...docSnap.data() as Student, docId: docSnap.id });
        } else {
          // Fallback query by ID / Matric number field
          const q = query(collection(db, 'students'), where('id', '==', studentId), limit(1));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const studentDoc = querySnapshot.docs[0];
            setStudent({ ...studentDoc.data() as Student, docId: studentDoc.id });
          } else {
            setStudent(null);
          }
        }
      } catch (error) {
        console.error("Verification lookup error:", error);
        setStudent(null);
      } finally {
        setLoading(false);
      }
    };

    // Keep the 1.5s delay for a premium registry loading simulation feel!
    const timer = setTimeout(() => {
      performLookup();
    }, 1500);

    return () => clearTimeout(timer);
  }, [studentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-12 h-12 border-4 border-university-green border-t-transparent rounded-full mb-6"
        />
        <p className="text-slate-500 font-black text-xs uppercase tracking-widest animate-pulse">
          Querying Secure Registry...
        </p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-10 rounded-3xl shadow-xl max-w-lg w-full border-t-4 border-red-500 space-y-6"
        >
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 leading-tight">Verification Failed</h2>
            <p className="text-slate-500 text-sm">
              The student record associated with this identifier could not be located in the COOU Central Registry.
            </p>
          </div>
          <Link 
            to="/"
            className="inline-flex items-center gap-2 text-university-green font-black text-sm uppercase tracking-widest hover:gap-3 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Portal
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/50 flex flex-col items-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200"
      >
        {/* Verification Header */}
        <div className="bg-university-green p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,242,0,0.1),transparent)]" />
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30"
          >
            <ShieldCheck className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-white text-xl font-black uppercase tracking-[0.2em] mb-1">Authentic Record</h1>
          <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest">COOU Verification Services System</p>
        </div>

        {/* Record Content */}
        <div className="p-10 space-y-10">
          {/* Identity Header */}
          <div className="flex flex-col md:flex-row items-center gap-8 border-b border-slate-100 pb-10">
            <div className="relative">
              <div className="p-1 bg-white rounded-3xl shadow-xl ring-2 ring-slate-100">
                <img 
                  src={student.passportURL} 
                  alt={student.name} 
                  className="w-32 h-32 md:w-40 md:h-40 object-cover rounded-2xl"
                />
              </div>
              <div className="absolute -bottom-3 -right-3 bg-emerald-500 p-2 rounded-full border-4 border-white text-white shadow-lg">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            
            <div className="text-center md:text-left flex-1 space-y-3">
              <div>
                <p className="text-[10px] font-black text-university-green uppercase tracking-widest mb-1">Registry Name</p>
                <h2 className="text-3xl font-black text-slate-900 leading-tight">{student.name}</h2>
              </div>
              <div className="inline-flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID NO.</p>
                <p className="text-sm font-mono font-black text-slate-700">{student.id}</p>
              </div>
            </div>
          </div>

          {/* Academic Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <DetailItem 
                icon={<Building className="w-5 h-5" />} 
                label="Primary Department" 
                value={student.department} 
              />
              <DetailItem 
                icon={<Calendar className="w-5 h-5" />} 
                label="Academic Level" 
                value={student.level} 
              />
              <DetailItem 
                icon={<div className="font-black text-xs">O+</div>} 
                label="Emergency Group" 
                value={student.bloodGroup || 'Not Specified'} 
              />
            </div>
            <div className="space-y-6">
              <DetailItem 
                icon={<div className="font-black text-[10px]">DOB</div>} 
                label="Date of Birth" 
                value={student.dob ? new Date(student.dob).toLocaleDateString() : 'Not Specified'} 
              />
              <DetailItem 
                icon={<Smartphone className="w-5 h-5" />} 
                label="Registered Contact" 
                value={student.phone || 'Not Specified'} 
              />
              <DetailItem 
                icon={<MapPin className="w-5 h-5" />} 
                label="Campus Location" 
                value="COOU Main Campus" 
              />
            </div>
          </div>

          {/* Footer Warning */}
          <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex gap-4">
            <ShieldCheck className="w-6 h-6 text-amber-500 shrink-0" />
            <div className="space-y-1">
              <p className="text-[11px] font-black text-amber-800 uppercase tracking-wider">Registry Disclaimer</p>
              <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                This identity record is cryptographically linked to the Chukwuemeka Odumegwu Ojukwu University database. 
                Any tampering with these details is legally punishable under the University Records Act.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <Link 
        to="/"
        className="mt-12 text-[10px] font-black text-slate-400 hover:text-university-green uppercase tracking-[0.3em] transition-colors"
      >
        Verified by {UNIVERSITY_NAME} Registry
      </Link>
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-university-green/5 flex items-center justify-center text-university-green shrink-0 border border-university-green/10 shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-sm font-black text-slate-700 uppercase tracking-tight">{value}</p>
      </div>
    </div>
  );
}
