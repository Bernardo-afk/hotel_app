import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { api } from '../../api/axios';

type RootStackParamList = {
  DoorWarning: { assignmentId: string; jobId: string };
  InProgress: { assignmentId: string; jobId: string; startedAt: string };
  GuestPresent: { assignmentId: string; jobId: string };
};

type NavProp = StackNavigationProp<RootStackParamList>;
type DoorWarningRouteProp = RouteProp<RootStackParamList, 'DoorWarning'>;

export default function DoorWarning() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<DoorWarningRouteProp>();
  const { assignmentId, jobId } = route.params;
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    setLoading(true);
    try {
      await api.post(`/assignments/${assignmentId}/door-knocked`);
      navigation.navigate('InProgress', {
        assignmentId,
        jobId,
        startedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      const status: number | undefined = err?.response?.status;
      const message: string =
        err?.response?.data?.message ?? err?.message ?? '';
      if (status === 409 || message.toLowerCase().includes('guest')) {
        navigation.navigate('GuestPresent', { assignmentId, jobId });
      } else {
        Alert.alert(
          'Erro',
          message || 'Não foi possível registrar a batida na porta.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D7377" />
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.emoji}>🚪</Text>
        </View>
        <Text style={styles.mainText}>
          BATA NA PORTA E AGUARDE 1 MINUTO antes de entrar
        </Text>
        <Text style={styles.subText}>
          Verifique se o hóspede saiu antes de entrar
        </Text>
      </View>
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handlePress}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#0D7377" />
          ) : (
            <Text style={styles.buttonText}>Já bati e aguardei</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D7377' },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  emoji: { fontSize: 80 },
  mainText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 32,
  },
  subText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.85,
  },
  bottomContainer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  button: {
    width: '80%',
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { fontSize: 18, fontWeight: '700', color: '#0D7377' },
});
