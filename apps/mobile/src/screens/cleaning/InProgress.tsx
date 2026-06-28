import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/axios';
import type { CleaningJob, IncidentType, UrgencyLevel } from '../../types';

type RootStackParamList = {
  InProgress: { assignmentId: string; jobId: string; startedAt: string };
  ReportIncident: { type: IncidentType; jobId: string; assignmentId: string };
  Complete: { assignmentId: string; jobId: string };
  Main: undefined;
};

type NavProp = StackNavigationProp<RootStackParamList>;
type InProgressRouteProp = RouteProp<RootStackParamList, 'InProgress'>;

const URGENCY_COLOR: Record<UrgencyLevel, string> = {
  RED: '#E63946',
  YELLOW: '#F4A261',
  GREEN: '#2DC653',
};

const URGENCY_LABEL: Record<UrgencyLevel, string> = {
  RED: 'Urgente',
  YELLOW: 'Médio',
  GREEN: 'Normal',
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

interface IncidentBtn {
  type: IncidentType;
  emoji: string;
  label: string;
  sublabel: string;
  bg: string;
}

const INCIDENT_BUTTONS: IncidentBtn[] = [
  { type: 'BROKEN', emoji: '🔴', label: 'Quebrado', sublabel: 'Relatar item quebrado', bg: '#FEE2E2' },
  { type: 'STAINED', emoji: '🟠', label: 'Manchado', sublabel: 'Relatar mancha', bg: '#FEF3C7' },
  { type: 'INFRASTRUCTURE', emoji: '🔵', label: 'Infraestrutura', sublabel: 'Problema de infra', bg: '#DBEAFE' },
  { type: 'LOST_ITEM', emoji: '🟣', label: 'Item perdido', sublabel: 'Objeto esquecido', bg: '#EDE9FE' },
];

export default function InProgress() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<InProgressRouteProp>();
  const { assignmentId, jobId, startedAt } = route.params;

  const [elapsed, setElapsed] = useState(0);
  const [cantFinishLoading, setCantFinishLoading] = useState(false);

  useEffect(() => {
    const startMs = new Date(startedAt).getTime();
    const tick = () => setElapsed(Date.now() - startMs);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const { data: job } = useQuery<CleaningJob>({
    queryKey: ['job', jobId],
    queryFn: () => api.get(`/cleaning-jobs/${jobId}`).then((r) => r.data),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (job?.status === 'STAND_BY') {
      Alert.alert(
        'Realocação urgente!',
        'Você foi realocado para outro apartamento.',
        [
          {
            text: 'OK',
            onPress: () =>
              navigation.reset({ index: 0, routes: [{ name: 'Main' }] }),
          },
        ],
      );
    }
  }, [job?.status, navigation]);

  const handleCantFinish = () => {
    Alert.alert(
      'Confirmar',
      'Tem certeza que não consegue finalizar a limpeza?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: async () => {
            setCantFinishLoading(true);
            try {
              await api.post(`/assignments/${assignmentId}/cant-finish`);
              navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
            } catch (err: any) {
              Alert.alert(
                'Erro',
                err?.response?.data?.message ?? 'Erro ao cancelar.',
              );
            } finally {
              setCantFinishLoading(false);
            }
          },
        },
      ],
    );
  };

  const urgency: UrgencyLevel = job?.urgencyLevel ?? job?.urgency ?? 'GREEN';
  const urgencyColor = URGENCY_COLOR[urgency];
  const urgencyLabel = URGENCY_LABEL[urgency];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Timer card */}
        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>tempo em andamento</Text>
          <Text style={styles.timerText}>{formatElapsed(elapsed)}</Text>
        </View>

        {/* Apt info */}
        {job ? (
          <View style={styles.aptRow}>
            <View style={[styles.urgencyChip, { backgroundColor: urgencyColor }]}>
              <Text style={styles.urgencyChipText}>{urgencyLabel}</Text>
            </View>
            <Text style={styles.aptNumber}>{job.property.unitNumber}</Text>
            <Text style={styles.condoName} numberOfLines={1}>
              {job.property.condominium.name}
            </Text>
          </View>
        ) : (
          <View style={styles.aptRowLoading}>
            <ActivityIndicator size="small" color="#0D7377" />
          </View>
        )}

        {/* Incident grid */}
        <Text style={styles.sectionTitle}>Registrar ocorrência</Text>
        <View style={styles.incidentGrid}>
          {INCIDENT_BUTTONS.map((btn) => (
            <TouchableOpacity
              key={btn.type}
              style={[styles.incidentButton, { backgroundColor: btn.bg }]}
              onPress={() =>
                navigation.navigate('ReportIncident', {
                  type: btn.type,
                  jobId,
                  assignmentId,
                })
              }
              activeOpacity={0.75}
            >
              <Text style={styles.incidentEmoji}>{btn.emoji}</Text>
              <Text style={styles.incidentLabel}>{btn.label}</Text>
              <Text style={styles.incidentSublabel}>{btn.sublabel}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Bottom buttons */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.completeButton}
          onPress={() => navigation.navigate('Complete', { assignmentId, jobId })}
          activeOpacity={0.85}
        >
          <Text style={styles.completeButtonText}>Concluir limpeza</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.cantFinishButton,
            cantFinishLoading && styles.buttonDisabled,
          ]}
          onPress={handleCantFinish}
          disabled={cantFinishLoading}
          activeOpacity={0.75}
        >
          {cantFinishLoading ? (
            <ActivityIndicator color="#6B7280" />
          ) : (
            <Text style={styles.cantFinishText}>Não consigo finalizar</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { padding: 16, paddingBottom: 8 },
  timerCard: {
    backgroundColor: '#0D7377',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  timerLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timerText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  aptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  aptRowLoading: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  urgencyChip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  urgencyChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  aptNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  condoName: { fontSize: 14, color: '#6B7280', flexShrink: 1 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  incidentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  incidentButton: {
    width: '48%',
    minHeight: 80,
    borderRadius: 12,
    padding: 14,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  incidentEmoji: { fontSize: 22, marginBottom: 4 },
  incidentLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  incidentSublabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  bottomContainer: {
    padding: 16,
    paddingTop: 8,
    gap: 8,
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  completeButton: {
    backgroundColor: '#2DC653',
    borderRadius: 14,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeButtonText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  cantFinishButton: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cantFinishText: { fontSize: 16, color: '#6B7280' },
  buttonDisabled: { opacity: 0.6 },
});
