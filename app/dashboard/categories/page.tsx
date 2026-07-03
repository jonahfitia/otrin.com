'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import { Category } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const ICONS = ['briefcase','star','shopping-bag','laptop','gift','plus-circle','utensils','car','home','wifi','droplets','zap','heart-pulse','users','graduation-cap','gamepad-2','plane','trending-up','piggy-bank','more-horizontal','church','wallet','coffee','music','book','camera','dumbbell'];
const COLORS = ['#10b981','#3b82f6','#ef4444','#f97316','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#84cc16','#6366f1','#a855f7','#f43f5e','#22c55e','#06b6d4','#7c3aed','#6b7280'];

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  type: z.enum(['income', 'expense']),
  icon: z.string().min(1),
  color: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

export default function CategoriesPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('expense');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'expense', color: COLORS[0], icon: ICONS[0] },
  });

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('categories').select('*').eq('user_id', user!.id).order('name');
    setCategories(data || []);
    setLoading(false);
  }

  const onSubmit = async (data: FormData) => {
    try {
      if (editing) {
        const { error } = await supabase.from('categories').update(data).eq('id', editing.id);
        if (error) throw error;
        toast.success('Catégorie modifiée');
      } else {
        const { error } = await supabase.from('categories').insert(data);
        if (error) throw error;
        toast.success('Catégorie ajoutée');
      }
      await load();
      setDialogOpen(false);
      setEditing(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  async function handleDelete(id: string) {
    await supabase.from('categories').delete().eq('id', id);
    await load();
    setDeleteId(null);
    toast.success('Catégorie supprimée');
  }

  function openNew() {
    setEditing(null);
    setSelectedColor(COLORS[0]);
    setSelectedIcon(ICONS[0]);
    reset({ type: activeTab, color: COLORS[0], icon: ICONS[0] });
    setDialogOpen(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setSelectedColor(cat.color);
    setSelectedIcon(cat.icon);
    reset({ name: cat.name, type: cat.type, icon: cat.icon, color: cat.color });
    setDialogOpen(true);
  }

  const income = categories.filter(c => c.type === 'income');
  const expense = categories.filter(c => c.type === 'expense');
  const shown = activeTab === 'income' ? income : expense;

  if (loading) return <div className="flex items-center justify-center min-h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catégories</h1>
          <p className="text-muted-foreground text-sm mt-1">{categories.length} catégories au total</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nouvelle</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {(['expense', 'income'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-all', activeTab === t ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            {t === 'income' ? `Revenus (${income.length})` : `Dépenses (${expense.length})`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {shown.map(cat => (
          <div key={cat.id} className="bg-card border border-border rounded-xl p-4 group hover:shadow-sm transition-shadow relative">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                <span className="text-lg" style={{ color: cat.color }}>●</span>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(cat)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                  <Edit2 className="w-3 h-3" />
                </button>
                <button onClick={() => setDeleteId(cat.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            <p className="text-sm font-medium truncate">{cat.name}</p>
            {cat.is_default && <p className="text-xs text-muted-foreground mt-0.5">Par défaut</p>}
            <div className="mt-2 h-1 rounded-full" style={{ backgroundColor: cat.color }} />
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input placeholder="Nom de la catégorie" {...register('name')} />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={watch('type')} onValueChange={(v) => setValue('type', v as 'income' | 'expense')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Revenu</SelectItem>
                  <SelectItem value="expense">Dépense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Couleur</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setSelectedColor(c); setValue('color', c); }}
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
            <AlertDialogTitle>Supprimer la catégorie ?</AlertDialogTitle>
            <AlertDialogDescription>Les transactions liées ne seront pas supprimées mais perdront leur catégorie.</AlertDialogDescription>
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
