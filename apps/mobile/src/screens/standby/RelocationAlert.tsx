import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  RelocationAlert: {
    urgentJobId: string;
    urgentAptNumber: string;
    urgentCondoName: string;
    checkInDeadline: string;
    pausedJobId: string;
    minutesLeftOnCurrent: number;
  };
  HomeAfterRelocation: { urgentJobId: string; pausedJobId: string };
};

type NavProp = StackNavigationProp<RootStackParamList>;
type RelocationAlertRouteProp = RouteProp<RootStackParamList, 'RelocationAlert'>;

function formatTimeLeft(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return '0 min';
  const totalMinutes = Math.floor(diff / 60000);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatDeadlineTime(deadline: string): string {
  try {
    const d = new Date(deadline);
    if (isNaN(d.getTime())) return deadline;
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return deadline;
  }
}

export default function RelocationAlert() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RelocationAlertRouteProp>();
  const {
    urgentJobId,
    urgentAptNumber,
    urgentCondoName,
    checkInDeadline,
    pausedJobId,
    minutesLeftOnCurrent,
  } = route.params;

  const timeLeft = formatTimeLeft(checkInDeadline);
  const deadlineDisplay = formatDeadlineTime(checkInDeadline);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#E63946" />

      {/* Red top bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarText}>Atenção — realocação urgente</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Alert card */}
        <View style={styles.alertCard}>
          <Text style={styles.alertCardTitle}>Novo apt urgente surgiu</Text>
          <Text style={styles.alertCardBody}>
            Apto {urgentAptNumber} ({urgentCondoName}) precisa ser limpo antes das{' '}
            {deadlineDisplay}
          </Text>
          <View style={styles.checkinRow}>
            <Text style={styles.checkinLabel}>Checkin em</Text>
            <Text style={styles.checkinTime}>{timeLeft}</Text>
          </View>
        </View>

        {/* Decision card */}
        <View style={styles.decisionCard}>
          <Text style={styles.decisionLabel}>Tempo restante no apt atual</Text>
          <Text style={styles.decisionValue}>~{minutesLeftOnCurrent} min</Text>
        </View>
      </ScrollView>

      {/* Buttons */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.goNowButton}
          onPress={() =>
            navigation.navigate('HomeAfterRelocation', { urgentJobId, pausedJobId })
          }
          activeOpacity={0.85}
        >
          <Text style={styles.goNowButtonText}>Ir agora pro urgente</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.finishFirstButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
        >
          <Text style={styles.finishFirstText}>
            Terminar este primeiro (~{minutesLeftOnCurrent} min)
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E63946' },
  topBar: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  topBarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  scrollView: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { padding: 16, paddingBottom: 8 },
  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E63946',
    padding: 20,
    marginBottom: 16,
  },
  alertCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E63946',
    marginBottom: 10,
  },
  alertCardBody: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 12,
  },
  checkinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  checkinLabel: { fontSize: 13, color: '#9B1C1C' },
  checkinTime: { fontSize: 13, fontWeight: '700', color: '#9B1C1C' },
  decisionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  decisionLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  decisionValue: { fontSize: 22, fontWeight: '700', color: '#374151' },
  bottomContainer: {
    padding: 16,
    paddingTop: 8,
    gap: 10,
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  goNowButton: {
    backgroundColor: '#E63946',
    borderRadius: 14,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goNowButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  finishFirstButton: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  finishFirstText: { fontSize: 15, color: '#6B7280', textAlign: 'center' },
});
