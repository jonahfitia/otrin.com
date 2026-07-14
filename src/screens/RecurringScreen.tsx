import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { recurringRepo, accountsRepo, categoriesRepo } from '@/lib/repository';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { RecurringTransaction, Account, Category, Frequency } from '@/types';
import { Card, Input, Modal, Button, Dropdown, EmptyState, LoadingSpinner, Badge } from '@/components/ui';
import { colors } from '@/components/theme';
import { Ionicons } from '@expo/vector-icons';

const FREQUENCIES: { label: string; value: Frequency }[] = [
  { label: 'Quotidien', value: 'daily' },
  { label: 'Hebdomadaire', value: 'weekly' },
  { label: 'Mensuel', value: 'monthly' },
  { label: 'Annuel', value: 'yearly' },
];

export default function RecurringScreen() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const [form, setForm] = useState({
    label: '',
    type: 'expense' as 'income' | 'expense',
    amount: '',
    frequency: 'monthly' as Frequency,
    account_id: '',
    category_id: '',
    day_of_month: '',
    next_date: '',
  });

  const load = useCallback(async () => {
    if (!user) return;
    const [rec, accs, cats] = await Promise.all([
      recurringRepo(user.uid).getAll(),
      accountsRepo(user.uid).getAll(),
      categoriesRepo(user.uid).getAll(),
    ]);
    setRecurring(rec);
    setAccounts(accs);
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

  const openNew = () => {
    setEditing(null);
    setForm({
      label: '', type: 'expense', amount: '', frequency: 'monthly',
      account_id: '', category_id: '', day_of_month: '1', next_date: '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !form.label || !form.amount) return;
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) return;
    const payload = {
      label: form.label,
      type: form.type,
      amount,
      amount_percent: null,
      frequency: form.frequency,
      day_of_month: form.day_of_month ? parseInt(form.day_of_month) : null,
      next_date: form.next_date || null,
      account_id: form.account_id || null,
      category_id: form.category_id || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await recurringRepo(user.uid).update(editing.id, payload);
    } else {
      await recurringRepo(user.uid).create({ ...payload, created_at: new Date().toISOString() } as any);
    }
    setDialogOpen(false);
    await load();
  };

  const handleDelete = (rec: RecurringTransaction) => {
    Alert.alert('Supprimer ?', `Supprimer "${rec.label}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          await recurringRepo(user.uid).delete(rec.id);
          await load();
        },
      },
    ]);
  };

  const toggleActive = async (rec: RecurringTransaction) => {
    if (!user) return;
    await recurringRepo(user.uid).update(rec.id, { is_active: !rec.is_active });
    await load();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Récurrentes</Text>
          <Text style={styles.subtitle}>Transactions automatiques</Text>
        </View>
        <TouchableOpacity style={styles.fab} onPress={openNew}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={recurring}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
        ListEmptyComponent={<EmptyState message="Aucune transaction récurrente" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.recCard}
            onLongPress={() => handleDelete(item)}
            onPress={() => toggleActive(item)}
          >
            <View style={[styles.recIcon, { backgroundColor: (item.type === 'income' ? colors.blue : colors.red) + '20' }]}>
              <Ionicons name={item.type === 'income' ? 'trending-up' : 'trending-down'} size={18} color={item.type === 'income' ? colors.blue : colors.red} />
            </View>
            <View style={styles.recInfo}>
              <Text style={styles.recLabel}>{item.label}</Text>
              <Text style={styles.recMeta}>
                {FREQUENCIES.find((f) => f.value === item.frequency)?.label}
                {item.next_date ? ` · ${formatDate(item.next_date)}` : ''}
              </Text>
            </View>
            <View style={styles.recRight}>
              <Text style={[styles.recAmount, { color: item.type === 'income' ? colors.blue : colors.red }]}>
                {formatCurrency(item.amount || 0, currency)}
              </Text>
              <Badge
                label={item.is_active ? 'Actif' : 'Inactif'}
                color={item.is_active ? colors.green : colors.gray}
                bg={item.is_active ? colors.green + '20' : colors.gray + '20'}
              />
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Modifier' : 'Nouvelle récurrente'}>
        <ScrollView>
          <Input label="Motif" value={form.label} onChangeText={(v) => setForm({ ...form, label: v })} placeholder="Description" />
          <View style={styles.typeRow}>
            {[
              { label: 'Dépense', value: 'expense' },
              { label: 'Entrée', value: 'income' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setForm({ ...form, type: opt.value as any })}
                style={[styles.typeBtn, form.type === opt.value && styles.typeBtnActive]}
              >
                <Text style={[styles.typeBtnText, form.type === opt.value && styles.typeBtnTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Input label="Montant" value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v })} placeholder="0" keyboardType="numeric" />
          <Dropdown label="Fréquence" value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as Frequency })} options={FREQUENCIES} />
          <Input label="Jour du mois" value={form.day_of_month} onChangeText={(v) => setForm({ ...form, day_of_month: v })} placeholder="1" keyboardType="numeric" />
          <Input label="Prochaine date" value={form.next_date} onChangeText={(v) => setForm({ ...form, next_date: v })} placeholder="YYYY-MM-DD" />
          <Dropdown label="Compte" value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })} options={accounts.map((a) => ({ label: a.name, value: a.id }))} placeholder="Sélectionner" />
          <Dropdown label="Catégorie" value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })} options={categories.filter((c) => c.type === form.type).map((c) => ({ label: c.name, value: c.id }))} placeholder="Sélectionner" />
          <View style={styles.formActions}>
            <Button title="Annuler" variant="outline" onPress={() => setDialogOpen(false)} style={{ flex: 1, marginRight: 8 }} />
            <Button title={editing ? 'Enregistrer' : 'Ajouter'} onPress={handleSubmit} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

import { ScrollView } from 'react-native';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  fab: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  recCard: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 10 },
  recIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  recInfo: { flex: 1 },
  recLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  recMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  recRight: { alignItems: 'flex-end', gap: 4 },
  recAmount: { fontSize: 15, fontWeight: '700' },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  typeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.input },
  typeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  typeBtnText: { fontSize: 14, color: colors.text, fontWeight: '500' },
  typeBtnTextActive: { color: colors.primary, fontWeight: '700' },
  formActions: { flexDirection: 'row', marginTop: 8 },
});
