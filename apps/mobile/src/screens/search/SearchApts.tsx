import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Modal,
  TextInput,
  RefreshControl,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api } from '../../api/axios';
import type { UrgencyLevel, Property } from '../../types';

type CandidacyStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface CandidacyJob {
  id: string;
  urgencyLevel?: UrgencyLevel;
  urgency?: UrgencyLevel | null;
  property: {
    unitNumber: string;
    condominium: { name: string };
  };
}

interface Candidacy {
  id: string;
  status: CandidacyStatus;
  cleaningJob?: CandidacyJob;
  job?: CandidacyJob;
  jobId?: string;
}

const URGENCY_COLOR: Record<UrgencyLevel, string> = {
  RED: '#E63946',
  YELLOW: '#F4A261',
  GREEN: '#2DC653',
};

const STATUS_COLOR: Record<CandidacyStatus, string> = {
  PENDING: '#F4A261',
  APPROVED: '#2DC653',
  REJECTED: '#E63946',
};

const STATUS_LABEL: Record<CandidacyStatus, string> = {
  PENDING: 'Candidatura enviada',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
};

function CandidacyRow({ item }: { item: Candidacy }) {
  const jobData = item.cleaningJob ?? item.job;
  const urgency: UrgencyLevel = jobData?.urgencyLevel ?? jobData?.urgency ?? 'GREEN';
  const dotColor = URGENCY_COLOR[urgency];
  const badgeColor = STATUS_COLOR[item.status] ?? '#6B7280';
  const badgeLabel = STATUS_LABEL[item.status] ?? item.status;
  const unitNumber = jobData?.property?.unitNumber ?? '—';
  const condoName = jobData?.property?.condominium?.name ?? '—';

  return (
    <View style={styles.row}>
      <View style={[styles.urgencyDot, { backgroundColor: dotColor }]} />
      <View style={styles.rowInfo}>
        <Text style={styles.aptNumber}>Apt {unitNumber}</Text>
        <Text style={styles.condoName}>{condoName}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: badgeColor }]}>
        <Text style={styles.badgeText}>{badgeLabel}</Text>
      </View>
    </View>
  );
}

export default function SearchApts() {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [jobIdInput, setJobIdInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { data: candidacies, isLoading, isError, refetch } = useQuery<Candidacy[]>({
    queryKey: ['candidacies'],
    queryFn: () => api.get('/candidacies').then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (jobId: string) => api.post('/candidacies', { jobId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidacies'] });
      setModalVisible(false);
      setJobIdInput('');
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleSubmit = () => {
    const trimmed = jobIdInput.trim();
    if (!trimmed) return;
    mutation.mutate(trimmed);
  };

  const closeModal = () => {
    setModalVisible(false);
    setJobIdInput('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Apts disponíveis</Text>
      </View>

      {isLoading && !refreshing && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0D7377" />
        </View>
      )}

      {isError && (
        <View style={styles.center}>
          <Text style={styles.errorText}>Erro ao carregar candidaturas.</Text>
        </View>
      )}

      {!isLoading && !isError && (
        <FlatList
          data={candidacies}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D7377" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Nenhuma candidatura ainda</Text>
            </View>
          }
          renderItem={({ item }) => <CandidacyRow item={item} />}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Candidacy Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Me candidatar</Text>
            <Text style={styles.modalSubtitle}>
              Informe o código do apartamento fornecido pelo coordenador
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Código do apartamento (Job ID)"
              placeholderTextColor="#9CA3AF"
              value={jobIdInput}
              onChangeText={setJobIdInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  (!jobIdInput.trim() || mutation.isPending) && styles.confirmBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!jobIdInput.trim() || mutation.isPending}
              >
                {mutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
            {mutation.isError && (
              <Text style={styles.mutationError}>
                Erro ao enviar candidatura. Tente novamente.
              </Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  errorText: { fontSize: 16, color: '#E63946' },
  emptyText: { fontSize: 16, color: '#6B7280', textAlign: 'center' },
  listContent: { padding: 16, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    minHeight: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  urgencyDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  rowInfo: { flex: 1 },
  aptNumber: { fontSize: 16, fontWeight: '700', color: '#111827' },
  condoName: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0D7377',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: { fontSize: 30, color: '#fff', lineHeight: 34 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  modalSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 16,
    minHeight: 48,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 15, color: '#374151', fontWeight: '500' },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#0D7377',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  mutationError: { fontSize: 13, color: '#E63946', marginTop: 10, textAlign: 'center' },
});
