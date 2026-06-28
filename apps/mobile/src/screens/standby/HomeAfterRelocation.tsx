import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/axios';
import type { CleaningJob } from '../../types';

type RootStackParamList = {
  HomeAfterRelocation: { urgentJobId: string; pausedJobId: string };
  DoorWarning: { assignmentId: string; jobId: string };
};

type NavProp = StackNavigationProp<RootStackParamList>;
type HomeAfterRelocationRouteProp = RouteProp<
  RootStackParamList,
  'HomeAfterRelocation'
>;

export default function HomeAfterRelocation() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<HomeAfterRelocationRouteProp>();
  const { urgentJobId, pausedJobId } = route.params;

  const { data: jobs, isLoading } = useQuery<CleaningJob[]>({
    queryKey: ['cleaning-jobs'],
    queryFn: () => api.get('/cleaning-jobs').then((r) => r.data),
  });

  const urgentJob = jobs?.find((j) => j.id === urgentJobId);
  const pausedJob = jobs?.find((j) => j.id === pausedJobId);
  const nextJobs =
    jobs?.filter(
      (j) =>
        j.id !== urgentJobId &&
        j.id !== pausedJobId &&
        (j.status === 'ASSIGNED' || j.status === 'PENDING'),
    ) ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.pageTitle}>Seus apts</Text>

        {isLoading && (
          <ActivityIndicator
            color="#0D7377"
            size="large"
            style={styles.loader}
          />
        )}

        {/* Section 1: Urgente agora */}
        <Text style={styles.sectionTitle}>Urgente agora</Text>
        {urgentJob ? (
          <View style={styles.urgentCard}>
            <View style={styles.urgentHeader}>
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentBadgeText}>URGENTE</Text>
              </View>
              <Text style={styles.urgentAptNumber}>
                {urgentJob.property.unitNumber}
              </Text>
            </View>
            <Text style={styles.urgentCondoName}>
              {urgentJob.property.condominium.name}
            </Text>
            <TouchableOpacity
              style={styles.startButton}
              onPress={() =>
                navigation.navigate('DoorWarning', {
                  assignmentId: urgentJob.assignments[0]?.id ?? '',
                  jobId: urgentJob.id,
                })
              }
              activeOpacity={0.85}
            >
              <Text style={styles.startButtonText}>Iniciar limpeza urgente</Text>
            </TouchableOpacity>
          </View>
        ) : !isLoading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Apt urgente não encontrado.</Text>
          </View>
        ) : null}

        {/* Section 2: Em pausa */}
        <Text style={[styles.sectionTitle, styles.sectionTitleGap]}>Em pausa</Text>
        {pausedJob ? (
          <View style={styles.pausedCard}>
            <View style={styles.pausedRow}>
              <View style={styles.standbyBadge}>
                <Text style={styles.standbyBadgeText}>⏸ Stand By</Text>
              </View>
              <Text style={styles.pausedAptNumber}>
                {pausedJob.property.unitNumber}
              </Text>
            </View>
            <Text style={styles.pausedCondoName}>
              {pausedJob.property.condominium.name}
            </Text>
            <Text style={styles.pausedSubtext}>Retomar após o urgente</Text>
          </View>
        ) : !isLoading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Nenhum apt em pausa.</Text>
          </View>
        ) : null}

        {/* Section 3: Próximos */}
        {nextJobs.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, styles.sectionTitleGap]}>
              Próximos
            </Text>
            {nextJobs.map((job) => (
              <View key={job.id} style={styles.nextCard}>
                <Text style={styles.nextAptNumber}>
                  {job.property.unitNumber}
                </Text>
                <Text style={styles.nextCondoName}>
                  {job.property.condominium.name}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { padding: 16, paddingBottom: 32 },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
  },
  loader: { marginVertical: 24 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sectionTitleGap: { marginTop: 8 },

  // Urgent card
  urgentCard: {
    backgroundColor: '#E63946',
    borderRadius: 16,
    padding: 20,
    marginBottom: 4,
  },
  urgentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  urgentBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  urgentBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  urgentAptNumber: { fontSize: 24, fontWeight: '700', color: '#fff' },
  urgentCondoName: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 16,
  },
  startButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButtonText: { fontSize: 16, fontWeight: '700', color: '#E63946' },

  // Paused card
  pausedCard: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 20,
    marginBottom: 4,
    backgroundColor: '#fff',
  },
  pausedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  standbyBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  standbyBadgeText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  pausedAptNumber: { fontSize: 20, fontWeight: '700', color: '#9CA3AF' },
  pausedCondoName: { fontSize: 14, color: '#9CA3AF', marginBottom: 6 },
  pausedSubtext: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },

  // Next jobs
  nextCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2DC653',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  nextAptNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  nextCondoName: { fontSize: 13, color: '#6B7280' },

  // Empty state
  emptyCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 4,
  },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
});
