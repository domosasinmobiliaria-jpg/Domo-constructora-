import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, Platform } from 'react-native';
import { Text, Card, Chip, ActivityIndicator, Button, ProgressBar } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import DomoHeader from '@/components/DomoHeader';
import { useAuth } from '@/context/AuthContext';
import { api, API_URL, getToken } from '@/utils/api';
import { colors } from '@/constants/colors';
import { formatCurrency, formatDateTime } from '@/utils/format';

type Section = 'kpis' | 'alertas' | 'timeline';

export default function KpisScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [section, setSection] = useState<Section>('kpis');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpis, setKpis] = useState<any>(null);
  const [payKpis, setPayKpis] = useState<any>(null);
  const [stalled, setStalled] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [k, pk, st, tl] = await Promise.all([
        api('/analytics/kpis'),
        api('/analytics/payment-kpis'),
        api('/analytics/stalled-clients?days=15'),
        api('/analytics/timeline?days=30'),
      ]);
      setKpis(k);
      setPayKpis(pk);
      setStalled(st as any[]);
      setTimeline(tl as any[]);
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

  const downloadExcel = async () => {
    setDownloading(true);
    try {
      const token = await getToken();
      const url = `${API_URL}/backup/export-excel`;
      if (Platform.OS === 'web') {
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('No autorizado');
        const blob = await res.blob();
        // @ts-ignore
        const objUrl = window.URL.createObjectURL(blob);
        // @ts-ignore
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = 'respaldo_domo.xlsx';
        a.click();
      } else {
        const fileUri = FileSystem.cacheDirectory + 'respaldo_domo.xlsx';
        const res = await FileSystem.downloadAsync(url, fileUri, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(res.uri, {
            mimeType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Respaldo Excel DOMO',
          });
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo descargar el respaldo.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DomoHeader title="Panel ejecutivo" subtitle="Indicadores en tiempo real" />
      <View style={styles.chipRow}>
        <Chip selected={section === 'kpis'} onPress={() => setSection('kpis')} style={styles.chip}>
          KPIs
        </Chip>
        <Chip selected={section === 'alertas'} onPress={() => setSection('alertas')} style={styles.chip}>
          Alertas
        </Chip>
        <Chip selected={section === 'timeline'} onPress={() => setSection('timeline')} style={styles.chip}>
          Timeline
        </Chip>
      </View>

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
          {section === 'kpis' && kpis && (
            <>
              <Text style={styles.title}>KPIs generales</Text>
              <View style={styles.grid}>
                <StatCard label="Clientes" value={kpis.total_clients} icon="people" color={colors.primary} />
                <StatCard label="Activos" value={kpis.by_status?.activo || 0} icon="pulse" color={colors.warning} />
                <StatCard label="En progreso" value={kpis.by_status?.en_progreso || 0} icon="construct" color={colors.secondary} />
                <StatCard label="Completados" value={kpis.by_status?.completado || 0} icon="trophy" color={colors.green} />
              </View>

              <Text style={styles.title}>Avance de procesos</Text>
              <ProgressRow label="Ruta de Crédito" pct={kpis.credit_progress_pct} />
              <ProgressRow label="Ruta Técnica" pct={kpis.technical_progress_pct} />

              {payKpis && (
                <>
                  <Text style={styles.title}>Gestión de cobros</Text>
                  <View style={styles.grid}>
                    <StatCard label="Cobrado" value={formatCurrency(payKpis.total_cobrado)} icon="cash" color={colors.green} small />
                    <StatCard label="Pendiente" value={formatCurrency(payKpis.total_pendiente)} icon="hourglass" color={colors.warning} small />
                    <StatCard label="Vencido" value={formatCurrency(payKpis.total_vencido)} icon="alert-circle" color={colors.red} small />
                    <StatCard label="Plan total" value={formatCurrency(payKpis.total_plan)} icon="calculator" color={colors.primary} small />
                  </View>
                  <ProgressRow label={`% de cobro`} pct={payKpis.pct_cobro} />
                  <ProgressRow label={`% de cumplimiento (en fecha)`} pct={payKpis.pct_cumplimiento} />

                  {payKpis.top_atrasos?.length > 0 && (
                    <>
                      <Text style={styles.subTitle}>Top 5 clientes con atrasos</Text>
                      {payKpis.top_atrasos.map((a: any, i: number) => (
                        <Card key={i} style={styles.rowCard}>
                          <Card.Content style={styles.rowContent}>
                            <Text style={styles.rank}>{i + 1}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.rowName}>{a.client_name}</Text>
                              <Text style={styles.rowMeta}>{a.cuotas} cuota(s) vencida(s)</Text>
                            </View>
                            <Text style={[styles.rowAmount, { color: colors.red }]}>
                              {formatCurrency(a.monto)}
                            </Text>
                          </Card.Content>
                        </Card>
                      ))}
                    </>
                  )}
                </>
              )}

              {isAdmin && (
                <Button
                  mode="contained"
                  icon="file-excel"
                  buttonColor={colors.green}
                  onPress={downloadExcel}
                  loading={downloading}
                  disabled={downloading}
                  style={styles.excelBtn}
                  contentStyle={{ paddingVertical: 6 }}
                >
                  Descargar respaldo Excel
                </Button>
              )}
            </>
          )}

          {section === 'alertas' && (
            <>
              <Text style={styles.title}>Clientes estancados (&gt;15 días sin movimiento)</Text>
              {stalled.length === 0 ? (
                <Text style={styles.empty}>Ningún cliente estancado. ¡Buen ritmo!</Text>
              ) : (
                stalled.map((c) => (
                  <Card key={c.client_id} style={styles.rowCard}>
                    <Card.Content style={styles.rowContent}>
                      <Ionicons name="warning" size={22} color={colors.warning} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName}>{c.client_name}</Text>
                        <Text style={styles.rowMeta}>
                          {c.days_inactive != null
                            ? `${c.days_inactive} días sin actividad`
                            : 'Sin actividad registrada'}
                        </Text>
                      </View>
                    </Card.Content>
                  </Card>
                ))
              )}
            </>
          )}

          {section === 'timeline' && (
            <>
              <Text style={styles.title}>Actividad de los últimos 30 días</Text>
              {timeline.length === 0 ? (
                <Text style={styles.empty}>Sin actividad reciente.</Text>
              ) : (
                timeline.map((t) => (
                  <View key={t.id} style={styles.timelineItem}>
                    <View style={styles.timelineDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>{t.description}</Text>
                      <Text style={styles.rowMeta}>
                        {t.client_name} · {t.user_name} · {formatDateTime(t.created_at)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon, color, small }: any) {
  return (
    <Card style={styles.statCard}>
      <Card.Content style={{ alignItems: 'center' }}>
        <Ionicons name={icon} size={22} color={color} />
        <Text style={[styles.statValue, small && { fontSize: 15 }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </Card.Content>
    </Card>
  );
}

function ProgressRow({ label, pct }: { label: string; pct: number }) {
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressHead}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressPct}>{pct}%</Text>
      </View>
      <ProgressBar progress={(pct || 0) / 100} color={colors.secondary} style={styles.progressBar} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  chipRow: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: colors.surface },
  chip: { backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 16, fontWeight: '700', color: colors.primary, marginTop: 14, marginBottom: 10 },
  subTitle: { fontSize: 14, fontWeight: '600', color: colors.textMuted, marginTop: 12, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flexGrow: 1, flexBasis: '45%', borderRadius: 12, backgroundColor: colors.surface },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 4 },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  progressRow: { marginBottom: 12 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressLabel: { color: colors.text, fontWeight: '600' },
  progressPct: { color: colors.secondary, fontWeight: '700' },
  progressBar: { height: 10, borderRadius: 6, backgroundColor: colors.border },
  rowCard: { marginBottom: 8, borderRadius: 10, backgroundColor: colors.surface },
  rowContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: { fontSize: 18, fontWeight: '800', color: colors.primary, width: 24, textAlign: 'center' },
  rowName: { fontWeight: '600', color: colors.text },
  rowMeta: { color: colors.textMuted, fontSize: 12 },
  rowAmount: { fontWeight: '700' },
  excelBtn: { marginTop: 24, borderRadius: 10 },
  empty: { color: colors.textMuted, fontStyle: 'italic', marginTop: 8 },
  timelineItem: { flexDirection: 'row', gap: 12, paddingVertical: 8, alignItems: 'flex-start' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.secondary, marginTop: 6 },
});
