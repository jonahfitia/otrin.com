'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { CURRENCIES } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Settings, Sun, Moon, Monitor, Trash2, LogOut, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { settings, currency, updateSettings } = useSettings();
  const { theme, setTheme } = useTheme();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleCurrencyChange(value: string) {
    const curr = CURRENCIES.find(c => c.code === value);
    if (!curr) return;
    await updateSettings({ currency: curr.code, currency_name: curr.name });
    toast.success('Devise mise à jour');
  }

  async function handleExportData() {
    if (!user) return;
    try {
      const [txRes, accRes, catRes, budRes, goalRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', user.id),
        supabase.from('accounts').select('*').eq('user_id', user.id),
        supabase.from('categories').select('*').eq('user_id', user.id),
        supabase.from('budgets').select('*').eq('user_id', user.id),
        supabase.from('goals').select('*').eq('user_id', user.id),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        user_email: user.email,
        transactions: txRes.data || [],
        accounts: accRes.data || [],
        categories: catRes.data || [],
        budgets: budRes.data || [],
        goals: goalRes.data || [],
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `volako_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Données exportées avec succès');
    } catch (err) {
      toast.error('Erreur lors de l\'export');
    }
  }

  async function handleDeleteAccount() {
    if (!user) return;
    setDeleting(true);
    try {
      await supabase.from('transactions').delete().eq('user_id', user.id);
      await supabase.from('accounts').delete().eq('user_id', user.id);
      await supabase.from('categories').delete().eq('user_id', user.id);
      await supabase.from('budgets').delete().eq('user_id', user.id);
      await supabase.from('goals').delete().eq('user_id', user.id);
      await supabase.from('goal_contributions').delete().eq('user_id', user.id);
      await supabase.from('recurring_transactions').delete().eq('user_id', user.id);
      await supabase.from('simulations').delete().eq('user_id', user.id);
      await supabase.from('settings').delete().eq('user_id', user.id);
      await signOut();
      toast.success('Toutes vos données ont été supprimées');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  const themeOptions = [
    { value: 'light', label: 'Clair', icon: Sun },
    { value: 'dark', label: 'Sombre', icon: Moon },
    { value: 'system', label: 'Système', icon: Monitor },
  ];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground text-sm mt-1">Configurez votre application</p>
      </div>

      {/* Profile */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold">Profil</h2>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-bold text-2xl">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium">{user?.email?.split('@')[0]}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Button variant="outline" onClick={signOut} className="gap-2">
          <LogOut className="w-4 h-4" /> Se déconnecter
        </Button>
      </div>

      {/* Appearance */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold">Apparence</h2>
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map(opt => {
            const Icon = opt.icon;
            const isActive = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                  isActive ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/30'
                )}
              >
                <Icon className={cn('w-5 h-5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <span className={cn('text-sm font-medium', isActive ? 'text-primary' : 'text-muted-foreground')}>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Currency */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold">Devise</h2>
        <div className="space-y-1.5">
          <Label>Devise par défaut</Label>
          <Select value={currency} onValueChange={handleCurrencyChange}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map(c => (
                <SelectItem key={c.code} value={c.code}>
                  {c.symbol} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">La devise choisie sera utilisée partout dans l'application.</p>
        </div>
      </div>

      {/* Data management */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold">Données</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Exporter mes données</p>
              <p className="text-xs text-muted-foreground">Télécharger toutes vos données en JSON</p>
            </div>
            <Button variant="outline" onClick={handleExportData} className="gap-2 flex-shrink-0">
              <Download className="w-4 h-4" /> Exporter
            </Button>
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-destructive">Supprimer toutes mes données</p>
              <p className="text-xs text-muted-foreground">Cette action est irréversible</p>
            </div>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(true)}
              className="gap-2 flex-shrink-0 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="w-4 h-4" /> Supprimer
            </Button>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-2">
        <h2 className="font-semibold">À propos</h2>
        <p className="text-sm text-muted-foreground">Volako — Application de gestion financière personnelle</p>
        <p className="text-xs text-muted-foreground">Version 1.0.0</p>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer toutes vos données ?</AlertDialogTitle>
            <AlertDialogDescription>
              Toutes vos transactions, comptes, catégories, budgets et objectifs seront définitivement supprimés. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? 'Suppression...' : 'Supprimer définitivement'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
