import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserProfile, UserRole, Household } from '../types';
import { BOOTSTRAP_ADMIN_EMAIL, getHouseholdByCustomerCode, saveUserProfile, saveHousehold, removeUndefined } from '../services/dbService';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  linkedHousehold: Household | null;
  role: UserRole;
  isSuperAdmin: boolean;
  isPermanentSuperAdmin: boolean;
  isOtherAdmin: boolean;
  isAdmin: boolean;
  isAreaStaff: boolean;
  isBillingStaff: boolean;
  isStaff: boolean;
  isCustomer: boolean;
  canAccessAdminFeatures: boolean;
  canManageSettings: boolean;
  assignedWards: string[];
  assignedToles: string[];
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, displayName: string, customerCode?: string) => Promise<void>;
  sendPasswordRecovery: (email: string) => Promise<void>;
  linkCustomerHousehold: (customerCode: string, verifiedPhone?: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  linkedHousehold: null,
  role: 'CUSTOMER',
  isSuperAdmin: false,
  isPermanentSuperAdmin: false,
  isOtherAdmin: false,
  isAdmin: false,
  isAreaStaff: false,
  isBillingStaff: false,
  isStaff: false,
  isCustomer: true,
  canAccessAdminFeatures: false,
  canManageSettings: false,
  assignedWards: [],
  assignedToles: [],
  loading: true,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  registerWithEmail: async () => {},
  sendPasswordRecovery: async () => {},
  linkCustomerHousehold: async () => ({ success: false, message: '' }),
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [linkedHousehold, setLinkedHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const isRootSuperAdmin = user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

          // Ensure superadmin doc exists in admins collection
          if (isRootSuperAdmin) {
            try {
              await setDoc(
                doc(db, 'admins', user.uid),
                {
                  email: user.email,
                  role: 'SUPER_ADMIN',
                  addedAt: new Date().toISOString(),
                },
                { merge: true }
              );
            } catch (err) {
              console.warn('Admin doc setup:', err);
            }
          }

          // Fetch user profile from Firestore
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          let profile: UserProfile;
          if (userDocSnap.exists()) {
            profile = userDocSnap.data() as UserProfile;
            if (isRootSuperAdmin && profile.role !== 'SUPER_ADMIN') {
              profile.role = 'SUPER_ADMIN';
              await setDoc(userDocRef, { role: 'SUPER_ADMIN' }, { merge: true });
            }
          } else {
            profile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || user.email?.split('@')[0] || 'Consumer',
              role: isRootSuperAdmin ? 'SUPER_ADMIN' : 'CUSTOMER',
              isActive: true,
              isApproved: isRootSuperAdmin,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, removeUndefined(profile));
          }
          setUserProfile(profile);

          // If linked to household
          if (profile.customerId) {
            const h = await getHouseholdByCustomerCode(profile.customerId);
            setLinkedHousehold(h);
          } else {
            setLinkedHousehold(null);
          }
        } catch (error) {
          console.error('Error in auth state change:', error);
        }
      } else {
        setUserProfile(null);
        setLinkedHousehold(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const sendPasswordRecovery = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const registerWithEmail = async (
    email: string,
    pass: string,
    displayName: string,
    customerCode?: string
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const isRoot = email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

    let linkedCode = '';
    let isApproved = false;

    if (customerCode) {
      const h = await getHouseholdByCustomerCode(customerCode);
      if (h) {
        linkedCode = h.customerCode;
        isApproved = true;
      }
    }

    const profile: UserProfile = {
      uid: cred.user.uid,
      email: cred.user.email || '',
      displayName: displayName || cred.user.email?.split('@')[0] || 'Consumer',
      role: isRoot ? 'SUPER_ADMIN' : 'CUSTOMER',
      customerId: linkedCode || undefined,
      isApproved,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveUserProfile(profile);
    setUserProfile(profile);
  };

  const linkCustomerHousehold = async (
    customerCode: string,
    verifiedPhone?: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) {
      return { success: false, message: 'Must be logged in to link household.' };
    }

    const household = await getHouseholdByCustomerCode(customerCode);
    if (!household) {
      return { success: false, message: 'Household record not found. Please verify your Permanent Customer Code.' };
    }

    // If phone number is supplied, check match; otherwise permit seamless customer code linking
    if (verifiedPhone && verifiedPhone.trim()) {
      const cleanPhone = verifiedPhone.replace(/\D/g, '');
      const cleanHouseholdPhone = (household.phoneNumber || '').replace(/\D/g, '');

      if (cleanPhone && cleanHouseholdPhone && !cleanHouseholdPhone.includes(cleanPhone.slice(-6))) {
        return {
          success: false,
          message: 'Mobile number does not match committee records for this household. Please contact the water committee office for manual verification.',
        };
      }
    }

    // Update household with userId and email securely
    const updatedHousehold: Household = {
      ...household,
      userId: currentUser.uid,
      email: currentUser.email || household.email || '',
    };
    await saveHousehold(updatedHousehold);

    // Update user profile
    const updatedProfile: UserProfile = {
      ...(userProfile || {
        uid: currentUser.uid,
        email: currentUser.email || '',
        displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Consumer',
        role: 'CUSTOMER',
      }),
      customerId: household.customerCode,
      householdNumber: household.householdNumber,
      isApproved: true,
      phoneNumber: verifiedPhone,
    };
    await saveUserProfile(updatedProfile);

    setUserProfile(updatedProfile);
    setLinkedHousehold(updatedHousehold);

    return {
      success: true,
      message: `Successfully linked to household ${household.customerCode} (${household.ownerName})!`,
    };
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    setUserProfile(null);
    setLinkedHousehold(null);
  };

  const isPermanentSuperAdmin = Boolean(currentUser?.email && currentUser.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase());
  const isAccountActive = isPermanentSuperAdmin || (userProfile?.isActive !== false);

  const rawRole = userProfile?.role || 'CUSTOMER';
  // Super Admin is STRICTLY the authorized email hayutarkhanepani@gmail.com
  const isSuperAdmin = isPermanentSuperAdmin && isAccountActive;
  // Other Admin: assigned ADMIN role by Super Admin, but not the permanent super admin email
  const isOtherAdmin = !isPermanentSuperAdmin && (rawRole === 'ADMIN' || (rawRole as string) === 'admin') && isAccountActive;
  const isAdmin = isSuperAdmin || isOtherAdmin;
  const isBillingStaff = (isAdmin || rawRole === 'BILLING_STAFF' || (rawRole as string) === 'staff') && isAccountActive;
  const isAreaStaff = (isAdmin || rawRole === 'AREA_STAFF') && isAccountActive;
  const isStaff = isAccountActive && (isAdmin || isBillingStaff || isAreaStaff);
  const isCustomer = !isStaff;

  // Admin Features (Staff Management, Audit Logs, Security Testing) & Admin Settings strictly restricted to Permanent Super Admin
  const canAccessAdminFeatures = isPermanentSuperAdmin;
  const canManageSettings = isPermanentSuperAdmin;

  const assignedWards = userProfile?.assignedWards || [];
  const assignedToles = userProfile?.assignedToles || [];

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        linkedHousehold,
        role: rawRole,
        isSuperAdmin,
        isPermanentSuperAdmin,
        isOtherAdmin,
        isAdmin,
        isAreaStaff,
        isBillingStaff,
        isStaff,
        isCustomer,
        canAccessAdminFeatures,
        canManageSettings,
        assignedWards,
        assignedToles,
        loading,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        sendPasswordRecovery,
        linkCustomerHousehold,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
