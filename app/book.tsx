import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  User,
  Phone,
  ArrowRight,
  CheckCircle,
  Ban,
  AlertTriangle,
  Lock,
  Calendar,
  Clock,
  ChevronRight,
  ArrowLeft,
  XCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import {
  DAYS,
  DAYS_SHORT,
  HOURS,
  MAX_CAPACITY,
  LOW_SPOTS_THRESHOLD,
  formatHourRange,
  getTodayDayIndex,
  formatPrice,
  getPriceForDays,
  getPriceLabelForDays,
} from '@/constants/gym';
import { useGym } from '@/context/GymContext';

type Step = 'identify' | 'schedule';

export default function PublicBookingScreen() {
  const {
    students,
    pricing,
    isLoading,
    getSlotAvailability,
    getSlotBookings,
    isSlotBlocked,
    getBlockedSlot,
    addBooking,
    removeBooking,
    getStudentUniqueDays,
  } = useGym();

  const [step, setStep] = useState<Step>('identify');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDay, setSelectedDay] = useState(getTodayDayIndex());
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null);
  const [justBooked, setJustBooked] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const { login } = useGym();

  const handleIdentify = useCallback(async () => {
    setError('');
    const trimFirst = firstName.trim();
    const trimLast = lastName.trim();
    const trimPhone = phone.trim();

    if (!trimFirst || !trimLast) {
      setError('Completá tu nombre y apellido');
      return;
    }
    if (!trimPhone) {
      setError('Ingresá tu número de teléfono');
      return;
    }

    setIsSubmitting(true);
    try {
      let student = students.find(
        (s) =>
          s.firstName.toLowerCase() === trimFirst.toLowerCase() &&
          s.lastName.toLowerCase() === trimLast.toLowerCase()
      );

      if (student) {
        setStudentId(student.id);
        console.log('[PublicBook] Found existing student:', student.id);
      } else {
        await login('student', trimFirst, trimLast, trimPhone);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      setStep('schedule');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      console.log('[PublicBook] Error:', e);
      setError('Error al registrarse. Intentá de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }, [firstName, lastName, phone, students, login]);

  const resolvedStudentId = useMemo(() => {
    if (studentId) return studentId;
    const trimFirst = firstName.trim().toLowerCase();
    const trimLast = lastName.trim().toLowerCase();
    const found = students.find(
      (s) =>
        s.firstName.toLowerCase() === trimFirst &&
        s.lastName.toLowerCase() === trimLast
    );
    return found?.id ?? null;
  }, [studentId, students, firstName, lastName]);

  const studentDaysCount = useMemo(() => {
    if (!resolvedStudentId) return 0;
    return getStudentUniqueDays(resolvedStudentId);
  }, [resolvedStudentId, getStudentUniqueDays]);

  const currentPrice = useMemo(() => {
    if (studentDaysCount === 0) return null;
    return getPriceForDays(studentDaysCount, pricing);
  }, [studentDaysCount, pricing]);

  const handleBook = useCallback(
    async (hour: number) => {
      if (!resolvedStudentId) {
        Alert.alert('Error', 'No se pudo identificar tu cuenta. Volvé a ingresar tus datos.');
        return;
      }
      try {
        await addBooking(resolvedStudentId, selectedDay, hour);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setJustBooked(`${selectedDay}-${hour}`);
        setTimeout(() => setJustBooked(null), 2000);
      } catch (e: any) {
        Alert.alert('Error', e.message ?? 'No se pudo reservar');
      }
    },
    [addBooking, resolvedStudentId, selectedDay]
  );

  const handleCancelBooking = useCallback(
    (hour: number) => {
      if (!resolvedStudentId) return;
      const slotBookings = getSlotBookings(selectedDay, hour);
      const myBooking = slotBookings.find((b) => b.studentId === resolvedStudentId);
      if (!myBooking) return;

      Alert.alert('Cancelar turno', '¿Querés cancelar esta reserva?', [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            await removeBooking(myBooking.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]);
    },
    [getSlotBookings, selectedDay, resolvedStudentId, removeBooking]
  );

  const renderSlotCard = useCallback(
    (hour: number) => {
      const blocked = isSlotBlocked(selectedDay, hour);
      const blockedInfo = getBlockedSlot(selectedDay, hour);
      const availability = getSlotAvailability(selectedDay, hour);
      const slotBookings = getSlotBookings(selectedDay, hour);
      const bookedCount = slotBookings.length;
      const isFull = availability <= 0;
      const isLowSpots = !isFull && availability <= LOW_SPOTS_THRESHOLD;
      const myBooking = resolvedStudentId
        ? slotBookings.find((b) => b.studentId === resolvedStudentId)
        : null;
      const isExpanded = expandedSlot === hour;
      const fillPercent = bookedCount / MAX_CAPACITY;
      const wasJustBooked = justBooked === `${selectedDay}-${hour}`;

      let cardStyle = [styles.slotCard] as any[];
      if (blocked) cardStyle = [styles.slotCard, styles.slotBlocked];
      else if (myBooking) cardStyle = [styles.slotCard, styles.slotMyBooking];
      else if (isFull) cardStyle = [styles.slotCard, styles.slotFull];

      return (
        <TouchableOpacity
          key={hour}
          style={cardStyle}
          onPress={() => setExpandedSlot(isExpanded ? null : hour)}
          activeOpacity={0.7}
        >
          <View style={styles.slotHeader}>
            <View style={styles.slotTimeRow}>
              <Clock size={14} color={Colors.textMuted} />
              <Text style={styles.slotTime}>{formatHourRange(hour)}</Text>
              {myBooking && (
                <View style={styles.myBadge}>
                  <CheckCircle size={12} color={Colors.primary} />
                  <Text style={styles.myBadgeText}>Reservado</Text>
                </View>
              )}
              {wasJustBooked && (
                <View style={styles.successBadge}>
                  <CheckCircle size={12} color={Colors.success} />
                  <Text style={styles.successBadgeText}>Listo!</Text>
                </View>
              )}
              {blocked && (
                <View style={styles.blockedBadge}>
                  <Lock size={12} color={Colors.error} />
                  <Text style={styles.blockedBadgeText}>No disponible</Text>
                </View>
              )}
              {isLowSpots && !blocked && (
                <View style={styles.lowSpotsBadge}>
                  <AlertTriangle size={12} color={Colors.warning} />
                  <Text style={styles.lowSpotsBadgeText}>Quedan pocos!</Text>
                </View>
              )}
            </View>

            {!blocked && (
              <View style={styles.availabilityRow}>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${fillPercent * 100}%`,
                        backgroundColor: isFull
                          ? Colors.error
                          : isLowSpots
                          ? Colors.warning
                          : Colors.primary,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.availabilityText,
                    isLowSpots && styles.availabilityWarning,
                    isFull && styles.availabilityFull,
                  ]}
                >
                  {availability}/{MAX_CAPACITY} lugares
                </Text>
              </View>
            )}

            {blocked && blockedInfo && (
              <Text style={styles.blockedReason}>{blockedInfo.reason}</Text>
            )}
          </View>

          {isExpanded && (
            <View style={styles.slotExpanded}>
              <View style={styles.slotActions}>
                {!blocked && !isFull && !myBooking && (
                  <TouchableOpacity
                    style={styles.bookButton}
                    onPress={() => handleBook(hour)}
                    activeOpacity={0.7}
                  >
                    <CheckCircle size={16} color={Colors.black} />
                    <Text style={styles.bookButtonText}>Reservar turno</Text>
                  </TouchableOpacity>
                )}

                {myBooking && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => handleCancelBooking(hour)}
                    activeOpacity={0.7}
                  >
                    <XCircle size={16} color={Colors.white} />
                    <Text style={styles.cancelButtonText}>Cancelar reserva</Text>
                  </TouchableOpacity>
                )}

                {isFull && !myBooking && !blocked && (
                  <View style={styles.fullBadge}>
                    <Ban size={14} color={Colors.textMuted} />
                    <Text style={styles.fullText}>Turno completo</Text>
                  </View>
                )}

                {blocked && (
                  <View style={styles.fullBadge}>
                    <Lock size={14} color={Colors.textMuted} />
                    <Text style={styles.fullText}>Horario no disponible</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={styles.expandHint}>
            <ChevronRight
              size={16}
              color={Colors.textMuted}
              style={{
                transform: [{ rotate: isExpanded ? '90deg' : '0deg' }],
              }}
            />
          </View>
        </TouchableOpacity>
      );
    },
    [
      selectedDay,
      expandedSlot,
      resolvedStudentId,
      justBooked,
      isSlotBlocked,
      getBlockedSlot,
      getSlotAvailability,
      getSlotBookings,
      handleBook,
      handleCancelBooking,
    ]
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  if (step === 'identify') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
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
                styles.heroSection,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              ]}
            >
              <Image
                source={require('@/assets/images/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.heroTitle}>Reservá tu turno</Text>
              <Text style={styles.heroSubtitle}>
                Ingresá tus datos para anotarte en un horario
              </Text>
            </Animated.View>

            <Animated.View
              style={[
                styles.formSection,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              ]}
            >
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre</Text>
                <View style={styles.inputRow}>
                  <View style={styles.inputIcon}>
                    <User size={16} color={Colors.textMuted} />
                  </View>
                  <TextInput
                    testID="book-firstName"
                    style={styles.inputField}
                    placeholder="Ej: Juan"
                    placeholderTextColor={Colors.textMuted}
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Apellido</Text>
                <View style={styles.inputRow}>
                  <View style={styles.inputIcon}>
                    <User size={16} color={Colors.textMuted} />
                  </View>
                  <TextInput
                    testID="book-lastName"
                    style={styles.inputField}
                    placeholder="Ej: Pérez"
                    placeholderTextColor={Colors.textMuted}
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Teléfono</Text>
                <View style={styles.inputRow}>
                  <View style={styles.inputIcon}>
                    <Phone size={16} color={Colors.textMuted} />
                  </View>
                  <TextInput
                    testID="book-phone"
                    style={styles.inputField}
                    placeholder="Ej: 1155667788"
                    placeholderTextColor={Colors.textMuted}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                testID="btn-continue"
                style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
                onPress={handleIdentify}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={Colors.black} size="small" />
                ) : (
                  <>
                    <Calendar size={18} color={Colors.black} />
                    <Text style={styles.primaryButtonText}>Ver horarios</Text>
                    <ArrowRight size={18} color={Colors.black} />
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.disclaimer}>
                Si ya estás registrado, ingresá el mismo nombre y apellido que usaste antes.
              </Text>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.scheduleHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep('identify')}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.scheduleHeaderInfo}>
          <Text style={styles.scheduleTitle}>Horarios disponibles</Text>
          <Text style={styles.scheduleUser}>
            {firstName} {lastName}
          </Text>
        </View>
      </View>

      {studentDaysCount > 0 && currentPrice !== null && (
        <View style={styles.priceBanner}>
          <Text style={styles.priceBannerLabel}>
            Tu cuota ({getPriceLabelForDays(studentDaysCount)}):
          </Text>
          <Text style={styles.priceBannerAmount}>
            {formatPrice(currentPrice)}
          </Text>
        </View>
      )}

      <View style={styles.daySelector}>
        {DAYS.map((day, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.dayPill,
              selectedDay === i && styles.dayPillActive,
            ]}
            onPress={() => {
              setSelectedDay(i);
              setExpandedSlot(null);
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.dayPillShort,
                selectedDay === i && styles.dayPillTextActive,
              ]}
            >
              {DAYS_SHORT[i]}
            </Text>
            <Text
              style={[
                styles.dayPillFull,
                selectedDay === i && styles.dayPillFullActive,
              ]}
            >
              {day}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.slotList}
        contentContainerStyle={styles.slotListContent}
        showsVerticalScrollIndicator={false}
      >
        {HOURS.map(renderSlotCard)}
      </ScrollView>
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
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 28,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  logo: {
    width: 180,
    height: 80,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  formSection: {
    paddingHorizontal: 20,
    paddingTop: 28,
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputIcon: {
    paddingLeft: 14,
  },
  inputField: {
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
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: Colors.black,
    fontSize: 17,
    fontWeight: '700' as const,
  },
  disclaimer: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleHeaderInfo: {
    flex: 1,
  },
  scheduleTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  scheduleUser: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  priceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  priceBannerLabel: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  priceBannerAmount: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  daySelector: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dayPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surfaceAlt,
  },
  dayPillActive: {
    backgroundColor: Colors.primary,
  },
  dayPillShort: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  dayPillTextActive: {
    color: Colors.black,
  },
  dayPillFull: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  dayPillFullActive: {
    color: 'rgba(0,0,0,0.6)',
  },
  slotList: {
    flex: 1,
  },
  slotListContent: {
    padding: 12,
    gap: 8,
    paddingBottom: 40,
  },
  slotCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative' as const,
  },
  slotBlocked: {
    backgroundColor: Colors.blocked,
    borderColor: 'rgba(255, 71, 87, 0.3)',
  },
  slotMyBooking: {
    backgroundColor: Colors.bookedByMe,
    borderColor: Colors.bookedByMeBorder,
  },
  slotFull: {
    backgroundColor: Colors.full,
    borderColor: 'rgba(255, 165, 2, 0.3)',
  },
  slotHeader: {
    paddingRight: 24,
  },
  slotTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  slotTime: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  myBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  myBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  successBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  blockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  blockedBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  lowSpotsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  lowSpotsBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.warning,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    minWidth: 70,
    textAlign: 'right' as const,
  },
  availabilityWarning: {
    color: Colors.warning,
  },
  availabilityFull: {
    color: Colors.error,
  },
  blockedReason: {
    fontSize: 13,
    color: Colors.error,
    fontStyle: 'italic' as const,
    marginTop: 2,
  },
  slotExpanded: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  slotActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bookButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  bookButtonText: {
    color: Colors.black,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.error,
    paddingVertical: 12,
    borderRadius: 10,
  },
  cancelButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  fullBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  fullText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  expandHint: {
    position: 'absolute' as const,
    right: 12,
    top: 16,
  },
});
