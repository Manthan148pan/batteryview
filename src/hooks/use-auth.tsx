'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInAnonymously,
  ConfirmationResult,
} from 'firebase/auth';
import { auth, db, ref, get, set, update, push } from '@/lib/firebase';
import type { SubscriptionInfo } from '@/types/bms';

interface UserProfile {
  fullName: string;
  companyName: string;
  mobileNumber: string;
  designation: string;
  role: 'main_user' | 'sub_user';
  main_user_uid?: string;
  custom_id?: string;
  subscription?: SubscriptionInfo;
  referralSource?: string;
  permissions?: {
    canRegisterBms: boolean;
    canAddGateway: boolean;
    canViewHistory: boolean;
  };
  active_device?: string;
  active_gateway?: string;
  last_connect_time?: number;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<any>;
  signup: (email: string, password: string, profile: Omit<UserProfile, 'email' | 'main_user_uid' | 'custom_id' | 'permissions' | 'subscription'>) => Promise<any>;
  sendVerificationEmail: () => Promise<void>;
  logout: () => Promise<void>;
  loginWithAdmin: (email: string, password: string) => Promise<void>;
  updateUserProfile: (profile: Partial<UserProfile>) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  loginWithPhone: (phoneNumber: string, reCaptchaId: string) => Promise<void>;
  verifyOTP: (otp: string) => Promise<any>;
  loginAnonymously: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const adminUser = {
  uid: 'admin-user',
  email: 'admin1EB@gmail.com',
  displayName: 'Admin',
  emailVerified: true,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isDemoUser, setIsDemoUser] = useState(false);

