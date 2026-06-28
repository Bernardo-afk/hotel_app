import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { api } from '../../api/axios';
import type { TransportType } from '../../types';

type RootStackParamList = {
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
type TransportRouteProp = RouteProp<RootStackParamList, 'TransportRegister'>;

const TRANSPORT_CHIPS: { label: string; value: TransportType }[] = [
  { label: 'Uber', value: 'UBER' },
  { label: '99', value: 'NOVENTA_E_NOVE' },
  { label: 'Ônibus', value: 'ONIBUS' },
  { label: 'Metrô', value: 'METRO' },
  { label: 'Outro', value: 'OUTRO' },
];

type OcrStatus = 'idle' | 'loading' | 'success' | 'error';

export default function TransportRegister() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<TransportRouteProp>();
  const params = route.params;

  const [selectedType, setSelectedType] = useState<TransportType | null>(null);
  const [amount, setAmount] = useState('');
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle');
  const [ocrConfidence, setOcrConfidence] = useState<'HIGH' | 'LOW' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão negada', 'Permita o acesso à câmera nas configurações.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('Erro', 'Não foi possível ler a imagem.');
      return;
    }

    setOcrStatus('loading');
    try {
      const response = await api.post('/ocr/extract', {
        imageBase64: asset.base64,
        mediaType: 'image/jpeg',
      });
      const { amount: ocrAmount, confidence } = response.data as { amount: number; confidence: 'HIGH' | 'LOW'; rawText: string };
      setAmount(ocrAmount.toFixed(2).replace('.', ','));
      setOcrConfidence(confidence);
      setOcrStatus('success');
    } catch {
      setOcrStatus('error');
      setOcrConfidence(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert('Atenção', 'Selecione o tipo de transporte.');
      return;
    }
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Atenção', 'Informe o valor da corrida.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/transport', {
        transportType: selectedType,
        amount: parsedAmount,
        originName: 'Local anterior',
        originLat: 0,
        originLng: 0,
        destinationName: params.destinationName,
        destinationLat: params.destinationLat ?? 0,
        destinationLng: params.destinationLng ?? 0,
        ocrConfidence: ocrConfidence ?? null,
      });
      navigation.navigate('DoorWarning', {
        assignmentId: params.assignmentId ?? '',
        jobId: params.jobId,
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível registrar o transporte. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    navigation.navigate('DoorWarning', {
      assignmentId: params.assignmentId ?? '',
      jobId: params.jobId,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Registro de Transporte</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Route label */}
          <View style={styles.routeCard}>
            <Text style={styles.routeText}>
              Origem: Local anterior  →  Destino: {params.destinationName}
            </Text>
          </View>

          {/* Transport type chips */}
          <Text style={styles.sectionLabel}>Tipo de transporte</Text>
          <View style={styles.chipsRow}>
            {TRANSPORT_CHIPS.map((chip) => {
              const selected = selectedType === chip.value;
              return (
                <TouchableOpacity
                  key={chip.value}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setSelectedType(chip.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Amount field */}
          <Text style={styles.sectionLabel}>Valor</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currencyPrefix}>R$</Text>
            <TextInput
              style={styles.amountInput}
              keyboardType="numeric"
              placeholder="0,00"
              placeholderTextColor="#9CA3AF"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          {/* OCR / Receipt photo */}
          <Text style={styles.sectionLabel}>Comprovante</Text>
          <TouchableOpacity style={styles.photoButton} onPress={handlePickPhoto} activeOpacity={0.7}>
            <Text style={styles.photoButtonIcon}>📷</Text>
            <Text style={styles.photoButtonText}>Foto do comprovante</Text>
          </TouchableOpacity>

          {ocrStatus === 'loading' && (
            <View style={styles.ocrBadge}>
              <ActivityIndicator size="small" color="#0D7377" />
              <Text style={styles.ocrBadgeText}>Lendo comprovante...</Text>
            </View>
          )}

          {ocrStatus === 'success' && (
            <View style={[styles.ocrBadge, styles.ocrBadgeSuccess]}>
              <Text style={styles.ocrBadgeTextSuccess}>
                R$ {amount} — Lido automaticamente ✓
              </Text>
            </View>
          )}

          {ocrStatus === 'error' && (
            <View style={[styles.ocrBadge, styles.ocrBadgeError]}>
              <Text style={styles.ocrBadgeTextError}>
                Leitura falhou — preencha manualmente
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Action buttons */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.primaryBtn, submitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Registrar corrida</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.ghostBtn} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={styles.ghostBtnText}>Não usei transporte</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  scrollContent: { padding: 16, paddingBottom: 160 },
  routeCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#0D7377',
  },
  routeText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    minHeight: 48,
  },
  chipSelected: { borderColor: '#0D7377', backgroundColor: '#0D7377' },
  chipText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  chipTextSelected: { color: '#fff' },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    paddingHorizontal: 14,
    marginBottom: 20,
    height: 52,
  },
  currencyPrefix: { fontSize: 17, fontWeight: '600', color: '#374151', marginRight: 6 },
  amountInput: { flex: 1, fontSize: 20, fontWeight: '600', color: '#111827' },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0D7377',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  photoButtonIcon: { fontSize: 20 },
  photoButtonText: { fontSize: 15, color: '#0D7377', fontWeight: '600' },
  ocrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
  },
  ocrBadgeSuccess: { backgroundColor: '#D1FAE5' },
  ocrBadgeError: { backgroundColor: '#FEF3C7' },
  ocrBadgeText: { fontSize: 14, color: '#374151' },
  ocrBadgeTextSuccess: { fontSize: 14, color: '#065F46', fontWeight: '500' },
  ocrBadgeTextError: { fontSize: 14, color: '#92400E', fontWeight: '500' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: '#0D7377',
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  ghostBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0D7377',
  },
  ghostBtnText: { color: '#0D7377', fontSize: 16, fontWeight: '600' },
});
