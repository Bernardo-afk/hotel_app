import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { api } from '../../api/axios';

type RootStackParamList = {
  GuestPresent: {
    assignmentId: string;
    jobId: string;
    coordinatorName?: string;
    coordinatorPhone?: string;
  };
};

type NavProp = StackNavigationProp<RootStackParamList>;
type GuestPresentRouteProp = RouteProp<RootStackParamList, 'GuestPresent'>;

function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function GuestPresent() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<GuestPresentRouteProp>();
  const { assignmentId, coordinatorName, coordinatorPhone } = route.params;

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [notified, setNotified] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const handleNotify = async () => {
    setLoading(true);
    try {
      await api.post(`/assignments/${assignmentId}/guest-present`);
      setNotified(true);
    } catch (err: any) {
      Alert.alert(
        'Erro',
        err?.response?.data?.message ?? 'Não foi possível notificar o coordenador.',
      );
    } finally {
      setLoading(false);
    }
  };

  const displayName = coordinatorName || 'Coordinator';
  const displayPhone = coordinatorPhone || '—';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#E63946" />

      {/* Red top bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarText}>Hóspede no quarto</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Alert card */}
        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>Hóspede ainda no quarto</Text>
          <Text style={styles.alertTimer}>
            Aguardando há {formatMmSs(elapsedSeconds)}
          </Text>
        </View>

        {/* Coordinator contact card */}
        <View style={styles.contactCard}>
          <Text style={styles.contactLabel}>Coordinator</Text>
          <View style={styles.contactRow}>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{displayName}</Text>
              <Text style={styles.contactPhone}>{displayPhone}</Text>
            </View>
            {coordinatorPhone ? (
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => Linking.openURL(`tel:${coordinatorPhone}`)}
                activeOpacity={0.75}
              >
                <Text style={styles.callEmoji}>📞</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Amber tip card */}
        <View style={styles.tipCard}>
          <Text style={styles.tipText}>
            Ligue para a coordinator antes de tomar qualquer decisão.
          </Text>
        </View>
      </ScrollView>

      {/* Buttons */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[
            styles.notifyButton,
            (notified || loading) && styles.buttonDisabled,
          ]}
          onPress={handleNotify}
          disabled={notified || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.notifyButtonText}>
              {notified ? '✓ Notificado' : 'Notificar coordinator pelo app'}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.waitButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
        >
          <Text style={styles.waitButtonText}>Continuar aguardando</Text>
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
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#F8F9FA',
  },
  alertCard: {
    backgroundColor: '#E63946',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  alertTimer: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  contactCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  contactLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactInfo: { flex: 1 },
  contactName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  contactPhone: { fontSize: 15, color: '#6B7280' },
  callButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0D7377',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  callEmoji: { fontSize: 22 },
  tipCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F4A261',
  },
  tipText: { fontSize: 14, color: '#92400E', lineHeight: 20 },
  bottomContainer: {
    padding: 16,
    paddingTop: 8,
    gap: 10,
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  notifyButton: {
    backgroundColor: '#E63946',
    borderRadius: 14,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifyButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  buttonDisabled: { opacity: 0.6 },
  waitButton: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitButtonText: { fontSize: 16, color: '#6B7280' },
});
