import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../api/axios';
import type { IncidentType } from '../../types';

type RootStackParamList = {
  ReportIncident: { type: IncidentType; jobId: string; assignmentId: string; unitNumber: string };
};

type NavProp = StackNavigationProp<RootStackParamList>;
type ReportIncidentRouteProp = RouteProp<RootStackParamList, 'ReportIncident'>;

interface IncidentOption {
  type: IncidentType;
  emoji: string;
  label: string;
}

const INCIDENT_OPTIONS: IncidentOption[] = [
  { type: 'BROKEN', emoji: '🔴', label: 'Quebrado' },
  { type: 'STAINED', emoji: '🟠', label: 'Manchado' },
  { type: 'INFRASTRUCTURE', emoji: '🔵', label: 'Infraestrutura' },
  { type: 'LOST_ITEM', emoji: '🟣', label: 'Item perdido' },
];

export default function ReportIncident() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<ReportIncidentRouteProp>();
  const { type: initialType, jobId, unitNumber } = route.params;

  const [selectedType, setSelectedType] = useState<IncidentType>(initialType);
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera para tirar fotos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images' as ImagePicker.MediaType,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhoto(result.assets[0]);
    }
  };

  const handleSave = async () => {
    if (!description.trim()) {
      Alert.alert('Atenção', 'Descreva o problema antes de salvar.');
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append('jobId', jobId);
      form.append('type', selectedType);
      form.append('description', description.trim());
      if (photo) {
        form.append('photo', {
          uri: photo.uri,
          name: 'photo.jpg',
          type: 'image/jpeg',
        } as any);
      }
      await api.post('/incidents', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigation.goBack();
    } catch (err: unknown) {
      Alert.alert(
        'Erro',
        (err as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message
          ?? (err as { message?: string }).message
          ?? 'Não foi possível salvar a ocorrência.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova ocorrência — Apto {unitNumber}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type selection */}
        <Text style={styles.sectionLabel}>Tipo de ocorrência</Text>
        <View style={styles.typeGrid}>
          {INCIDENT_OPTIONS.map((opt) => {
            const selected = selectedType === opt.type;
            return (
              <TouchableOpacity
                key={opt.type}
                style={[styles.typeCard, selected && styles.typeCardSelected]}
                onPress={() => setSelectedType(opt.type)}
                activeOpacity={0.75}
              >
                <Text style={styles.typeEmoji}>{opt.emoji}</Text>
                <Text
                  style={[
                    styles.typeLabel,
                    selected && styles.typeLabelSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Description */}
        <Text style={styles.sectionLabel}>Descrição</Text>
        <TextInput
          style={styles.textInput}
          multiline
          numberOfLines={4}
          placeholder="Descreva o problema..."
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          textAlignVertical="top"
        />

        {/* Photo */}
        <Text style={styles.sectionLabel}>Foto</Text>
        <TouchableOpacity
          style={styles.photoButton}
          onPress={pickPhoto}
          activeOpacity={0.75}
        >
          {photo ? (
            <Image source={{ uri: photo.uri }} style={styles.thumbnail} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.cameraIcon}>📷</Text>
              <Text style={styles.photoLabel}>Adicionar foto</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Save button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Salvar</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: { padding: 4 },
  backArrow: { fontSize: 24, color: '#111827' },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  headerRight: { width: 32 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
    marginTop: 16,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  typeCardSelected: {
    borderWidth: 2,
    borderColor: '#0D7377',
    backgroundColor: '#F0FAFA',
  },
  typeEmoji: { fontSize: 24 },
  typeLabel: { fontSize: 15, fontWeight: '600', color: '#374151' },
  typeLabelSelected: { color: '#0D7377' },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    minHeight: 100,
    backgroundColor: '#F9FAFB',
  },
  photoButton: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 12,
    overflow: 'hidden',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholder: { alignItems: 'center', gap: 8 },
  cameraIcon: { fontSize: 32 },
  photoLabel: { fontSize: 14, color: '#6B7280' },
  thumbnail: { width: '100%', height: '100%', resizeMode: 'cover' },
  bottomContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  saveButton: {
    backgroundColor: '#0D7377',
    borderRadius: 14,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 18, fontWeight: '700', color: '#fff' },
});
