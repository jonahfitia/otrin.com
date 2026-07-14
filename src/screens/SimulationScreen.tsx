import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { simulationsRepo, simulationItemsRepo } from '@/lib/repository';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Simulation, SimulationItem } from '@/types';
import { Card, Input, Modal, Button, EmptyState, LoadingSpinner, Badge } from '@/components/ui';
import { colors } from '@/components/theme';
import { Ionicons } from '@expo/vector-icons';

export default function SimulationScreen() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const [simulations, setSimulations] = useState<(Simulation & { items?: SimulationItem[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [itemDialog, setItemDialog] = useState<Simulation | null>(null);
  const [editing, setEditing] = useState<Simulation | null>(null);
  const [form, setForm] = useState({ name: '', description: '', start_balance: '0' });
  const [itemForm, setItemForm] = useState({ date: new Date().toISOString().split('T')[0], label: '', type: 'expense' as 'income' | 'expense', amount: '' });

  const load = useCallback(async () => {
    if (!user) return;
    const sims = await simulationsRepo(user.uid).getAll();
    const items = await simulationItemsRepo(user.uid).getAll();
    setSimulations(sims.map((s) => ({ ...s, items: items.filter((i) => i.simulation_id === s.id) })));
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
    setForm({ name: '', description: '', start_balance: '0' });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !form.name) return;
    const payload = {
      name: form.name,
      description: form.description || null,
      start_balance: parseFloat(form.start_balance) || 0,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await simulationsRepo(user.uid).update(editing.id, payload);
    } else {
      await simulationsRepo(user.uid).create({ ...payload, created_at: new Date().toISOString() } as any);
    }
    setDialogOpen(false);
    await load();
  };

  const handleAddItem = async () => {
    if (!user || !itemDialog || !itemForm.label || !itemForm.amount) return;
    const amount = parseFloat(itemForm.amount);
    if (isNaN(amount) || amount <= 0) return;
    await simulationItemsRepo(user.uid).create({
      simulation_id: itemDialog.id,
      date: itemForm.date,
      label: itemForm.label,
      type: itemForm.type,
      amount,
      notes: null,
      created_at: new Date().toISOString(),
    } as any);
    setItemForm({ date: new Date().toISOString().split('T')[0], label: '', type: 'expense', amount: '' });
    await load();
  };

  const computeFinalBalance = (sim: Simulation & { items?: SimulationItem[] }) => {
    let balance = sim.start_balance;
    (sim.items || []).forEach((item) => {
      balance += item.type === 'income' ? item.amount : -item.amount;
    });
    return balance;
  };

  const handleDelete = (sim: Simulation) => {
    Alert.alert('Supprimer la simulation ?', `Supprimer "${sim.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          const items = await simulationItemsRepo(user.uid).getAll();
          for (const item of items.filter((i) => i.simulation_id === sim.id)) {
            await simulationItemsRepo(user.uid).delete(item.id);
          }
          await simulationsRepo(user.uid).delete(sim.id);
          await load();
        },
      },
    ]);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Simulations</Text>
          <Text style={styles.subtitle}>Scénarios hypothétiques</Text>
        </View>
        <TouchableOpacity style={styles.fab} onPress={openNew}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={simulations}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
        ListEmptyComponent={<EmptyState message="Aucune simulation. Créez-en une !" />}
        renderItem={({ item }) => {
          const finalBalance = computeFinalBalance(item);
          return (
            <Card style={styles.simCard}>
              <View style={styles.simHeader}>
                <View>
                  <Text style={styles.simName}>{item.name}</Text>
                  {item.description ? <Text style={styles.simDesc}>{item.description}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => handleDelete(item)}>
                  <Ionicons name="trash-outline" size={18} color={colors.red} />
                </TouchableOpacity>
              </View>
              <View style={styles.simBalances}>
                <View>
                  <Text style={styles.simBalanceLabel}>Solde initial</Text>
                  <Text style={styles.simBalanceValue}>{formatCurrency(item.start_balance, currency)}</Text>
                </View>
                <View style={styles.simBalanceRight}>
                  <Text style={styles.simBalanceLabel}>Solde final</Text>
                  <Text style={[styles.simBalanceValue, { color: finalBalance >= 0 ? colors.green : colors.red }]}>
                    {formatCurrency(finalBalance, currency)}
                  </Text>
                </View>
              </View>
              {item.items && item.items.length > 0 && (
                <View style={styles.itemsList}>
                  {item.items.map((it) => (
                    <View key={it.id} style={styles.itemRow}>
                      <Badge label={it.type === 'income' ? '+' : '-'} color={it.type === 'income' ? colors.blue : colors.red} bg={it.type === 'income' ? colors.blue + '20' : colors.red + '20'} />
                      <Text style={styles.itemLabel}>{it.label}</Text>
                      <Text style={styles.itemDate}>{formatDate(it.date)}</Text>
                      <Text style={[styles.itemAmount, { color: it.type === 'income' ? colors.blue : colors.red }]}>
                        {formatCurrency(it.amount, currency)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              <Button title="Ajouter un élément" variant="outline" size="sm" onPress={() => setItemDialog(item)} style={{ marginTop: 8 }} />
            </Card>
          );
        }}
      />

      <Modal visible={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Modifier' : 'Nouvelle simulation'}>
        <Input label="Nom" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Nom du scénario" />
        <Input label="Description" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder="Description" multiline numberOfLines={2} />
        <Input label="Solde initial" value={form.start_balance} onChangeText={(v) => setForm({ ...form, start_balance: v })} placeholder="0" keyboardType="numeric" />
        <View style={styles.formActions}>
          <Button title="Annuler" variant="outline" onPress={() => setDialogOpen(false)} style={{ flex: 1, marginRight: 8 }} />
          <Button title={editing ? 'Enregistrer' : 'Créer'} onPress={handleSubmit} style={{ flex: 1 }} />
        </View>
      </Modal>

      <Modal visible={!!itemDialog} onClose={() => setItemDialog(null)} title="Ajouter un élément">
        <Input label="Date" value={itemForm.date} onChangeText={(v) => setItemForm({ ...itemForm, date: v })} placeholder="YYYY-MM-DD" />
        <Input label="Motif" value={itemForm.label} onChangeText={(v) => setItemForm({ ...itemForm, label: v })} placeholder="Description" />
        <View style={styles.typeRow}>
          {[
            { label: 'Dépense', value: 'expense' },
            { label: 'Entrée', value: 'income' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setItemForm({ ...itemForm, type: opt.value as any })}
              style={[styles.typeBtn, itemForm.type === opt.value && styles.typeBtnActive]}
            >
              <Text style={[styles.typeBtnText, itemForm.type === opt.value && styles.typeBtnTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Input label="Montant" value={itemForm.amount} onChangeText={(v) => setItemForm({ ...itemForm, amount: v })} placeholder="0" keyboardType="numeric" />
        <View style={styles.formActions}>
          <Button title="Annuler" variant="outline" onPress={() => setItemDialog(null)} style={{ flex: 1, marginRight: 8 }} />
          <Button title="Ajouter" onPress={handleAddItem} style={{ flex: 1 }} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  fab: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  simCard: { marginBottom: 12 },
  simHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  simName: { fontSize: 16, fontWeight: '700', color: colors.text },
  simDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  simBalances: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  simBalanceLabel: { fontSize: 12, color: colors.textMuted },
  simBalanceValue: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 4 },
  simBalanceRight: { alignItems: 'flex-end' },
  itemsList: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  itemLabel: { flex: 1, fontSize: 13, color: colors.text, fontWeight: '500' },
  itemDate: { fontSize: 11, color: colors.textMuted },
  itemAmount: { fontSize: 13, fontWeight: '600' },
  formActions: { flexDirection: 'row', marginTop: 8 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  typeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.input },
  typeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  typeBtnText: { fontSize: 14, color: colors.text, fontWeight: '500' },
  typeBtnTextActive: { color: colors.primary, fontWeight: '700' },
});
