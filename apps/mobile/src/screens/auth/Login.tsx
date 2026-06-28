import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { api } from '../../api/axios';
import { useAuthStore } from '../../store/authStore';

type AuthStackParamList = {
  Login: undefined;
  Register: { token?: string };
  Main: undefined;
};

type LoginNavProp = StackNavigationProp<AuthStackParamList, 'Login'>;

export default function Login() {
  const navigation = useNavigation<LoginNavProp>();
  const login = useAuthStore((s) => s.login);

  const [phone, setPhone] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);

    if (!phone.trim() || !tenantId.trim() || !password.trim()) {
      setError('Preencha todos os campos.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/login', {
        identifier: phone.trim(),
        password,
        tenantId: tenantId.trim(),
      });

      const { accessToken, refreshToken, user } = res.data as {
        accessToken: string;
        refreshToken: string;
        user: { id: string; name: string; role: string; phone: string };
      };

      login({
        accessToken,
        refreshToken,
        tenantId: tenantId.trim(),
        userId: user.id,
        role: user.role as import('../../types').Role,
        name: user.name,
        phone: user.phone,
      });

      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message ?? 'Erro ao fazer login. Tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>STAY</Text>
        <Text style={styles.subtitle}>Gestão de limpeza</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Telefone</Text>
          <TextInput
            style={styles.input}
            placeholder="(11) 99999-9999"
            placeholderTextColor="#9CA3AF"
            value={phone}
            onChangeText={setPhone}
            keyboardType="numeric"
            autoCorrect={false}
            autoCapitalize="none"
            textContentType="telephoneNumber"
          />

          <Text style={styles.label}>ID do Tenant</Text>
          <TextInput
            style={styles.input}
            placeholder="Código da empresa"
            placeholderTextColor="#9CA3AF"
            value={tenantId}
            onChangeText={setTenantId}
            autoCorrect={false}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />

          {error != null && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Entrar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ghostLink}
            onPress={() => navigation.navigate('Register', {})}
            activeOpacity={0.7}
          >
            <Text style={styles.ghostLinkText}>Cadastrar-se</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  logo: {
    fontSize: 48,
    fontWeight: '800',
    color: '#0D7377',
    letterSpacing: 4,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 40,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    marginBottom: 16,
  },
  errorText: {
    color: '#E63946',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    height: 48,
    backgroundColor: '#0D7377',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  ghostLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  ghostLinkText: {
    color: '#0D7377',
    fontSize: 15,
    fontWeight: '500',
  },
});
