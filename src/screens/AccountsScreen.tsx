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
import { accountsRepo } from '@/lib/repository';
import { formatCurrency } from '@/lib/formatters';
import { Account } from '@/types';
import { Card, Input, Dropdown, Modal, Button, EmptyState, LoadingSpinner } from '@/components/ui';
import { colors } from '@/components/theme';
import { Ionicons } from '@expo/vector-icons';

const ACCOUNT_TYPES = [
  { label: 'Banque', value: 'bank' },
  { label: 'Espèces', value: 'cash' },
  { label: 'Mobile Money', value: 'mobile' },
  { label: 'Épargne', value: 'savings' },
];

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];

export default function AccountsScreen() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({ name: '', type: 'bank', color: '#10b981', balance: '' });

  const load = useCallback(async () => {
    if (!user) return;
    const accs = await accountsRepo(user.uid).getAll();
    setAccounts(accs.sort((a, b) => a.name.localeCompare(b.name)));
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
    setForm({ name: '', type: 'bank', color: '#10b981', balance: '0' });
    setDialogOpen(true);
  };

  const openEdit = (acc: Account) => {
    setEditing(acc);
    setForm({ name: acc.name, type: acc.type, color: acc.color, balance: String(acc.balance) });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !form.name) return;
    const payload = {
      name: form.name,
      type: form.type,
      color: form.color,
      icon: 'wallet',
      balance: parseFloat(form.balance) || 0,
      is_default: false,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await accountsRepo(user.uid).update(editing.id, payload);
    } else {
      await accountsRepo(user.uid).create({
        ...payload,
        created_at: new Date().toISOString(),
      } as any);
    }
    setDialogOpen(false);
    await load();
  };

  const handleDelete = (acc: Account) => {
    Alert.alert('Supprimer le compte ?', `Supprimer "${acc.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          await accountsRepo(user.uid).delete(acc.id);
          await load();
        },
      },
    ]);
  };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  if (loading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Comptes</Text>
          <Text style={styles.subtitle}>Total: {formatCurrency(totalBalance, currency)}</Text>
        </View>
        <TouchableOpacity style={styles.fab} onPress={openNew}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
        ListEmptyComponent={<EmptyState message="Aucun compte. Ajoutez-en un !" />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.accountCard} onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
            <View style={[styles.accountIcon, { backgroundColor: item.color + '20' }]}>
              <Ionicons name="wallet" size={20} color={item.color} />
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>{item.name}</Text>
              <Text style={styles.accountType}>
                {ACCOUNT_TYPES.find((t) => t.value === item.type)?.label || item.type}
              </Text>
            </View>
            <Text style={[styles.accountBalance, { color: item.balance >= 0 ? colors.text : colors.red }]}>
              {formatCurrency(item.balance, currency)}
            </Text>
          </TouchableOpacity>
        )}
      />

      <Modal visible={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Modifier le compte' : 'Nouveau compte'}>
        <Input label="Nom" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Nom du compte" />
        <Dropdown
          label="Type"
          value={form.type}
          onValueChange={(v) => setForm({ ...form, type: v })}
          options={ACCOUNT_TYPES}
        />
        <Input
          label="Solde initial"
          value={form.balance}
          onChangeText={(v) => setForm({ ...form, balance: v })}
          placeholder="0"
          keyboardType="numeric"
        />
        <Text style={styles.label}>Couleur</Text>
        <View style={styles.colorRow}>
          {COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setForm({ ...form, color: c })}
              style={[styles.colorDot, { backgroundColor: c }, form.color === c && styles.colorDotActive]}
            />
          ))}
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  fab: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  accountInfo: { flex: 1, marginLeft: 12 },
  accountName: { fontSize: 16, fontWeight: '600', color: colors.text },
  accountType: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  accountBalance: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8, marginTop: 4 },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotActive: { borderWidth: 3, borderColor: colors.text },
  formActions: { flexDirection: 'row', marginTop: 8 },
});
