import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Appbar } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/constants/colors';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
};

// Encabezado corporativo con "logo" DOMO. Reusable en pantallas principales.
export default function DomoHeader({ title, subtitle, onBack, right }: Props) {
  return (
    <Appbar.Header style={styles.header} dark>
      {onBack ? (
        <Appbar.BackAction color={colors.white} onPress={onBack} />
      ) : (
        <View style={styles.logo}>
          <Ionicons name="home" size={20} color={colors.secondary} />
        </View>
      )}
      <Appbar.Content
        title={title}
        titleStyle={styles.title}
        subtitle={subtitle}
        subtitleStyle={styles.subtitle}
      />
      {right}
    </Appbar.Header>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.primary },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  title: { color: colors.white, fontWeight: '700', fontSize: 18 },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
});
