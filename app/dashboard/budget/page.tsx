'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { Budget, Category } from '@/lib/types';
import { formatCurrency, formatMonthYear, getCurrentMonth } from '@/lib/formatters';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, ChevronLeft, ChevronRight, AlertTriangle, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const schema = z.object({
  category_id: z.string().min(1, 'Catégorie requise'),
  amount: z.coerce.number().positive('Montant invalide'),
});
type FormData = z.infer<typeof schema>;

interface BudgetWithSpent extends Budget {
  spent: number;
  category: Category;
}

export default function BudgetPage() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const { month: currentMonth, year: currentYear } = getCurrentMonth();
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [budgets, setBudgets] = useState<BudgetWithSpent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetWithSpent | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => { if (user) load(); }, [user, month, year]);

  async function load() {
    setLoading(true);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = new Date(year, month, 0).toISOString().split('T')[0];

    const [budgetRes, catRes, txRes] = await Promise.all([
      supabase.from('budgets').select('*, category:categories(*)').eq('user_id', user!.id).eq('month', month).eq('year', year),
      supabase.from('categories').select('*').eq('user_id', user!.id).eq('type', 'expense').order('name'),
      supabase.from('transactions').select('category_id, amount').eq('user_id', user!.id).eq('type', 'expense').gte('date', start).lte('date', end),
    ]);

    const spentByCategory: Record<string, number> = {};
    (txRes.data || []).forEach(t => {
      if (t.category_id) {
        spentByCategory[t.category_id] = (spentByCategory[t.category_id] || 0) + Number(t.amount);
      }
    });

    const budgetsWithSpent = (budgetRes.data || []).map(b => ({
      ...b,
      spent: spentByCategory[b.category_id] || 0,
    })) as BudgetWithSpent[];

    setBudgets(budgetsWithSpent);
    setCategories(catRes.data || []);
    setLoading(false);
  }

  const onSubmit = async (data: FormData) => {
    try {
      if (editing) {
        await supabase.from('budgets').update({ amount: data.amount }).eq('id', editing.id);
        toast.success('Budget modifié');
      } else {
        await supabase.from('budgets').upsert({ ...data, month, year }, { onConflict: 'user_id,category_id,month,year' });
        toast.success('Budget ajouté');
      }
      await load();
      setDialogOpen(false);
      setEditing(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  function openNew() {
    setEditing(null);
    reset({});
    setDialogOpen(true);
  }

  function openEdit(b: BudgetWithSpent) {
    setEditing(b);
    reset({ category_id: b.category_id || '', amount: b.amount });
    setValue('category_id', b.category_id || '');
    setDialogOpen(true);
  }

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const totalRemaining = totalBudget - totalSpent;
  const overallPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const usedCategoryIds = budgets.map(b => b.category_id).filter(Boolean);
  const availableCategories = categories.filter(c => !usedCategoryIds.includes(c.id) || (editing && editing.category_id === c.id));

  if (loading) return <div className="flex items-center justify-center min-h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budget</h1>
          <p className="text-muted-foreground text-sm mt-1">Planifiez vos dépenses par catégorie</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nouveau budget</Button>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-4">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold capitalize min-w-40 text-center">{formatMonthYear(month, year)}</h2>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Summary */}
      {budgets.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Total budget</span>
            <div className="flex gap-6 text-sm">
              <span className="text-muted-foreground">Budget: <span className="text-foreground font-semibold">{formatCurrency(totalBudget, currency)}</span></span>
              <span className="text-muted-foreground">Dépensé: <span className="text-red-500 font-semibold">{formatCurrency(totalSpent, currency)}</span></span>
              <span className="text-muted-foreground">Reste: <span className={cn('font-semibold', totalRemaining >= 0 ? 'text-primary' : 'text-red-500')}>{formatCurrency(Math.abs(totalRemaining), currency)}</span></span>
            </div>
          </div>
          <Progress value={Math.min(overallPct, 100)} className={cn('h-2', overallPct > 100 ? '[&>div]:bg-destructive' : '[&>div]:bg-primary')} />
          {overallPct > 90 && (
            <div className={cn('flex items-center gap-2 text-sm px-3 py-2 rounded-lg', overallPct > 100 ? 'bg-red-50 text-red-600 dark:bg-red-950/30' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30')}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {overallPct > 100 ? 'Budget global dépassé !' : `Budget global presque atteint (${overallPct.toFixed(0)}%)`}
            </div>
          )}
        </div>
      )}

      {/* Budget cards */}
      {budgets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>Aucun budget pour ce mois.</p>
          <p className="text-sm mt-1">Ajoutez des budgets par catégorie pour suivre vos dépenses.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map(b => {
            const pct = b.amount > 0 ? (b.spent / b.amount) * 100 : 0;
            const over = pct > 100;
            const warn = pct > 80 && !over;
            const remaining = b.amount - b.spent;

            return (
              <div key={b.id} className={cn('bg-card border rounded-xl p-4 space-y-3 transition-all hover:shadow-sm', over ? 'border-red-200 dark:border-red-900' : 'border-border')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: b.category.color + '20' }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: b.category.color }} />
                    </div>
                    <span className="font-medium">{b.category.name}</span>
                  </div>
                  <button onClick={() => openEdit(b)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Progress value={Math.min(pct, 100)} className={cn('h-2', over ? '[&>div]:bg-destructive' : warn ? '[&>div]:bg-amber-500' : '[&>div]:bg-primary')} />
                <div className="flex items-center justify-between text-sm">
                  <div className="flex gap-4 text-muted-foreground">
                    <span>Budget: <span className="text-foreground font-medium">{formatCurrency(b.amount, currency)}</span></span>
                    <span>Dépensé: <span className="text-red-500 font-medium">{formatCurrency(b.spent, currency)}</span></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {over && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                    <span className={cn('font-semibold', remaining >= 0 ? 'text-primary' : 'text-destructive')}>
                      {remaining >= 0 ? `${formatCurrency(remaining, currency)} restant` : `${formatCurrency(Math.abs(remaining), currency)} dépassé`}
                    </span>
                  </div>
                </div>
                {(over || warn) && (
                  <div className={cn('flex items-center gap-2 text-xs px-2 py-1.5 rounded-md', over ? 'bg-red-50 text-red-600 dark:bg-red-950/30' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30')}>
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    {over ? `Budget dépassé de ${formatCurrency(Math.abs(remaining), currency)} !` : `Attention : ${pct.toFixed(0)}% du budget utilisé`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le budget' : 'Nouveau budget'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select value={watch('category_id') || ''} onValueChange={(v) => setValue('category_id', v)} disabled={!!editing}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {availableCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.category_id && <p className="text-destructive text-xs">{errors.category_id.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Montant du budget</Label>
              <Input type="number" step="any" min="0" placeholder="0" {...register('amount')} />
              {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Annuler</Button>
              <Button type="submit" className="flex-1">{editing ? 'Enregistrer' : 'Ajouter'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
