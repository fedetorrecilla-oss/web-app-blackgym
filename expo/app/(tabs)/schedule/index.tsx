import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  Lock,
  Unlock,
  UserCheck,
  Ban,
  CheckCircle,
  XCircle,
  ChevronRight,
  LogOut,
  AlertTriangle,
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

export default function ScheduleScreen() {
  const {
    currentUser,
    getSlotBookings,
    getSlotAvailability,
    isSlotBlocked,
    getBlockedSlot,
    addBooking,
    removeBooking,
    blockSlot,
    unblockSlot,
    getStudentById,
    getStudentUniqueDays,
    pricing,
    logout,
  } = useGym();
  const router = useRouter();

  const isAdmin = currentUser?.role === 'admin';
  const studentId = currentUser?.studentId ?? '';

  const [selectedDay, setSelectedDay] = useState(getTodayDayIndex());
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [blockingHour, setBlockingHour] = useState<number | null>(null);
  const [blockReason, setBlockReason] = useState('');

  const studentDaysCount = useMemo(() => {
    if (!studentId) return 0;
    return getStudentUniqueDays(studentId);
  }, [studentId, getStudentUniqueDays]);

  const currentPrice = useMemo(() => {
    if (studentDaysCount === 0) return null;
    return getPriceForDays(studentDaysCount, pricing);
  }, [studentDaysCount, pricing]);

  const handleLogout = useCallback(() => {
    Alert.alert('Cerrar sesión', '¿Querés salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  }, [logout, router]);

  const handleBook = useCallback(
    async (hour: number) => {
      try {
        await addBooking(studentId, selectedDay, hour);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e: any) {
        Alert.alert('Error', e.message ?? 'No se pudo reservar');
      }
    },
    [addBooking, studentId, selectedDay]
  );

  const handleCancelBooking = useCallback(
    (hour: number) => {
      const slotBookings = getSlotBookings(selectedDay, hour);
      const myBooking = slotBookings.find((b) => b.studentId === studentId);
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
    [getSlotBookings, selectedDay, studentId, removeBooking]
  );

  const handleBlock = useCallback(
    (hour: number) => {
      setBlockingHour(hour);
      setBlockReason('');
      setBlockModalVisible(true);
    },
    []
  );

  const confirmBlock = useCallback(async () => {
    if (blockingHour === null) return;
    await blockSlot(selectedDay, blockingHour, blockReason.trim() || 'Actividad cerrada');
    setBlockModalVisible(false);
    setBlockingHour(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [blockSlot, selectedDay, blockingHour, blockReason]);

  const handleUnblock = useCallback(
    (hour: number) => {
      Alert.alert('Desbloquear', '¿Querés habilitar este horario?', [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí',
          onPress: async () => {
            await unblockSlot(selectedDay, hour);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]);
    },
    [unblockSlot, selectedDay]
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
      const myBooking = !isAdmin
        ? slotBookings.find((b) => b.studentId === studentId)
        : null;
      const isExpanded = expandedSlot === hour;
      const fillPercent = bookedCount / MAX_CAPACITY;

      let cardBg = styles.slotCard;
      if (blocked) cardBg = { ...styles.slotCard, ...styles.slotBlocked };
      else if (myBooking) cardBg = { ...styles.slotCard, ...styles.slotMyBooking };
      else if (isFull) cardBg = { ...styles.slotCard, ...styles.slotFull };

      return (
        <TouchableOpacity
          key={hour}
          style={cardBg}
          onPress={() => setExpandedSlot(isExpanded ? null : hour)}
          activeOpacity={0.7}
        >
          <View style={styles.slotHeader}>
            <View style={styles.slotTimeRow}>
              <Text style={styles.slotTime}>{formatHourRange(hour)}</Text>
              {myBooking && (
                <View style={styles.myBadge}>
                  <CheckCircle size={12} color={Colors.primary} />
                  <Text style={styles.myBadgeText}>Reservado</Text>
                </View>
              )}
              {blocked && (
                <View style={styles.blockedBadge}>
                  <Lock size={12} color={Colors.error} />
                  <Text style={styles.blockedBadgeText}>Bloqueado</Text>
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
                        backgroundColor:
                          isFull
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
                  {availability}/{MAX_CAPACITY}
                </Text>
              </View>
            )}

            {blocked && blockedInfo && (
              <Text style={styles.blockedReason}>{blockedInfo.reason}</Text>
            )}
          </View>

          {isExpanded && (
            <View style={styles.slotExpanded}>
              {isAdmin && !blocked && bookedCount > 0 && (
                <View style={styles.studentList}>
                  <Text style={styles.studentListTitle}>
                    Inscriptos ({bookedCount}):
                  </Text>
                  {slotBookings.map((b) => {
                    const student = getStudentById(b.studentId);
                    return (
                      <Text key={b.id} style={styles.studentName}>
                        {student
                          ? `${student.firstName} ${student.lastName}`
                          : 'Alumno desconocido'}
                      </Text>
                    );
                  })}
                </View>
              )}

              <View style={styles.slotActions}>
                {!isAdmin && !blocked && !isFull && !myBooking && (
                  <TouchableOpacity
                    style={styles.bookButton}
                    onPress={() => handleBook(hour)}
                    activeOpacity={0.7}
                  >
                    <UserCheck size={16} color={Colors.black} />
                    <Text style={styles.bookButtonText}>Reservar</Text>
                  </TouchableOpacity>
                )}

                {!isAdmin && myBooking && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => handleCancelBooking(hour)}
                    activeOpacity={0.7}
                  >
                    <XCircle size={16} color={Colors.white} />
                    <Text style={styles.cancelButtonText}>Cancelar reserva</Text>
                  </TouchableOpacity>
                )}

                {!isAdmin && isFull && !myBooking && !blocked && (
                  <View style={styles.fullBadge}>
                    <Ban size={14} color={Colors.textMuted} />
                    <Text style={styles.fullText}>Turno completo</Text>
                  </View>
                )}

                {isAdmin && !blocked && (
                  <TouchableOpacity
                    style={styles.blockButton}
                    onPress={() => handleBlock(hour)}
                    activeOpacity={0.7}
                  >
                    <Lock size={16} color={Colors.white} />
                    <Text style={styles.blockButtonText}>Bloquear</Text>
                  </TouchableOpacity>
                )}

                {isAdmin && blocked && (
                  <TouchableOpacity
                    style={styles.unblockButton}
                    onPress={() => handleUnblock(hour)}
                    activeOpacity={0.7}
                  >
                    <Unlock size={16} color={Colors.primary} />
                    <Text style={styles.unblockButtonText}>Desbloquear</Text>
                  </TouchableOpacity>
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
      isAdmin,
      studentId,
      isSlotBlocked,
      getBlockedSlot,
      getSlotAvailability,
      getSlotBookings,
      getStudentById,
      handleBook,
      handleCancelBooking,
      handleBlock,
      handleUnblock,
    ]
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Horarios',
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text, fontWeight: '700' as const },
          headerRight: () => (
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <LogOut size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          ),
        }}
      />

      {!isAdmin && studentDaysCount > 0 && currentPrice !== null && (
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

      <Modal
        visible={blockModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBlockModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Bloquear horario</Text>
            <Text style={styles.modalSubtitle}>
              {blockingHour !== null
                ? `${DAYS[selectedDay]} ${formatHourRange(blockingHour)}`
                : ''}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Motivo (opcional)"
              placeholderTextColor={Colors.textMuted}
              value={blockReason}
              onChangeText={setBlockReason}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setBlockModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={confirmBlock}
              >
                <Text style={styles.modalConfirmText}>Bloquear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  logoutBtn: {
    padding: 8,
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
    paddingBottom: 20,
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
    minWidth: 30,
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
  studentList: {
    marginBottom: 12,
  },
  studentListTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  studentName: {
    fontSize: 13,
    color: Colors.text,
    paddingVertical: 2,
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
    paddingVertical: 10,
    borderRadius: 10,
  },
  bookButtonText: {
    color: Colors.black,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.error,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cancelButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  fullBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  fullText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  blockButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.error,
    paddingVertical: 10,
    borderRadius: 10,
  },
  blockButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  unblockButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  unblockButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  expandHint: {
    position: 'absolute' as const,
    right: 12,
    top: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.surfaceAlt,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  modalConfirmBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.error,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
