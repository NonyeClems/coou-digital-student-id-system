import React, { createContext, useContext, useEffect, useState } from 'react';
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
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INITIAL_ADMINS = ['nonyeasuzu3@gmail.com'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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

      if (profileDoc.exists()) {
        setProfile(profileDoc.data() as UserProfile);
      } else {
        const role: UserRole = INITIAL_ADMINS.includes(currentUser.email || '') ? 'admin' : 'student';
        const newProfile: UserProfile = {
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || 'Anonymous User',
          photoURL: currentUser.photoURL || undefined,
          role: role,
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

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signup = async (email: string, password: string, name: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: name });
    
    const role: UserRole = INITIAL_ADMINS.includes(email) ? 'admin' : 'student';
    const newProfile: UserProfile = {
      uid: userCredential.user.uid,
      email: email,
      displayName: name,
      photoURL: undefined,
      role: role,
    };
    
    await setDoc(doc(db, 'profiles', userCredential.user.uid), newProfile);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, signup, logout, resetPassword }}>
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
