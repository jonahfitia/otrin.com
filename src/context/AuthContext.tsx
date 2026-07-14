import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { settingsRepo, categoriesRepo, accountsRepo } from '@/lib/repository';
import { pullAllData, flushSyncQueue } from '@/lib/sync';
import { DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES } from '@/types';
import { clearAllData } from '@/lib/storage';

interface AuthContextValue {
  user: FirebaseUser | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

async function seedUserData(userId: string) {
  const settings = await settingsRepo(userId).getAll();
  if (settings.length === 0) {
    await settingsRepo(userId).create({
      currency: 'Ar',
      currency_name: 'Ariary',
      theme: 'system',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);
  }

  const accounts = await accountsRepo(userId).getAll();
  if (accounts.length === 0) {
    await accountsRepo(userId).create({
      name: 'Espèces',
      type: 'cash',
      color: '#10b981',
      icon: 'wallet',
      balance: 0,
      is_default: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);
  }

  const categories = await categoriesRepo(userId).getAll();
  if (categories.length === 0) {
    for (const c of DEFAULT_INCOME_CATEGORIES) {
      await categoriesRepo(userId).create({
        ...c,
        type: 'income',
        is_default: true,
        created_at: new Date().toISOString(),
      } as any);
    }
    for (const c of DEFAULT_EXPENSE_CATEGORIES) {
      await categoriesRepo(userId).create({
        ...c,
        type: 'expense',
        is_default: true,
        created_at: new Date().toISOString(),
      } as any);
    }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      setLoading(false);
      if (fbUser) {
        await seedUserData(fbUser.uid);
        try {
          await pullAllData(fbUser.uid);
        } catch {
          // offline — local data is still available
        }
      }
    });
    return unsub;
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    await seedUserData(cred.user.uid);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signOut = useCallback(async () => {
    if (user) {
      try {
        await flushSyncQueue(user.uid);
      } catch {
        // ignore
      }
    }
    await fbSignOut(auth);
    await clearAllData();
    setUser(null);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
