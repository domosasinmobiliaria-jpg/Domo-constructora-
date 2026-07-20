import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Card,
  Button,
  ActivityIndicator,
  TextInput,
  SegmentedButtons,
  Switch,
  Portal,
  Modal,
  IconButton,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import DomoHeader from '@/components/DomoHeader';
import AttachmentsSection from '@/components/AttachmentsSection';
import ReportResponsibleModal from '@/components/ReportResponsibleModal';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/utils/api';
import { colors, installmentStatusColor } from '@/constants/colors';
import { installmentStatusLabels, installmentStatusEmoji, frequencyLabels, canWrite } from '@/constants/labels';
import { formatCurrency, formatDate, todayISO } from '@/utils/format';
import { generatePaymentPdf } from '@/utils/pdfGenerator';

export default function PaymentScheduleScreen() {
  const { client_id } = useLocalSearchParams<{ client_id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const editable = canWrite(user?.role, 'payments');

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [pdfModal, setPdfModal] = useState(false);
  const [payModal, setPayModal] = useState<any>(null); // cuota a marcar pagada

  // Config
  const [subtotal, setSubtotal] = useState('');
  const [aplicaIva, setAplicaIva] = useState(true);
  const [ivaRate, setIvaRate] = useState('0.15');
  const [downPayment, setDownPayment] = useState('0');
  const [numInstallments, setNumInstallments] = useState('12');
  const [frequency, setFrequency] = useState('mensual');
  const [firstDue, setFirstDue] = useState(todayISO());

  const load = useCallback(async () => {
    try {
      const [c, sch] = await Promise.all([
        api(`/clients/${client_id}`),
        api(`/payment-schedule/${client_id}`),
      ]);
      setClient(c);
      setSchedule(sch);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [client_id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const createSchedule = async () => {
    const sub = parseFloat(subtotal);
    if (!sub || sub <= 0) {
      Alert.alert('Subtotal inválido', 'Ingresa un subtotal válido.');
      return;
    }
    try {
      const sch = await api(`/payment-schedule/${client_id}`, {
        method: 'POST',
        body: {
          subtotal: sub,
          aplica_iva: aplicaIva,
          iva_rate: parseFloat(ivaRate) || 0,
          down_payment: parseFloat(downPayment) || 0,
          num_installments: parseInt(numInstallments) || 1,
          frequency,
          first_due_date: firstDue,
        },
      });
      setSchedule(sch);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const deleteSchedule = () => {
    Alert.alert('Eliminar plan', '¿Eliminar el plan de pagos completo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/payment-schedule/${client_id}`, { method: 'DELETE' });
            setSchedule(null);
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const markPaid = async (paidDate: string, receiptId?: string) => {
    try {
      await api(`/payment-schedule/${client_id}/installment/${payModal.id}`, {
        method: 'PUT',
        body: { status: 'paid', paid_date: paidDate, receipt_attachment_id: receiptId || null },
      });
      setPayModal(null);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const revert = async (inst: any) => {
    try {
      await api(`/payment-schedule/${client_id}/installment/${inst.id}`, {
        method: 'PUT',
        body: { status: 'pending' },
      });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DomoHeader title="Plan de pagos" onBack={() => router.back()} />
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DomoHeader
        title="Plan de pagos"
        subtitle={client?.name}
        onBack={() => router.back()}
        right={
          schedule ? (
            <IconButton icon="file-pdf-box" iconColor={colors.white} onPress={() => setPdfModal(true)} />
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {!schedule ? (
          editable ? (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.title}>Configurar plan</Text>
                <TextInput
                  label="Subtotal (USD)"
                  mode="outlined"
                  keyboardType="numeric"
                  value={subtotal}
                  onChangeText={setSubtotal}
                  style={styles.input}
                />
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Aplica IVA</Text>
                  <Switch value={aplicaIva} onValueChange={setAplicaIva} color={colors.secondary} />
                </View>
                {aplicaIva && (
                  <TextInput
                    label="Tasa IVA (ej. 0.15)"
                    mode="outlined"
                    keyboardType="numeric"
                    value={ivaRate}
                    onChangeText={setIvaRate}
                    style={styles.input}
                  />
                )}
                <TextInput
                  label="Abono inicial (USD)"
                  mode="outlined"
                  keyboardType="numeric"
                  value={downPayment}
                  onChangeText={setDownPayment}
                  style={styles.input}
                />
                <TextInput
                  label="Número de cuotas"
                  mode="outlined"
                  keyboardType="numeric"
                  value={numInstallments}
                  onChangeText={setNumInstallments}
                  style={styles.input}
                />
                <Text style={styles.label}>Frecuencia</Text>
                <SegmentedButtons
                  value={frequency}
                  onValueChange={setFrequency}
                  buttons={[
                    { value: 'mensual', label: 'Mensual' },
                    { value: 'quincenal', label: 'Quincenal' },
                    { value: 'semanal', label: 'Semanal' },
                  ]}
                  style={styles.segments}
                />
                <TextInput
                  label="Fecha primer pago (AAAA-MM-DD)"
                  mode="outlined"
                  value={firstDue}
                  onChangeText={setFirstDue}
                  style={styles.input}
                />
                <Button
                  mode="contained"
                  buttonColor={colors.secondary}
                  onPress={createSchedule}
                  style={styles.saveBtn}
                >
                  Generar cuotas
                </Button>
              </Card.Content>
            </Card>
          ) : (
            <Text style={styles.empty}>Este cliente aún no tiene plan de pagos.</Text>
          )
        ) : (
          <>
            <Card style={styles.summaryCard}>
              <Card.Content>
                <SummaryRow label="Subtotal" value={formatCurrency(schedule.subtotal)} />
                {schedule.aplica_iva && (
                  <SummaryRow
                    label={`IVA (${((schedule.iva_rate || 0) * 100).toFixed(0)}%)`}
                    value={formatCurrency(schedule.iva_amount)}
                  />
                )}
                <SummaryRow label="Total" value={formatCurrency(schedule.total_amount)} bold />
                <SummaryRow label="Abono inicial" value={formatCurrency(schedule.down_payment)} />
                <SummaryRow
                  label="Frecuencia"
                  value={`${frequencyLabels[schedule.frequency]} · ${schedule.num_installments} cuotas`}
                />
              </Card.Content>
            </Card>

            <Text style={styles.title}>Cuotas</Text>
            {schedule.installments.map((inst: any) => (
              <Card key={inst.id} style={[styles.instCard, { borderLeftColor: installmentStatusColor[inst.status] }]}>
                <Card.Content>
                  <View style={styles.instHead}>
                    <Text style={styles.instNumber}>
                      {installmentStatusEmoji[inst.status]} Cuota #{inst.number}
                    </Text>
                    <Text style={styles.instAmount}>{formatCurrency(inst.amount)}</Text>
                  </View>
                  <Text style={styles.instMeta}>
                    Vence: {formatDate(inst.due_date)} ·{' '}
                    <Text style={{ color: installmentStatusColor[inst.status], fontWeight: '700' }}>
                      {installmentStatusLabels[inst.status]}
                    </Text>
                  </Text>
                  {inst.paid_date && (
                    <Text style={styles.instMeta}>Pagada el {formatDate(inst.paid_date)}</Text>
                  )}

                  {editable && (
                    <View style={styles.instActions}>
                      {inst.status !== 'paid' ? (
                        <Button
                          mode="contained"
                          compact
                          buttonColor={colors.green}
                          icon="check"
                          onPress={() => setPayModal(inst)}
                        >
                          Marcar pagada
                        </Button>
                      ) : (
                        <Button
                          mode="outlined"
                          compact
                          icon="undo"
                          textColor={colors.warning}
                          onPress={() => revert(inst)}
                        >
                          Revertir
                        </Button>
                      )}
                    </View>
                  )}

                  {inst.receipt_attachment_id && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.receiptLabel}>Comprobante:</Text>
                      <AttachmentsSection
                        clientId={client_id!}
                        ownerType="payment_receipt"
                        refKey={inst.id}
                        canWrite={false}
                      />
                    </View>
                  )}
                </Card.Content>
              </Card>
            ))}

            {editable && (
              <Button
                mode="outlined"
                icon="delete"
                textColor={colors.red}
                onPress={deleteSchedule}
                style={styles.deleteBtn}
              >
                Eliminar plan de pagos
              </Button>
            )}
          </>
        )}
      </ScrollView>

      {/* Modal marcar pagada */}
      <PaymentModal
        inst={payModal}
        clientId={client_id!}
        onClose={() => setPayModal(null)}
        onConfirm={markPaid}
      />

      <ReportResponsibleModal
        visible={pdfModal}
        onDismiss={() => setPdfModal(false)}
        onConfirm={async (meta) => {
          setPdfModal(false);
          try {
            await generatePaymentPdf(client, schedule, meta);
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        }}
        title="Datos del reporte"
      />
    </SafeAreaView>
  );
}

function PaymentModal({ inst, clientId, onClose, onConfirm }: any) {
  const [paidDate, setPaidDate] = useState(todayISO());
  const [receiptId, setReceiptId] = useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (inst) {
      setPaidDate(todayISO());
      setReceiptId(undefined);
    }
  }, [inst]);

  return (
    <Portal>
      <Modal visible={!!inst} onDismiss={onClose} contentContainerStyle={styles.modal}>
        <ScrollView>
          <Text style={styles.modalTitle}>Registrar pago — Cuota #{inst?.number}</Text>
          <TextInput
            label="Fecha real de pago (AAAA-MM-DD)"
            mode="outlined"
            value={paidDate}
            onChangeText={setPaidDate}
            style={styles.input}
          />
          <Text style={styles.receiptLabel}>Comprobante (cámara, galería o PDF):</Text>
          {inst && (
            <AttachmentsSection
              clientId={clientId}
              ownerType="payment_receipt"
              refKey={inst.id}
              canWrite={true}
            />
          )}
          <Text style={styles.hint}>
            Sube el comprobante arriba; se vinculará a esta cuota al confirmar.
          </Text>
          <View style={styles.modalActions}>
            <Button onPress={onClose}>Cancelar</Button>
            <Button
              mode="contained"
              buttonColor={colors.green}
              onPress={() => onConfirm(paidDate, receiptId)}
            >
              Confirmar pago
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

function SummaryRow({ label, value, bold }: any) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && { fontWeight: '700', color: colors.text }]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && { fontSize: 18, color: colors.primary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 12, backgroundColor: colors.surface },
  title: { fontSize: 16, fontWeight: '700', color: colors.primary, marginTop: 12, marginBottom: 10 },
  input: { marginBottom: 12, backgroundColor: colors.white },
  label: { color: colors.textMuted, marginBottom: 6, fontSize: 13 },
  segments: { marginBottom: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  switchLabel: { color: colors.text, fontSize: 15 },
  saveBtn: { borderRadius: 10, marginTop: 8 },
  summaryCard: { borderRadius: 12, backgroundColor: colors.surface },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { color: colors.textMuted },
  summaryValue: { color: colors.text, fontWeight: '600' },
  instCard: { marginBottom: 8, borderRadius: 10, borderLeftWidth: 4, backgroundColor: colors.surface },
  instHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  instNumber: { fontWeight: '700', color: colors.text, fontSize: 15 },
  instAmount: { fontWeight: '800', color: colors.primary, fontSize: 16 },
  instMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  instActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  receiptLabel: { color: colors.textMuted, fontSize: 13, marginTop: 4, fontWeight: '600' },
  deleteBtn: { marginTop: 20, borderColor: colors.red, borderRadius: 10 },
  empty: { color: colors.textMuted, fontStyle: 'italic', marginTop: 20, textAlign: 'center' },
  modal: { backgroundColor: colors.white, margin: 20, borderRadius: 12, padding: 20, maxHeight: '85%' },
  modalTitle: { fontWeight: '700', color: colors.primary, fontSize: 16, marginBottom: 12 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
});
