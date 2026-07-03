'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { Transaction } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

export default function CalendarPage() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) load(); }, [user, month, year]);

  async function load() {
    setLoading(true);
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const end = new Date(year, month + 1, 0).toISOString().split('T')[0];
    const { data } = await supabase
      .from('transactions')
      .select('*, category:categories(name, color)')
      .eq('user_id', user!.id)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true });
    setTransactions(data || []);
    setLoading(false);
  }

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = lastDay.getDate();

  const txByDay: Record<number, Transaction[]> = {};
  transactions.forEach(tx => {
    const day = parseInt(tx.date.split('-')[2]);
    if (!txByDay[day]) txByDay[day] = [];
    txByDay[day].push(tx);
  });

  const selectedTxs = selectedDay ? (txByDay[selectedDay] || []) : [];

  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Calendrier</h1>
        <p className="text-muted-foreground text-sm mt-1">Vue des transactions par jour</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="font-semibold text-lg">{MONTHS[month]} {year}</h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="h-20 border-b border-r border-border last:border-r-0" />;
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const txs = txByDay[day] || [];
              const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
              const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
              const isSelected = selectedDay === day;

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={cn(
                    'h-20 border-b border-r border-border last:border-r-0 p-1.5 text-left transition-colors hover:bg-muted/50',
                    isSelected && 'bg-primary/10 border-primary',
                    (i + 1) % 7 === 0 && 'border-r-0'
                  )}
                >
                  <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium mb-1', isToday ? 'bg-primary text-primary-foreground' : '')}>
                    {day}
                  </div>
                  {txs.length > 0 && (
                    <div className="space-y-0.5">
                      {income > 0 && <div className="text-[10px] text-blue-500 font-medium truncate">+{Math.round(income / 1000)}k</div>}
                      {expense > 0 && <div className="text-[10px] text-red-500 font-medium truncate">-{Math.round(expense / 1000)}k</div>}
                      {txs.length > 2 && <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mx-auto mt-0.5" />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold">
              {selectedDay ? `${selectedDay} ${MONTHS[month]}` : 'Sélectionner un jour'}
            </h3>
            {selectedDay && (
              <button onClick={() => setSelectedDay(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="overflow-y-auto max-h-96 scrollbar-thin">
            {!selectedDay ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                Cliquez sur un jour pour voir ses transactions
              </div>
            ) : selectedTxs.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                Aucune transaction ce jour
              </div>
            ) : (
              <div className="divide-y divide-border">
                {selectedTxs.map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: (tx.category as any)?.color + '20', color: (tx.category as any)?.color }}
                    >
                      {tx.label.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{(tx.category as any)?.name || '—'}</p>
                    </div>
                    <p className={cn('text-sm font-semibold flex-shrink-0', tx.type === 'income' ? 'text-blue-500' : 'text-red-500')}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedDay && selectedTxs.length > 0 && (
            <div className="px-4 py-3 border-t border-border bg-muted/30 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Revenus</span>
                <span className="text-blue-500 font-medium">{formatCurrency(selectedTxs.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0), currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Dépenses</span>
                <span className="text-red-500 font-medium">{formatCurrency(selectedTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0), currency)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
