import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/axios';

interface AvailabilityRecord {
  date: string;
  available: boolean;
  startTime?: string;
  endTime?: string;
}

const DAYS_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
// ISO weekday: Mon=1 ... Sun=7 (getDay() gives 0=Sun, 1=Mon...6=Sat)

function getThisWeekDates(): string[] {
  const today = new Date();
  // Monday of this week
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  });
}

export default function Availability() {
  const navigation = useNavigation();
  const userId = useAuthStore((s) => s.userId);

  // Local toggle state: date string -> boolean
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const weekDates = getThisWeekDates();

  const { data: availabilityData, isLoading, isError } = useQuery<AvailabilityRecord[]>({
    queryKey: ['availability', userId],
    queryFn: () =>
      api.get(`/availability/${userId}`).then((r) => r.data),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!availabilityData) return;
    const initial: Record<string, boolean> = {};
    // Default all this week's days to true
    weekDates.forEach((d) => {
      initial[d] = true;
    });
    // Override with fetched data
    availabilityData.forEach((rec) => {
      if (weekDates.includes(rec.date)) {
        initial[rec.date] = rec.available;
      }
    });
    setToggles(initial);
  // weekDates is stable (computed outside component on each render, but array ref changes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availabilityData]);

  const handleToggle = useCallback((date: string, value: boolean) => {
    setToggles((prev) => ({ ...prev, [date]: value }));
  }, []);

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    try {
      await Promise.all(
        weekDates.map((date) =>
          api.put(`/availability/${userId}/${date}`, {
            available: toggles[date] ?? true,
          }),
        ),
      );
      Alert.alert('Sucesso', 'Disponibilidade salva com sucesso!');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a disponibilidade. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Minha disponibilidade</Text>
        <View style={styles.backButton} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0D7377" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Erro ao carregar disponibilidade.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionLabel}>Esta semana</Text>
          {weekDates.map((date, idx) => {
            const isAvailable = toggles[date] ?? true;
            return (
              <View key={date} style={styles.dayRow}>
                <Text style={styles.dayName}>{DAYS_PT[idx]}</Text>
                <Text style={styles.dateLabel}>{date.slice(8, 10)}/{date.slice(5, 7)}</Text>
                <Switch
                  value={isAvailable}
                  onValueChange={(val) => handleToggle(date, val)}
                  trackColor={{ false: '#D1D5DB', true: '#0D7377' }}
                  thumbColor="#fff"
                />
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Fixed save button */}
      <View style={styles.saveContainer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveText}>Salvar disponibilidade</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: { width: 44, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  backText: { fontSize: 32, color: '#0D7377', lineHeight: 36 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: '#E63946' },

  scrollContent: { padding: 16, paddingBottom: 24 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    minHeight: 56,
  },
  dayName: { fontSize: 16, fontWeight: '600', color: '#111827', width: 40 },
  dateLabel: { flex: 1, fontSize: 14, color: '#6B7280' },

  saveContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  saveButton: {
    backgroundColor: '#0D7377',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
