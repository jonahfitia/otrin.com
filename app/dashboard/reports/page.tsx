'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { formatCurrency, getCurrentMonth } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Download, FileText, Sheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

const COLORS = ['#10b981','#3b82f6','#f97316','#8b5cf6','#f59e0b','#ec4899','#14b8a6','#6366f1','#ef4444','#22c55e'];

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const { year: currentYear } = getCurrentMonth();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [topExpenses, setTopExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) load(); }, [user, selectedYear]);

  async function load() {
    setLoading(true);
    const year = parseInt(selectedYear);
    await Promise.all([loadMonthly(year), loadCategories(year), loadTopExpenses(year)]);
    setLoading(false);
  }

  async function loadMonthly(year: number) {
    const data: MonthlyData[] = [];
    for (let m = 1; m <= 12; m++) {
      const start = `${year}-${String(m).padStart(2, '0')}-01`;
      const end = new Date(year, m, 0).toISOString().split('T')[0];
      const { data: txs } = await supabase
        .from('transactions')
        .select('type, amount')
        .eq('user_id', user!.id)
        .gte('date', start)
        .lte('date', end);

      const income = (txs || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const expenses = (txs || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      const label = new Date(year, m - 1).toLocaleDateString('fr-FR', { month: 'short' });
      data.push({ month: label, income, expenses, savings: income - expenses });
    }
    setMonthlyData(data);
  }

  async function loadCategories(year: number) {
    const { data } = await supabase
      .from('transactions')
      .select('amount, category:categories(name, color)')
      .eq('user_id', user!.id)
      .eq('type', 'expense')
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`);

    const grouped: Record<string, { value: number; color: string }> = {};
    (data || []).forEach((t: any) => {
      const name = t.category?.name || 'Divers';
      const color = t.category?.color || '#6b7280';
      if (!grouped[name]) grouped[name] = { value: 0, color };
      grouped[name].value += Number(t.amount);
    });

    setCategoryData(
      Object.entries(grouped)
        .map(([name, { value, color }]) => ({ name, value, color }))
        .sort((a, b) => b.value - a.value)
    );
  }

  async function loadTopExpenses(year: number) {
    const { data } = await supabase
      .from('transactions')
      .select('label, amount, date, category:categories(name, color)')
      .eq('user_id', user!.id)
      .eq('type', 'expense')
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`)
      .order('amount', { ascending: false })
      .limit(10);
    setTopExpenses(data || []);
  }

  function exportCSV() {
    const rows = [
      ['Mois', 'Revenus', 'Dépenses', 'Épargne'],
      ...monthlyData.map(d => [d.month, d.income, d.expenses, d.savings]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `volako_rapport_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));
  const totalIncome = monthlyData.reduce((s, d) => s + d.income, 0);
  const totalExpenses = monthlyData.reduce((s, d) => s + d.expenses, 0);
  const totalSavings = totalIncome - totalExpenses;

  if (loading) return <div className="flex items-center justify-center min-h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Rapports</h1>
          <p className="text-muted-foreground text-sm mt-1">Analyse complète de vos finances</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV} className="gap-2 h-9">
            <Download className="w-4 h-4" /> CSV
          </Button>
        </div>
      </div>

      {/* Annual summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground">Total revenus {selectedYear}</p>
          <p className="text-2xl font-bold text-blue-500 mt-1">{formatCurrency(totalIncome, currency)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground">Total dépenses {selectedYear}</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(totalExpenses, currency)}</p>
        </div>
        <div className={cn('border rounded-xl p-5', totalSavings >= 0 ? 'bg-primary/10 border-primary/20' : 'bg-destructive/10 border-destructive/20')}>
          <p className="text-sm text-muted-foreground">Épargne nette {selectedYear}</p>
          <p className={cn('text-2xl font-bold mt-1', totalSavings >= 0 ? 'text-primary' : 'text-destructive')}>{formatCurrency(totalSavings, currency)}</p>
        </div>
      </div>

      {/* Monthly bar chart */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-4">Revenus et dépenses par mois</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={monthlyData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="income" name="Revenus" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Dépenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Savings evolution */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-4">Évolution de l'épargne mensuelle</h2>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={monthlyData}>
            <defs>
              <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => [formatCurrency(v, currency), 'Épargne']} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
            <Area type="monotone" dataKey="savings" stroke="#10b981" strokeWidth={2} fill="url(#savingsGrad)" name="Épargne" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Category pie */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Dépenses par catégorie</h2>
          {categoryData.length > 0 ? (
            <div className="flex items-center gap-4">
              <PieChart width={160} height={160}>
                <Pie data={categoryData} cx={75} cy={75} innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                  {categoryData.map((entry, i) => <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
              </PieChart>
              <div className="flex-1 space-y-1.5 overflow-y-auto max-h-40 scrollbar-thin">
                {categoryData.map((cat, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || COLORS[i % COLORS.length] }} />
                    <span className="truncate text-muted-foreground flex-1">{cat.name}</span>
                    <span className="font-medium text-xs flex-shrink-0">{formatCurrency(cat.value, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Aucune dépense cette année</div>}
        </div>

        {/* Top 10 expenses */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-semibold">Top dépenses</h2>
          </div>
          <div className="divide-y divide-border">
            {topExpenses.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Aucune dépense</div>
            ) : topExpenses.map((tx, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tx.label}</p>
                  <p className="text-xs text-muted-foreground">{(tx.category as any)?.name || '—'}</p>
                </div>
                <p className="text-sm font-semibold text-red-500 flex-shrink-0">{formatCurrency(tx.amount, currency)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
