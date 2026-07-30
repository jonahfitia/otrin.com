import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { accountsRepo, recurringRepo } from '@/lib/repository';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Account, RecurringTransaction } from '@/types';
import { Card, LoadingSpinner, EmptyState } from '@/components/ui';
import { colors } from '@/components/theme';
import { Ionicons } from '@expo/vector-icons';
import { addMonths, addDays, addWeeks, addYears, startOfMonth, endOfMonth, isBefore, parseISO } from 'date-fns';

interface ProjectedTx {
  date: Date;
  label: string;
  type: 'income' | 'expense';
  amount: number;
}

interface MonthProjection {
  month: number;
  year: number;
  label: string;
  startBalance: number;
  income: number;
  expenses: number;
  endBalance: number;
  transactions: ProjectedTx[];
}

function projectDate(base: Date, frequency: string, occurrence: number): Date {
  switch (frequency) {
    case 'daily': return addDays(base, occurrence);
    case 'weekly': return addWeeks(base, occurrence);
    case 'monthly': return addMonths(base, occurrence);
    case 'yearly': return addYears(base, occurrence);
    default: return addMonths(base, occurrence);
  }
}

function formatMonthLabel(m: number, y: number): string {
  const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  return `${months[m - 1]} ${y}`;
}

export default function ForecastScreen() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [accs, rec] = await Promise.all([
      accountsRepo(user.uid).getAll(),
      recurringRepo(user.uid).getAll(),
    ]);
    setAccounts(accs);
    setRecurring(rec.filter((r) => r.is_active));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const currentBalance = useMemo(() =>
    accounts.reduce((s, a) => s + a.balance, 0),
  [accounts]);

  const projections = useMemo(() => {
    const months: MonthProjection[] = [];
    const today = new Date();
    const startM = today.getMonth() + 1;
    const startY = today.getFullYear();

    let runningBalance = currentBalance;

    for (let offset = 0; offset < 6; offset++) {
      const m = ((startM - 1 + offset) % 12) + 1;
      const y = startY + Math.floor((startM - 1 + offset) / 12);
      const monthStart = startOfMonth(new Date(y, m - 1, 1));
      const monthEnd = endOfMonth(monthStart);

      const projected: ProjectedTx[] = [];

      for (const rec of recurring) {
        const baseDate = rec.next_date ? parseISO(rec.next_date) : today;
        let occ = 0;
        const maxOcc = rec.frequency === 'daily' ? 180 : rec.frequency === 'weekly' ? 52 : rec.frequency === 'monthly' ? 12 : 3;

        for (let i = 0; i <= maxOcc; i++) {
          const d = projectDate(baseDate, rec.frequency, i);
          if (isBefore(d, monthStart)) continue;
          if (isBefore(monthEnd, d)) break;
          projected.push({
            date: d,
            label: rec.label,
            type: rec.type,
            amount: rec.amount || 0,
          });
        }
      }

      projected.sort((a, b) => a.date.getTime() - b.date.getTime());

      const income = projected.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expenses = projected.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const endBalance = runningBalance + income - expenses;

      months.push({
        month: m,
        year: y,
        label: formatMonthLabel(m, y),
        startBalance: runningBalance,
        income,
        expenses,
        endBalance,
        transactions: projected,
      });

      runningBalance = endBalance;
    }

    return months;
  }, [currentBalance, recurring]);

  const selected = projections[selectedMonthIdx] || projections[0];

  if (loading) return <LoadingSpinner />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Prévisions financières</Text>
      <Text style={styles.subtitle}>Projection sur 6 mois</Text>

      <Card style={styles.currentCard}>
        <Text style={styles.currentLabel}>Solde actuel</Text>
        <Text style={styles.currentValue}>{formatCurrency(currentBalance, currency)}</Text>
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthStrip}>
        {projections.map((p, idx) => {
          const isSelected = idx === selectedMonthIdx;
          const isPositive = p.endBalance >= 0;
          return (
            <TouchableOpacity
              key={`${p.month}-${p.year}`}
              style={[styles.monthChip, isSelected && styles.monthChipSelected]}
              onPress={() => setSelectedMonthIdx(idx)}
            >
              <Text style={[styles.monthChipLabel, isSelected && styles.monthChipLabelSelected]}>
                {p.label.split(' ')[0].slice(0, 3)} {String(p.year).slice(2)}
              </Text>
              <Text style={[styles.monthChipValue, { color: isPositive ? colors.green : colors.red }]}>
                {formatCurrency(p.endBalance, currency)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selected && (
        <Card style={styles.monthCard}>
          <Text style={styles.monthTitle}>{selected.label}</Text>
          <View style={styles.monthBalances}>
            <View style={styles.monthBalanceItem}>
              <Text style={styles.monthBalanceLabel}>Solde début</Text>
              <Text style={styles.monthBalanceValue}>{formatCurrency(selected.startBalance, currency)}</Text>
            </View>
            <View style={styles.monthBalanceItem}>
              <Text style={styles.monthBalanceLabel}>Revenus</Text>
              <Text style={[styles.monthBalanceValue, { color: colors.blue }]}>+{formatCurrency(selected.income, currency)}</Text>
            </View>
            <View style={styles.monthBalanceItem}>
              <Text style={styles.monthBalanceLabel}>Dépenses</Text>
              <Text style={[styles.monthBalanceValue, { color: colors.red }]}>-{formatCurrency(selected.expenses, currency)}</Text>
            </View>
            <View style={[styles.monthBalanceItem, styles.monthBalanceItemEnd]}>
              <Text style={styles.monthBalanceLabelBold}>Solde fin</Text>
              <Text style={[styles.monthBalanceValueBold, { color: selected.endBalance >= 0 ? colors.green : colors.red }]}>
                {formatCurrency(selected.endBalance, currency)}
              </Text>
            </View>
          </View>

          {selected.income > 0 && (
            <View style={styles.projectedSection}>
              <Text style={styles.projectedSectionTitle}>Entrées prévues</Text>
              {selected.transactions.filter((t) => t.type === 'income').map((t, i) => (
                <View key={i} style={styles.projectedRow}>
                  <View style={[styles.projectedIcon, { backgroundColor: colors.blue + '20' }]}>
                    <Ionicons name="trending-up" size={14} color={colors.blue} />
                  </View>
                  <Text style={styles.projectedLabel}>{t.label}</Text>
                  <Text style={styles.projectedDate}>{formatDate(t.date.toISOString().split('T')[0])}</Text>
                  <Text style={[styles.projectedAmount, { color: colors.blue }]}>+{formatCurrency(t.amount, currency)}</Text>
                </View>
              ))}
            </View>
          )}

          {selected.expenses > 0 && (
            <View style={styles.projectedSection}>
              <Text style={styles.projectedSectionTitle}>Sorties prévues</Text>
              {selected.transactions.filter((t) => t.type === 'expense').map((t, i) => (
                <View key={i} style={styles.projectedRow}>
                  <View style={[styles.projectedIcon, { backgroundColor: colors.red + '20' }]}>
                    <Ionicons name="trending-down" size={14} color={colors.red} />
                  </View>
                  <Text style={styles.projectedLabel}>{t.label}</Text>
                  <Text style={styles.projectedDate}>{formatDate(t.date.toISOString().split('T')[0])}</Text>
                  <Text style={[styles.projectedAmount, { color: colors.red }]}>-{formatCurrency(t.amount, currency)}</Text>
                </View>
              ))}
            </View>
          )}

          {selected.transactions.length === 0 && (
            <Text style={styles.noProjected}>Aucune opération récurrente prévue ce mois-ci</Text>
          )}
        </Card>
      )}

      <Card style={styles.evolutionCard}>
        <Text style={styles.sectionTitle}>Évolution sur 6 mois</Text>
        {projections.map((p, idx) => {
          const maxBalance = Math.max(...projections.map((pr) => Math.abs(pr.endBalance)), 1);
          const barRatio = Math.abs(p.endBalance) / maxBalance;
          const isPos = p.endBalance >= 0;
          return (
            <View key={idx} style={styles.evolutionRow}>
              <Text style={styles.evolutionLabel}>{p.label}</Text>
              <View style={styles.evolutionBarContainer}>
                <View
                  style={[
                    styles.evolutionBar,
                    {
                      width: `${Math.max(barRatio * 100, 4)}%`,
                      backgroundColor: isPos ? colors.green : colors.red,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.evolutionValue, { color: isPos ? colors.green : colors.red }]}>
                {formatCurrency(p.endBalance, currency)}
              </Text>
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 80 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 8 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2, marginBottom: 16 },
  currentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentLabel: { fontSize: 14, color: colors.textMuted },
  currentValue: { fontSize: 22, fontWeight: '800', color: colors.primary },
  monthStrip: { marginBottom: 16 },
  monthChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 90,
  },
  monthChipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  monthChipLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  monthChipLabelSelected: { color: colors.primaryDark },
  monthChipValue: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  monthCard: { marginBottom: 16 },
  monthTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 },
  monthBalances: {},
  monthBalanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  monthBalanceItemEnd: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 6,
    paddingTop: 10,
  },
  monthBalanceLabel: { fontSize: 14, color: colors.textMuted },
  monthBalanceValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  monthBalanceLabelBold: { fontSize: 14, fontWeight: '700', color: colors.text },
  monthBalanceValueBold: { fontSize: 16, fontWeight: '800' },
  projectedSection: { marginTop: 14 },
  projectedSectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase' },
  projectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  projectedIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectedLabel: { flex: 1, fontSize: 13, color: colors.text, fontWeight: '500' },
  projectedDate: { fontSize: 11, color: colors.textMuted },
  projectedAmount: { fontSize: 13, fontWeight: '600', minWidth: 80, textAlign: 'right' },
  noProjected: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic', marginTop: 8 },
  evolutionCard: { marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 },
  evolutionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  evolutionLabel: {
    fontSize: 12,
    color: colors.textMuted,
    width: 80,
  },
  evolutionBarContainer: {
    flex: 1,
    height: 20,
    backgroundColor: colors.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  evolutionBar: {
    height: '100%',
    borderRadius: 10,
    minWidth: 4,
  },
  evolutionValue: {
    fontSize: 12,
    fontWeight: '700',
    width: 90,
    textAlign: 'right',
  },
});
