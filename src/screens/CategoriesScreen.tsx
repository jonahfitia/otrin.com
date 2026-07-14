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
import { categoriesRepo } from '@/lib/repository';
import { Category, TransactionType } from '@/types';
import { Card, Input, Modal, Button, Dropdown, EmptyState, LoadingSpinner } from '@/components/ui';
import { colors } from '@/components/theme';
import { Ionicons } from '@expo/vector-icons';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#ec4899'];

export default function CategoriesScreen() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', type: 'expense' as TransactionType, color: '#10b981' });

  const load = useCallback(async () => {
    if (!user) return;
    const cats = await categoriesRepo(user.uid).getAll();
    setCategories(cats.sort((a, b) => a.name.localeCompare(b.name)));
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
    setForm({ name: '', type: 'expense', color: '#10b981' });
    setDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({ name: cat.name, type: cat.type, color: cat.color });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !form.name) return;
    const payload = {
      name: form.name,
      type: form.type,
      color: form.color,
      icon: 'circle',
      is_default: false,
    };
    if (editing) {
      await categoriesRepo(user.uid).update(editing.id, payload);
    } else {
      await categoriesRepo(user.uid).create({
        ...payload,
        created_at: new Date().toISOString(),
      } as any);
    }
    setDialogOpen(false);
    await load();
  };

  const handleDelete = (cat: Category) => {
    Alert.alert('Supprimer la catégorie ?', `Supprimer "${cat.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          await categoriesRepo(user.uid).delete(cat.id);
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
          <Text style={styles.title}>Catégories</Text>
          <Text style={styles.subtitle}>{categories.length} catégories</Text>
        </View>
        <TouchableOpacity style={styles.fab} onPress={openNew}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
        ListEmptyComponent={<EmptyState message="Aucune catégorie" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.catCard}
            onPress={() => openEdit(item)}
            onLongPress={() => handleDelete(item)}
          >
            <View style={[styles.catDot, { backgroundColor: item.color + '20' }]}>
              <Text style={{ color: item.color, fontSize: 14, fontWeight: '700' }}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.catInfo}>
              <Text style={styles.catName}>{item.name}</Text>
              <Text style={styles.catType}>{item.type === 'income' ? 'Revenu' : 'Dépense'}</Text>
            </View>
            {item.is_default && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultText}>Défaut</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />

      <Modal visible={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Modifier' : 'Nouvelle catégorie'}>
        <Input label="Nom" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Nom de la catégorie" />
        <Dropdown
          label="Type"
          value={form.type}
          onValueChange={(v) => setForm({ ...form, type: v as TransactionType })}
          options={[
            { label: 'Dépense', value: 'expense' },
            { label: 'Revenu', value: 'income' },
          ]}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  fab: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  catCard: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 10 },
  catDot: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catInfo: { flex: 1 },
  catName: { fontSize: 15, fontWeight: '600', color: colors.text },
  catType: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  defaultBadge: { backgroundColor: colors.primaryLight, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 },
  defaultText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  label: { fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8, marginTop: 4 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotActive: { borderWidth: 3, borderColor: colors.text },
  formActions: { flexDirection: 'row', marginTop: 8 },
});
