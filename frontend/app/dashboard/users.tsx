import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { Text, Card, Button, ActivityIndicator, Chip, IconButton } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import DomoHeader from '@/components/DomoHeader';
import { api } from '@/utils/api';
import { colors } from '@/constants/colors';
import { roleLabels, userStatusLabels } from '@/constants/labels';

export default function UsersScreen() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<any[]>('/admin/users');
      setUsers(data);
    } catch {
      // noop
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const act = async (id: string, action: 'approve' | 'reject') => {
    try {
      await api(`/admin/users/${id}/${action}`, { method: 'PUT' });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const remove = (u: any) => {
    Alert.alert('Eliminar usuario', `¿Eliminar a ${u.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/admin/users/${u.id}`, { method: 'DELETE' });
            await load();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const statusColor = (s: string) =>
    s === 'approved' ? colors.green : s === 'rejected' ? colors.red : colors.warning;

  const pending = users.filter((u) => u.status === 'pending');
  const others = users.filter((u) => u.status !== 'pending');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DomoHeader title="Usuarios" subtitle={`${users.length} en total`} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
        >
          {pending.length > 0 && (
            <>
              <Text style={styles.title}>Pendientes de aprobación ({pending.length})</Text>
              {pending.map((u) => (
                <Card key={u.id} style={[styles.card, { borderLeftColor: colors.warning }]}>
                  <Card.Content>
                    <Text style={styles.name}>{u.name}</Text>
                    <Text style={styles.meta}>{u.email}</Text>
                    <Text style={styles.role}>{roleLabels[u.role]}</Text>
                    <View style={styles.actions}>
                      <Button
                        mode="contained"
                        buttonColor={colors.green}
                        compact
                        icon="check"
                        onPress={() => act(u.id, 'approve')}
                      >
                        Aprobar
                      </Button>
                      <Button
                        mode="outlined"
                        textColor={colors.red}
                        compact
                        icon="close"
                        onPress={() => act(u.id, 'reject')}
                      >
                        Rechazar
                      </Button>
                    </View>
                  </Card.Content>
                </Card>
              ))}
            </>
          )}

          <Text style={styles.title}>Todos los usuarios</Text>
          {others.map((u) => (
            <Card key={u.id} style={[styles.card, { borderLeftColor: statusColor(u.status) }]}>
              <Card.Content style={styles.userRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{u.name?.charAt(0)?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{u.name}</Text>
                  <Text style={styles.meta}>{u.email}</Text>
                  <View style={styles.tagRow}>
                    <Chip compact style={styles.chip} textStyle={{ fontSize: 11 }}>
                      {roleLabels[u.role]}
                    </Chip>
                    <Chip
                      compact
                      style={[styles.chip, { backgroundColor: statusColor(u.status) }]}
                      textStyle={{ fontSize: 11, color: colors.white }}
                    >
                      {userStatusLabels[u.status]}
                    </Chip>
                  </View>
                </View>
                {u.role !== 'admin' && (
                  <IconButton icon="delete" iconColor={colors.red} onPress={() => remove(u)} />
                )}
              </Card.Content>
            </Card>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 16, fontWeight: '700', color: colors.primary, marginTop: 12, marginBottom: 10 },
  card: { marginBottom: 10, borderRadius: 12, borderLeftWidth: 4, backgroundColor: colors.surface },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontWeight: '700', fontSize: 18 },
  name: { fontWeight: '700', color: colors.text, fontSize: 15 },
  meta: { color: colors.textMuted, fontSize: 12 },
  role: { color: colors.secondary, fontSize: 12, marginTop: 2, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  chip: { backgroundColor: colors.background },
});
