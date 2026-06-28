import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { api } from '../../api/axios';
import type { CleaningJob, UrgencyLevel } from '../../types';

const URGENCY_COLOR: Record<UrgencyLevel, string> = {
  RED: '#E63946',
  YELLOW: '#F4A261',
  GREEN: '#2DC653',
};

const URGENCY_LABEL: Record<UrgencyLevel, string> = {
  RED: 'URGENTE',
  YELLOW: 'ATENÇÃO',
  GREEN: 'OK',
};

function formatDateTime(dateStr: string | undefined | null): string {
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

type RootStackParamList = {
  AptDetail: { jobId: string };
  TransportRegister: {
    jobId: string;
    assignmentId?: string;
    destinationName: string;
    destinationLat?: number;
    destinationLng?: number;
  };
  DoorWarning: { assignmentId: string; jobId: string };
};

type NavProp = StackNavigationProp<RootStackParamList>;
type AptDetailRouteProp = RouteProp<RootStackParamList, 'AptDetail'>;

export default function AptDetail() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<AptDetailRouteProp>();
  const { jobId } = route.params;

  const { data: job, isLoading, isError } = useQuery<CleaningJob>({
    queryKey: ['job', jobId],
    queryFn: () => api.get(`/cleaning-jobs/${jobId}`).then((r) => r.data),
  });

  const handleStartCleaning = () => {
    if (!job) return;
    Alert.alert(
      'Transporte',
      'Veio de outro condomínio?',
      [
        {
          text: 'Sim',
          onPress: () => {
            navigation.navigate('TransportRegister', {
              jobId: job.id,
              assignmentId: job.assignments[0]?.id ?? '',
              destinationName: job.property.condominium.name,
              destinationLat: job.property.lat,
              destinationLng: job.property.lng,
            });
          },
        },
        {
          text: 'Não',
          onPress: () => {
            navigation.navigate('DoorWarning', {
              assignmentId: job.assignments[0]?.id ?? '',
              jobId: job.id,
            });
          },
        },
      ],
      { cancelable: true },
    );
  };

  const urgency: UrgencyLevel = job?.urgencyLevel ?? job?.urgency ?? 'GREEN';
  const urgencyColor = URGENCY_COLOR[urgency];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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
          <Text style={styles.errorText}>Erro ao carregar apartamento.</Text>
        </View>
      )}

      {job && (
        <>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Urgency badge */}
            <View style={styles.heroSection}>
              <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor }]}>
                <Text style={styles.urgencyBadgeText}>{URGENCY_LABEL[urgency]}</Text>
              </View>
              <Text style={styles.aptNumber}>{job.property.unitNumber}</Text>
              <Text style={styles.condoName}>{job.property.condominium.name}</Text>
              <Text style={styles.address}>{job.property.address}</Text>
            </View>

            {/* Info cards */}
            <View style={styles.infoSection}>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Checkout</Text>
                <Text style={styles.infoValue}>{formatDateTime(job.reservation?.checkOut)}</Text>
              </View>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Próximo check-in</Text>
                <Text style={[styles.infoValue, urgency === 'RED' && { color: '#E63946' }]}>
                  {formatDateTime(job.reservation?.checkIn)}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Fixed bottom button */}
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.startBtn} onPress={handleStartCleaning} activeOpacity={0.85}>
              <Text style={styles.startBtnText}>Iniciar limpeza</Text>
            </TouchableOpacity>
          </View>
        </>
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
  scrollContent: { padding: 16, paddingBottom: 100 },
  heroSection: { alignItems: 'center', paddingVertical: 24, backgroundColor: '#fff', borderRadius: 12, marginBottom: 16 },
  urgencyBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  urgencyBadgeText: { color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 1 },
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
  infoLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  startBtn: {
    backgroundColor: '#0D7377',
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
