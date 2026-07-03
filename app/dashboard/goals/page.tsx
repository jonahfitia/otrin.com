'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { Goal, GoalContribution } from '@/lib/types';
import { formatCurrency, formatDate, toInputDate } from '@/lib/formatters';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Target, Trash2, Edit2, CheckCircle, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const COLORS = ['#10b981','#3b82f6','#f97316','#8b5cf6','#f59e0b','#ec4899','#14b8a6','#6366f1'];

const goalSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  target_amount: z.coerce.number().positive('Montant invalide'),
  deadline: z.string().optional(),
  color: z.string(),
});

const contribSchema = z.object({
  amount: z.coerce.number().positive('Montant invalide'),
  date: z.string().min(1, 'Date requise'),
  notes: z.string().optional(),
});

type GoalForm = z.infer<typeof goalSchema>;
type ContribForm = z.infer<typeof contribSchema>;

export default function GoalsPage() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contribDialogOpen, setContribDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  const goalForm = useForm<GoalForm>({
    resolver: zodResolver(goalSchema),
    defaultValues: { color: COLORS[0] },
  });
  const contribForm = useForm<ContribForm>({
    resolver: zodResolver(contribSchema),
    defaultValues: { date: new Date().toISOString().split('T')[0] },
  });

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('goals').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
    setGoals(data || []);
    setLoading(false);
  }

  const onGoalSubmit = async (data: GoalForm) => {
    try {
      if (editing) {
        await supabase.from('goals').update(data).eq('id', editing.id);
        toast.success('Objectif modifié');
      } else {
        await supabase.from('goals').insert(data);
        toast.success('Objectif créé');
      }
      await load();
      setDialogOpen(false);
      setEditing(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const onContribSubmit = async (data: ContribForm) => {
    if (!selectedGoal) return;
    try {
      await supabase.from('goal_contributions').insert({ goal_id: selectedGoal.id, ...data });
      const newAmount = selectedGoal.current_amount + data.amount;
      const isCompleted = newAmount >= selectedGoal.target_amount;
      await supabase.from('goals').update({
        current_amount: newAmount,
        is_completed: isCompleted,
      }).eq('id', selectedGoal.id);

      if (isCompleted) toast.success('Félicitations ! Objectif atteint ! 🎉');
      else toast.success('Contribution ajoutée');

      await load();
      setContribDialogOpen(false);
      setSelectedGoal(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  async function handleDelete(id: string) {
    await supabase.from('goals').delete().eq('id', id);
    await load();
    setDeleteId(null);
    toast.success('Objectif supprimé');
  }

  function openNew() {
    setEditing(null);
    setSelectedColor(COLORS[0]);
    goalForm.reset({ color: COLORS[0] });
    setDialogOpen(true);
  }

  function openEdit(g: Goal) {
    setEditing(g);
    setSelectedColor(g.color);
    goalForm.reset({ name: g.name, target_amount: g.target_amount, deadline: g.deadline || undefined, color: g.color });
    setDialogOpen(true);
  }

  function openContrib(g: Goal) {
    setSelectedGoal(g);
    contribForm.reset({ date: new Date().toISOString().split('T')[0] });
    setContribDialogOpen(true);
  }

  const active = goals.filter(g => !g.is_completed);
  const completed = goals.filter(g => g.is_completed);

  if (loading) return <div className="flex items-center justify-center min-h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Objectifs d'épargne</h1>
          <p className="text-muted-foreground text-sm mt-1">{goals.length} objectif{goals.length > 1 ? 's' : ''} au total</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nouvel objectif</Button>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucun objectif. Commencez par en créer un !</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {active.map(g => {
                const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0;
                const remaining = g.target_amount - g.current_amount;
                const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000) : null;

                return (
                  <div key={g.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-sm transition-shadow space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: g.color + '20' }}>
                          <Target className="w-5 h-5" style={{ color: g.color }} />
                        </div>
                        <div>
                          <p className="font-semibold">{g.name}</p>
                          {g.deadline && (
                            <p className={cn('text-xs', daysLeft && daysLeft < 30 ? 'text-amber-500' : 'text-muted-foreground')}>
                              {daysLeft != null && daysLeft < 0 ? 'Délai dépassé' : daysLeft != null ? `${daysLeft} jours restants` : formatDate(g.deadline)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(g)} className="p-1 rounded hover:bg-muted text-muted-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteId(g.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{formatCurrency(g.current_amount, currency)}</span>
                        <span className="font-medium">{formatCurrency(g.target_amount, currency)}</span>
                      </div>
                      <Progress value={Math.min(pct, 100)} className="h-2.5" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold" style={{ color: g.color }}>{pct.toFixed(0)}%</span>
                        <span className="text-xs text-muted-foreground">Reste: {formatCurrency(remaining, currency)}</span>
                      </div>
                    </div>

                    <Button size="sm" variant="outline" onClick={() => openContrib(g)} className="w-full gap-1.5">
                      <PlusCircle className="w-3.5 h-3.5" /> Ajouter une contribution
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h2 className="text-base font-semibold mb-3 text-muted-foreground flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" /> Objectifs atteints ({completed.length})
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {completed.map(g => (
                  <div key={g.id} className="bg-card border border-primary/20 rounded-xl p-5 opacity-75 space-y-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-8 h-8 text-primary flex-shrink-0" />
                      <div>
                        <p className="font-semibold">{g.name}</p>
                        <p className="text-xs text-primary">{formatCurrency(g.current_amount, currency)} atteint</p>
                      </div>
                    </div>
                    <Progress value={100} className="h-1.5 [&>div]:bg-primary" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier l'objectif" : 'Nouvel objectif'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={goalForm.handleSubmit(onGoalSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nom de l'objectif</Label>
              <Input placeholder="Ex: Nouvel ordinateur, Vacances..." {...goalForm.register('name')} />
              {goalForm.formState.errors.name && <p className="text-destructive text-xs">{goalForm.formState.errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Montant cible</Label>
                <Input type="number" step="any" min="0" placeholder="0" {...goalForm.register('target_amount')} />
                {goalForm.formState.errors.target_amount && <p className="text-destructive text-xs">{goalForm.formState.errors.target_amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Date limite (optionnel)</Label>
                <Input type="date" {...goalForm.register('deadline')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Couleur</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => { setSelectedColor(c); goalForm.setValue('color', c); }}
                    className={cn('w-7 h-7 rounded-full transition-transform', selectedColor === c && 'ring-2 ring-offset-2 ring-foreground scale-110')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Annuler</Button>
              <Button type="submit" className="flex-1">{editing ? 'Enregistrer' : 'Créer'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={contribDialogOpen} onOpenChange={(o) => { setContribDialogOpen(o); if (!o) setSelectedGoal(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter une contribution — {selectedGoal?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={contribForm.handleSubmit(onContribSubmit)} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Montant</Label>
                <Input type="number" step="any" min="0" placeholder="0" {...contribForm.register('amount')} />
                {contribForm.formState.errors.amount && <p className="text-destructive text-xs">{contribForm.formState.errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" {...contribForm.register('date')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optionnel)</Label>
              <Input placeholder="Notes..." {...contribForm.register('notes')} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setContribDialogOpen(false)} className="flex-1">Annuler</Button>
              <Button type="submit" className="flex-1">Ajouter</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'objectif ?</AlertDialogTitle>
            <AlertDialogDescription>Cet objectif et toutes ses contributions seront supprimés définitivement.</AlertDialogDescription>
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
