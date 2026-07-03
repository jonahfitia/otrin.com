'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { formatCurrency, formatDate, formatDateShort, getCurrentMonth } from '@/lib/formatters';
import { Transaction, Account, Category } from '@/lib/types';
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank, BarChart2, Percent,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import Link from 'next/link';

interface DashboardStats {
  balance: number;
  income: number;
  expenses: number;
  savings: number;
  budgetTotal: number;
  budgetSpent: number;
  savingsRate: number;
}

const COLORS = ['#10b981', '#3b82f6', '#f97316', '#a855f7', '#f43f5e', '#14b8a6', '#f59e0b', '#6366f1'];

export default function DashboardPage() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const [stats, setStats] = useState<DashboardStats>({ balance: 0, income: 0, expenses: 0, savings: 0, budgetTotal: 0, budgetSpent: 0, savingsRate: 0 });
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [balanceHistory, setBalanceHistory] = useState<{ date: string; balance: number }[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ month: string; income: number; expenses: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const { month, year } = getCurrentMonth();

  useEffect(() => {
    if (!user) return;
    loadDashboard();
  }, [user]);

  async function loadDashboard() {
    setLoading(true);
    await Promise.all([
      loadStats(),
      loadRecentTransactions(),
      loadBalanceHistory(),
      loadMonthlyData(),
      loadCategoryData(),
    ]);
    setLoading(false);
  }

  async function loadStats() {
    const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
    const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];

    const [accountsRes, txRes, budgetRes] = await Promise.all([
      supabase.from('accounts').select('balance').eq('user_id', user!.id),
      supabase.from('transactions').select('type, amount').eq('user_id', user!.id).gte('date', startOfMonth).lte('date', endOfMonth),
      supabase.from('budgets').select('amount').eq('user_id', user!.id).eq('month', month).eq('year', year),
    ]);

    const totalBalance = (accountsRes.data || []).reduce((s, a) => s + Number(a.balance), 0);
    const income = (txRes.data || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expenses = (txRes.data || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const budgetTotal = (budgetRes.data || []).reduce((s, b) => s + Number(b.amount), 0);

    const savings = income - expenses;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;

    setStats({
      balance: totalBalance,
      income,
      expenses,
      savings,
      budgetTotal,
      budgetSpent: expenses,
      savingsRate,
    });
  }

  async function loadRecentTransactions() {
    const { data } = await supabase
      .from('transactions')
      .select('*, account:accounts(name, color), category:categories(name, icon, color)')
      .eq('user_id', user!.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(8);
    setRecentTransactions(data || []);
  }

  async function loadBalanceHistory() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const { data } = await supabase
      .from('transactions')
      .select('date, type, amount')
      .eq('user_id', user!.id)
      .gte('date', sixMonthsAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (!data?.length) { setBalanceHistory([]); return; }

    const byDate: Record<string, number> = {};
    data.forEach(t => {
      const d = t.date.substring(0, 10);
      if (!byDate[d]) byDate[d] = 0;
      byDate[d] += t.type === 'income' ? Number(t.amount) : -Number(t.amount);
    });

    let running = 0;
    const history = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, delta]) => {
        running += delta;
        return { date: formatDateShort(date), balance: running };
      });
    setBalanceHistory(history);
  }

  async function loadMonthlyData() {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
    }

    const data = await Promise.all(months.map(async ({ month, year }) => {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const end = new Date(year, month, 0).toISOString().split('T')[0];
      const { data: txs } = await supabase
        .from('transactions')
        .select('type, amount')
        .eq('user_id', user!.id)
        .gte('date', start)
        .lte('date', end);

      const income = (txs || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const expenses = (txs || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      const label = new Date(year, month - 1).toLocaleDateString('fr-FR', { month: 'short' });
      return { month: label, income, expenses };
    }));

    setMonthlyData(data);
  }

  async function loadCategoryData() {
    const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
    const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];

    const { data } = await supabase
      .from('transactions')
      .select('amount, category:categories(name, color)')
      .eq('user_id', user!.id)
      .eq('type', 'expense')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth);

    const grouped: Record<string, { value: number; color: string }> = {};
    (data || []).forEach((t: any) => {
      const name = t.category?.name || 'Divers';
      const color = t.category?.color || '#6b7280';
      if (!grouped[name]) grouped[name] = { value: 0, color };
      grouped[name].value += Number(t.amount);
    });

    const sorted = Object.entries(grouped)
      .map(([name, { value, color }]) => ({ name, value, color }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    setCategoryData(sorted);
  }

  const metrics = [
    {
      label: 'Solde actuel',
      value: formatCurrency(stats.balance, currency),
      icon: Wallet,
      color: 'text-primary',
      bg: 'bg-primary/10',
      trend: null,
    },
    {
      label: 'Revenus du mois',
      value: formatCurrency(stats.income, currency),
      icon: TrendingUp,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      trend: 'up',
    },
    {
      label: 'Dépenses du mois',
      value: formatCurrency(stats.expenses, currency),
      icon: TrendingDown,
      color: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-950/30',
      trend: 'down',
    },
    {
      label: 'Épargne du mois',
      value: formatCurrency(stats.savings, currency),
      icon: PiggyBank,
      color: stats.savings >= 0 ? 'text-emerald-500' : 'text-red-500',
      bg: stats.savings >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30',
      trend: stats.savings >= 0 ? 'up' : 'down',
    },
    {
      label: 'Budget restant',
      value: formatCurrency(Math.max(0, stats.budgetTotal - stats.budgetSpent), currency),
      icon: BarChart2,
      color: 'text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      trend: null,
    },
    {
      label: "Taux d'épargne",
      value: `${stats.savingsRate.toFixed(1)}%`,
      icon: Percent,
      color: stats.savingsRate >= 0 ? 'text-purple-500' : 'text-red-500',
      bg: 'bg-purple-50 dark:bg-purple-950/30',
      trend: null,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-muted-foreground text-sm mt-1">Vue d'ensemble de vos finances</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metrics.map((m, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">{m.label}</p>
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', m.bg)}>
                <m.icon className={cn('w-4 h-4', m.color)} />
              </div>
            </div>
            <div>
              <p className={cn('text-lg font-bold leading-tight', m.color)}>{m.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Balance evolution */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Évolution du solde</h2>
          {balanceHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={balanceHistory}>
                <defs>
                  <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [formatCurrency(v, currency), 'Solde']} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={2} fill="url(#balanceGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              Aucune transaction pour le moment
            </div>
          )}
        </div>

        {/* Revenue vs Expenses */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Revenus vs Dépenses (6 mois)</h2>
          <ResponsiveContainer width="100%" height={200}>
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
      </div>

      {/* Category pie + recent transactions */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Category pie */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Dépenses par catégorie (ce mois)</h2>
          {categoryData.length > 0 ? (
            <div className="flex items-center gap-4">
              <PieChart width={160} height={160}>
                <Pie data={categoryData} cx={75} cy={75} innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                  {categoryData.map((entry, index) => (
                    <Cell key={index} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
              </PieChart>
              <div className="flex-1 space-y-1.5 min-w-0">
                {categoryData.map((cat, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || COLORS[i % COLORS.length] }} />
                    <span className="truncate text-muted-foreground flex-1">{cat.name}</span>
                    <span className="font-medium flex-shrink-0">{formatCurrency(cat.value, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
              Aucune dépense ce mois
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Dernières opérations</h2>
            <Link href="/dashboard/transactions" className="text-sm text-primary hover:underline">Voir tout</Link>
          </div>
          {recentTransactions.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
              Aucune transaction
            </div>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                    style={{ backgroundColor: (tx.category as any)?.color + '20', color: (tx.category as any)?.color }}
                  >
                    {tx.label.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.label}</p>
                    <p className="text-xs text-muted-foreground">{(tx.category as any)?.name || 'Sans catégorie'} · {formatDate(tx.date)}</p>
                  </div>
                  <div className={cn('text-sm font-semibold flex-shrink-0', tx.type === 'income' ? 'text-blue-500' : 'text-red-500')}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, currency)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
