import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  FlatList,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { transactionsRepo, accountsRepo, categoriesRepo } from '@/lib/repository';
import { formatCurrency, formatDate, toInputDate } from '@/lib/formatters';
import { Transaction, Account, Category } from '@/types';
import {
  Card,
  Input,
  Dropdown,
  Modal,
  Button,
  Badge,
  EmptyState,
  LoadingSpinner,
} from '@/components/ui';
import { colors } from '@/components/theme';
import { Ionicons } from '@expo/vector-icons';

export default function TransactionsScreen() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    label: '',
    type: 'expense' as 'income' | 'expense',
    amount: '',
    account_id: '',
    category_id: '',
    notes: '',
  });

  const loadAll = useCallback(async () => {
    if (!user) return;
    const [txs, accs, cats] = await Promise.all([
      transactionsRepo(user.uid).getAll(),
      accountsRepo(user.uid).getAll(),
      categoriesRepo(user.uid).getAll(),
    ]);
    setTransactions(txs);
    setAccounts(accs);
    setCategories(cats);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const openNew = () => {
    setEditingTx(null);
    setForm({
      date: new Date().toISOString().split('T')[0],
      label: '',
      type: 'expense',
      amount: '',
      account_id: '',
      category_id: '',
      notes: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setForm({
      date: toInputDate(tx.date),
      label: tx.label,
      type: tx.type,
      amount: String(tx.amount),
      account_id: tx.account_id || '',
      category_id: tx.category_id || '',
      notes: tx.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !form.label || !form.amount) return;
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) return;

    const payload = {
      date: form.date,
      label: form.label,
      type: form.type,
      amount,
      account_id: form.account_id || null,
      category_id: form.category_id || null,
      notes: form.notes || null,
      attachment_url: null,
      balance_after: null,
      updated_at: new Date().toISOString(),
    };

    if (editingTx) {
      await transactionsRepo(user.uid).update(editingTx.id, payload);
    } else {
      await transactionsRepo(user.uid).create({
        ...payload,
        created_at: new Date().toISOString(),
      } as any);
    }

    await recalcAccountBalance(form.account_id || null);
    if (editingTx && editingTx.account_id !== (form.account_id || null)) {
      await recalcAccountBalance(editingTx.account_id);
    }

    setDialogOpen(false);
    await loadAll();
  };

  const recalcAccountBalance = async (accountId: string | null) => {
    if (!user || !accountId) return;
    const txs = await transactionsRepo(user.uid).getAll();
    const balance = txs
      .filter((t) => t.account_id === accountId)
      .reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
    await accountsRepo(user.uid).update(accountId, { balance });
  };

  const handleDelete = (tx: Transaction) => {
    Alert.alert('Supprimer la transaction ?', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          await transactionsRepo(user.uid).delete(tx.id);
          await recalcAccountBalance(tx.account_id);
          await loadAll();
        },
      },
    ]);
  };

  const filtered = transactions
    .filter((tx) => {
      if (search) {
        const q = search.toLowerCase();
        if (!tx.label.toLowerCase().includes(q) && !String(tx.amount).includes(q)) return false;
      }
      if (filterType !== 'all' && tx.type !== filterType) return false;
      return true;
    })
    .sort((a, b) => (b.date + b.created_at).localeCompare(a.date + a.created_at));

  const filteredCategories = categories.filter((c) => c.type === form.type);

  if (loading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Transactions</Text>
          <Text style={styles.subtitle}>{transactions.length} opérations</Text>
        </View>
        <TouchableOpacity style={styles.fab} onPress={openNew}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher..."
          keyboardType="default"
        />
        <View style={styles.typeFilters}>
          {[
            { label: 'Tous', value: 'all' },
            { label: 'Entrées', value: 'income' },
            { label: 'Dépenses', value: 'expense' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setFilterType(opt.value)}
              style={[styles.typeBtn, filterType === opt.value && styles.typeBtnActive]}
            >
              <Text style={[styles.typeBtnText, filterType === opt.value && styles.typeBtnTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 80 }}
        ListEmptyComponent={<EmptyState message="Aucune transaction. Ajoutez-en une !" />}
        renderItem={({ item }) => {
          const cat = categories.find((c) => c.id === item.category_id);
          return (
            <TouchableOpacity
              style={styles.txCard}
              onLongPress={() => handleDelete(item)}
              onPress={() => openEdit(item)}
            >
              <View style={[styles.txIcon, { backgroundColor: (cat?.color || colors.gray) + '20' }]}>
                <Text style={[styles.txIconText, { color: cat?.color || colors.gray }]}>
                  {item.label.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txLabel} numberOfLines={1}>{item.label}</Text>
                <View style={styles.txMeta}>
                  {cat && (
                    <View style={[styles.catBadge, { backgroundColor: cat.color + '20' }]}>
                      <Text style={[styles.catText, { color: cat.color }]}>{cat.name}</Text>
                    </View>
                  )}
                  <Text style={styles.txDate}>{formatDate(item.date)}</Text>
                </View>
              </View>
              <Text style={[styles.txAmount, item.type === 'income' ? { color: colors.blue } : { color: colors.red }]}>
                {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount, currency)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={dialogOpen} onClose={() => setDialogOpen(false)} title={editingTx ? 'Modifier' : 'Nouvelle transaction'}>
        <ScrollView>
          <View style={styles.formRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Input label="Date" value={form.date} onChangeText={(v) => setForm({ ...form, date: v })} placeholder="YYYY-MM-DD" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.typeRow}>
                {[
                  { label: 'Dépense', value: 'expense' },
                  { label: 'Entrée', value: 'income' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setForm({ ...form, type: opt.value as any, category_id: '' })}
                    style={[styles.typeBtn, form.type === opt.value && styles.typeBtnActive]}
                  >
                    <Text style={[styles.typeBtnText, form.type === opt.value && styles.typeBtnTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <Input label="Motif" value={form.label} onChangeText={(v) => setForm({ ...form, label: v })} placeholder="Description" />
          <Input
            label="Montant"
            value={form.amount}
            onChangeText={(v) => setForm({ ...form, amount: v })}
            placeholder="0"
            keyboardType="numeric"
          />

          <Dropdown
            label="Compte"
            value={form.account_id}
            onValueChange={(v) => setForm({ ...form, account_id: v })}
            options={accounts.map((a) => ({ label: a.name, value: a.id }))}
            placeholder="Sélectionner un compte"
          />

          <Dropdown
            label="Catégorie"
            value={form.category_id}
            onValueChange={(v) => setForm({ ...form, category_id: v })}
            options={filteredCategories.map((c) => ({ label: c.name, value: c.id }))}
            placeholder="Sélectionner une catégorie"
          />

          <Input
            label="Notes"
            value={form.notes}
            onChangeText={(v) => setForm({ ...form, notes: v })}
            placeholder="Notes optionnelles"
            multiline
            numberOfLines={2}
          />

          <View style={styles.formActions}>
            <Button title="Annuler" variant="outline" onPress={() => setDialogOpen(false)} style={{ flex: 1, marginRight: 8 }} />
            <Button title={editingTx ? 'Enregistrer' : 'Ajouter'} onPress={handleSubmit} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filters: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  typeFilters: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.input,
  },
  typeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  typeBtnText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  typeBtnTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconText: {
    fontSize: 16,
    fontWeight: '700',
  },
  txInfo: {
    flex: 1,
    marginLeft: 12,
  },
  txLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  txMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  catBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  catText: {
    fontSize: 11,
    fontWeight: '600',
  },
  txDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  formRow: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  formActions: {
    flexDirection: 'row',
    marginTop: 16,
  },
});
