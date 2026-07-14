import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { settingsRepo } from '@/lib/repository';
import { Settings as SettingsType } from '@/types';

interface SettingsContextValue {
  settings: SettingsType | null;
  currency: string;
  currencyName: string;
  theme: string;
  loading: boolean;
  updateSettings: (patch: Partial<SettingsType>) => Promise<void>;
  refresh: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: null,
  currency: 'Ar',
  currencyName: 'Ariary',
  theme: 'system',
  loading: true,
  updateSettings: async () => {},
  refresh: async () => {},
});

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const items = await settingsRepo(user.uid).getAll();
    setSettings(items[0] || null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateSettings = useCallback(
    async (patch: Partial<SettingsType>) => {
      if (!user || !settings) return;
      const updated = await settingsRepo(user.uid).update(settings.id, {
        ...patch,
        updated_at: new Date().toISOString(),
      });
      if (updated) setSettings(updated);
    },
    [user, settings],
  );

  return (
    <SettingsContext.Provider
      value={{
        settings,
        currency: settings?.currency || 'Ar',
        currencyName: settings?.currency_name || 'Ariary',
        theme: settings?.theme || 'system',
        loading,
        updateSettings,
        refresh,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
