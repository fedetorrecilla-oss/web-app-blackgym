import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { User, Shield, ArrowRight, Phone, Calendar } from 'lucide-react-native';
import { useGym } from '@/context/GymContext';
import Colors from '@/constants/colors';
import { ADMIN_PASSWORD } from '@/constants/gym';
import { UserRole } from '@/types/gym';

export default function LoginScreen() {
  const router = useRouter();
  const { currentUser, isLoading, login, loginPending } = useGym();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const formAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    if (currentUser && !isLoading) {
      console.log('[Login] User already logged in, redirecting...');
      router.replace('/(tabs)/schedule');
    }
  }, [currentUser, isLoading, router]);

  useEffect(() => {
    if (selectedRole) {
      Animated.timing(formAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } else {
      formAnim.setValue(0);
    }
  }, [selectedRole, formAnim]);

  const handleLogin = async () => {
    setError('');
    if (selectedRole === 'student') {
      if (!firstName.trim() || !lastName.trim()) {
        setError('Completá tu nombre y apellido');
        return;
      }
      if (!phone.trim()) {
        setError('Ingresá tu número de teléfono');
        return;
      }
      try {
        await login('student', firstName.trim(), lastName.trim(), phone.trim());
        router.replace('/(tabs)/schedule');
      } catch (e) {
        console.log('[Login] Error:', e);
        setError('Error al iniciar sesión');
      }
    } else if (selectedRole === 'admin') {
      if (adminPassword !== ADMIN_PASSWORD) {
        setError('Contraseña incorrecta');
        return;
      }
      try {
        await login('admin');
        router.replace('/(tabs)/schedule');
      } catch (e) {
        console.log('[Login] Error:', e);
        setError('Error al iniciar sesión');
      }
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (currentUser) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.header,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.subtitle}>Reservá tu turno en segundos</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.bookingBanner,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <TouchableOpacity
              testID="btn-book-direct"
              style={styles.bookingBannerButton}
              onPress={() => router.push('/book')}
              activeOpacity={0.8}
            >
              <View style={styles.bookingBannerIcon}>
                <Calendar size={20} color={Colors.black} />
              </View>
              <View style={styles.bookingBannerTextWrap}>
                <Text style={styles.bookingBannerTitle}>¿Querés reservar un turno?</Text>
                <Text style={styles.bookingBannerDesc}>Anotate sin necesidad de crear cuenta</Text>
              </View>
              <ArrowRight size={18} color={Colors.primary} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View
            style={[
              styles.content,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <Text style={styles.sectionLabel}>¿Cómo querés ingresar?</Text>

            <View style={styles.roleCards}>
              <TouchableOpacity
                testID="role-student"
                style={[
                  styles.roleCard,
                  selectedRole === 'student' && styles.roleCardActive,
                ]}
                onPress={() => {
                  setSelectedRole('student');
                  setError('');
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.roleIconCircle,
                    selectedRole === 'student' && styles.roleIconCircleActive,
                  ]}
                >
                  <User
                    size={24}
                    color={
                      selectedRole === 'student'
                        ? Colors.black
                        : Colors.primary
                    }
                  />
                </View>
                <Text
                  style={[
                    styles.roleLabel,
                    selectedRole === 'student' && styles.roleLabelActive,
                  ]}
                >
                  Soy Alumno
                </Text>
                <Text style={styles.roleDesc}>Reservar turnos</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="role-admin"
                style={[
                  styles.roleCard,
                  selectedRole === 'admin' && styles.roleCardActive,
                ]}
                onPress={() => {
                  setSelectedRole('admin');
                  setError('');
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.roleIconCircle,
                    selectedRole === 'admin' && styles.roleIconCircleActive,
                  ]}
                >
                  <Shield
                    size={24}
                    color={
                      selectedRole === 'admin' ? Colors.black : Colors.primary
                    }
                  />
                </View>
                <Text
                  style={[
                    styles.roleLabel,
                    selectedRole === 'admin' && styles.roleLabelActive,
                  ]}
                >
                  Administrador
                </Text>
                <Text style={styles.roleDesc}>Gestionar el gym</Text>
              </TouchableOpacity>
            </View>

            {selectedRole && (
              <Animated.View
                style={[
                  styles.formContainer,
                  {
                    opacity: formAnim,
                    transform: [
                      {
                        translateY: formAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [20, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {selectedRole === 'student' ? (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Nombre</Text>
                      <TextInput
                        testID="input-firstName"
                        style={styles.input}
                        placeholder="Ej: Juan"
                        placeholderTextColor={Colors.textMuted}
                        value={firstName}
                        onChangeText={setFirstName}
                        autoCapitalize="words"
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Apellido</Text>
                      <TextInput
                        testID="input-lastName"
                        style={styles.input}
                        placeholder="Ej: Pérez"
                        placeholderTextColor={Colors.textMuted}
                        value={lastName}
                        onChangeText={setLastName}
                        autoCapitalize="words"
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Teléfono</Text>
                      <View style={styles.phoneInputRow}>
                        <View style={styles.phoneIcon}>
                          <Phone size={16} color={Colors.textMuted} />
                        </View>
                        <TextInput
                          testID="input-phone"
                          style={styles.phoneInput}
                          placeholder="Ej: 1155667788"
                          placeholderTextColor={Colors.textMuted}
                          value={phone}
                          onChangeText={setPhone}
                          keyboardType="phone-pad"
                        />
                      </View>
                    </View>
                  </>
                ) : (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Contraseña</Text>
                    <TextInput
                      testID="input-password"
                      style={styles.input}
                      placeholder="Ingresá la contraseña"
                      placeholderTextColor={Colors.textMuted}
                      value={adminPassword}
                      onChangeText={setAdminPassword}
                      secureTextEntry
                    />
                  </View>
                )}

                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  testID="btn-login"
                  style={[
                    styles.loginButton,
                    loginPending && styles.loginButtonDisabled,
                  ]}
                  onPress={handleLogin}
                  disabled={loginPending}
                  activeOpacity={0.8}
                >
                  {loginPending ? (
                    <ActivityIndicator color={Colors.black} size="small" />
                  ) : (
                    <>
                      <Text style={styles.loginButtonText}>Ingresar</Text>
                      <ArrowRight size={20} color={Colors.black} />
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 32,
    backgroundColor: Colors.background,
  },
  logo: {
    width: 660,
    height: 300,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  bookingBanner: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  bookingBannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 12,
  },
  bookingBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingBannerTextWrap: {
    flex: 1,
  },
  bookingBannerTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  bookingBannerDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  roleCards: {
    flexDirection: 'row',
    gap: 12,
  },
  roleCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  roleCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  roleIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  roleIconCircleActive: {
    backgroundColor: Colors.primary,
  },
  roleLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  roleLabelActive: {
    color: Colors.primary,
  },
  roleDesc: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  formContainer: {
    marginTop: 28,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  phoneIcon: {
    paddingLeft: 14,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  errorBox: {
    backgroundColor: Colors.errorLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: Colors.black,
    fontSize: 17,
    fontWeight: '700' as const,
  },
});
