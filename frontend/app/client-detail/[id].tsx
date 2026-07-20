import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import {
  Text,
  Card,
  ActivityIndicator,
  Button,
  Divider,
  IconButton,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import DomoHeader from '@/components/DomoHeader';
import ReportResponsibleModal from '@/components/ReportResponsibleModal';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/utils/api';
import { colors, stageStatusColor } from '@/constants/colors';
import {
  creditStages,
  creditStageLabels,
  technicalStages,
  technicalStageLabels,
  stageStatusLabels,
  clientStatusLabels,
  paymentMethodLabels,
  canWrite,
} from '@/constants/labels';
import { formatDate, formatDateTime } from '@/utils/format';
import { generateRoutePdf, generateConstructionPdf } from '@/utils/pdfGenerator';

type Tab = 'info' | 'credit' | 'technical' | 'construction';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>('info');
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<any>(null);
  const [credit, setCredit] = useState<any>(null);
  const [technical, setTechnical] = useState<any>(null);
  const [construction, setConstruction] = useState<any>(null);
  const [pdfModal, setPdfModal] = useState<null | 'credit' | 'technical' | 'construction'>(null);

  const load = useCallback(async () => {
    try {
      const [c, cr, te, co] = await Promise.all([
        api(`/clients/${id}`),
        api(`/clients/${id}/credit`),
        api(`/clients/${id}/technical`),
        api(`/clients/${id}/construction`),
      ]);
      setClient(c);
      setCredit(cr);
      setTechnical(te);
      setConstruction(co);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading || !client) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DomoHeader title="Cliente" onBack={() => router.back()} />
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const isEfectivo = client.payment_method === 'efectivo';
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'info', label: 'Info', icon: 'information-circle' },
    ...(isEfectivo ? [] : [{ key: 'credit' as Tab, label: 'Crédito', icon: 'card' }]),
    { key: 'technical', label: 'Técnico', icon: 'construct' },
    { key: 'construction', label: 'Obra', icon: 'business' },
  ];

  const onGeneratePdf = async (meta: any) => {
    const which = pdfModal;
    setPdfModal(null);
    try {
      if (which === 'credit') await generateRoutePdf('credit', client, credit?.stages, meta);
      else if (which === 'technical') await generateRoutePdf('technical', client, technical?.stages, meta);
      else if (which === 'construction')
        await generateConstructionPdf(client, construction?.activities || [], meta);
    } catch (e: any) {
      Alert.alert('Error al generar PDF', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DomoHeader
        title={client.name}
        subtitle={paymentMethodLabels[client.payment_method]}
        onBack={() => router.back()}
        right={
          <IconButton
            icon="history"
            iconColor={colors.white}
            onPress={() => router.push(`/audit-logs/${id}`)}
          />
        }
      />

      <View style={styles.tabBar}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Ionicons
              name={t.icon as any}
              size={18}
              color={tab === t.key ? colors.secondary : colors.textMuted}
            />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'info' && <InfoTab client={client} router={router} user={user} onReload={load} />}

        {tab === 'credit' && (
          <RouteTab
            area="credit"
            clientId={id!}
            stages={creditStages}
            labels={creditStageLabels}
            data={credit?.stages || {}}
            canEdit={canWrite(user?.role, 'credit')}
            onOpen={(stage) => router.push(`/update-credit-stage/${id}/${stage}`)}
            onPdf={() => setPdfModal('credit')}
          />
        )}

        {tab === 'technical' && (
          <RouteTab
            area="technical"
            clientId={id!}
            stages={technicalStages}
            labels={technicalStageLabels}
            data={technical?.stages || {}}
            canEdit={canWrite(user?.role, 'technical')}
            onOpen={(stage) => router.push(`/update-technical-stage/${id}/${stage}`)}
            onPdf={() => setPdfModal('technical')}
          />
        )}

        {tab === 'construction' && (
          <View>
            <View style={styles.routeHead}>
              <Text style={styles.routeTitle}>Cronograma de obra</Text>
              <Button
                mode="text"
                icon="file-pdf-box"
                compact
                onPress={() => setPdfModal('construction')}
              >
                PDF
              </Button>
            </View>
            <Button
              mode="contained"
              icon="open-in-new"
              buttonColor={colors.primary}
              onPress={() => router.push(`/construction-schedule/${id}`)}
              style={{ borderRadius: 10, marginBottom: 12 }}
            >
              Abrir cronograma completo
            </Button>
            {(construction?.activities || []).length === 0 ? (
              <Text style={styles.empty}>Sin actividades registradas.</Text>
            ) : (
              construction.activities.map((a: any) => (
                <Card key={a.id} style={styles.stageCard}>
                  <Card.Content style={styles.stageRow}>
                    <View style={[styles.dot, { backgroundColor: stageStatusColor[a.status] }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stageName}>{a.name}</Text>
                      <Text style={styles.stageMeta}>
                        {stageStatusLabels[a.status]} · {a.progress ?? 0}%
                      </Text>
                    </View>
                  </Card.Content>
                </Card>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <ReportResponsibleModal
        visible={pdfModal !== null}
        onDismiss={() => setPdfModal(null)}
        onConfirm={onGeneratePdf}
        title="Datos del reporte"
      />
    </SafeAreaView>
  );
}

function InfoTab({ client, router, user, onReload }: any) {
  const remove = () => {
    Alert.alert('Eliminar cliente', `¿Eliminar a ${client.name}? Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/clients/${client.id}`, { method: 'DELETE' });
            router.back();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  return (
    <View>
      <Card style={styles.infoCard}>
        <Card.Content>
          <InfoRow icon="call" label="Teléfono" value={client.phone || '—'} />
          <Divider style={styles.div} />
          <InfoRow icon="mail" label="Correo" value={client.email || '—'} />
          <Divider style={styles.div} />
          <InfoRow icon="location" label="Dirección" value={client.address || '—'} />
          <Divider style={styles.div} />
          <InfoRow icon="pricetag" label="Método de pago" value={paymentMethodLabels[client.payment_method]} />
          <Divider style={styles.div} />
          <InfoRow icon="flag" label="Estado" value={clientStatusLabels[client.status]} />
          {!!client.notes && (
            <>
              <Divider style={styles.div} />
              <InfoRow icon="document-text" label="Notas" value={client.notes} />
            </>
          )}
          <Divider style={styles.div} />
          <InfoRow icon="person" label="Registrado por" value={client.created_by_name || '—'} />
          <InfoRow icon="calendar" label="Fecha" value={formatDateTime(client.created_at)} />
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        icon="cash-multiple"
        buttonColor={colors.secondary}
        onPress={() => router.push(`/payment-schedule/${client.id}`)}
        style={styles.actionBtn}
        contentStyle={{ paddingVertical: 6 }}
      >
        Plan de pagos
      </Button>

      {user?.role === 'admin' && (
        <Button mode="outlined" icon="delete" textColor={colors.red} onPress={remove} style={styles.deleteBtn}>
          Eliminar cliente
        </Button>
      )}
    </View>
  );
}

function InfoRow({ icon, label, value }: any) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.primary} style={{ width: 26 }} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function RouteTab({ stages, labels, data, canEdit, onOpen, onPdf }: any) {
  return (
    <View>
      <View style={styles.routeHead}>
        <Text style={styles.routeTitle}>{canEdit ? 'Toca una etapa para editarla' : 'Solo lectura'}</Text>
        <Button mode="text" icon="file-pdf-box" compact onPress={onPdf}>
          PDF ruta
        </Button>
      </View>
      {stages.map((key: string) => {
        const st = data[key] || { status: 'pending' };
        return (
          <TouchableOpacity key={key} onPress={() => onOpen(key)}>
            <Card style={styles.stageCard}>
              <Card.Content style={styles.stageRow}>
                <View style={[styles.dot, { backgroundColor: stageStatusColor[st.status] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.stageName}>{labels[key]}</Text>
                  <Text style={styles.stageMeta}>
                    {stageStatusLabels[st.status]}
                    {st.updated_by_name ? ` · ${st.updated_by_name}` : ''}
                    {st.updated_at ? ` · ${formatDate(st.updated_at)}` : ''}
                  </Text>
                  {!!st.notes && <Text style={styles.stageNotes} numberOfLines={2}>{st.notes}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Card.Content>
            </Card>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, elevation: 2 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.secondary },
  tabText: { fontSize: 11, color: colors.textMuted },
  tabTextActive: { color: colors.secondary, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },
  infoCard: { borderRadius: 12, backgroundColor: colors.surface },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  infoLabel: { color: colors.textMuted, width: 120, fontSize: 13 },
  infoValue: { flex: 1, color: colors.text, fontWeight: '500' },
  div: { backgroundColor: colors.border },
  actionBtn: { marginTop: 16, borderRadius: 10 },
  deleteBtn: { marginTop: 12, borderColor: colors.red, borderRadius: 10 },
  routeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  routeTitle: { color: colors.textMuted, fontSize: 13 },
  stageCard: { marginBottom: 8, borderRadius: 10, backgroundColor: colors.surface },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  stageName: { fontWeight: '600', color: colors.text },
  stageMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  stageNotes: { color: colors.text, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  empty: { color: colors.textMuted, fontStyle: 'italic', marginTop: 8 },
});
