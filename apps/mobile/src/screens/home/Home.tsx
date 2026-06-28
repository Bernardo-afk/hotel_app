import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { api } from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import type { CleaningJob, UrgencyLevel } from '../../types';

const URGENCY_COLOR: Record<UrgencyLevel, string> = {
  RED: '#E63946',
  YELLOW: '#F4A261',
  GREEN: '#2DC653',
};

const URGENCY_ORDER: Record<UrgencyLevel, number> = {
  RED: 0,
  YELLOW: 1,
  GREEN: 2,
};

function formatTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

type RootStackParamList = {
  AptDetail: { jobId: string };
  HomeAfterRelocation: { urgentJobId?: string; pausedJobId?: string } | undefined;
};

type NavProp = StackNavigationProp<RootStackParamList>;

interface GroupedJobs {
  condoName: string;
  jobs: CleaningJob[];
}

function groupAndSortJobs(jobs: CleaningJob[]): GroupedJobs[] {
  const map = new Map<string, CleaningJob[]>();
  for (const job of jobs) {
    const key = job.property.condominium.name;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(job);
  }
  const groups: GroupedJobs[] = [];
  map.forEach((groupJobs, condoName) => {
    const sorted = [...groupJobs].sort((a, b) => {
      const aLevel = a.urgencyLevel ?? a.urgency ?? 'GREEN';
      const bLevel = b.urgencyLevel ?? b.urgency ?? 'GREEN';
      return URGENCY_ORDER[aLevel] - URGENCY_ORDER[bLevel];
    });
    groups.push({ condoName, jobs: sorted });
  });
  return groups;
}

function AptCard({ job, onPress }: { job: CleaningJob; onPress: () => void }) {
  const urgency = job.urgencyLevel ?? job.urgency ?? 'GREEN';
  const dotColor = URGENCY_COLOR[urgency];
  const checkoutTime = formatTime(job.reservation?.checkOut);
  const nextCheckIn = formatTime(job.reservation?.checkIn);
  const showNextCheckIn = urgency === 'RED' || urgency === 'YELLOW';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardRow}>
        <View style={[styles.urgencyDot, { backgroundColor: dotColor }]} />
        <Text style={styles.aptNumber}>{job.property.unitNumber}</Text>
        <Text style={styles.checkoutTime}>{checkoutTime}</Text>
      </View>
      {showNextCheckIn && nextCheckIn !== '—' && (
        <Text style={styles.nextCheckIn}>Check-in: {nextCheckIn}</Text>
      )}
    </TouchableOpacity>
  );
}

export default function Home() {
  const navigation = useNavigation<NavProp>();
  const name = useAuthStore((s) => s.name);
  const [tomorrowExpanded, setTomorrowExpanded] = useState(false);

  const { data: jobs, isLoading, isError } = useQuery<CleaningJob[]>({
    queryKey: ['jobs'],
    queryFn: () => api.get('/cleaning-jobs').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayJobs = (jobs ?? []).filter((j) => isSameDay(new Date(j.scheduledDate), today));
  const tomorrowJobs = (jobs ?? []).filter((j) => isSameDay(new Date(j.scheduledDate), tomorrow));
  const hasStandBy = (jobs ?? []).some((j) => j.status === 'STAND_BY');

  const todayGroups = groupAndSortJobs(todayJobs);
  const tomorrowGroups = groupAndSortJobs(tomorrowJobs);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {hasStandBy && (
        <TouchableOpacity
          style={styles.standByBanner}
          onPress={() => {
            const standByJob = jobs?.find(j => j.status === 'STAND_BY');
            const urgentJob = jobs?.filter(j => j.status !== 'STAND_BY' && j.status !== 'DONE' && j.status !== 'CANCELLED')
              .sort((a, b) => {
                const order: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2 };
                return (order[a.urgencyLevel ?? 'GREEN'] ?? 2) - (order[b.urgencyLevel ?? 'GREEN'] ?? 2);
              })[0];
            navigation.navigate('HomeAfterRelocation', {
              urgentJobId: urgentJob?.id ?? standByJob?.id ?? '',
              pausedJobId: standByJob?.id ?? '',
            });
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.standByText}>Realocação urgente — toque para ver</Text>
        </TouchableOpacity>
      )}

      <View style={styles.header}>
        <Text style={styles.greeting}>Olá, {name ?? 'Faxineira'}!</Text>
        <Text style={styles.dateSubtitle}>{formatDate(today)}</Text>
      </View>

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0D7377" />
        </View>
      )}

      {isError && (
        <View style={styles.center}>
          <Text style={styles.errorText}>Erro ao carregar apartamentos.</Text>
        </View>
      )}

      {!isLoading && !isError && (
        <FlatList
          data={todayGroups}
          keyExtractor={(item) => item.condoName}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Nenhum apartamento hoje 🎉</Text>
            </View>
          }
          renderItem={({ item: group }) => (
            <View style={styles.group}>
              <Text style={styles.condoHeader}>{group.condoName}</Text>
              {group.jobs.map((job) => (
                <AptCard
                  key={job.id}
                  job={job}
                  onPress={() => navigation.navigate('AptDetail', { jobId: job.id })}
                />
              ))}
            </View>
          )}
          ListFooterComponent={
            tomorrowJobs.length > 0 ? (
              <View style={styles.tomorrowSection}>
                <TouchableOpacity
                  style={styles.tomorrowHeader}
                  onPress={() => setTomorrowExpanded((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.tomorrowTitle}>Amanhã ({tomorrowJobs.length})</Text>
                  <Text style={styles.chevron}>{tomorrowExpanded ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {tomorrowExpanded &&
                  tomorrowGroups.map((group) => (
                    <View key={group.condoName} style={styles.group}>
                      <Text style={styles.condoHeader}>{group.condoName}</Text>
                      {group.jobs.map((job) => (
                        <AptCard
                          key={job.id}
                          job={job}
                          onPress={() => navigation.navigate('AptDetail', { jobId: job.id })}
                        />
                      ))}
                    </View>
                  ))}
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: '#fff' },
  greeting: { fontSize: 22, fontWeight: '700', color: '#0D7377' },
  dateSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  standByBanner: {
    backgroundColor: '#E63946',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  standByText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  listContent: { padding: 16, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontSize: 18, color: '#6B7280', textAlign: 'center' },
  errorText: { fontSize: 16, color: '#E63946' },
  group: { marginBottom: 20 },
  condoHeader: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  urgencyDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  aptNumber: { flex: 1, fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center' },
  checkoutTime: { fontSize: 15, color: '#6B7280', minWidth: 48, textAlign: 'right' },
  nextCheckIn: { fontSize: 13, color: '#E63946', marginTop: 4, marginLeft: 22 },
  tomorrowSection: { marginTop: 8, marginBottom: 16 },
  tomorrowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tomorrowTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  chevron: { fontSize: 12, color: '#6B7280' },
});
