import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Alert, Linking } from 'react-native';
import { Text, Button, List, IconButton, ActivityIndicator } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { colors } from '@/constants/colors';
import { api, attachmentContentUrl, getToken, API_URL } from '@/utils/api';
import { formatDateTime } from '@/utils/format';

const MAX_BYTES = 6 * 1024 * 1024;

type Props = {
  clientId: string;
  ownerType: 'credit' | 'technical' | 'construction' | 'payment_receipt';
  refKey: string;
  canWrite: boolean;
};

// Sección reusable de adjuntos: cámara, galería y PDF, con listado y borrado.
export default function AttachmentsSection({
  clientId,
  ownerType,
  refKey,
  canWrite,
}: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<any[]>(
        `/attachments?client_id=${clientId}&owner_type=${ownerType}&ref_key=${encodeURIComponent(
          refKey
        )}`
      );
      setItems(data);
    } catch (e: any) {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [clientId, ownerType, refKey]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = useCallback(
    async (filename: string, mime: string, base64: string, sizeBytes: number) => {
      if (sizeBytes > MAX_BYTES) {
        Alert.alert('Archivo muy grande', 'El límite por archivo es de 6 MB.');
        return;
      }
      setUploading(true);
      try {
        await api('/attachments', {
          method: 'POST',
          body: {
            owner_type: ownerType,
            client_id: clientId,
            ref_key: refKey,
            filename,
            mime_type: mime,
            data: base64,
            description: '',
          },
        });
        await load();
      } catch (e: any) {
        Alert.alert('Error', e.message || 'No se pudo subir el archivo');
      } finally {
        setUploading(false);
      }
    },
    [clientId, ownerType, refKey, load]
  );

  const pickImage = useCallback(
    async (fromCamera: boolean) => {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permiso requerido', 'Habilita el acceso para continuar.');
        return;
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6 });
      if (result.canceled) return;
      const asset = result.assets[0];
      const b64 = asset.base64 || '';
      const size = Math.floor((b64.length * 3) / 4);
      const name = asset.fileName || `foto_${Date.now()}.jpg`;
      await upload(name, asset.mimeType || 'image/jpeg', b64, size);
    },
    [upload]
  );

  const pickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      const b64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: 'base64',
      });
      const size = asset.size ?? Math.floor((b64.length * 3) / 4);
      await upload(asset.name, asset.mimeType || 'application/pdf', b64, size);
    } catch (e: any) {
      Alert.alert('Error', 'No se pudo leer el archivo PDF.');
    }
  }, [upload]);

  const openAttachment = useCallback(async (id: string) => {
    // Abre el contenido en el visor del sistema.
    const token = await getToken();
    const url = attachmentContentUrl(id);
    // La descarga autenticada se hace con fetch y se comparte/abre localmente.
    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const blob = await res.blob();
      // En web abrimos en pestaña nueva.
      // @ts-ignore
      if (typeof window !== 'undefined' && window.URL) {
        // @ts-ignore
        const objUrl = window.URL.createObjectURL(blob);
        // @ts-ignore
        window.open(objUrl, '_blank');
      } else {
        Linking.openURL(url);
      }
    } catch {
      Linking.openURL(url);
    }
  }, []);

  const remove = useCallback(
    async (id: string) => {
      Alert.alert('Eliminar adjunto', '¿Deseas eliminar este archivo?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/attachments/${id}`, { method: 'DELETE' });
              await load();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]);
    },
    [load]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Adjuntos</Text>
      {canWrite && (
        <View style={styles.buttons}>
          <Button
            icon="camera"
            mode="outlined"
            compact
            onPress={() => pickImage(true)}
            disabled={uploading}
          >
            Cámara
          </Button>
          <Button
            icon="image"
            mode="outlined"
            compact
            onPress={() => pickImage(false)}
            disabled={uploading}
          >
            Galería
          </Button>
          <Button
            icon="file-pdf-box"
            mode="outlined"
            compact
            onPress={pickDocument}
            disabled={uploading}
          >
            PDF
          </Button>
        </View>
      )}
      {uploading && <ActivityIndicator style={{ marginVertical: 8 }} color={colors.secondary} />}
      {loading ? (
        <ActivityIndicator style={{ marginVertical: 8 }} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>Sin archivos adjuntos.</Text>
      ) : (
        items.map((it) => (
          <List.Item
            key={it.id}
            title={it.filename}
            description={`${(it.size_bytes / 1024).toFixed(0)} KB · ${it.uploaded_by_name || ''} · ${formatDateTime(it.uploaded_at)}`}
            titleNumberOfLines={2}
            left={(p) => (
              <List.Icon
                {...p}
                icon={it.mime_type?.includes('pdf') ? 'file-pdf-box' : 'image'}
                color={colors.primary}
              />
            )}
            right={(p) => (
              <View style={styles.itemActions}>
                <IconButton
                  {...p}
                  icon="eye"
                  onPress={() => openAttachment(it.id)}
                />
                {canWrite && (
                  <IconButton
                    {...p}
                    icon="delete"
                    iconColor={colors.red}
                    onPress={() => remove(it.id)}
                  />
                )}
              </View>
            )}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8 },
  title: { fontWeight: '700', color: colors.primary, marginBottom: 8 },
  buttons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  empty: { color: colors.textMuted, fontStyle: 'italic', marginVertical: 6 },
  itemActions: { flexDirection: 'row' },
});
