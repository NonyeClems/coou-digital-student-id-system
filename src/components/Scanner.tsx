import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Student } from '../types';
import { X, CheckCircle2, AlertTriangle, ShieldCheck, User, Building, Calendar, IdCard, Smartphone, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';

interface ScannerProps {
  onClose: () => void;
}

export function Scanner({ onClose }: ScannerProps) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<Student | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    const onScanSuccess = async (decodedText: string) => {
      // Handle both raw IDs and full verification URLs
      let studentDocId = decodedText;
      if (decodedText.includes('/verify/')) {
        const parts = decodedText.split('/verify/');
        studentDocId = parts[parts.length - 1];
      }

      try {
        scanner.clear();
        setVerifying(true);
        setError(null);
        
        // Simulate network delay for verification feel
        await new Promise(r => setTimeout(r, 800));

        const docRef = doc(db, 'students', studentDocId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setResult({ ...docSnap.data() as Student, docId: docSnap.id });
        } else {
          // Fallback query by ID / Matric number field
          const q = query(collection(db, 'students'), where('id', '==', studentDocId), limit(1));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const studentDoc = querySnapshot.docs[0];
            setResult({ ...studentDoc.data() as Student, docId: studentDoc.id });
          } else {
            setError("Invalid QR Code. Student record not found in registry.");
          }
        }
      } catch (err) {
        console.error("Verification error:", err);
        setError("Error connecting to verification server.");
      } finally {
        setVerifying(false);
      }
    };

    scanner.render(onScanSuccess, (err) => {
      // Optional: Handle scan failures (too many, noisy etc)
    });

    return () => {
      scanner.clear().catch(e => console.error(e));
    };
  }, []);

  const resetScanner = () => {
    setResult(null);
    setError(null);
    window.location.reload(); // Simplest way to re-init scanner after clear
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-university-green p-2 rounded-xl shadow-lg shadow-emerald-100">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">Identity Gate</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Biometric Verification</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {verifying ? (
          <motion.div 
            key="verifying"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-12 space-y-4"
          >
            <div className="w-12 h-12 border-4 border-university-green border-t-university-yellow rounded-full animate-spin" />
            <p className="font-black text-university-green uppercase tracking-[0.2em] text-[10px]">Accessing COOU Database...</p>
          </motion.div>
        ) : error ? (
          <motion.div 
            key="error"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="p-8 text-center bg-red-50 border border-red-100 rounded-3xl space-y-4"
          >
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
               <AlertTriangle className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-red-900 uppercase tracking-tighter">Validation Failed</h3>
              <p className="text-red-600 text-xs font-bold uppercase tracking-widest">{error}</p>
            </div>
            <button 
              onClick={resetScanner}
              className="bg-white px-8 py-3 rounded-xl text-xs font-black text-red-600 border border-red-200 hover:bg-red-100 transition-colors uppercase tracking-widest"
            >
              Retry Scan
            </button>
          </motion.div>
        ) : result ? (
          <motion.div 
            key="result"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className={cn(
              "p-5 rounded-3xl flex items-center gap-4 border-2 transition-all",
              result.status === 'active' ? "bg-emerald-50 border-emerald-100 text-emerald-900" : "bg-amber-50 border-amber-100 text-amber-900 shadow-inner"
            )}>
              <div className={cn(
                "p-3 rounded-2xl shrink-0",
                result.status === 'active' ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
              )}>
                {result.status === 'active' ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <div className="flex-1">
                <p className="text-[10px] uppercase font-black tracking-[0.2em] leading-none mb-1.5 opacity-60">Registry Status</p>
                <div className="flex items-center justify-between">
                   <p className="text-xl font-black uppercase tracking-tight">{result.status} STUDENT</p>
                   {result.status === 'active' && <span className="text-[10px] bg-white text-emerald-600 px-3 py-1 rounded-full font-black shadow-sm border border-emerald-100">AUTHENTICATED</span>}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 border-2 border-slate-100 shadow-xl flex flex-col items-center gap-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-2 bg-university-green" />
              <div className="relative">
                <img 
                  src={result.passportURL} 
                  className="w-40 h-48 rounded-2xl object-cover ring-8 ring-slate-50 shadow-2xl"
                />
                <div className="absolute -bottom-3 -right-3 bg-university-yellow p-2 rounded-xl shadow-lg border-2 border-white">
                   <IdCard className="w-5 h-5 text-university-green" />
                </div>
              </div>
              
              <div className="text-center space-y-1">
                <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">{result.name}</h3>
                <p className="text-sm font-black font-mono text-university-green bg-university-green/5 px-4 py-1.5 rounded-full inline-block mt-2">MATRIC: {result.id}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full pt-8 border-t border-slate-100">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Building className="w-3 h-3 text-university-green" /> Faculty
                  </p>
                  <p className="text-xs font-black text-slate-700 uppercase">{result.department}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-university-green" /> Academic
                  </p>
                  <p className="text-xs font-black text-slate-700 uppercase">{result.level}</p>
                </div>
              </div>
            </div>

            <button 
              onClick={resetScanner}
              className="w-full bg-university-green hover:bg-university-green/90 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-emerald-100 uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-2"
            >
              Verify Next record
              <RefreshCcw className="w-4 h-4 text-university-yellow" />
            </button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <div className="relative group">
               <div id="reader" className="overflow-hidden rounded-[2.5rem] border-4 border-dashed border-university-green/20 p-2 bg-slate-50 transition-all group-hover:border-university-green/40"></div>
               <div className="absolute inset-0 pointer-events-none border-[20px] border-transparent rounded-[2.5rem]">
                  <div className="w-full h-full border-2 border-university-green/10 rounded-[1.5rem]" />
               </div>
            </div>
            <div className="flex items-center gap-4 p-5 bg-university-green text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-50">
               <div className="bg-white/20 p-2 rounded-lg">
                  <Smartphone className="w-5 h-5 text-university-yellow" />
               </div>
               Position the COOU Digital ID QR code within the scanner frame to authenticate student record.
            </div>
          </div>
        ) }
      </AnimatePresence>
    </div>
  );
}
