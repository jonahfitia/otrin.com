'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings } from '@/lib/types';
import { useAuth } from './auth-context';

interface SettingsContextValue {
  settings: Settings | null;
  currency: string;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: null,
  currency: 'Ar',
  updateSettings: async () => {},
  loading: true,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }
    loadSettings();
  }, [user]);

  async function loadSettings() {
    const { data } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();
    setSettings(data);
    setLoading(false);
  }

  async function updateSettings(updates: Partial<Settings>) {
    if (!user) return;
    const { data } = await supabase
      .from('settings')
      .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })
      .select()
      .maybeSingle();
    if (data) setSettings(data);
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        currency: settings?.currency ?? 'Ar',
        updateSettings,
        loading,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
