import React, { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import {
  Text,
  Searchbar,
  Chip,
  Card,
  FAB,
  Menu,
  Button,
  ActivityIndicator,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import DomoHeader from '@/components/DomoHeader';
import { api } from '@/utils/api';
import { colors } from '@/constants/colors';
import { clientStatusLabels, paymentMethodLabels } from '@/constants/labels';

const SORTS: Record<string, string> = {
  recent: 'Recientes',
  old: 'Antiguos',
  az: 'A-Z',
  za: 'Z-A',
};

export default function ClientsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('recent');
  const [sortMenu, setSortMenu] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (method) params.set('payment_method', method);
      if (status) params.set('status', status);
      params.set('sort', sort);
      const data = await api<any[]>(`/clients?${params.toString()}`);
      setItems(data);
    } catch {
      // noop
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, method, status, sort]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const statusColor = (s: string) =>
    s === 'completado' ? colors.green : s === 'en_progreso' ? colors.secondary : colors.warning;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DomoHeader title="Clientes" subtitle={`${items.length} registrados`} />
      <View style={styles.filters}>
        <Searchbar
          placeholder="Buscar por nombre, teléfono o correo"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={load}
          style={styles.search}
          inputStyle={{ fontSize: 14 }}
        />
        <View style={styles.chipsRow}>
          <Chip
            selected={method === 'credito'}
            onPress={() => setMethod(method === 'credito' ? '' : 'credito')}
            style={styles.chip}
            compact
          >
            Crédito
          </Chip>
          <Chip
            selected={method === 'efectivo'}
            onPress={() => setMethod(method === 'efectivo' ? '' : 'efectivo')}
            style={styles.chip}
            compact
          >
            Efectivo
          </Chip>
          <Chip
            selected={status === 'activo'}
            onPress={() => setStatus(status === 'activo' ? '' : 'activo')}
            style={styles.chip}
            compact
          >
            Activos
          </Chip>
          <Menu
            visible={sortMenu}
            onDismiss={() => setSortMenu(false)}
            anchor={
              <Button
                mode="outlined"
                compact
                icon="sort"
                onPress={() => setSortMenu(true)}
                style={styles.sortBtn}
              >
                {SORTS[sort]}
              </Button>
            }
          >
            {Object.entries(SORTS).map(([k, label]) => (
              <Menu.Item
                key={k}
                title={label}
                onPress={() => {
                  setSort(k);
                  setSortMenu(false);
                }}
              />
            ))}
          </Menu>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={44} color={colors.textMuted} />
              <Text style={styles.emptyText}>No hay clientes que coincidan.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push(`/client-detail/${item.id}`)}>
              <Card style={styles.card}>
                <Card.Content style={styles.cardContent}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.name?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    {!!item.phone && (
                      <Text style={styles.meta}>
                        <Ionicons name="call" size={12} /> {item.phone}
                      </Text>
                    )}
                    <View style={styles.tagRow}>
                      <View style={[styles.tag, { backgroundColor: colors.primary }]}>
                        <Text style={styles.tagText}>
                          {paymentMethodLabels[item.payment_method]}
                        </Text>
                      </View>
                      <View style={[styles.tag, { backgroundColor: statusColor(item.status) }]}>
                        <Text style={styles.tagText}>{clientStatusLabels[item.status]}</Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Card.Content>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}

      <FAB
        icon="plus"
        label="Cliente"
        style={styles.fab}
        color={colors.white}
        onPress={() => router.push('/add-client')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  filters: { padding: 12, backgroundColor: colors.surface },
  search: { borderRadius: 10, backgroundColor: colors.background },
  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' },
  chip: { backgroundColor: colors.background },
  sortBtn: { marginLeft: 'auto' },
  list: { padding: 12, paddingBottom: 90 },
  card: { marginBottom: 10, borderRadius: 12, backgroundColor: colors.surface },
  cardContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 20, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  tagText: { color: colors.white, fontSize: 10, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: colors.textMuted, marginTop: 10 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: colors.secondary,
    borderRadius: 14,
  },
});
