import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Modal, Portal, TextInput, Button, Text } from 'react-native-paper';

import { colors } from '@/constants/colors';
import { todayISO } from '@/utils/format';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: (meta: { responsible?: string; date?: string }) => void;
  title?: string;
};

// Modal previo a generar PDF: pide responsable y fecha (ambos opcionales).
export default function ReportResponsibleModal({
  visible,
  onDismiss,
  onConfirm,
  title = 'Generar PDF',
}: Props) {
  const [responsible, setResponsible] = useState('');
  const [date, setDate] = useState(todayISO());

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modal}
      >
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.hint}>Estos datos son opcionales.</Text>
        <TextInput
          label="Responsable"
          mode="outlined"
          value={responsible}
          onChangeText={setResponsible}
          style={styles.input}
        />
        <TextInput
          label="Fecha (AAAA-MM-DD)"
          mode="outlined"
          value={date}
          onChangeText={setDate}
          style={styles.input}
        />
        <View style={styles.actions}>
          <Button onPress={onDismiss}>Cancelar</Button>
          <Button
            mode="contained"
            buttonColor={colors.secondary}
            onPress={() => onConfirm({ responsible: responsible.trim(), date })}
          >
            Generar
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: colors.white,
    margin: 24,
    borderRadius: 12,
    padding: 20,
  },
  title: { color: colors.primary, fontWeight: '700' },
  hint: { color: colors.textMuted, marginBottom: 12, fontSize: 12 },
  input: { marginBottom: 12, backgroundColor: colors.white },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
