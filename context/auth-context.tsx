'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

async function seedUserData(userId: string) {
  const { data: existing } = await supabase
    .from('settings')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) return;

  await supabase.from('settings').insert({ user_id: userId });

  const { data: account } = await supabase
    .from('accounts')
    .insert({ name: 'Espèces', type: 'cash', color: '#10b981', icon: 'wallet', balance: 0, is_default: true })
    .select()
    .maybeSingle();

  const incomeCategories = DEFAULT_INCOME_CATEGORIES.map((c) => ({
    ...c,
    type: 'income' as const,
    is_default: true,
  }));
  const expenseCategories = DEFAULT_EXPENSE_CATEGORIES.map((c) => ({
    ...c,
    type: 'expense' as const,
    is_default: true,
  }));

  await supabase.from('categories').insert([...incomeCategories, ...expenseCategories]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        seedUserData(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === 'SIGNED_IN' && session?.user) {
        (async () => {
          await seedUserData(session.user.id);
        })();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
