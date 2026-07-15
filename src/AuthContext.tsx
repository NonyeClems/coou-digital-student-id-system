import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { UserProfile, UserRole } from './types';
import { auth, db } from './lib/firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { findStudentByRegNo } from './lib/students';
import { resolveLoginEmail } from './lib/login';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  /** Signs in with either an email address or a registration number. */
  login: (identifier: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Persists the registration number on the user's profile so the ID card is looked up by it. */
  linkStudentRecord: (studentDocId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Emails granted the 'admin' role on signup/login. Must stay in sync with
// isAdminEmail() in firestore.rules, which is what actually enforces that
// only these accounts can hold an elevated role.
// admin@coou.edu.ng is the local-development administrator seeded into the
// Firebase emulators by `npm run seed:admin` (password: Admin123!).
const INITIAL_ADMINS = ['nonyeasuzu3@gmail.com', 'admin@coou.edu.ng'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // While signup() is actively creating the account, onAuthStateChanged fires
  // with a stale firebaseUser snapshot (displayName not yet propagated from
  // updateProfile()). Skip loadProfile's own profile-creation during that
  // window so it can't race signup()'s authoritative write and clobber the
  // real name with the "Anonymous User" fallback.
  const signingUpRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const u: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        };
        setUser(u);
        if (signingUpRef.current) {
          return;
        }
        await loadProfile(u);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loadProfile = async (currentUser: User) => {
    try {
      const profileRef = doc(db, 'profiles', currentUser.uid);
      const profileDoc = await getDoc(profileRef);
      const isAdminEmail = INITIAL_ADMINS.includes(currentUser.email || '');

      if (profileDoc.exists()) {
        const existingProfile = profileDoc.data() as UserProfile;
        // Self-heal: if this email is on the admin allow-list but the stored
        // profile predates that (or was created before promotion), upgrade it.
        if (isAdminEmail && existingProfile.role !== 'admin') {
          const promotedProfile: UserProfile = { ...existingProfile, role: 'admin' };
          await setDoc(profileRef, promotedProfile);
          setProfile(promotedProfile);
        } else {
          setProfile(existingProfile);
        }
      } else {
        const role: UserRole = isAdminEmail ? 'admin' : 'student';
        const newProfile: UserProfile = {
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || 'Anonymous User',
          role: role,
          // Firestore rejects `undefined` field values, so only include
          // photoURL when one actually exists rather than setting it to undefined.
          ...(currentUser.photoURL ? { photoURL: currentUser.photoURL } : {}),
        };
        await setDoc(profileRef, newProfile);
        setProfile(newProfile);
      }
    } catch (error) {
      console.error("Error loading profile from Firestore:", error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (identifier: string, password: string) => {
    const email = await resolveLoginEmail(identifier, findStudentByRegNo);
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signup = async (email: string, password: string, name: string) => {
    signingUpRef.current = true;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });

      const role: UserRole = INITIAL_ADMINS.includes(email) ? 'admin' : 'student';
      const newProfile: UserProfile = {
        uid: userCredential.user.uid,
        email: email,
        displayName: name,
        role: role,
      };

      await setDoc(doc(db, 'profiles', userCredential.user.uid), newProfile);
      setProfile(newProfile);
      setUser({ uid: userCredential.user.uid, email, displayName: name, photoURL: null });
    } finally {
      signingUpRef.current = false;
      setLoading(false);
    }
  };

  const linkStudentRecord = async (studentDocId: string) => {
    if (!user) return;
    const current = profile;
    if (!current || current.studentId === studentDocId) return;
    const updated: UserProfile = { ...current, studentId: studentDocId };
    setProfile(updated);
    try {
      await setDoc(doc(db, 'profiles', user.uid), updated);
    } catch (error) {
      // Offline writes are queued by the persistent cache; anything else is
      // non-fatal (the portal falls back to the email lookup).
      console.error('Failed to link student record to profile:', error);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, signup, logout, resetPassword, linkStudentRecord }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
