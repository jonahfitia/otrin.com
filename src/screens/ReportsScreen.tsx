import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { transactionsRepo, categoriesRepo } from '@/lib/repository';
import { formatCurrency, getCurrentMonth } from '@/lib/formatters';
import { Transaction, Category } from '@/types';
import { Card, LoadingSpinner, EmptyState, ProgressBar } from '@/components/ui';
import { colors } from '@/components/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function ReportsScreen() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { month, year } = getCurrentMonth();

  const load = useCallback(async () => {
    if (!user) return;
    const [txs, cats] = await Promise.all([
      transactionsRepo(user.uid).getAll(),
      categoriesRepo(user.uid).getAll(),
    ]);
    setTransactions(txs);
    setCategories(cats);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) return <LoadingSpinner />;

  const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
  const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];
  const monthTxs = transactions.filter((t) => t.date >= startOfMonth && t.date <= endOfMonth);

  const income = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // Category breakdown
  const byCategory: Record<string, { value: number; color: string }> = {};
  monthTxs
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const cat = categories.find((c) => c.id === t.category_id);
      const name = cat?.name || 'Divers';
      const color = cat?.color || colors.gray;
      if (!byCategory[name]) byCategory[name] = { value: 0, color };
      byCategory[name].value += t.amount;
    });

  const categoryData = Object.entries(byCategory)
    .map(([name, { value, color }]) => ({ name, value, color }))
    .sort((a, b) => b.value - a.value);

  // 6-month trend
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }
  const trendData = months.map(({ month, year }) => {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = new Date(year, month, 0).toISOString().split('T')[0];
    const txs = transactions.filter((t) => t.date >= start && t.date <= end);
    const inc = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { month: new Date(year, month - 1).toLocaleDateString('fr-FR', { month: 'short' }), income: inc, expenses: exp };
  });

  const maxVal = Math.max(...trendData.map((d) => Math.max(d.income, d.expenses)), 1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 80 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Rapports</Text>
        <Text style={styles.subtitle}>Analyse de vos finances</Text>
      </View>

      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Revenus du mois</Text>
          <Text style={[styles.summaryValue, { color: colors.blue }]}>{formatCurrency(income, currency)}</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Dépenses du mois</Text>
          <Text style={[styles.summaryValue, { color: colors.red }]}>{formatCurrency(expenses, currency)}</Text>
        </Card>
      </View>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Tendance sur 6 mois</Text>
        {trendData.length > 0 ? (
          <View style={styles.chartContainer}>
            {trendData.map((d, i) => (
              <View key={i} style={styles.barGroup}>
                <View style={styles.bars}>
                  <View
                    style={[styles.bar, { height: (d.income / maxVal) * 120, backgroundColor: colors.blue }]}
                  />
                  <View
                    style={[styles.bar, { height: (d.expenses / maxVal) * 120, backgroundColor: colors.red }]}
                  />
                </View>
                <Text style={styles.barLabel}>{d.month}</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState message="Pas assez de données" />
        )}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.blue }]} />
            <Text style={styles.legendText}>Revenus</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.red }]} />
            <Text style={styles.legendText}>Dépenses</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Dépenses par catégorie</Text>
        {categoryData.length === 0 ? (
          <EmptyState message="Aucune dépense ce mois" />
        ) : (
          categoryData.map((cat, i) => (
            <View key={i} style={styles.catRow}>
              <View style={styles.catRowHeader}>
                <View style={styles.catRowLeft}>
                  <View style={[styles.catDot, { backgroundColor: cat.color + '20' }]}>
                    <Text style={{ color: cat.color, fontSize: 10, fontWeight: '700' }}>{cat.name.charAt(0)}</Text>
                  </View>
                  <Text style={styles.catName}>{cat.name}</Text>
                </View>
                <Text style={styles.catValue}>{formatCurrency(cat.value, currency)}</Text>
              </View>
              <ProgressBar
                progress={expenses > 0 ? (cat.value / expenses) * 100 : 0}
                color={cat.color}
              />
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 16 },
  summaryCard: { flex: 1 },
  summaryLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  summaryValue: { fontSize: 18, fontWeight: '700', marginTop: 6 },
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 16 },
  chartContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 140 },
  barGroup: { alignItems: 'center', flex: 1 },
  bars: { flexDirection: 'row', gap: 4, alignItems: 'flex-end', height: 120 },
  bar: { width: 12, borderRadius: 4, minHeight: 2 },
  barLabel: { fontSize: 10, color: colors.textMuted, marginTop: 4 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.textMuted },
  catRow: { marginBottom: 12 },
  catRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  catRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catDot: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  catName: { fontSize: 14, fontWeight: '500', color: colors.text },
  catValue: { fontSize: 14, fontWeight: '600', color: colors.text },
});
