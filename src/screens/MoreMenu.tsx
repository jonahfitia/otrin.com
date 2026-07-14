import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/components/theme';

const MENU_ITEMS = [
  { label: 'Budget', icon: 'bar-chart' as const, route: 'Budget', color: colors.amber },
  { label: 'Objectifs', icon: 'trophy' as const, route: 'Goals', color: colors.green },
  { label: 'Catégories', icon: 'pricetags' as const, route: 'Categories', color: colors.blue },
  { label: 'Récurrentes', icon: 'repeat' as const, route: 'Recurring', color: colors.purple },
  { label: 'Simulations', icon: 'flask' as const, route: 'Simulation', color: colors.teal },
  { label: 'Paramètres', icon: 'settings' as const, route: 'Settings', color: colors.gray },
];

export default function MoreMenu({ navigation }: { navigation: any }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Plus</Text>
        <Text style={styles.subtitle}>Toutes les fonctionnalités</Text>
      </View>
      <View style={styles.grid}>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.menuCard}
            onPress={() => navigation.navigate(item.route)}
          >
            <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12 },
  menuCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  menuIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
});
