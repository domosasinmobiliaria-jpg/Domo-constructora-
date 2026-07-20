import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  SegmentedButtons,
  HelperText,
  ActivityIndicator,
  Snackbar,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/utils/api';
import { colors } from '@/constants/colors';
import { roleLabels } from '@/constants/labels';

export default function LoginScreen() {
  const { user, loading, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [adminExists, setAdminExists] = useState<boolean | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('credit_advisor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [snack, setSnack] = useState('');

  useEffect(() => {
    authApi
      .adminExists()
      .then((r) => setAdminExists(r.exists))
      .catch(() => setAdminExists(true));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/dashboard" />;
  }

  const isAdminEmail =
    email.trim().toLowerCase() === 'domo.sas.inmobiliaria@gmail.com';

  const handleSubmit = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Correo y contraseña son obligatorios.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        if (!name.trim()) {
          setError('El nombre es obligatorio.');
          setBusy(false);
          return;
        }
        const finalRole = isAdminEmail && !adminExists ? 'admin' : role;
        const created: any = await register({
          name: name.trim(),
          email: email.trim(),
          password,
          role: finalRole,
        });
        if (created?.status === 'pending') {
          setSnack('Cuenta creada. Un administrador debe aprobarla.');
          setMode('login');
          setPassword('');
        }
      }
    } catch (e: any) {
      setError(e.message || 'Ocurrió un error.');
    } finally {
      setBusy(false);
    }
  };

  const roleOptions = Object.entries(roleLabels)
    .filter(([k]) => k !== 'admin')
    .map(([value, label]) => ({ value, label: label.split(' ')[0] }));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.brand}>
          <View style={styles.logoCircle}>
            <Ionicons name="home" size={40} color={colors.secondary} />
          </View>
          <Text style={styles.brandTitle}>DOMO</Text>
          <Text style={styles.brandSub}>Constructora e Inmobiliaria</Text>
        </View>

        <View style={styles.card}>
          <SegmentedButtons
            value={mode}
            onValueChange={(v) => {
              setMode(v as any);
              setError('');
            }}
            buttons={[
              { value: 'login', label: 'Ingresar' },
              { value: 'register', label: 'Registrarse' },
            ]}
            style={styles.segments}
          />

          {mode === 'register' && (
            <TextInput
              label="Nombre completo"
              mode="outlined"
              value={name}
              onChangeText={setName}
              style={styles.input}
            />
          )}

          <TextInput
            label="Correo electrónico"
            mode="outlined"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
          <TextInput
            label="Contraseña"
            mode="outlined"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />

          {mode === 'register' && !(isAdminEmail && !adminExists) && (
            <>
              <Text style={styles.roleLabel}>Rol solicitado</Text>
              <SegmentedButtons
                value={role}
                onValueChange={setRole}
                buttons={roleOptions}
                style={styles.segments}
              />
            </>
          )}

          {mode === 'register' && isAdminEmail && !adminExists && (
            <HelperText type="info" visible>
              Este correo se registrará como administrador del sistema.
            </HelperText>
          )}

          {!!error && (
            <HelperText type="error" visible>
              {error}
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={busy}
            disabled={busy}
            buttonColor={colors.secondary}
            style={styles.submit}
            contentStyle={{ paddingVertical: 6 }}
          >
            {mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </Button>
        </View>
      </ScrollView>
      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={4000}>
        {snack}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brand: { alignItems: 'center', marginBottom: 28 },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandTitle: { color: colors.white, fontSize: 40, fontWeight: '800', letterSpacing: 4 },
  brandSub: { color: colors.secondary, fontSize: 13, letterSpacing: 1 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  segments: { marginBottom: 12 },
  input: { marginBottom: 12, backgroundColor: colors.white },
  roleLabel: { color: colors.textMuted, marginBottom: 6, fontSize: 13 },
  submit: { marginTop: 8, borderRadius: 10 },
});
