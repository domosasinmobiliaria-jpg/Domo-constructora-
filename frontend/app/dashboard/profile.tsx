import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, TextInput, Button, Divider } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import DomoHeader from '@/components/DomoHeader';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/utils/api';
import { colors } from '@/constants/colors';
import { roleLabels } from '@/constants/labels';

export default function ProfileScreen() {
  const { user, logout, refresh } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user?.name || '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const body: any = {};
      if (name.trim() && name.trim() !== user?.name) body.name = name.trim();
      if (password) body.password = password;
      if (Object.keys(body).length === 0) {
        Alert.alert('Sin cambios', 'No hay datos para actualizar.');
        setSaving(false);
        return;
      }
      await api(`/users/${user?.id}/profile`, { method: 'PUT', body });
      await refresh();
      setPassword('');
      Alert.alert('Listo', 'Perfil actualizado.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const doLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DomoHeader title="Mi perfil" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={14} color={colors.white} />
            <Text style={styles.roleText}>{roleLabels[user?.role || '']}</Text>
          </View>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Editar datos</Text>
            <TextInput
              label="Nombre"
              mode="outlined"
              value={name}
              onChangeText={setName}
              style={styles.input}
            />
            <TextInput
              label="Nueva contraseña (opcional)"
              mode="outlined"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />
            <Button
              mode="contained"
              buttonColor={colors.secondary}
              onPress={save}
              loading={saving}
              disabled={saving}
              style={styles.saveBtn}
            >
              Guardar cambios
            </Button>
          </Card.Content>
        </Card>

        <Button
          mode="outlined"
          textColor={colors.red}
          icon="logout"
          onPress={doLogout}
          style={styles.logout}
        >
          Cerrar sesión
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  hero: { alignItems: 'center', marginVertical: 16 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: colors.white, fontSize: 36, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
  email: { color: colors.textMuted, marginBottom: 8 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: { color: colors.white, fontWeight: '600', fontSize: 12 },
  card: { borderRadius: 12, backgroundColor: colors.surface },
  sectionTitle: { fontWeight: '700', color: colors.primary, marginBottom: 12 },
  input: { marginBottom: 12, backgroundColor: colors.white },
  saveBtn: { borderRadius: 10, marginTop: 4 },
  logout: { marginTop: 24, borderColor: colors.red, borderRadius: 10 },
});
