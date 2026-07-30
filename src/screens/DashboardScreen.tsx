import React, { useEffect, useState, useCallback } from 'react';
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
import { accountsRepo, transactionsRepo, budgetsRepo, loansRepo } from '@/lib/repository';
import { formatCurrency, formatDate, formatDateShort, getCurrentMonth } from '@/lib/formatters';
import { Account, Transaction, Loan } from '@/types';
import { Card, LoadingSpinner, EmptyState } from '@/components/ui';
import { colors } from '@/components/theme';
import { Ionicons } from '@expo/vector-icons';

interface DashboardStats {
  balance: number;
  income: number;
  expenses: number;
  savings: number;
  budgetTotal: number;
  budgetSpent: number;
  savingsRate: number;
  tithe: number;
  offerings: number;
  availableIncome: number;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const [stats, setStats] = useState<DashboardStats>({
    balance: 0,
    income: 0,
    expenses: 0,
    savings: 0,
    budgetTotal: 0,
    budgetSpent: 0,
    savingsRate: 0,
    tithe: 0,
    offerings: 0,
    availableIncome: 0,
  });
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { month, year } = getCurrentMonth();

  const loadData = useCallback(async () => {
    if (!user) return;
    const [accounts, txs, budgets, loansData] = await Promise.all([
      accountsRepo(user.uid).getAll(),
      transactionsRepo(user.uid).getAll(),
      budgetsRepo(user.uid).getAll(),
      loansRepo(user.uid).getAll(),
    ]);

    const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
    const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];

    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
    const monthTxs = txs.filter((t) => t.date >= startOfMonth && t.date <= endOfMonth);
    const income = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const budgetTotal = budgets
      .filter((b) => b.month === month && b.year === year)
      .reduce((s, b) => s + b.amount, 0);
    const savings = income - expenses;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;

    const tithe = income * 0.1;
    const offerings = income * 0.1;
    const availableIncome = income - tithe - offerings;

    setStats({ balance: totalBalance, income, expenses, savings, budgetTotal, budgetSpent: expenses, savingsRate, tithe, offerings, availableIncome });
    setRecentTx(
      [...txs].sort((a, b) => (b.date + b.created_at).localeCompare(a.date + a.created_at)).slice(0, 8),
    );
    setLoans(loansData);
    setLoading(false);
  }, [user, month, year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (loading) return <LoadingSpinner />;

  const metrics = [
    { label: 'Solde actuel', value: formatCurrency(stats.balance, currency), icon: 'wallet' as const, color: colors.primary },
    { label: 'Revenus du mois', value: formatCurrency(stats.income, currency), icon: 'trending-up' as const, color: colors.blue },
    { label: 'Dépenses du mois', value: formatCurrency(stats.expenses, currency), icon: 'trending-down' as const, color: colors.red },
    { label: 'Épargne du mois', value: formatCurrency(stats.savings, currency), icon: 'save' as const, color: stats.savings >= 0 ? colors.green : colors.red },
    { label: 'Budget restant', value: formatCurrency(Math.max(0, stats.budgetTotal - stats.budgetSpent), currency), icon: 'bar-chart' as const, color: colors.amber },
    { label: "Taux d'épargne", value: `${stats.savingsRate.toFixed(1)}%`, icon: 'stats-chart' as const, color: colors.purple },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.greeting}>Bonjour</Text>
      <Text style={styles.title}>Tableau de bord</Text>

      <View style={styles.metricsGrid}>
        {metrics.map((m, i) => (
          <Card key={i} style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>{m.label}</Text>
              <View style={[styles.metricIcon, { backgroundColor: m.color + '20' }]}>
                <Ionicons name={m.icon} size={16} color={m.color} />
              </View>
            </View>
            <Text style={[styles.metricValue, { color: m.color }]}>{m.value}</Text>
          </Card>
        ))}
      </View>

      {(() => {
        const activeLoans = loans.filter((l) => l.status !== 'repaid' && l.status !== 'cancelled');
        const totalOutstanding = activeLoans.reduce((s, l) => s + l.remaining_amount, 0);
        const overdueCount = activeLoans.filter((l) => new Date(l.expected_repayment_date) < new Date()).length;
        if (activeLoans.length === 0) return null;
        return (
          <Card style={styles.loansSummaryCard}>
            <View style={styles.loansSummaryHeader}>
              <Ionicons name="cash" size={20} color={colors.orange} />
              <Text style={styles.loansSummaryTitle}>Prêts en cours</Text>
            </View>
            <View style={styles.loansSummaryRow}>
              <Text style={styles.loansSummaryLabel}>{activeLoans.length} prêt{activeLoans.length > 1 ? 's' : ''}</Text>
              <Text style={styles.loansSummaryValue}>{formatCurrency(totalOutstanding, currency)}</Text>
            </View>
            {overdueCount > 0 && (
              <View style={styles.loansSummaryRow}>
                <Text style={[styles.loansSummaryLabel, { color: colors.red }]}>Dont {overdueCount} en retard</Text>
                <Ionicons name="alert-circle" size={16} color={colors.red} />
              </View>
            )}
          </Card>
        );
      })()}

      {stats.income > 0 && (
        <Card style={styles.religionCard}>
          <View style={styles.religionHeader}>
            <Ionicons name="church" size={20} color={colors.primary} />
            <Text style={styles.religionTitle}>Contributions religieuses</Text>
          </View>
          <View style={styles.religionRow}>
            <Text style={styles.religionLabel}>Dîme (10%)</Text>
            <Text style={styles.religionValue}>{formatCurrency(stats.tithe, currency)}</Text>
          </View>
          <View style={styles.religionRow}>
            <Text style={styles.religionLabel}>Offrandes (10%)</Text>
            <Text style={styles.religionValue}>{formatCurrency(stats.offerings, currency)}</Text>
          </View>
          <View style={styles.religionDivider} />
          <View style={styles.religionRow}>
            <Text style={styles.religionLabelBold}>Solde réellement disponible</Text>
            <Text style={styles.religionValueBold}>{formatCurrency(stats.availableIncome, currency)}</Text>
          </View>
        </Card>
      )}

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Dernières opérations</Text>
        {recentTx.length === 0 ? (
          <EmptyState message="Aucune transaction" />
        ) : (
          recentTx.map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={[styles.txIcon, { backgroundColor: colors.border + '40' }]}>
                <Text style={styles.txIconText}>{tx.label.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txLabel} numberOfLines={1}>{tx.label}</Text>
                <Text style={styles.txDate}>{formatDate(tx.date)}</Text>
              </View>
              <Text style={[styles.txAmount, tx.type === 'income' ? { color: colors.blue } : { color: colors.red }]}>
                {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, currency)}
              </Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 80,
  },
  greeting: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '47%',
    flexGrow: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
    flex: 1,
    flexWrap: 'wrap',
  },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  txInfo: {
    flex: 1,
    marginLeft: 12,
  },
  txLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  txDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  loansSummaryCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.orange + '30',
  },
  loansSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  loansSummaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  loansSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  loansSummaryLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  loansSummaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.orange,
  },
  religionCard: {
    marginTop: 16,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  religionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  religionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  religionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  religionLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  religionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  religionDivider: {
    height: 1,
    backgroundColor: colors.primary + '30',
    marginVertical: 6,
  },
  religionLabelBold: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  religionValueBold: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
  },
});
