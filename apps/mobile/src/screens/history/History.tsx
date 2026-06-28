import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { api } from '../../api/axios';
import type { CleaningJob, CleaningJobStatus } from '../../types';

type RootStackParamList = {
  HistoryDetail: { jobId: string };
};
type NavProp = StackNavigationProp<RootStackParamList>;

// ─── helpers ────────────────────────────────────────────────────────────────

function getISOWeekYear(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7; // Monday=1 … Sunday=7
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function formatDayMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatDateRange(dates: Date[]): string {
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  return `${formatShortDate(sorted[0])} – ${formatShortDate(sorted[sorted.length - 1])}`;
}

function getStatusBadge(status: CleaningJobStatus): { color: string; label: string } {
  if (status === 'DONE') return { color: '#2DC653', label: 'Concluído' };
  if (status === 'PARTIAL') return { color: '#F4A261', label: 'Parcial' };
  return { color: '#E63946', label: 'Problema' };
}

function countThisMonth(jobs: CleaningJob[]): number {
  const now = new Date();
  return jobs.filter((j) => {
    const d = new Date(j.scheduledDate);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
}

// ─── week grouping ───────────────────────────────────────────────────────────

type ListItem =
  | { type: 'header'; label: string }
  | { type: 'job'; job: CleaningJob };

function buildListData(jobs: CleaningJob[]): ListItem[] {
  const now = new Date();
  const { year: thisYear, week: thisWeek } = getISOWeekYear(now);

  const prevDate = new Date(now);
  prevDate.setDate(prevDate.getDate() - 7);
  const { year: prevYear, week: prevWeek } = getISOWeekYear(prevDate);

  const groupMap = new Map<string, CleaningJob[]>();

  for (const job of jobs) {
    const d = new Date(job.scheduledDate);
    const { year, week } = getISOWeekYear(d);
    let key: string;
    if (year === thisYear && week === thisWeek) {
      key = 'THIS_WEEK';
    } else if (year === prevYear && week === prevWeek) {
      key = 'LAST_WEEK';
    } else {
      key = `${year}-W${String(week).padStart(2, '0')}`;
    }
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(job);
  }

  const items: ListItem[] = [];

  function pushGroup(label: string, groupJobs: CleaningJob[]) {
    items.push({ type: 'header', label });
    for (const job of groupJobs) items.push({ type: 'job', job });
  }

  if (groupMap.has('THIS_WEEK')) {
    pushGroup('Esta semana', groupMap.get('THIS_WEEK')!);
    groupMap.delete('THIS_WEEK');
  }

  if (groupMap.has('LAST_WEEK')) {
    pushGroup('Semana passada', groupMap.get('LAST_WEEK')!);
    groupMap.delete('LAST_WEEK');
  }

  // Remaining older weeks, newest first
  const olderKeys = Array.from(groupMap.keys()).sort((a, b) => (a > b ? -1 : 1));
  for (const key of olderKeys) {
    const weekJobs = groupMap.get(key)!;
    const dates = weekJobs.map((j) => new Date(j.scheduledDate));
    pushGroup(formatDateRange(dates), weekJobs);
  }

  return items;
}

// ─── row component ───────────────────────────────────────────────────────────

function HistoryRow({ job, onPress }: { job: CleaningJob; onPress: () => void }) {
  const badge = getStatusBadge(job.status);
  const dayMonth = formatDayMonth(job.scheduledDate);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.dateBox}>
        <Text style={styles.dateText}>{dayMonth}</Text>
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.aptNumber}>Apt {job.property.unitNumber}</Text>
        <Text style={styles.condoName}>{job.property.condominium.name}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: badge.color }]}>
        <Text style={styles.badgeText}>{badge.label}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── screen ─────────────────────────────────────────────────────────────────

export default function History() {
  const navigation = useNavigation<NavProp>();
  const [refreshing, setRefreshing] = useState(false);

  const { data: jobs, isLoading, isError, refetch } = useQuery<CleaningJob[]>({
    queryKey: ['history'],
    queryFn: () => api.get('/cleaning-jobs?status=DONE').then((r) => r.data),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const listData = buildListData(jobs ?? []);
  const monthCount = countThisMonth(jobs ?? []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meu histórico</Text>
        <Text style={styles.headerSubtitle}>{monthCount} apts este mês</Text>
      </View>

      {isLoading && !refreshing && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0D7377" />
        </View>
      )}

      {isError && (
        <View style={styles.center}>
          <Text style={styles.errorText}>Erro ao carregar histórico.</Text>
        </View>
      )}

      {!isLoading && !isError && (
        <FlatList<ListItem>
          data={listData}
          keyExtractor={(item, index) =>
            item.type === 'header' ? `header-${item.label}` : `job-${item.job.id}-${index}`
          }
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D7377" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Nenhum apartamento limpo ainda</Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text style={styles.sectionHeader}>{item.label}</Text>;
            }
            return (
              <HistoryRow
                job={item.job}
                onPress={() => navigation.navigate('HistoryDetail', { jobId: item.job.id })}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  errorText: { fontSize: 16, color: '#E63946' },
  emptyText: { fontSize: 16, color: '#6B7280', textAlign: 'center' },
  listContent: { padding: 16, flexGrow: 1 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    minHeight: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  dateBox: { width: 52, marginRight: 12 },
  dateText: { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'center' },
  rowInfo: { flex: 1 },
  aptNumber: { fontSize: 16, fontWeight: '700', color: '#111827' },
  condoName: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },
});