  useEffect(() => {
    if (!auth || !db) return;
    const isAdminLoggedIn = sessionStorage.getItem('isAdminLoggedIn') === 'true';
    if (isAdminLoggedIn) {
      setUser(adminUser as User);
      setUserProfile({
        fullName: 'Admin',
        companyName: 'Energy View',
        mobileNumber: 'N/A',
        designation: 'Administrator',
        role: 'main_user',
        custom_id: 'admin'
      });
      setIsAdmin(true);
      setLoading(false);
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (sessionStorage.getItem('isAdminLoggedIn') !== 'true') {
        setUser(firebaseUser);
        if (firebaseUser) {
          if (!db) return;
          const profileRef = ref(db, `users/${firebaseUser.uid}`);
          const snapshot = await get(profileRef);
          if (snapshot.exists()) {
            setUserProfile(snapshot.val());
          } else {
            // Check if it's a guest or phone user without a profile
            if (firebaseUser.isAnonymous) {
              const guestProfile: UserProfile = {
                fullName: 'Guest Rider',
                companyName: 'Anonymous',
                mobileNumber: 'N/A',
                designation: 'Rider',
                role: 'sub_user',
                permissions: {
                  canRegisterBms: false,
                  canAddGateway: false,
                  canViewHistory: true
                }
              };
              setUserProfile(guestProfile);
            } else if (firebaseUser.phoneNumber) {
              const newProfile: UserProfile = {
                fullName: 'Rider',
                companyName: 'Individual',
                mobileNumber: firebaseUser.phoneNumber,
                designation: 'Rider',
                role: 'sub_user',
                permissions: {
                  canRegisterBms: false,
                  canAddGateway: false,
                  canViewHistory: true
                }
              };
              await set(profileRef, newProfile);
              setUserProfile(newProfile);
            } else {
              setUserProfile(null);
            }
          }
        } else {
          setUserProfile(null);
        }
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    if (!auth || !db) throw new Error("Firebase not initialized");
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    if (user) {
      const sessionsRef = ref(db, `users/${user.uid}/sessions`);
      const newSessionRef = push(sessionsRef);
      await set(newSessionRef, {
        loginTime: new Date().toISOString(),
        userAgent: navigator.userAgent
      });
    }
    return userCredential;
  };

  const signup = async (email: string, password: string, profile: any) => {
    if (!auth || !db) throw new Error("Firebase not initialized");
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    const userCount = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
    const customId = `batteryview${String(userCount + 1).padStart(2, '0')}`;

    const profileRef = ref(db, `users/${user.uid}`);
    const newProfile = {
      email: user.email,
      custom_id: customId,
      subscription: {
        status: 'trialing',
        current_period_end: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 day trial
        plan_type: 'per_battery',
        price_per_unit: 50, // Default base price is ₹50
        currency: 'INR'
      },
      ...profile
    }
    await set(profileRef, newProfile);
    setUserProfile(newProfile as UserProfile);
    return userCredential;
  };

  const sendVerificationEmail = () => {
    if (auth?.currentUser) return sendEmailVerification(auth.currentUser);
    return Promise.reject(new Error('No user is currently signed in.'));
  };

  const loginWithAdmin = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail === 'admin1eb@gmail.com' && password === 'ADmin@2025') {
      if (!db) throw new Error("Firebase not initialized");
      sessionStorage.setItem('isAdminLoggedIn', 'true');
      setUser(adminUser as User);
      setIsAdmin(true);
      setUserProfile({
        fullName: 'Admin',
        companyName: 'Energy View',
        mobileNumber: 'N/A',
        designation: 'Administrator',
        role: 'main_user',
        custom_id: 'admin'
      });
    } else {
      throw new Error('Invalid admin credentials.');
    }
  };

  const logout = async () => {
    const wasAdmin = sessionStorage.getItem('isAdminLoggedIn') === 'true';
    if (wasAdmin) sessionStorage.removeItem('isAdminLoggedIn');
    else if (auth) await signOut(auth);
    setUser(null);
    setIsAdmin(false);
    setUserProfile(null);
    setIsDemoUser(false);
  };

  const updateUserProfile = async (newProfile: Partial<UserProfile>) => {
    if (user && !isAdmin && db) {
      const profileRef = ref(db, `users/${user.uid}`);
      await update(profileRef, newProfile);
      const updatedProfile = { ...(userProfile as UserProfile), ...newProfile };
      setUserProfile(updatedProfile);
    }
  };

  const sendPasswordReset = async (email: string) => {
    if (!auth) throw new Error("Firebase not initialized");
    return sendPasswordResetEmail(auth, email);
  };
  
  const loginWithPhone = async (phoneNumber: string, reCaptchaId: string) => {
    if (!auth) throw new Error("Firebase not initialized");
    
    // DEMO BYPASS (Clean spaces first)
    const cleanNumber = phoneNumber.replace(/\s/g, '');
    if (cleanNumber === '+910000000000') {
      setIsDemoUser(true);
      sessionStorage.setItem('demoPhoneNumber', cleanNumber);
      return;
    }

    // Try to clear existing recaptcha to prevent "already rendered" issues
    if ((window as any).recaptchaVerifier) {
      try {
        (window as any).recaptchaVerifier.clear();
      } catch (e) {}
    }

    const appVerifier = new RecaptchaVerifier(auth, reCaptchaId, {
      'size': 'invisible'
    });
    (window as any).recaptchaVerifier = appVerifier;

    try {
      const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(result);
    } catch (error: any) {
      if (error.code === 'auth/billing-not-enabled' || (error.message && error.message.includes('billing-not-enabled'))) {
        console.warn('Firebase Billing not enabled. Activating Demo Bypass for phone:', phoneNumber);
        setIsDemoUser(true);
        sessionStorage.setItem('demoPhoneNumber', phoneNumber);
        return; // Proceed as if OTP was sent successfully
      }
      throw error;
    }
  };

  const verifyOTP = async (otp: string) => {
    // DEMO BYPASS
    if (isDemoUser && otp === '123456') {
      const demoPhoneNumber = sessionStorage.getItem('demoPhoneNumber') || '+910000000000';
      const demoProfile: UserProfile = {
        fullName: 'Demo Rider',
        companyName: 'Individual',
        mobileNumber: demoPhoneNumber,
        designation: 'Rider',
        role: 'sub_user',
        permissions: {
          canRegisterBms: false,
          canAddGateway: false,
          canViewHistory: true
        }
      };
      
      // Override auth state locally for demo purposes
      setUser({ uid: 'demo_rider_uid', phoneNumber: demoPhoneNumber } as any);
      setUserProfile(demoProfile);
      
      // Store flag in session storage so it survives refresh if needed
      sessionStorage.setItem('isDemoUser', 'true');
      return;
    }

    if (!confirmationResult && !isDemoUser) throw new Error("No confirmation result found");
    if (confirmationResult) {
      const userCredential = await confirmationResult.confirm(otp);
      return userCredential;
    }
  };

  const loginAnonymously = async () => {
    if (!auth) throw new Error("Firebase not initialized");
    await signInAnonymously(auth);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userProfile, 
      isAuthenticated: !!user, 
      loading, 
      isAdmin, 
      login, 
      signup, 
      sendVerificationEmail, 
      logout, 
      loginWithAdmin, 
      updateUserProfile, 
      sendPasswordReset,
      loginWithPhone,
      verifyOTP,
      loginAnonymously
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
