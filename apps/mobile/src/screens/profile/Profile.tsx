import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/axios';
import type { CleaningJob } from '../../types';

type RootStackParamList = {
  Availability: undefined;
  Login: undefined;
};

type NavProp = StackNavigationProp<RootStackParamList>;

function getInitials(name: string | null): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0][0]?.toUpperCase() ?? '?';
  const first = words[0][0]?.toUpperCase() ?? '';
  const last = words[words.length - 1][0]?.toUpperCase() ?? '';
  return first + last;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function Profile() {
  const navigation = useNavigation<NavProp>();
  const { name, phone, streakCount, logout } = useAuthStore();

  const { data: doneJobs, isLoading: loadingJobs } = useQuery<CleaningJob[]>({
    queryKey: ['jobs-done'],
    queryFn: () => api.get('/cleaning-jobs', { params: { status: 'DONE' } }).then((r) => r.data),
  });

  const todayDoneCount = useMemo(() => {
    if (!doneJobs) return 0;
    const today = new Date();
    return doneJobs.filter((j) => isSameDay(new Date(j.scheduledDate), today)).length;
  }, [doneJobs]);

  const initials = getInitials(name);

  function handleLogout() {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          logout();
          setTimeout(() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }), 0);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Eu</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile section */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{name ?? '—'}</Text>
          <Text style={styles.phone}>{phone ?? '—'}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.streakText}>🔥 {streakCount} dias em sequência</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              {loadingJobs ? (
                <ActivityIndicator size="small" color="#0D7377" />
              ) : (
                <Text style={styles.aptsText}>{todayDoneCount} apts hoje</Text>
              )}
            </View>
          </View>
        </View>

        {/* Menu cards */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => navigation.navigate('Availability')}
            activeOpacity={0.7}
          >
            <Text style={styles.menuCardText}>Minha disponibilidade</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => Alert.alert('Em breve', 'Esta função estará disponível em breve.')}
            activeOpacity={0.7}
          >
            <Text style={styles.menuCardText}>Configurações</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  scrollContent: { padding: 16, paddingBottom: 32 },

  profileSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0D7377',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#fff' },
  name: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  phone: { fontSize: 14, color: '#6B7280', marginBottom: 16 },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
    gap: 16,
  },
  statItem: { alignItems: 'center' },
  statDivider: { width: 1, height: 24, backgroundColor: '#E5E7EB' },
  streakText: { fontSize: 15, fontWeight: '600', color: '#F4A261' },
  aptsText: { fontSize: 15, fontWeight: '600', color: '#0D7377' },

  section: { marginBottom: 20 },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 56,
  },
  menuCardText: { fontSize: 16, color: '#111827' },
  chevron: { fontSize: 22, color: '#9CA3AF', fontWeight: '300' },

  logoutButton: {
    borderWidth: 1.5,
    borderColor: '#E63946',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    marginTop: 8,
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#E63946' },
});
