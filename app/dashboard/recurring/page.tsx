'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { RecurringTransaction, Account, Category } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Quotidien',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  yearly: 'Annuel',
};

const schema = z.object({
  label: z.string().min(1, 'Libellé requis'),
  type: z.enum(['income', 'expense']),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  amount: z.coerce.number().optional(),
  amount_percent: z.coerce.number().min(0).max(100).optional(),
  account_id: z.string().optional(),
  category_id: z.string().optional(),
  day_of_month: z.coerce.number().min(1).max(31).optional(),
  next_date: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function RecurringPage() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'expense', frequency: 'monthly' },
  });

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    setLoading(true);
    await Promise.all([loadItems(), loadAccounts(), loadCategories()]);
    setLoading(false);
  }

  async function loadItems() {
    const { data } = await supabase
      .from('recurring_transactions')
      .select('*, account:accounts(name), category:categories(name, color)')
      .eq('user_id', user!.id)
      .order('label');
    setItems(data || []);
  }

  async function loadAccounts() {
    const { data } = await supabase.from('accounts').select('*').eq('user_id', user!.id);
    setAccounts(data || []);
  }

  async function loadCategories() {
    const { data } = await supabase.from('categories').select('*').eq('user_id', user!.id);
    setCategories(data || []);
  }

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        label: data.label,
        type: data.type,
        frequency: data.frequency,
        amount: data.amount || null,
        amount_percent: data.amount_percent || null,
        account_id: data.account_id || null,
        category_id: data.category_id || null,
        day_of_month: data.day_of_month || null,
        next_date: data.next_date || null,
      };

      if (editing) {
        await supabase.from('recurring_transactions').update(payload).eq('id', editing.id);
        toast.success('Modifié');
      } else {
        await supabase.from('recurring_transactions').insert(payload);
        toast.success('Ajouté');
      }
      await loadItems();
      setDialogOpen(false);
      setEditing(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  async function toggleActive(item: RecurringTransaction) {
    await supabase.from('recurring_transactions').update({ is_active: !item.is_active }).eq('id', item.id);
    await loadItems();
  }

  async function handleDelete(id: string) {
    await supabase.from('recurring_transactions').delete().eq('id', id);
    await loadItems();
    setDeleteId(null);
    toast.success('Supprimé');
  }

  function openNew() {
    setEditing(null);
    reset({ type: 'expense', frequency: 'monthly' });
    setDialogOpen(true);
  }

  function openEdit(item: RecurringTransaction) {
    setEditing(item);
    reset({
      label: item.label,
      type: item.type,
      frequency: item.frequency,
      amount: item.amount || undefined,
      amount_percent: item.amount_percent || undefined,
      account_id: item.account_id || undefined,
      category_id: item.category_id || undefined,
      day_of_month: item.day_of_month || undefined,
      next_date: item.next_date || undefined,
    });
    setDialogOpen(true);
  }

  const filteredCategories = categories.filter(c => c.type === watch('type'));
  const active = items.filter(i => i.is_active);
  const inactive = items.filter(i => !i.is_active);

  if (loading) return <div className="flex items-center justify-center min-h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dépenses récurrentes</h1>
          <p className="text-muted-foreground text-sm mt-1">{active.length} actives</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Ajouter</Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucune opération récurrente configurée.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {active.map(item => (
              <div key={item.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-4 hover:shadow-sm transition-shadow">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: ((item.category as any)?.color || '#10b981') + '20' }}>
                  <RefreshCw className="w-4 h-4" style={{ color: (item.category as any)?.color || '#10b981' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.label}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{FREQUENCY_LABELS[item.frequency]}</span>
                    {(item.category as any) && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: (item.category as any).color + '20', color: (item.category as any).color }}>
                        {(item.category as any).name}
                      </span>
                    )}
                    {(item.account as any) && <span className="text-xs text-muted-foreground">{(item.account as any).name}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {item.amount != null && (
                    <p className={cn('font-semibold', item.type === 'income' ? 'text-blue-500' : 'text-red-500')}>
                      {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount, currency)}
                    </p>
                  )}
                  {item.amount_percent != null && (
                    <p className={cn('font-semibold', item.type === 'income' ? 'text-blue-500' : 'text-red-500')}>
                      {item.type === 'income' ? '+' : '-'}{item.amount_percent}%
                    </p>
                  )}
                  {item.next_date && <p className="text-xs text-muted-foreground mt-0.5">Prochain: {formatDate(item.next_date)}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggleActive(item)} className="p-1.5 rounded hover:bg-muted text-primary">
                    <ToggleRight className="w-5 h-5" />
                  </button>
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteId(item.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {inactive.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Désactivées ({inactive.length})</h3>
              <div className="space-y-2 opacity-60">
                {inactive.map(item => (
                  <div key={item.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-muted-foreground">{item.label}</p>
                      <span className="text-xs text-muted-foreground">{FREQUENCY_LABELS[item.frequency]}</span>
                    </div>
                    {item.amount && <p className="text-muted-foreground font-medium">{formatCurrency(item.amount, currency)}</p>}
                    <button onClick={() => toggleActive(item)} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                      <ToggleLeft className="w-5 h-5" />
                    </button>
                    <button onClick={() => setDeleteId(item.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier' : 'Nouvelle opération récurrente'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Libellé</Label>
                <Input placeholder="Internet, Loyer..." {...register('label')} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={watch('type')} onValueChange={(v) => setValue('type', v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Dépense</SelectItem>
                    <SelectItem value="income">Revenu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Fréquence</Label>
                <Select value={watch('frequency')} onValueChange={(v) => setValue('frequency', v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Montant (optionnel)</Label>
                <Input type="number" step="any" min="0" placeholder="0" {...register('amount')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Pourcentage (optionnel)</Label>
                <Input type="number" step="0.1" min="0" max="100" placeholder="%" {...register('amount_percent')} />
              </div>
              <div className="space-y-1.5">
                <Label>Jour du mois</Label>
                <Input type="number" min="1" max="31" placeholder="1-31" {...register('day_of_month')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Compte</Label>
                <Select value={watch('account_id') || ''} onValueChange={(v) => setValue('account_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <Select value={watch('category_id') || ''} onValueChange={(v) => setValue('category_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Prochaine date</Label>
              <Input type="date" {...register('next_date')} />
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
            <AlertDialogTitle>Supprimer ?</AlertDialogTitle>
            <AlertDialogDescription>Cette opération récurrente sera supprimée définitivement.</AlertDialogDescription>
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
