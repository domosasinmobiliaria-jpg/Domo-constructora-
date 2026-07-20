import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import DomoHeader from '@/components/DomoHeader';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/utils/api';
import { colors } from '@/constants/colors';
import { formatCurrency, formatDate, daysUntil } from '@/utils/format';
import { roleLabels } from '@/constants/labels';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overdue, setOverdue] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [pay, k] = await Promise.all([
        api('/payments/upcoming?days=7'),
        api('/analytics/kpis'),
      ]);
      setOverdue((pay as any).overdue || []);
      setUpcoming((pay as any).upcoming || []);
      setKpis(k);
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

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const overdueTotal = overdue.reduce((s, i) => s + (i.amount || 0), 0);
  const upcomingTotal = upcoming.reduce((s, i) => s + (i.amount || 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DomoHeader
        title={`Hola, ${user?.name?.split(' ')[0] || ''}`}
        subtitle={roleLabels[user?.role || ''] || ''}
      />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.sectionTitle}>Alertas de cobro</Text>

          <View style={styles.alertRow}>
            <Card style={[styles.alertCard, { borderTopColor: colors.red }]}>
              <Card.Content>
                <View style={styles.alertHead}>
                  <Ionicons name="alert-circle" size={22} color={colors.red} />
                  <Text style={styles.alertCount}>{overdue.length}</Text>
                </View>
                <Text style={styles.alertLabel}>Pagos vencidos</Text>
                <Text style={[styles.alertAmount, { color: colors.red }]}>
                  {formatCurrency(overdueTotal)}
                </Text>
              </Card.Content>
            </Card>

            <Card style={[styles.alertCard, { borderTopColor: colors.warning }]}>
              <Card.Content>
                <View style={styles.alertHead}>
                  <Ionicons name="time" size={22} color={colors.warning} />
                  <Text style={styles.alertCount}>{upcoming.length}</Text>
                </View>
                <Text style={styles.alertLabel}>Próximos (≤7 días)</Text>
                <Text style={[styles.alertAmount, { color: colors.warning }]}>
                  {formatCurrency(upcomingTotal)}
                </Text>
              </Card.Content>
            </Card>
          </View>

          {overdue.length > 0 && (
            <>
              <Text style={styles.subTitle}>Vencidos</Text>
              {overdue.slice(0, 20).map((i, idx) => (
                <AlertItem key={`o${idx}`} item={i} color={colors.red} router={router} />
              ))}
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <Text style={styles.subTitle}>Próximos a vencer</Text>
              {upcoming.slice(0, 20).map((i, idx) => (
                <AlertItem key={`u${idx}`} item={i} color={colors.warning} router={router} />
              ))}
            </>
          )}

          {overdue.length === 0 && upcoming.length === 0 && (
            <Card style={styles.emptyCard}>
              <Card.Content style={{ alignItems: 'center' }}>
                <Ionicons name="checkmark-circle" size={40} color={colors.green} />
                <Text style={styles.emptyText}>Sin pagos vencidos ni próximos.</Text>
              </Card.Content>
            </Card>
          )}

          {kpis && (
            <>
              <Text style={styles.sectionTitle}>Resumen</Text>
              <View style={styles.miniRow}>
                <MiniStat label="Clientes" value={kpis.total_clients} icon="people" />
                <MiniStat
                  label="Activos"
                  value={kpis.by_status?.activo || 0}
                  icon="pulse"
                />
                <MiniStat
                  label="Completados"
                  value={kpis.by_status?.completado || 0}
                  icon="trophy"
                />
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function AlertItem({ item, color, router }: any) {
  const d = daysUntil(item.due_date);
  const dText =
    item.status === 'overdue'
      ? `Venció ${formatDate(item.due_date)}`
      : `Vence en ${d} día${d === 1 ? '' : 's'}`;
  return (
    <TouchableOpacity
      onPress={() => router.push(`/payment-schedule/${item.client_id}`)}
    >
      <Card style={styles.itemCard}>
        <Card.Content style={styles.itemContent}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>{item.client_name}</Text>
            <Text style={styles.itemMeta}>
              Cuota #{item.number} · {dText}
            </Text>
          </View>
          <Text style={[styles.itemAmount, { color }]}>
            {formatCurrency(item.amount)}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

function MiniStat({ label, value, icon }: any) {
  return (
    <Card style={styles.miniCard}>
      <Card.Content style={{ alignItems: 'center' }}>
        <Ionicons name={icon} size={22} color={colors.primary} />
        <Text style={styles.miniValue}>{value}</Text>
        <Text style={styles.miniLabel}>{label}</Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 12,
    marginTop: 8,
  },
  subTitle: { fontSize: 14, fontWeight: '600', color: colors.textMuted, marginVertical: 8 },
  alertRow: { flexDirection: 'row', gap: 12 },
  alertCard: {
    flex: 1,
    borderTopWidth: 4,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  alertHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertCount: { fontSize: 26, fontWeight: '800', color: colors.text },
  alertLabel: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  alertAmount: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  itemCard: { marginBottom: 8, borderRadius: 10, backgroundColor: colors.surface },
  itemContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemName: { fontWeight: '600', color: colors.text },
  itemMeta: { color: colors.textMuted, fontSize: 12 },
  itemAmount: { fontWeight: '700' },
  emptyCard: { borderRadius: 12, backgroundColor: colors.surface, marginVertical: 8 },
  emptyText: { color: colors.textMuted, marginTop: 8 },
  miniRow: { flexDirection: 'row', gap: 12 },
  miniCard: { flex: 1, borderRadius: 12, backgroundColor: colors.surface },
  miniValue: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
  miniLabel: { color: colors.textMuted, fontSize: 12 },
});
