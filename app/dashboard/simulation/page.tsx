'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { Simulation, SimulationItem } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Trash2, FlaskConical, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

const simSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  description: z.string().optional(),
  start_balance: z.coerce.number(),
});

const itemSchema = z.object({
  date: z.string().min(1, 'Date requise'),
  label: z.string().min(1, 'Libellé requis'),
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number().positive('Montant invalide'),
  notes: z.string().optional(),
});

type SimForm = z.infer<typeof simSchema>;
type ItemForm = z.infer<typeof itemSchema>;

export default function SimulationPage() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [selectedSim, setSelectedSim] = useState<Simulation | null>(null);
  const [items, setItems] = useState<SimulationItem[]>([]);
  const [realBalance, setRealBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [simDialogOpen, setSimDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);

  const simForm = useForm<SimForm>({ resolver: zodResolver(simSchema), defaultValues: { start_balance: 0 } });
  const itemForm = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
    defaultValues: { type: 'expense', date: new Date().toISOString().split('T')[0] },
  });

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    setLoading(true);
    const [simRes, accRes] = await Promise.all([
      supabase.from('simulations').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('accounts').select('balance').eq('user_id', user!.id),
    ]);
    const sims = simRes.data || [];
    setSimulations(sims);
    const balance = (accRes.data || []).reduce((s, a) => s + Number(a.balance), 0);
    setRealBalance(balance);
    if (sims.length > 0 && !selectedSim) {
      const first = sims[0];
      setSelectedSim(first);
      await loadItems(first.id);
    }
    setLoading(false);
  }

  async function loadItems(simId: string) {
    const { data } = await supabase
      .from('simulation_items')
      .select('*')
      .eq('simulation_id', simId)
      .order('date', { ascending: true });
    setItems(data || []);
  }

  const onSimSubmit = async (data: SimForm) => {
    try {
      const { data: sim } = await supabase.from('simulations').insert(data).select().maybeSingle();
      toast.success('Simulation créée');
      setSimulations(prev => [sim!, ...prev]);
      setSelectedSim(sim!);
      setItems([]);
      setSimDialogOpen(false);
      simForm.reset();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const onItemSubmit = async (data: ItemForm) => {
    if (!selectedSim) return;
    try {
      const { data: item } = await supabase
        .from('simulation_items')
        .insert({ simulation_id: selectedSim.id, ...data })
        .select()
        .maybeSingle();
      toast.success('Opération ajoutée');
      setItems(prev => [...prev, item!].sort((a, b) => a.date.localeCompare(b.date)));
      setItemDialogOpen(false);
      itemForm.reset({ type: 'expense', date: new Date().toISOString().split('T')[0] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  async function deleteItem(id: string) {
    await supabase.from('simulation_items').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  async function selectSim(sim: Simulation) {
    setSelectedSim(sim);
    await loadItems(sim.id);
  }

  // Build chart data: real line + simulated dashed line
  const simStartBalance = selectedSim?.start_balance ?? realBalance;
  let running = simStartBalance;
  const simChartData = items.map(item => {
    running += item.type === 'income' ? Number(item.amount) : -Number(item.amount);
    return { date: formatDate(item.date), simulation: running, real: null };
  });

  const allChartData = [{ date: 'Maintenant', real: realBalance, simulation: simStartBalance }, ...simChartData];
  const finalBalance = running;
  const delta = finalBalance - realBalance;

  if (loading) return <div className="flex items-center justify-center min-h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Simulation financière</h1>
          <p className="text-muted-foreground text-sm mt-1">Projetez votre avenir financier sans affecter vos vraies données</p>
        </div>
        <Button onClick={() => setSimDialogOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Nouvelle simulation</Button>
      </div>

      {simulations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Créez votre première simulation pour projeter votre solde.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Sidebar: simulation list */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Mes simulations</h2>
            {simulations.map(sim => (
              <button
                key={sim.id}
                onClick={() => selectSim(sim)}
                className={cn('w-full text-left p-3 rounded-xl border transition-all', selectedSim?.id === sim.id ? 'bg-primary/10 border-primary' : 'bg-card border-border hover:shadow-sm')}
              >
                <p className="font-medium text-sm">{sim.name}</p>
                {sim.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sim.description}</p>}
                <p className="text-xs text-muted-foreground mt-1">Départ: {formatCurrency(sim.start_balance, currency)}</p>
              </button>
            ))}
          </div>

          {/* Main: items + chart */}
          {selectedSim && (
            <div className="lg:col-span-2 space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-xs text-muted-foreground">Solde actuel réel</p>
                  <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(realBalance, currency)}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-xs text-muted-foreground">Après simulation</p>
                  <p className={cn('text-xl font-bold mt-1', finalBalance >= 0 ? 'text-primary' : 'text-destructive')}>{formatCurrency(finalBalance, currency)}</p>
                </div>
                <div className={cn('rounded-xl p-4', delta >= 0 ? 'bg-primary/10' : 'bg-destructive/10')}>
                  <p className="text-xs text-muted-foreground">Variation</p>
                  <p className={cn('text-xl font-bold mt-1', delta >= 0 ? 'text-primary' : 'text-destructive')}>
                    {delta >= 0 ? '+' : ''}{formatCurrency(delta, currency)}
                  </p>
                </div>
              </div>

              {/* Chart */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold mb-4">Projection</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={allChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => v != null ? formatCurrency(v, currency) : null} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="real" name="Réel" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} connectNulls />
                    <Line type="monotone" dataKey="simulation" name="Simulation" stroke="#10b981" strokeWidth={2} strokeDasharray="6 3" dot={{ fill: '#10b981', r: 3 }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Items list */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <h3 className="font-semibold">Opérations simulées</h3>
                  <Button size="sm" onClick={() => setItemDialogOpen(true)} className="gap-1.5 h-8">
                    <Plus className="w-3.5 h-3.5" /> Ajouter
                  </Button>
                </div>
                {items.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    Ajoutez des opérations futures pour voir la projection.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {items.map(item => (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', item.type === 'income' ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-red-50 dark:bg-red-950/30')}>
                          {item.type === 'income' ? <TrendingUp className="w-4 h-4 text-blue-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                        </div>
                        <p className={cn('font-semibold text-sm', item.type === 'income' ? 'text-blue-500' : 'text-red-500')}>
                          {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount, currency)}
                        </p>
                        <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* New simulation dialog */}
      <Dialog open={simDialogOpen} onOpenChange={setSimDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouvelle simulation</DialogTitle></DialogHeader>
          <form onSubmit={simForm.handleSubmit(onSimSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input placeholder="Ex: Scénario achat moto" {...simForm.register('name')} />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optionnel)</Label>
              <Input placeholder="Description..." {...simForm.register('description')} />
            </div>
            <div className="space-y-1.5">
              <Label>Solde de départ</Label>
              <Input type="number" step="any" placeholder="0" {...simForm.register('start_balance')} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setSimDialogOpen(false)} className="flex-1">Annuler</Button>
              <Button type="submit" className="flex-1">Créer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* New item dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ajouter une opération simulée</DialogTitle></DialogHeader>
          <form onSubmit={itemForm.handleSubmit(onItemSubmit)} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" {...itemForm.register('date')} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={itemForm.watch('type')} onValueChange={(v) => itemForm.setValue('type', v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Entrée</SelectItem>
                    <SelectItem value="expense">Dépense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Libellé</Label>
              <Input placeholder="Description..." {...itemForm.register('label')} />
            </div>
            <div className="space-y-1.5">
              <Label>Montant</Label>
              <Input type="number" step="any" min="0" placeholder="0" {...itemForm.register('amount')} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setItemDialogOpen(false)} className="flex-1">Annuler</Button>
              <Button type="submit" className="flex-1">Ajouter</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
