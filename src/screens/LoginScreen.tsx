import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { Input, Button } from '@/components/ui';
import { colors } from '@/components/theme';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName || undefined);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur d\'authentification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>V</Text>
          </View>
          <Text style={styles.title}>Volako</Text>
          <Text style={styles.subtitle}>Gérez vos finances, en ligne et hors ligne</Text>
        </View>

        <View style={styles.form}>
          {mode === 'register' && (
            <Input
              label="Nom"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Votre nom"
            />
          )}
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="email@exemple.com"
            keyboardType="email-address"
          />
          <Input
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title={loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer un compte'}
            onPress={handleSubmit}
            disabled={loading}
            style={styles.submitBtn}
          />
          <Button
            title={mode === 'login' ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
            onPress={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
            variant="ghost"
            size="sm"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  error: {
    color: colors.destructive,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  submitBtn: {
    marginTop: 8,
    marginBottom: 12,
  },
});
