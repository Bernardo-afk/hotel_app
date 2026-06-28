import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { api } from '../../api/axios';
import type { CleaningJob, CleaningJobStatus } from '../../types';

type RootStackParamList = {
  HistoryDetail: { jobId: string };
};
type NavProp = StackNavigationProp<RootStackParamList>;
type HistoryDetailRouteProp = RouteProp<RootStackParamList, 'HistoryDetail'>;

// ─── helpers ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Partial<Record<CleaningJobStatus, { color: string; label: string }>> & {
  [key: string]: { color: string; label: string };
} = {
  DONE: { color: '#2DC653', label: 'Concluído' },
  PARTIAL: { color: '#F4A261', label: 'Parcial' },
  CANCELLED: { color: '#E63946', label: 'Cancelado' },
  IN_PROGRESS: { color: '#0D7377', label: 'Em andamento' },
  ASSIGNED: { color: '#0D7377', label: 'Atribuído' },
  PENDING: { color: '#6B7280', label: 'Pendente' },
  STAND_BY: { color: '#F4A261', label: 'Em espera' },
  BLOCKED: { color: '#E63946', label: 'Bloqueado' },
};

function getStatusConfig(status: CleaningJobStatus): { color: string; label: string } {
  return STATUS_CONFIG[status] ?? { color: '#6B7280', label: status };
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ASSIGNMENT_STATUS_LABEL: Record<string, string> = {
  NOTIFIED: 'Notificado',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluído',
};

// ─── screen ─────────────────────────────────────────────────────────────────

export default function HistoryDetail() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<HistoryDetailRouteProp>();
  const { jobId } = route.params;

  const { data: job, isLoading, isError } = useQuery<CleaningJob>({
    queryKey: ['job', jobId],
    queryFn: () => api.get(`/cleaning-jobs/${jobId}`).then((r) => r.data),
  });

  const statusCfg = job ? getStatusConfig(job.status) : null;
  const myAssignment = job?.assignments?.[0];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Detalhes</Text>
        <View style={styles.backBtn} />
      </View>

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0D7377" />
        </View>
      )}

      {isError && (
        <View style={styles.center}>
          <Text style={styles.errorText}>Erro ao carregar detalhes.</Text>
        </View>
      )}

      {job && statusCfg && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Hero */}
          <View style={styles.heroCard}>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.color }]}>
              <Text style={styles.statusBadgeText}>{statusCfg.label}</Text>
            </View>
            <Text style={styles.aptNumber}>{job.property.unitNumber}</Text>
            <Text style={styles.condoName}>{job.property.condominium.name}</Text>
            <Text style={styles.address}>{job.property.address}</Text>
          </View>

          {/* Info cards */}
          <View style={styles.infoSection}>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Data da limpeza</Text>
              <Text style={styles.infoValue}>{formatDate(job.scheduledDate)}</Text>
            </View>

            {job.reservation?.checkOut ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Checkout</Text>
                <Text style={styles.infoValue}>{formatDateTime(job.reservation.checkOut)}</Text>
              </View>
            ) : null}

            {job.reservation?.checkIn ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Próximo check-in</Text>
                <Text style={styles.infoValue}>{formatDateTime(job.reservation.checkIn)}</Text>
              </View>
            ) : null}

            {myAssignment ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Status do assignment</Text>
                <Text style={styles.infoValue}>
                  {ASSIGNMENT_STATUS_LABEL[myAssignment.status] ?? myAssignment.status}
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  backIcon: { fontSize: 22, color: '#0D7377' },
  topBarTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: '#E63946' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 14,
  },
  statusBadgeText: { color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 1 },
  aptNumber: { fontSize: 32, fontWeight: '800', color: '#111827', marginBottom: 4 },
  condoName: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 4 },
  address: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 16 },
  infoSection: { gap: 10 },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
});
