import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Card,
  Button,
  ActivityIndicator,
  Portal,
  Modal,
  TextInput,
  SegmentedButtons,
  IconButton,
  Menu,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import DomoHeader from '@/components/DomoHeader';
import AttachmentsSection from '@/components/AttachmentsSection';
import ReportResponsibleModal from '@/components/ReportResponsibleModal';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/utils/api';
import { colors, stageStatusColor } from '@/constants/colors';
import { stageStatusLabels, canWrite } from '@/constants/labels';
import { formatDate, todayISO } from '@/utils/format';
import { generateConstructionPdf } from '@/utils/pdfGenerator';

export default function ConstructionScheduleScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const editable = canWrite(user?.role, 'construction');

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [tplMenu, setTplMenu] = useState(false);
  const [editor, setEditor] = useState<any>(null); // actividad en edición o {} para nueva
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pdfModal, setPdfModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, sch, tpls] = await Promise.all([
        api(`/clients/${clientId}`),
        api(`/clients/${clientId}/construction`),
        api(`/schedule-templates`),
      ]);
      setClient(c);
      setActivities((sch as any).activities || []);
      setTemplates(tpls as any[]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const applyTemplate = async (templateId?: string) => {
    setTplMenu(false);
    try {
      await api(`/clients/${clientId}/construction/from-template`, {
        method: 'POST',
        body: { template_id: templateId },
      });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const saveActivity = async () => {
    if (!editor?.name?.trim()) {
      Alert.alert('Falta el nombre', 'La actividad necesita un nombre.');
      return;
    }
    try {
      const body = {
        name: editor.name.trim(),
        status: editor.status || 'pending',
        start_date: editor.start_date || null,
        end_date: editor.end_date || null,
        progress: Number(editor.progress) || 0,
        notes: editor.notes || '',
      };
      if (editor.id) {
        await api(`/clients/${clientId}/construction/activities/${editor.id}`, {
          method: 'PUT',
          body,
        });
      } else {
        await api(`/clients/${clientId}/construction/activities`, { method: 'POST', body });
      }
      setEditor(null);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const removeActivity = (a: any) => {
    Alert.alert('Eliminar actividad', `¿Eliminar "${a.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/clients/${clientId}/construction/activities/${a.id}`, {
              method: 'DELETE',
            });
            await load();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DomoHeader title="Cronograma de obra" onBack={() => router.back()} />
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DomoHeader
        title="Cronograma de obra"
        subtitle={client?.name}
        onBack={() => router.back()}
        right={
          <IconButton icon="file-pdf-box" iconColor={colors.white} onPress={() => setPdfModal(true)} />
        }
      />

      {editable && (
        <View style={styles.toolbar}>
          <Button
            mode="contained"
            icon="plus"
            compact
            buttonColor={colors.secondary}
            onPress={() => setEditor({ status: 'pending', progress: 0, start_date: todayISO() })}
          >
            Actividad
          </Button>
          <Menu
            visible={tplMenu}
            onDismiss={() => setTplMenu(false)}
            anchor={
              <Button mode="outlined" icon="format-list-bulleted" compact onPress={() => setTplMenu(true)}>
                Plantilla
              </Button>
            }
          >
            {templates.map((t) => (
              <Menu.Item
                key={t.id}
                title={`${t.name} (${t.activities?.length || 0})`}
                onPress={() => applyTemplate(t.id)}
              />
            ))}
            {templates.length === 0 && <Menu.Item title="Sin plantillas" disabled />}
          </Menu>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {activities.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="hammer-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              Aún no hay actividades.
              {editable ? ' Crea una o parte de una plantilla.' : ''}
            </Text>
          </View>
        ) : (
          activities.map((a, idx) => (
            <View key={a.id} style={styles.timelineRow}>
              <View style={styles.timelineCol}>
                <View style={[styles.timelineDot, { backgroundColor: stageStatusColor[a.status] }]} />
                {idx < activities.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <Card style={styles.actCard}>
                <Card.Content>
                  <View style={styles.actHead}>
                    <Text style={styles.actName}>{a.name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: stageStatusColor[a.status] }]}>
                      <Text style={styles.statusText}>{stageStatusLabels[a.status]}</Text>
                    </View>
                  </View>
                  <Text style={styles.actMeta}>
                    {formatDate(a.start_date)} → {formatDate(a.end_date)} · {a.progress ?? 0}%
                  </Text>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(100, a.progress || 0)}%` },
                      ]}
                    />
                  </View>
                  {!!a.notes && <Text style={styles.actNotes}>{a.notes}</Text>}

                  <View style={styles.actActions}>
                    <Button
                      compact
                      mode="text"
                      icon={expanded === a.id ? 'chevron-up' : 'paperclip'}
                      onPress={() => setExpanded(expanded === a.id ? null : a.id)}
                    >
                      Fotos
                    </Button>
                    {editable && (
                      <>
                        <IconButton icon="pencil" size={18} onPress={() => setEditor(a)} />
                        <IconButton
                          icon="delete"
                          size={18}
                          iconColor={colors.red}
                          onPress={() => removeActivity(a)}
                        />
                      </>
                    )}
                  </View>

                  {expanded === a.id && (
                    <AttachmentsSection
                      clientId={clientId!}
                      ownerType="construction"
                      refKey={a.id}
                      canWrite={editable}
                    />
                  )}
                </Card.Content>
              </Card>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal de edición/creación de actividad */}
      <Portal>
        <Modal
          visible={!!editor}
          onDismiss={() => setEditor(null)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>{editor?.id ? 'Editar actividad' : 'Nueva actividad'}</Text>
            <TextInput
              label="Nombre"
              mode="outlined"
              value={editor?.name || ''}
              onChangeText={(t) => setEditor({ ...editor, name: t })}
              style={styles.input}
            />
            <Text style={styles.label}>Estado</Text>
            <SegmentedButtons
              value={editor?.status || 'pending'}
              onValueChange={(v) => setEditor({ ...editor, status: v })}
              buttons={[
                { value: 'pending', label: 'Pend.' },
                { value: 'in_progress', label: 'Progreso' },
                { value: 'completed', label: 'Compl.' },
              ]}
              style={styles.segments}
            />
            <TextInput
              label="Fecha inicio (AAAA-MM-DD)"
              mode="outlined"
              value={editor?.start_date || ''}
              onChangeText={(t) => setEditor({ ...editor, start_date: t })}
              style={styles.input}
            />
            <TextInput
              label="Fecha fin (AAAA-MM-DD)"
              mode="outlined"
              value={editor?.end_date || ''}
              onChangeText={(t) => setEditor({ ...editor, end_date: t })}
              style={styles.input}
            />
            <TextInput
              label="Progreso (%)"
              mode="outlined"
              keyboardType="numeric"
              value={String(editor?.progress ?? 0)}
              onChangeText={(t) => setEditor({ ...editor, progress: t.replace(/[^0-9]/g, '') })}
              style={styles.input}
            />
            <TextInput
              label="Notas"
              mode="outlined"
              multiline
              numberOfLines={3}
              value={editor?.notes || ''}
              onChangeText={(t) => setEditor({ ...editor, notes: t })}
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <Button onPress={() => setEditor(null)}>Cancelar</Button>
              <Button mode="contained" buttonColor={colors.secondary} onPress={saveActivity}>
                Guardar
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      <ReportResponsibleModal
        visible={pdfModal}
        onDismiss={() => setPdfModal(false)}
        onConfirm={async (meta) => {
          setPdfModal(false);
          try {
            await generateConstructionPdf(client, activities, meta);
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        }}
        title="Datos del reporte"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  toolbar: { flexDirection: 'row', gap: 10, padding: 12, backgroundColor: colors.surface },
  content: { padding: 16, paddingBottom: 40 },
  empty: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: colors.textMuted, marginTop: 10, textAlign: 'center', paddingHorizontal: 20 },
  timelineRow: { flexDirection: 'row' },
  timelineCol: { alignItems: 'center', width: 26 },
  timelineDot: { width: 14, height: 14, borderRadius: 7, marginTop: 18 },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 2 },
  actCard: { flex: 1, marginBottom: 12, borderRadius: 12, backgroundColor: colors.surface },
  actHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actName: { fontWeight: '700', color: colors.text, flex: 1, fontSize: 15 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText: { color: colors.white, fontSize: 10, fontWeight: '600' },
  actMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.border, marginTop: 8 },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.green },
  actNotes: { color: colors.text, fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  actActions: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  modal: { backgroundColor: colors.white, margin: 20, borderRadius: 12, padding: 20, maxHeight: '85%' },
  modalTitle: { fontWeight: '700', color: colors.primary, fontSize: 16, marginBottom: 12 },
  label: { color: colors.textMuted, marginBottom: 6, fontSize: 13 },
  input: { marginBottom: 12, backgroundColor: colors.white },
  segments: { marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
});
