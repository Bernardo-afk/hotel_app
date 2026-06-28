import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import type { CleaningJob } from '../../types';

type RootStackParamList = {
  WellDone: { assignmentId?: string; jobId?: string };
  Main: undefined;
};

type NavProp = StackNavigationProp<RootStackParamList>;
type WellDoneRouteProp = RouteProp<RootStackParamList, 'WellDone'>;

export default function WellDone() {
  const navigation = useNavigation<NavProp>();
  useRoute<WellDoneRouteProp>();

  const name = useAuthStore((s) => s.name);
  const streakCount = useAuthStore((s) => s.streakCount);

  const { data: doneJobs } = useQuery<CleaningJob[]>({
    queryKey: ['done-jobs'],
    queryFn: () =>
      api.get('/cleaning-jobs', { params: { status: 'DONE' } }).then((r) => r.data),
  });

  const doneToday = doneJobs?.length ?? streakCount;
  const totalToday = Math.max(doneToday, streakCount);
  const progressPct = !doneJobs ? 0 : (totalToday > 0 ? Math.min((doneToday / totalToday) * 100, 100) : 0);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.content}>
        {/* Badge */}
        <View style={styles.badge}>
          <Text style={styles.badgeEmoji}>⭐</Text>
          <View style={styles.streakPill}>
            <Text style={styles.streakText}>{streakCount}x</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Bom trabalho, {name ?? 'você'}!</Text>
        <Text style={styles.subtitle}>
          Você está em sequência de {streakCount} apts hoje!
        </Text>

        {/* Metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricPill}>
            <Text style={styles.metricValue}>{doneToday}</Text>
            <Text style={styles.metricLabel}>apts hoje</Text>
          </View>
          <View style={styles.metricPill}>
            <Text style={styles.metricValue}>⏱ --</Text>
            <Text style={styles.metricLabel}>tempo</Text>
          </View>
          <View style={styles.metricPill}>
            <Text style={styles.metricValue}>✅ --</Text>
            <Text style={styles.metricLabel}>restantes</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progressPct}%` as any }]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {doneToday} de {totalToday} apts concluídos hoje
          </Text>
        </View>
      </View>

      {/* Continue button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() =>
            navigation.reset({ index: 0, routes: [{ name: 'Main' }] })
          }
          activeOpacity={0.85}
        >
          <Text style={styles.continueButtonText}>Continuar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  badge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0D7377',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  badgeEmoji: { fontSize: 48 },
  streakPill: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: '#F4A261',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  streakText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  metricPill: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  metricLabel: { fontSize: 12, color: '#6B7280' },
  progressContainer: { width: '100%', gap: 8 },
  progressTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#0D7377', borderRadius: 4 },
  progressLabel: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  bottomContainer: { padding: 16 },
  continueButton: {
    backgroundColor: '#0D7377',
    borderRadius: 14,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: { fontSize: 18, fontWeight: '700', color: '#fff' },
});
