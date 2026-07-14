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
import { goalsRepo, goalContributionsRepo } from '@/lib/repository';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Goal } from '@/types';
import { Card, Input, Modal, Button, Dropdown, ProgressBar, EmptyState, LoadingSpinner } from '@/components/ui';
import { colors } from '@/components/theme';
import { Ionicons } from '@expo/vector-icons';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];

export default function GoalsScreen() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contribOpen, setContribOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [contribGoal, setContribGoal] = useState<Goal | null>(null);
  const [form, setForm] = useState({ name: '', target_amount: '', deadline: '', color: '#10b981' });
  const [contribAmount, setContribAmount] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const g = await goalsRepo(user.uid).getAll();
    setGoals(g);
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
    setForm({ name: '', target_amount: '', deadline: '', color: '#10b981' });
    setDialogOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setEditing(goal);
    setForm({
      name: goal.name,
      target_amount: String(goal.target_amount),
      deadline: goal.deadline || '',
      color: goal.color,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !form.name || !form.target_amount) return;
    const target = parseFloat(form.target_amount);
    if (isNaN(target) || target <= 0) return;
    const payload = {
      name: form.name,
      target_amount: target,
      deadline: form.deadline || null,
      color: form.color,
      icon: 'target',
      is_completed: false,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await goalsRepo(user.uid).update(editing.id, payload);
    } else {
      await goalsRepo(user.uid).create({
        ...payload,
        current_amount: 0,
        created_at: new Date().toISOString(),
      } as any);
    }
    setDialogOpen(false);
    await load();
  };

  const handleContrib = async () => {
    if (!user || !contribGoal || !contribAmount) return;
    const amount = parseFloat(contribAmount);
    if (isNaN(amount) || amount <= 0) return;
    await goalContributionsRepo(user.uid).create({
      goal_id: contribGoal.id,
      amount,
      date: new Date().toISOString().split('T')[0],
      notes: null,
      created_at: new Date().toISOString(),
    } as any);
    const newAmount = contribGoal.current_amount + amount;
    await goalsRepo(user.uid).update(contribGoal.id, {
      current_amount: newAmount,
      is_completed: newAmount >= contribGoal.target_amount,
    });
    setContribOpen(false);
    setContribAmount('');
    await load();
  };

  const handleDelete = (goal: Goal) => {
    Alert.alert('Supprimer l\'objectif ?', `Supprimer "${goal.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          await goalsRepo(user.uid).delete(goal.id);
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
          <Text style={styles.title}>Objectifs</Text>
          <Text style={styles.subtitle}>Vos objectifs d'épargne</Text>
        </View>
        <TouchableOpacity style={styles.fab} onPress={openNew}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={goals}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
        ListEmptyComponent={<EmptyState message="Aucun objectif. Créez-en un !" />}
        renderItem={({ item }) => {
          const pct = item.target_amount > 0 ? (item.current_amount / item.target_amount) * 100 : 0;
          return (
            <TouchableOpacity
              style={styles.goalCard}
              onPress={() => { setContribGoal(item); setContribOpen(true); }}
              onLongPress={() => handleDelete(item)}
            >
              <View style={styles.goalHeader}>
                <View style={[styles.goalIcon, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name="trophy" size={18} color={item.color} />
                </View>
                <View style={styles.goalInfo}>
                  <Text style={styles.goalName}>{item.name}</Text>
                  {item.deadline && <Text style={styles.goalDeadline}>Échéance: {formatDate(item.deadline)}</Text>}
                </View>
                {item.is_completed && (
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedText}>Atteint</Text>
                  </View>
                )}
              </View>
              <ProgressBar progress={pct} color={item.color} />
              <View style={styles.goalAmounts}>
                <Text style={styles.goalCurrent}>{formatCurrency(item.current_amount, currency)}</Text>
                <Text style={styles.goalTarget}>/ {formatCurrency(item.target_amount, currency)}</Text>
              </View>
              <Text style={styles.goalPct}>{pct.toFixed(0)}%</Text>
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Modifier l\'objectif' : 'Nouvel objectif'}>
        <Input label="Nom" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Nom de l'objectif" />
        <Input
          label="Montant cible"
          value={form.target_amount}
          onChangeText={(v) => setForm({ ...form, target_amount: v })}
          placeholder="0"
          keyboardType="numeric"
        />
        <Input
          label="Échéance (optionnel)"
          value={form.deadline}
          onChangeText={(v) => setForm({ ...form, deadline: v })}
          placeholder="YYYY-MM-DD"
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
          <Button title={editing ? 'Enregistrer' : 'Créer'} onPress={handleSubmit} style={{ flex: 1 }} />
        </View>
      </Modal>

      <Modal visible={contribOpen} onClose={() => setContribOpen(false)} title="Ajouter un dépôt">
        <Text style={styles.contribGoalName}>{contribGoal?.name}</Text>
        <Text style={styles.contribCurrent}>
          Actuel: {formatCurrency(contribGoal?.current_amount || 0, currency)} / {formatCurrency(contribGoal?.target_amount || 0, currency)}
        </Text>
        <Input
          label="Montant du dépôt"
          value={contribAmount}
          onChangeText={setContribAmount}
          placeholder="0"
          keyboardType="numeric"
        />
        <View style={styles.formActions}>
          <Button title="Annuler" variant="outline" onPress={() => setContribOpen(false)} style={{ flex: 1, marginRight: 8 }} />
          <Button title="Déposer" onPress={handleContrib} style={{ flex: 1 }} />
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
  goalCard: { padding: 16, marginBottom: 10, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, gap: 10 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goalIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  goalInfo: { flex: 1 },
  goalName: { fontSize: 16, fontWeight: '600', color: colors.text },
  goalDeadline: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  completedBadge: { backgroundColor: colors.green + '20', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 },
  completedText: { fontSize: 11, fontWeight: '700', color: colors.green },
  goalAmounts: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  goalCurrent: { fontSize: 15, fontWeight: '700', color: colors.text },
  goalTarget: { fontSize: 13, color: colors.textMuted },
  goalPct: { fontSize: 12, color: colors.textMuted },
  label: { fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8, marginTop: 4 },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotActive: { borderWidth: 3, borderColor: colors.text },
  formActions: { flexDirection: 'row', marginTop: 8 },
  contribGoalName: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  contribCurrent: { fontSize: 14, color: colors.textMuted, marginBottom: 16 },
});
