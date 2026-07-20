import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, SegmentedButtons } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import DomoHeader from '@/components/DomoHeader';
import { api } from '@/utils/api';
import { colors } from '@/constants/colors';

export default function AddClientScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('credito');
  const [status, setStatus] = useState('activo');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Falta el nombre', 'El nombre del cliente es obligatorio.');
      return;
    }
    setSaving(true);
    try {
      await api('/clients', {
        method: 'POST',
        body: {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          payment_method: paymentMethod,
          status,
          notes: notes.trim(),
        },
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DomoHeader title="Nuevo cliente" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <TextInput label="Nombre completo *" mode="outlined" value={name} onChangeText={setName} style={styles.input} />
        <TextInput
          label="Teléfono"
          mode="outlined"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          style={styles.input}
        />
        <TextInput
          label="Correo electrónico"
          mode="outlined"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput label="Dirección" mode="outlined" value={address} onChangeText={setAddress} style={styles.input} />

        <Text style={styles.label}>Método de pago</Text>
        <SegmentedButtons
          value={paymentMethod}
          onValueChange={setPaymentMethod}
          buttons={[
            { value: 'credito', label: 'Crédito', icon: 'credit-card' },
            { value: 'efectivo', label: 'Efectivo', icon: 'cash' },
          ]}
          style={styles.segments}
        />

        <Text style={styles.label}>Estado</Text>
        <SegmentedButtons
          value={status}
          onValueChange={setStatus}
          buttons={[
            { value: 'activo', label: 'Activo' },
            { value: 'en_progreso', label: 'En progreso' },
            { value: 'completado', label: 'Completado' },
          ]}
          style={styles.segments}
        />

        <TextInput
          label="Notas"
          mode="outlined"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          style={styles.input}
        />

        <Button
          mode="contained"
          buttonColor={colors.secondary}
          onPress={save}
          loading={saving}
          disabled={saving}
          style={styles.saveBtn}
          contentStyle={{ paddingVertical: 6 }}
        >
          Guardar cliente
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  input: { marginBottom: 12, backgroundColor: colors.white },
  label: { color: colors.textMuted, marginBottom: 6, marginTop: 4, fontSize: 13 },
  segments: { marginBottom: 14 },
  saveBtn: { marginTop: 8, borderRadius: 10 },
});
