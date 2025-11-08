// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";
import { auth, googleProvider, db } from "@/lib/firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

type ExtraProfile = {
  name?: string;
  phone?: string;
  gender?: string;
  address?: any; // { line1, city, state, postalCode, country, lat, lng }
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  /** Email/password sign up + optional extras (saved to Firestore) */
  signUpWithEmail: (email: string, password: string, extras?: ExtraProfile) => Promise<User>;
  /** Email/password login */
  signInWithEmail: (email: string, password: string) => Promise<User>;
  /** Google popup login; merges optional extras on first login */
  signInWithGoogle: (extras?: ExtraProfile) => Promise<User>;
  /** Sign out */
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- helpers ---
async function saveProfile(uid: string, payload: Record<string, any>) {
  await setDoc(
    doc(db, "users", uid),
    {
      ...payload,
      updatedAt: serverTimestamp(),
      // keep createdAt if document exists; otherwise set it
      createdAt: payload?.createdAt ?? serverTimestamp(),
    },
    { merge: true }
  );
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to Firebase auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signUpWithEmail = async (email: string, password: string, extras?: ExtraProfile) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // Set displayName if provided
    if (extras?.name) {
      await updateProfile(cred.user, { displayName: extras.name });
    }

    // Write Firestore profile (new doc)
    await saveProfile(cred.user.uid, {
      uid: cred.user.uid,
      email,
      name: extras?.name ?? cred.user.displayName ?? "",
      phone: extras?.phone ?? "",
      gender: extras?.gender ?? "",
      address: extras?.address ?? null,
      provider: "password",
      emailVerified: cred.user.emailVerified ?? false,
      photoURL: cred.user.photoURL ?? null,
      createdAt: serverTimestamp(),
    });

    setUser(cred.user);
    return cred.user;
  };

  const signInWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    setUser(cred.user);
    return cred.user;
  };

  const signInWithGoogle = async (extras?: ExtraProfile) => {
    const cred = await signInWithPopup(auth, googleProvider);
    const u = cred.user;

    // If user doc doesn't exist, create it; otherwise merge any extras
    const ref = doc(db, "users", u.uid);
    const snap = await getDoc(ref);

    const base = {
      uid: u.uid,
      email: u.email ?? "",
      name: u.displayName ?? extras?.name ?? "",
      phone: extras?.phone ?? "",
      gender: extras?.gender ?? "",
      address: extras?.address ?? null,
      provider: "google",
      emailVerified: u.emailVerified ?? false,
      photoURL: u.photoURL ?? null,
    };

    await saveProfile(u.uid, snap.exists() ? { ...base } : { ...base, createdAt: serverTimestamp() });

    setUser(u);
    return u;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      logout,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};

/** Simple route guard example */
export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null; // or a spinner
  if (!user) {
    // you can also <Navigate to="/login" replace />
    window.location.href = "/login";
    return null;
  }
  return <>{children}</>;
};
