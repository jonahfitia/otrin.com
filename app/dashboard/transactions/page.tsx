'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { Transaction, Account, Category } from '@/lib/types';
import { formatCurrency, formatDate, toInputDate } from '@/lib/formatters';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Plus, Search, Filter, Edit2, Trash2, X, ChevronUp, ChevronDown, Paperclip,
  SortAsc, SortDesc,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

const schema = z.object({
  date: z.string().min(1, 'Date requise'),
  label: z.string().min(1, 'Motif requis'),
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number().positive('Montant invalide'),
  account_id: z.string().optional(),
  category_id: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type SortField = 'date' | 'label' | 'amount' | 'type';
type SortDir = 'asc' | 'desc';

export default function TransactionsPage() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterAccount, setFilterAccount] = useState('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split('T')[0], type: 'expense' },
  });

  const watchType = watch('type');

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadTransactions(), loadAccounts(), loadCategories()]);
    setLoading(false);
  }

  async function loadTransactions() {
    const { data } = await supabase
      .from('transactions')
      .select('*, account:accounts(id, name, color), category:categories(id, name, icon, color)')
      .eq('user_id', user!.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    setTransactions(data || []);
  }

  async function loadAccounts() {
    const { data } = await supabase.from('accounts').select('*').eq('user_id', user!.id).order('name');
    setAccounts(data || []);
  }

  async function loadCategories() {
    const { data } = await supabase.from('categories').select('*').eq('user_id', user!.id).order('name');
    setCategories(data || []);
  }

  async function recalcBalances() {
    const { data: txs } = await supabase
      .from('transactions')
      .select('id, type, amount, account_id, date, created_at')
      .eq('user_id', user!.id)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true });

    if (!txs?.length) return;

    const byAccount: Record<string, { balance: number; txs: typeof txs }> = {};
    txs.forEach(tx => {
      const aid = tx.account_id || 'none';
      if (!byAccount[aid]) byAccount[aid] = { balance: 0, txs: [] };
      byAccount[aid].txs.push(tx);
    });

    const updates: { id: string; balance_after: number }[] = [];
    Object.values(byAccount).forEach(({ txs }) => {
      let running = 0;
      txs.forEach(tx => {
        running += tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount);
        updates.push({ id: tx.id, balance_after: running });
      });
    });

    for (const u of updates) {
      await supabase.from('transactions').update({ balance_after: u.balance_after }).eq('id', u.id);
    }
  }

  async function updateAccountBalance(accountId: string | null | undefined) {
    if (!accountId) return;
    const { data } = await supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', user!.id)
      .eq('account_id', accountId);

    const balance = (data || []).reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
    await supabase.from('accounts').update({ balance }).eq('id', accountId);
  }

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        date: data.date,
        label: data.label,
        type: data.type,
        amount: data.amount,
        account_id: data.account_id || null,
        category_id: data.category_id || null,
        notes: data.notes || null,
      };

      if (editingTx) {
        const { error } = await supabase.from('transactions').update(payload).eq('id', editingTx.id);
        if (error) throw error;
        if (editingTx.account_id !== (data.account_id || null)) {
          await updateAccountBalance(editingTx.account_id);
        }
        await updateAccountBalance(data.account_id);
        toast.success('Transaction modifiée');
      } else {
        const { error } = await supabase.from('transactions').insert(payload);
        if (error) throw error;
        await updateAccountBalance(data.account_id);
        toast.success('Transaction ajoutée');
      }

      await recalcBalances();
      await loadTransactions();
      setDialogOpen(false);
      setEditingTx(null);
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
  };

  async function handleDelete(id: string) {
    const tx = transactions.find(t => t.id === id);
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    await updateAccountBalance(tx?.account_id);
    await recalcBalances();
    await loadTransactions();
    setDeleteId(null);
    toast.success('Transaction supprimée');
  }

  function openNew() {
    setEditingTx(null);
    reset({ date: new Date().toISOString().split('T')[0], type: 'expense' });
    setDialogOpen(true);
  }

  function openEdit(tx: Transaction) {
    setEditingTx(tx);
    reset({
      date: toInputDate(tx.date),
      label: tx.label,
      type: tx.type,
      amount: tx.amount,
      account_id: tx.account_id || undefined,
      category_id: tx.category_id || undefined,
      notes: tx.notes || undefined,
    });
    setDialogOpen(true);
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <SortAsc className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const filtered = transactions
    .filter(tx => {
      if (search) {
        const q = search.toLowerCase();
        const cat = (tx.category as any)?.name?.toLowerCase() || '';
        const acc = (tx.account as any)?.name?.toLowerCase() || '';
        if (!tx.label.toLowerCase().includes(q) && !cat.includes(q) && !acc.includes(q) && !String(tx.amount).includes(q)) return false;
      }
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (filterCategory !== 'all' && tx.category_id !== filterCategory) return false;
      if (filterAccount !== 'all' && tx.account_id !== filterAccount) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = a.date.localeCompare(b.date);
      if (sortField === 'label') cmp = a.label.localeCompare(b.label);
      if (sortField === 'amount') cmp = a.amount - b.amount;
      if (sortField === 'type') cmp = a.type.localeCompare(b.type);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const filteredCategories = categories.filter(c => c.type === watchType);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground text-sm mt-1">{transactions.length} opérations au total</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Ajouter
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="pl-9 h-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="income">Entrées</SelectItem>
            <SelectItem value="expense">Dépenses</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterAccount} onValueChange={setFilterAccount}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Compte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous comptes</SelectItem>
            {accounts.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('date')}>
                    Date <SortIcon field="date" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('label')}>
                    Motif <SortIcon field="label" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell">Catégorie</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell">Compte</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('type')}>
                    Type <SortIcon field="type" />
                  </button>
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  <button className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors" onClick={() => toggleSort('amount')}>
                    Montant <SortIcon field="amount" />
                  </button>
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell">Solde après</th>
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell">Notes</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-muted-foreground">
                    {search || filterType !== 'all' || filterCategory !== 'all' ? 'Aucun résultat' : 'Aucune transaction. Commencez par en ajouter une !'}
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => (
                  <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{formatDate(tx.date)}</td>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        {tx.attachment_url && <Paperclip className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                        <span className="truncate max-w-36">{tx.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {(tx.category as any) ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium"
                          style={{ backgroundColor: (tx.category as any).color + '20', color: (tx.category as any).color }}
                        >
                          {(tx.category as any).name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                      {(tx.account as any)?.name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn('text-xs border-0 font-medium', tx.type === 'income' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400' : 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400')}>
                        {tx.type === 'income' ? 'Entrée' : 'Dépense'}
                      </Badge>
                    </td>
                    <td className={cn('px-4 py-3 text-right font-semibold whitespace-nowrap', tx.type === 'income' ? 'text-blue-500' : 'text-red-500')}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground text-xs whitespace-nowrap hidden xl:table-cell">
                      {tx.balance_after != null ? formatCurrency(tx.balance_after, currency) : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell">
                      <span className="truncate max-w-24 block">{tx.notes || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(tx)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(tx.id)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingTx(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTx ? 'Modifier la transaction' : 'Nouvelle transaction'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" {...register('date')} />
                {errors.date && <p className="text-destructive text-xs">{errors.date.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={watch('type')} onValueChange={(v) => setValue('type', v as 'income' | 'expense')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Entrée</SelectItem>
                    <SelectItem value="expense">Dépense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Motif</Label>
              <Input placeholder="Description de la transaction" {...register('label')} />
              {errors.label && <p className="text-destructive text-xs">{errors.label.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Montant</Label>
                <Input type="number" step="any" min="0" placeholder="0" {...register('amount')} />
                {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Compte</Label>
                <Select value={watch('account_id') || ''} onValueChange={(v) => setValue('account_id', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select value={watch('category_id') || ''} onValueChange={(v) => setValue('category_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter(c => c.type === (watch('type') || 'expense'))
                    .map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Notes optionnelles..." {...register('notes')} rows={2} className="resize-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" className="flex-1">
                {editingTx ? 'Enregistrer' : 'Ajouter'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la transaction ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La transaction sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)} className="bg-destructive hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
