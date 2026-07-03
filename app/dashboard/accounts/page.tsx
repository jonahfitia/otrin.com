'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { Account, Transaction } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Wallet, Building2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

const COLORS = ['#10b981','#3b82f6','#f97316','#8b5cf6','#f59e0b','#ec4899','#14b8a6','#6366f1'];
const ACCOUNT_TYPES = [
  { value: 'bank', label: 'Banque', icon: Building2 },
  { value: 'mobile', label: 'Mobile Money', icon: Smartphone },
  { value: 'cash', label: 'Espèces', icon: Wallet },
];

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  type: z.enum(['bank', 'mobile', 'cash']),
  color: z.string(),
  initial_balance: z.coerce.number().default(0),
});
type FormData = z.infer<typeof schema>;

export default function AccountsPage() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountTxs, setAccountTxs] = useState<Transaction[]>([]);
  const [accountHistory, setAccountHistory] = useState<{ date: string; balance: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'bank', color: COLORS[0], initial_balance: 0 },
  });

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('accounts').select('*').eq('user_id', user!.id).order('name');
    setAccounts(data || []);
    if (data?.length && !selectedAccount) setSelectedAccount(data[0]);
    setLoading(false);
  }

  useEffect(() => {
    if (selectedAccount) loadAccountDetails(selectedAccount.id);
  }, [selectedAccount]);

  async function loadAccountDetails(accountId: string) {
    const { data } = await supabase
      .from('transactions')
      .select('*, category:categories(name, color)')
      .eq('user_id', user!.id)
      .eq('account_id', accountId)
      .order('date', { ascending: false })
      .limit(20);
    setAccountTxs(data || []);

    let running = 0;
    const history = [...(data || [])].reverse().map(tx => {
      running += tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount);
      return { date: tx.date.substring(5), balance: running };
    });
    setAccountHistory(history);
  }

  const onSubmit = async (data: FormData) => {
    try {
      const { initial_balance, ...rest } = data;
      if (editing) {
        await supabase.from('accounts').update({ ...rest }).eq('id', editing.id);
        toast.success('Compte modifié');
      } else {
        await supabase.from('accounts').insert({ ...rest, balance: initial_balance });
        toast.success('Compte ajouté');
      }
      await load();
      setDialogOpen(false);
      setEditing(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  async function handleDelete(id: string) {
    await supabase.from('accounts').delete().eq('id', id);
    if (selectedAccount?.id === id) setSelectedAccount(null);
    await load();
    setDeleteId(null);
    toast.success('Compte supprimé');
  }

  function openNew() {
    setEditing(null);
    setSelectedColor(COLORS[0]);
    reset({ type: 'bank', color: COLORS[0], initial_balance: 0 });
    setDialogOpen(true);
  }

  function openEdit(acc: Account) {
    setEditing(acc);
    setSelectedColor(acc.color);
    reset({ name: acc.name, type: acc.type as any, color: acc.color, initial_balance: 0 });
    setDialogOpen(true);
  }

  if (loading) return <div className="flex items-center justify-center min-h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comptes</h1>
          <p className="text-muted-foreground text-sm mt-1">{accounts.length} compte{accounts.length > 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nouveau compte</Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Account list */}
        <div className="space-y-3">
          {accounts.map(acc => {
            const TypeIcon = ACCOUNT_TYPES.find(t => t.value === acc.type)?.icon || Wallet;
            return (
              <div
                key={acc.id}
                onClick={() => setSelectedAccount(acc)}
                className={cn(
                  'bg-card border rounded-xl p-4 cursor-pointer hover:shadow-sm transition-all',
                  selectedAccount?.id === acc.id ? 'border-primary shadow-sm' : 'border-border'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: acc.color + '20' }}>
                      <TypeIcon className="w-5 h-5" style={{ color: acc.color }} />
                    </div>
                    <div>
                      <p className="font-medium">{acc.name}</p>
                      <p className="text-xs text-muted-foreground">{ACCOUNT_TYPES.find(t => t.value === acc.type)?.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(acc); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteId(acc.id); }} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">Solde actuel</p>
                  <p className={cn('text-lg font-bold', acc.balance >= 0 ? 'text-foreground' : 'text-destructive')}>
                    {formatCurrency(acc.balance, currency)}
                  </p>
                </div>
              </div>
            );
          })}
          {accounts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Aucun compte. Créez-en un pour commencer.
            </div>
          )}
        </div>

        {/* Account detail */}
        {selectedAccount && (
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Évolution — {selectedAccount.name}</h3>
              {accountHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={accountHistory}>
                    <defs>
                      <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={selectedAccount.color} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={selectedAccount.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [formatCurrency(v, currency), 'Solde']} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                    <Area type="monotone" dataKey="balance" stroke={selectedAccount.color} strokeWidth={2} fill="url(#accGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">Aucune transaction sur ce compte</div>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold">Historique récent</h3>
              </div>
              <div className="divide-y divide-border">
                {accountTxs.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">Aucune transaction</div>
                ) : (
                  accountTxs.map(tx => (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: (tx.category as any)?.color + '20', color: (tx.category as any)?.color }}>
                        {tx.label.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.label}</p>
                        <p className="text-xs text-muted-foreground">{(tx.category as any)?.name || '—'} · {formatDate(tx.date)}</p>
                      </div>
                      <p className={cn('text-sm font-semibold', tx.type === 'income' ? 'text-blue-500' : 'text-red-500')}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, currency)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le compte' : 'Nouveau compte'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nom du compte</Label>
              <Input placeholder="Ex: BOA, Mvola..." {...register('name')} />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={watch('type')} onValueChange={(v) => setValue('type', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!editing && (
              <div className="space-y-1.5">
                <Label>Solde initial</Label>
                <Input type="number" step="any" min="0" placeholder="0" {...register('initial_balance')} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Couleur</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => { setSelectedColor(c); setValue('color', c); }}
                    className={cn('w-7 h-7 rounded-full transition-transform', selectedColor === c && 'ring-2 ring-offset-2 ring-foreground scale-110')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Annuler</Button>
              <Button type="submit" className="flex-1">{editing ? 'Enregistrer' : 'Ajouter'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le compte ?</AlertDialogTitle>
            <AlertDialogDescription>Les transactions liées ne seront pas supprimées mais perdront leur compte associé.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
