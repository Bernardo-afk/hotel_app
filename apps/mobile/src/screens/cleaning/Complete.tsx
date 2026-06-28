import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../api/axios';

type RootStackParamList = {
  Complete: { assignmentId: string; jobId: string };
  WellDone: { assignmentId?: string; jobId?: string };
};

type NavProp = StackNavigationProp<RootStackParamList>;
type CompleteRouteProp = RouteProp<RootStackParamList, 'Complete'>;

const SERVICE_OPTIONS = ['Urgente', 'Médio prazo', 'Pode esperar', 'Não'] as const;
type ServiceOption = (typeof SERVICE_OPTIONS)[number];

function serviceToUrgency(opt: ServiceOption): string | undefined {
  if (opt === 'Urgente') return 'URGENT';
  if (opt === 'Médio prazo') return 'MEDIUM';
  if (opt === 'Pode esperar') return 'LOW';
  return undefined;
}

const DIRT_LABELS: Record<number, string> = {
  1: '1 - Leve',
  2: '2',
  3: '3',
  4: '4',
  5: '5 - Muito sujo',
};

export default function Complete() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<CompleteRouteProp>();
  const { assignmentId, jobId } = route.params;

  const [starRating, setStarRating] = useState(0);
  const [dirtLevel, setDirtLevel] = useState(0);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [video, setVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [serviceChip, setServiceChip] = useState<ServiceOption>('Não');
  const [loading, setLoading] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images' as ImagePicker.MediaType,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhoto(result.assets[0]);
      setPhotoError(false);
    }
  };

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'videos' as ImagePicker.MediaType,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setVideo(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    if (!photo) {
      setPhotoError(true);
      Alert.alert('Atenção', 'A foto é obrigatória para concluir.');
      return;
    }
    if (starRating === 0) {
      Alert.alert('Atenção', 'Selecione o estado ao chegar (1-5 estrelas).');
      return;
    }
    if (dirtLevel === 0) {
      Alert.alert('Atenção', 'Selecione o nível de sujeira.');
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append('aptConditionFound', String(starRating));
      form.append('dirtLevel', String(dirtLevel));
      form.append('needsService', serviceChip !== 'Não' ? 'true' : 'false');
      const urgency = serviceToUrgency(serviceChip);
      if (urgency) form.append('serviceUrgency', urgency);
      form.append('photo', {
        uri: photo.uri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      } as any);
      if (video) {
        form.append('video', {
          uri: video.uri,
          name: 'video.mp4',
          type: 'video/mp4',
        } as any);
      }
      await api.post(`/reports/assignments/${assignmentId}/complete`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigation.navigate('WellDone', { assignmentId, jobId });
    } catch (err: any) {
      Alert.alert(
        'Erro',
        err?.response?.data?.message ?? 'Não foi possível concluir a limpeza.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Star rating */}
        <Text style={styles.sectionTitle}>Estado ao chegar</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => setStarRating(star)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Text
                style={[
                  styles.star,
                  starRating >= star ? styles.starFilled : styles.starEmpty,
                ]}
              >
                ★
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Dirt level */}
        <Text style={styles.sectionTitle}>Nível de sujeira</Text>
        <View style={styles.chipsRow}>
          {[1, 2, 3, 4, 5].map((level) => (
            <TouchableOpacity
              key={level}
              style={[styles.chip, dirtLevel === level && styles.chipSelected]}
              onPress={() => setDirtLevel(level)}
            >
              <Text
                style={[
                  styles.chipText,
                  dirtLevel === level && styles.chipTextSelected,
                ]}
              >
                {DIRT_LABELS[level]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Media */}
        <Text style={styles.sectionTitle}>Mídia</Text>
        <View style={styles.mediaGrid}>
          {/* Photo */}
          <TouchableOpacity
            style={[
              styles.mediaCard,
              photoError && !photo && styles.mediaCardError,
            ]}
            onPress={pickPhoto}
            activeOpacity={0.75}
          >
            {photo ? (
              <View style={styles.mediaSelectedContainer}>
                <Image
                  source={{ uri: photo.uri }}
                  style={styles.mediaThumbnail}
                />
                <View style={styles.checkOverlay}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
              </View>
            ) : (
              <View style={styles.mediaPlaceholder}>
                <Text style={styles.mediaIcon}>📷</Text>
                <Text style={styles.mediaLabel}>Foto obrigatória</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Video */}
          <TouchableOpacity
            style={styles.mediaCard}
            onPress={pickVideo}
            activeOpacity={0.75}
          >
            {video ? (
              <View style={styles.videoSelectedContainer}>
                <Text style={styles.videoCheckIcon}>✓</Text>
                <Text style={styles.videoSelectedLabel}>Vídeo adicionado</Text>
              </View>
            ) : (
              <View style={styles.mediaPlaceholder}>
                <Text style={styles.mediaIcon}>🎥</Text>
                <Text style={styles.mediaLabel}>Adicionar vídeo</Text>
                <Text style={styles.mediaTip}>Grave um vídeo rápido do apt</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Service */}
        <Text style={styles.sectionTitle}>Precisa de manutenção?</Text>
        <View style={styles.serviceChipsRow}>
          {SERVICE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[
                styles.serviceChip,
                serviceChip === opt && styles.serviceChipSelected,
              ]}
              onPress={() => setServiceChip(opt)}
            >
              <Text
                style={[
                  styles.serviceChipText,
                  serviceChip === opt && styles.serviceChipTextSelected,
                ]}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Submit button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Enviando...</Text>
          ) : (
            <Text style={styles.submitButtonText}>Enviar e concluir ✓</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: 16, paddingBottom: 24 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    marginTop: 20,
  },
  starsRow: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 40 },
  starFilled: { color: '#0D7377' },
  starEmpty: { color: '#D1D5DB' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
  },
  chipSelected: { backgroundColor: '#0D7377', borderColor: '#0D7377' },
  chipText: { fontSize: 14, color: '#374151' },
  chipTextSelected: { color: '#fff', fontWeight: '700' },
  mediaGrid: { flexDirection: 'row', gap: 10 },
  mediaCard: {
    flex: 1,
    height: 120,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  mediaCardError: { borderColor: '#E63946' },
  mediaPlaceholder: { alignItems: 'center', gap: 6 },
  mediaIcon: { fontSize: 28 },
  mediaLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    textAlign: 'center',
  },
  mediaTip: { fontSize: 11, color: '#9CA3AF', textAlign: 'center' },
  mediaSelectedContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  mediaThumbnail: { width: '100%', height: '100%', resizeMode: 'cover' },
  checkOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2DC653',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: { color: '#fff', fontSize: 16, fontWeight: '700' },
  videoSelectedContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#E6F7F7',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  videoCheckIcon: { fontSize: 36, color: '#0D7377' },
  videoSelectedLabel: { fontSize: 12, color: '#0D7377', fontWeight: '600' },
  serviceChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceChip: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
  },
  serviceChipSelected: { backgroundColor: '#0D7377', borderColor: '#0D7377' },
  serviceChipText: { fontSize: 15, color: '#374151' },
  serviceChipTextSelected: { color: '#fff', fontWeight: '700' },
  bottomContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  submitButton: {
    backgroundColor: '#2DC653',
    borderRadius: 14,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  submitButtonText: { fontSize: 18, fontWeight: '700', color: '#fff' },
});
