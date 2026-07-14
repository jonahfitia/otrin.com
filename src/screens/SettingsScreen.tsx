import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { CURRENCIES } from '@/types';
import { Card, Button, Dropdown } from '@/components/ui';
import { colors } from '@/components/theme';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { currency, currencyName, theme, updateSettings } = useSettings();

  const handleSignOut = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Paramètres</Text>
      </View>

      <Card style={styles.section}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.email?.charAt(0).toUpperCase() || '?'}</Text>
          </View>
          <View>
            <Text style={styles.profileName}>{user?.displayName || 'Utilisateur'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Devise</Text>
        <Dropdown
          value={currency}
          onValueChange={(v) => {
            const c = CURRENCIES.find((c) => c.code === v);
            if (c) updateSettings({ currency: c.code, currency_name: c.name });
          }}
          options={CURRENCIES.map((c) => ({ label: `${c.name} (${c.symbol})`, value: c.code }))}
        />
        <Text style={styles.hint}>Devise actuelle: {currencyName}</Text>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Thème</Text>
        <Dropdown
          value={theme}
          onValueChange={(v) => updateSettings({ theme: v })}
          options={[
            { label: 'Système', value: 'system' },
            { label: 'Clair', value: 'light' },
            { label: 'Sombre', value: 'dark' },
          ]}
        />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Synchronisation</Text>
        <View style={styles.syncRow}>
          <Ionicons name="cloud" size={20} color={colors.primary} />
          <Text style={styles.syncText}>Firebase + AsyncStorage</Text>
        </View>
        <Text style={styles.hint}>Vos données sont synchronisées en ligne via Firebase Firestore et disponibles hors ligne via AsyncStorage.</Text>
      </Card>

      <Button title="Se déconnecter" variant="destructive" onPress={handleSignOut} style={{ marginHorizontal: 16, marginTop: 8 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  section: { marginHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  profileName: { fontSize: 16, fontWeight: '600', color: colors.text },
  profileEmail: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  syncText: { fontSize: 15, color: colors.text, fontWeight: '500' },
});
