import { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { CalendarDays, Clock, Trash2, Inbox, CreditCard, ExternalLink } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { DAYS, formatHourRange, formatPrice, getPriceForDays, getPriceLabelForDays, getCurrentMonthKey } from '@/constants/gym';
import { useGym } from '@/context/GymContext';

export default function BookingsScreen() {
  const {
    currentUser,
    getStudentBookings,
    removeBooking,
    getCurrentStudent,
    getStudentUniqueDays,
    pricing,
    isPaymentDone,
  } = useGym();

  const student = getCurrentStudent();
  const studentId = currentUser?.studentId ?? '';

  const myBookings = useMemo(() => {
    if (!studentId) return [];
    const bks = getStudentBookings(studentId);
    return [...bks].sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.hour - b.hour;
    });
  }, [studentId, getStudentBookings]);

  const groupedByDay = useMemo(() => {
    const groups: Record<number, typeof myBookings> = {};
    myBookings.forEach((b) => {
      if (!groups[b.dayOfWeek]) groups[b.dayOfWeek] = [];
      groups[b.dayOfWeek].push(b);
    });
    return groups;
  }, [myBookings]);

  const daysCount = useMemo(() => {
    if (!studentId) return 0;
    return getStudentUniqueDays(studentId);
  }, [studentId, getStudentUniqueDays]);

  const monthlyPrice = useMemo(() => {
    if (daysCount === 0) return 0;
    return getPriceForDays(daysCount, pricing);
  }, [daysCount, pricing]);

  const currentMonth = getCurrentMonthKey();
  const hasPaid = isPaymentDone(studentId, currentMonth);

  const handleCancel = useCallback(
    (bookingId: string, day: number, hour: number) => {
      Alert.alert(
        'Cancelar turno',
        `¿Querés cancelar tu turno del ${DAYS[day]} a las ${formatHourRange(hour)}?`,
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Sí, cancelar',
            style: 'destructive',
            onPress: async () => {
              await removeBooking(bookingId);
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning
              );
            },
          },
        ]
      );
    },
    [removeBooking]
  );

  const handlePayWithMP = useCallback(() => {
    if (!pricing.mercadoPagoLink) {
      Alert.alert('No disponible', 'El link de pago aún no fue configurado por el administrador.');
      return;
    }
    if (Platform.OS === 'web') {
      window.open(pricing.mercadoPagoLink, '_blank');
    } else {
      Linking.openURL(pricing.mercadoPagoLink).catch(() => {
        Alert.alert('Error', 'No se pudo abrir el link de pago');
      });
    }
  }, [pricing.mercadoPagoLink]);

  return (
    <View style={styles.container}>
      {student && (
        <View style={styles.welcomeBar}>
          <Text style={styles.welcomeText}>
            Hola, {student.firstName}
          </Text>
          <Text style={styles.bookingCount}>
            {myBookings.length} turno{myBookings.length !== 1 ? 's' : ''}{' '}
            reservado{myBookings.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {daysCount > 0 && (
        <View style={styles.priceSection}>
          <View style={styles.priceInfo}>
            <Text style={styles.priceLabel}>
              Cuota mensual ({getPriceLabelForDays(daysCount)})
            </Text>
            <Text style={styles.priceAmount}>{formatPrice(monthlyPrice)}</Text>
          </View>
          <View style={styles.priceActions}>
            {hasPaid ? (
              <View style={styles.paidBadge}>
                <Text style={styles.paidBadgeText}>Pagado</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.payButton}
                onPress={handlePayWithMP}
                activeOpacity={0.7}
              >
                <CreditCard size={16} color={Colors.black} />
                <Text style={styles.payButtonText}>Pagar con MP</Text>
                <ExternalLink size={14} color={Colors.black} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {myBookings.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Inbox size={48} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Sin turnos reservados</Text>
          <Text style={styles.emptySubtitle}>
            Andá a la pestaña de Horarios para reservar tu primer turno
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {Object.keys(groupedByDay)
            .map(Number)
            .sort()
            .map((dayIndex) => (
              <View key={dayIndex} style={styles.dayGroup}>
                <View style={styles.dayHeader}>
                  <CalendarDays size={16} color={Colors.primary} />
                  <Text style={styles.dayTitle}>{DAYS[dayIndex]}</Text>
                </View>

                {groupedByDay[dayIndex].map((booking) => (
                  <View key={booking.id} style={styles.bookingCard}>
                    <View style={styles.bookingInfo}>
                      <View style={styles.timeRow}>
                        <Clock size={14} color={Colors.primary} />
                        <Text style={styles.timeText}>
                          {formatHourRange(booking.hour)}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() =>
                        handleCancel(
                          booking.id,
                          booking.dayOfWeek,
                          booking.hour
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <Trash2 size={18} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  welcomeBar: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  bookingCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  priceSection: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  priceLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  priceAmount: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  priceActions: {
    flexDirection: 'row',
  },
  payButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  payButtonText: {
    color: Colors.black,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  paidBadge: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    paddingVertical: 10,
    borderRadius: 10,
  },
  paidBadgeText: {
    color: Colors.success,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 24,
  },
  dayGroup: {
    gap: 8,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  bookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bookingInfo: {
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
