import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator, Chip } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import DomoHeader from '@/components/DomoHeader';
import { api } from '@/utils/api';
import { colors } from '@/constants/colors';
import { roleLabels } from '@/constants/labels';
import { formatDateTime } from '@/utils/format';

const processColor: Record<string, string> = {
  cliente: colors.primary,
  credito: colors.secondary,
  tecnico: colors.warning,
  obra: colors.green,
  pagos: colors.red,
};

export default function AuditLogsScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<any[]>(`/audit-logs/${clientId}`);
      setLogs(data);
    } catch {
      // noop
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DomoHeader title="Historial" subtitle="Auditoría del cliente" onBack={() => router.back()} />
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
          {logs.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={44} color={colors.textMuted} />
              <Text style={styles.emptyText}>Sin registros de auditoría.</Text>
            </View>
          ) : (
            logs.map((l) => (
              <Card key={l.id} style={styles.card}>
                <Card.Content>
                  <View style={styles.head}>
                    <Chip
                      compact
                      style={[styles.chip, { backgroundColor: processColor[l.process_type] || colors.primary }]}
                      textStyle={{ color: colors.white, fontSize: 10 }}
                    >
                      {(l.process_type || '').toUpperCase()}
                    </Chip>
                    <Text style={styles.date}>{formatDateTime(l.created_at)}</Text>
                  </View>
                  <Text style={styles.desc}>{l.description}</Text>
                  <Text style={styles.meta}>
                    {l.user_name} · {roleLabels[l.user_role] || l.user_role}
                  </Text>
                </Card.Content>
              </Card>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  card: { marginBottom: 8, borderRadius: 10, backgroundColor: colors.surface },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  chip: { height: 24 },
  date: { color: colors.textMuted, fontSize: 11 },
  desc: { color: colors.text, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: colors.textMuted, marginTop: 10 },
});
