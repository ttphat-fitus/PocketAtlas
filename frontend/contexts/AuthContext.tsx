"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, isConfigured } from "../lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (email: string, password: string, displayName?: string) => Promise<User>;
  signInAnon: () => Promise<User>;
  signInWithGoogle: () => Promise<User>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      // Create or update user document in Firestore
      if (firebaseUser) {
        try {
          const userRef = doc(db, "users", firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              isAnonymous: firebaseUser.isAnonymous,
              createdAt: serverTimestamp(),
              lastLoginAt: serverTimestamp(),
            });
          } else {
            // Update last login
            await setDoc(userRef, {
              lastLoginAt: serverTimestamp(),
            }, { merge: true });
          }
        } catch (error) {
          console.error("Error updating user document:", error);
        }
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isConfigured) {
      throw new Error("Firebase is not configured. Please check your .env.local file.");
    }
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    if (!isConfigured) {
      throw new Error("Firebase is not configured. Please check your .env.local file.");
    }
    const result = await createUserWithEmailAndPassword(auth, email, password);
    
    if (displayName && result.user) {
      await updateProfile(result.user, { displayName });
    }
    
    return result.user;
  };

  const signInAnon = async () => {
    if (!isConfigured) {
      throw new Error("Firebase is not configured. Please check your .env.local file.");
    }
    const result = await signInAnonymously(auth);
    return result.user;
  };

  const signInWithGoogle = async () => {
    if (!isConfigured) {
      throw new Error("Firebase is not configured. Please check your .env.local file.");
    }
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  };

  const signOut = async () => {
    if (!isConfigured) {
      throw new Error("Firebase is not configured. Please check your .env.local file.");
    }
    await firebaseSignOut(auth);
  };

  const getIdToken = async () => {
    if (!isConfigured || !user) return null;
    return await user.getIdToken();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signInAnon,
        signInWithGoogle,
        signOut,
        getIdToken,
        isConfigured: isConfigured || false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
