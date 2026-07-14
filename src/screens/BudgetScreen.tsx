import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { budgetsRepo, categoriesRepo, transactionsRepo } from '@/lib/repository';
import { formatCurrency, formatMonthYear, getCurrentMonth } from '@/lib/formatters';
import { Budget, Category, Transaction } from '@/types';
import { Card, Dropdown, Modal, Button, Input, ProgressBar, EmptyState, LoadingSpinner } from '@/components/ui';
import { colors } from '@/components/theme';
import { Ionicons } from '@expo/vector-icons';

export default function BudgetScreen() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const [budgets, setBudgets] = useState<(Budget & { spent?: number; category?: Category })[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [form, setForm] = useState({ category_id: '', amount: '' });

  const { month, year } = getCurrentMonth();

  const load = useCallback(async () => {
    if (!user) return;
    const [buds, cats, txs] = await Promise.all([
      budgetsRepo(user.uid).getAll(),
      categoriesRepo(user.uid).getAll(),
      transactionsRepo(user.uid).getAll(),
    ]);
    const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
    const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];
    const monthTxs = txs.filter((t) => t.type === 'expense' && t.date >= startOfMonth && t.date <= endOfMonth);

    const enriched = buds
      .filter((b) => b.month === month && b.year === year)
      .map((b) => {
        const cat = cats.find((c) => c.id === b.category_id);
        const spent = monthTxs
          .filter((t) => t.category_id === b.category_id)
          .reduce((s, t) => s + t.amount, 0);
        return { ...b, spent, category: cat };
      });
    setBudgets(enriched);
    setCategories(cats.filter((c) => c.type === 'expense'));
    setTransactions(txs);
    setLoading(false);
  }, [user, month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ category_id: '', amount: '' });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !form.category_id || !form.amount) return;
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) return;
    const payload = { category_id: form.category_id, month, year, amount, updated_at: new Date().toISOString() };
    if (editing) {
      await budgetsRepo(user.uid).update(editing.id, payload);
    } else {
      await budgetsRepo(user.uid).create({ ...payload, created_at: new Date().toISOString() } as any);
    }
    setDialogOpen(false);
    await load();
  };

  const handleDelete = (bud: Budget) => {
    Alert.alert('Supprimer le budget ?', '', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          await budgetsRepo(user.uid).delete(bud.id);
          await load();
        },
      },
    ]);
  };

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + (b.spent || 0), 0);

  if (loading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Budget</Text>
          <Text style={styles.subtitle}>{formatMonthYear(month, year)}</Text>
        </View>
        <TouchableOpacity style={styles.fab} onPress={openNew}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Total budget</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalBudget, currency)}</Text>
          </View>
          <View style={styles.summaryRight}>
            <Text style={styles.summaryLabel}>Dépensé</Text>
            <Text style={[styles.summaryValue, { color: totalSpent > totalBudget ? colors.red : colors.amber }]}>
              {formatCurrency(totalSpent, currency)}
            </Text>
          </View>
        </View>
        <ProgressBar progress={totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0} color={totalSpent > totalBudget ? colors.red : colors.primary} />
      </Card>

      <FlatList
        data={budgets}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
        ListEmptyComponent={<EmptyState message="Aucun budget ce mois" />}
        renderItem={({ item }) => {
          const pct = item.amount > 0 ? ((item.spent || 0) / item.amount) * 100 : 0;
          return (
            <TouchableOpacity style={styles.budgetCard} onLongPress={() => handleDelete(item)}>
              <View style={styles.budgetHeader}>
                <View style={[styles.catDot, { backgroundColor: (item.category?.color || colors.gray) + '20' }]}>
                  <Text style={{ color: item.category?.color || colors.gray, fontSize: 12, fontWeight: '700' }}>
                    {(item.category?.name || '?').charAt(0)}
                  </Text>
                </View>
                <Text style={styles.budgetName}>{item.category?.name || 'Sans catégorie'}</Text>
                <Text style={[styles.budgetAmount, { color: pct > 100 ? colors.red : colors.text }]}>
                  {formatCurrency(item.spent || 0, currency)} / {formatCurrency(item.amount, currency)}
                </Text>
              </View>
              <ProgressBar progress={pct} color={pct > 100 ? colors.red : pct > 80 ? colors.amber : colors.primary} />
              <Text style={styles.budgetPct}>{pct.toFixed(0)}% utilisé</Text>
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Modifier le budget' : 'Nouveau budget'}>
        <Dropdown
          label="Catégorie"
          value={form.category_id}
          onValueChange={(v) => setForm({ ...form, category_id: v })}
          options={categories.map((c) => ({ label: c.name, value: c.id }))}
          placeholder="Sélectionner"
        />
        <Input
          label="Montant du budget"
          value={form.amount}
          onChangeText={(v) => setForm({ ...form, amount: v })}
          placeholder="0"
          keyboardType="numeric"
        />
        <View style={styles.formActions}>
          <Button title="Annuler" variant="outline" onPress={() => setDialogOpen(false)} style={{ flex: 1, marginRight: 8 }} />
          <Button title={editing ? 'Enregistrer' : 'Ajouter'} onPress={handleSubmit} style={{ flex: 1 }} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  fab: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { marginHorizontal: 16, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  summaryValue: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 4 },
  summaryRight: { alignItems: 'flex-end' },
  budgetCard: {
    padding: 14, marginBottom: 8, backgroundColor: colors.card,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
  gap: 8,
  },
  budgetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catDot: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  budgetName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  budgetAmount: { fontSize: 13, fontWeight: '600' },
  budgetPct: { fontSize: 12, color: colors.textMuted },
  formActions: { flexDirection: 'row', marginTop: 8 },
});
