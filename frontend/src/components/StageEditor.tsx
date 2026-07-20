import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Card,
  SegmentedButtons,
  TextInput,
  Button,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';

import DomoHeader from '@/components/DomoHeader';
import AttachmentsSection from '@/components/AttachmentsSection';
import ReportResponsibleModal from '@/components/ReportResponsibleModal';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/utils/api';
import { colors } from '@/constants/colors';
import {
  creditStageLabels,
  technicalStageLabels,
  stageStatusLabels,
  canWrite,
} from '@/constants/labels';
import { formatDateTime } from '@/utils/format';
import { generateStagePdf } from '@/utils/pdfGenerator';

type Props = {
  area: 'credit' | 'technical';
  clientId: string;
  stageKey: string;
};

// Editor común para una etapa de crédito o técnica.
export default function StageEditor({ area, clientId, stageKey }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const labels = area === 'credit' ? creditStageLabels : technicalStageLabels;
  const routeName = area === 'credit' ? 'Ruta de Crédito' : 'Ruta Técnica';
  const ownerType = area; // 'credit' | 'technical'
  const editable = canWrite(user?.role, area);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [client, setClient] = useState<any>(null);
  const [stage, setStage] = useState<any>(null);
  const [status, setStatus] = useState('pending');
  const [notes, setNotes] = useState('');
  const [pdfModal, setPdfModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, proc] = await Promise.all([
        api(`/clients/${clientId}`),
        api(`/clients/${clientId}/${area}`),
      ]);
      setClient(c);
      const st = (proc as any).stages?.[stageKey] || { status: 'pending', notes: '' };
      setStage(st);
      setStatus(st.status || 'pending');
      setNotes(st.notes || '');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [clientId, area, stageKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const save = async () => {
    setSaving(true);
    try {
      await api(`/clients/${clientId}/${area}/${stageKey}`, {
        method: 'PUT',
        body: { status, notes },
      });
      Alert.alert('Guardado', 'Etapa actualizada correctamente.');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const onPdf = async (meta: any) => {
    setPdfModal(false);
    try {
      await generateStagePdf(area, client, stageKey, { ...stage, status, notes }, meta);
    } catch (e: any) {
      Alert.alert('Error al generar PDF', e.message);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DomoHeader title={labels[stageKey]} onBack={() => router.back()} />
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DomoHeader title={labels[stageKey]} subtitle={routeName} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.label}>Estado</Text>
            <SegmentedButtons
              value={status}
              onValueChange={editable ? setStatus : () => {}}
              buttons={[
                { value: 'pending', label: 'Pendiente' },
                { value: 'in_progress', label: 'En progreso' },
                { value: 'completed', label: 'Completado' },
              ]}
              style={styles.segments}
            />

            <Text style={styles.label}>Notas</Text>
            <TextInput
              mode="outlined"
              value={notes}
              onChangeText={setNotes}
              editable={editable}
              multiline
              numberOfLines={4}
              placeholder="Observaciones de la etapa…"
              style={styles.input}
            />

            {stage?.updated_by_name && (
              <Text style={styles.audit}>
                Última actualización: {stage.updated_by_name} · {formatDateTime(stage.updated_at)}
              </Text>
            )}

            {editable ? (
              <Button
                mode="contained"
                buttonColor={colors.secondary}
                onPress={save}
                loading={saving}
                disabled={saving}
                style={styles.saveBtn}
              >
                Guardar etapa
              </Button>
            ) : (
              <Text style={styles.readonly}>No tienes permisos para editar esta ruta.</Text>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <AttachmentsSection
              clientId={clientId}
              ownerType={ownerType}
              refKey={stageKey}
              canWrite={editable}
            />
          </Card.Content>
        </Card>

        <Button
          mode="outlined"
          icon="file-pdf-box"
          onPress={() => setPdfModal(true)}
          style={styles.pdfBtn}
        >
          Generar PDF de la etapa
        </Button>
      </ScrollView>

      <ReportResponsibleModal
        visible={pdfModal}
        onDismiss={() => setPdfModal(false)}
        onConfirm={onPdf}
        title="Datos del reporte"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 12, backgroundColor: colors.surface, marginBottom: 12 },
  label: { color: colors.textMuted, marginBottom: 6, fontSize: 13 },
  segments: { marginBottom: 14 },
  input: { backgroundColor: colors.white, marginBottom: 8 },
  audit: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  saveBtn: { borderRadius: 10, marginTop: 12 },
  readonly: { color: colors.red, fontStyle: 'italic', marginTop: 8 },
  pdfBtn: { borderRadius: 10, borderColor: colors.primary },
});
