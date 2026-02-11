import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  MessageCircle,
  Search,
  X,
  Upload,
  FileSpreadsheet,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import Colors from '@/constants/colors';
import { getCurrentMonthKey, getMonthLabel, formatPrice, getPriceForDays, formatPhoneForWhatsApp } from '@/constants/gym';
import { useGym } from '@/context/GymContext';

export default function PaymentsScreen() {
  const { students, isPaymentDone, togglePayment, getPaymentRecord, getStudentUniqueDays, pricing, getUnpaidStudents, bulkImportStudents } = useGym();
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const navigateMonth = useCallback(
    (direction: -1 | 1) => {
      const [year, month] = monthKey.split('-').map(Number);
      let newMonth = month + direction;
      let newYear = year;
      if (newMonth < 1) {
        newMonth = 12;
        newYear -= 1;
      } else if (newMonth > 12) {
        newMonth = 1;
        newYear += 1;
      }
      setMonthKey(
        `${newYear}-${newMonth.toString().padStart(2, '0')}`
      );
    },
    [monthKey]
  );

  const stats = useMemo(() => {
    let paid = 0;
    let unpaid = 0;
    students.forEach((s) => {
      if (isPaymentDone(s.id, monthKey)) {
        paid += 1;
      } else {
        unpaid += 1;
      }
    });
    return { paid, unpaid, total: students.length };
  }, [students, monthKey, isPaymentDone]);

  const handleToggle = useCallback(
    async (studentId: string) => {
      await togglePayment(studentId, monthKey, 'manual');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [togglePayment, monthKey]
  );

  const handleExcelImport = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        console.log('[Payments] Document picker cancelled');
        return;
      }

      const file = result.assets[0];
      console.log('[Payments] File picked:', file.name, file.uri, file.mimeType);
      setIsImporting(true);

      let rows: { firstName: string; lastName: string; phone: string }[] = [];

      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        rows = parseSheetRows(jsonData);
      } else {
        const fileContent = await FileSystem.readAsStringAsync(file.uri, {
          encoding: 'base64',
        });
        const workbook = XLSX.read(fileContent, { type: 'base64' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        rows = parseSheetRows(jsonData);
      }

      if (rows.length === 0) {
        Alert.alert(
          'Archivo vacío',
          'No se encontraron clientes en el archivo. Asegurate de que tenga columnas: Nombre, Apellido, Teléfono (o variaciones como "nombre", "apellido", "telefono").'
        );
        setIsImporting(false);
        return;
      }

      console.log('[Payments] Parsed rows:', rows.length);
      const importResult = await bulkImportStudents(rows);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Importación completada',
        `Se importaron ${importResult.imported} cliente${importResult.imported !== 1 ? 's' : ''} nuevo${importResult.imported !== 1 ? 's' : ''}.${importResult.skipped > 0 ? `\n${importResult.skipped} fila${importResult.skipped !== 1 ? 's' : ''} omitida${importResult.skipped !== 1 ? 's' : ''} (datos incompletos).` : ''}${importResult.imported === 0 && importResult.skipped === 0 ? '\nTodos los clientes ya estaban registrados.' : ''}`
      );
    } catch (e: any) {
      console.log('[Payments] Excel import error:', e);
      Alert.alert('Error', 'No se pudo leer el archivo. Verificá que sea un Excel (.xlsx, .xls) o CSV válido.');
    } finally {
      setIsImporting(false);
    }
  }, [bulkImportStudents]);

  const handleWhatsAppAll = useCallback(() => {
    const unpaidList = getUnpaidStudents(monthKey);
    const withPhone = unpaidList.filter((s) => s.phone && s.phone.trim());

    if (withPhone.length === 0) {
      Alert.alert(
        'Sin deudores',
        unpaidList.length === 0
          ? 'Todos los alumnos pagaron este mes.'
          : 'Los alumnos que deben no tienen teléfono cargado.'
      );
      return;
    }

    Alert.alert(
      'Enviar WhatsApp',
      `Se abrirá WhatsApp para ${withPhone.length} alumno${withPhone.length !== 1 ? 's' : ''} que deben. Tendrás que enviar cada mensaje manualmente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Comenzar',
          onPress: () => {
            const first = withPhone[0];
            const formattedPhone = formatPhoneForWhatsApp(first.phone);
            const message = encodeURIComponent(
              `Hola ${first.firstName}! Te recordamos que ya está disponible el pago de la cuota del gimnasio. Cualquier consulta no dudes en escribirnos.`
            );
            const url = `https://wa.me/${formattedPhone}?text=${message}`;
            if (Platform.OS === 'web') {
              window.open(url, '_blank');
            } else {
              Linking.openURL(url).catch(() => {
                Alert.alert('Error', 'No se pudo abrir WhatsApp');
              });
            }

            if (withPhone.length > 1) {
              setTimeout(() => {
                Alert.alert(
                  'Siguientes alumnos',
                  `Quedan ${withPhone.length - 1} alumnos más por contactar:\n\n${withPhone.slice(1).map((s) => `${s.firstName} ${s.lastName} - ${s.phone}`).join('\n')}`,
                  [{ text: 'OK' }]
                );
              }, 1500);
            }
          },
        },
      ]
    );
  }, [getUnpaidStudents, monthKey]);

  const handleWhatsAppSingle = useCallback(
    (studentId: string) => {
      const student = students.find((s) => s.id === studentId);
      if (!student) return;
      if (!student.phone || !student.phone.trim()) {
        Alert.alert('Sin teléfono', 'Este alumno no tiene teléfono cargado.');
        return;
      }
      const formattedPhone = formatPhoneForWhatsApp(student.phone);
      const message = encodeURIComponent(
        `Hola ${student.firstName}! Te recordamos que ya está disponible el pago de la cuota del gimnasio. Cualquier consulta no dudes en escribirnos.`
      );
      const url = `https://wa.me/${formattedPhone}?text=${message}`;
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        Linking.openURL(url).catch(() => {
          Alert.alert('Error', 'No se pudo abrir WhatsApp');
        });
      }
    },
    [students]
  );

  const sortedStudents = useMemo(() => {
    let filtered = [...students];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((s) => {
        const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
        return fullName.includes(q);
      });
    }
    return filtered.sort((a, b) => {
      const aPaid = isPaymentDone(a.id, monthKey);
      const bPaid = isPaymentDone(b.id, monthKey);
      if (aPaid !== bPaid) return aPaid ? 1 : -1;
      return `${a.lastName} ${a.firstName}`.localeCompare(
        `${b.lastName} ${b.firstName}`
      );
    });
  }, [students, monthKey, isPaymentDone, searchQuery]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.monthSelector}>
          <TouchableOpacity
            onPress={() => navigateMonth(-1)}
            style={styles.monthArrow}
          >
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{getMonthLabel(monthKey)}</Text>
          <TouchableOpacity
            onPress={() => navigateMonth(1)}
            style={styles.monthArrow}
          >
            <ChevronRight size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statBadge, styles.statPaid]}>
            <CheckCircle2 size={14} color={Colors.success} />
            <Text style={styles.statPaidText}>
              {stats.paid} pagaron
            </Text>
          </View>
          <View style={[styles.statBadge, styles.statUnpaid]}>
            <Circle size={14} color={Colors.error} />
            <Text style={styles.statUnpaidText}>
              {stats.unpaid} deben
            </Text>
          </View>
        </View>

        {stats.total > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${(stats.paid / stats.total) * 100}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round((stats.paid / stats.total) * 100)}%
            </Text>
          </View>
        )}

        <View style={styles.actionRow}>
          {stats.unpaid > 0 && (
            <TouchableOpacity
              style={styles.whatsappAllBtn}
              onPress={handleWhatsAppAll}
              activeOpacity={0.7}
            >
              <MessageCircle size={16} color={Colors.white} />
              <Text style={styles.whatsappAllText}>
                Cobrar ({stats.unpaid})
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.importBtn}
            onPress={handleExcelImport}
            activeOpacity={0.7}
            disabled={isImporting}
          >
            {isImporting ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <>
                <Upload size={16} color={Colors.primary} />
                <Text style={styles.importBtnText}>Importar Excel</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {students.length > 0 && (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrap}>
            <Search size={18} color={Colors.textMuted} />
            <TextInput
              testID="input-search-payment"
              style={styles.searchInput}
              placeholder="Buscar alumno..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {students.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FileSpreadsheet size={48} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No hay clientes aún</Text>
          <Text style={styles.emptySubtitle}>
            Podés cargar clientes desde un archivo Excel o CSV
          </Text>
          <TouchableOpacity
            style={styles.emptyImportBtn}
            onPress={handleExcelImport}
            activeOpacity={0.7}
            disabled={isImporting}
          >
            {isImporting ? (
              <ActivityIndicator size="small" color={Colors.black} />
            ) : (
              <>
                <Upload size={18} color={Colors.black} />
                <Text style={styles.emptyImportText}>Subir archivo Excel</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.emptyHint}>
            El archivo debe tener columnas: Nombre, Apellido, Teléfono
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {sortedStudents.map((student) => {
            const paid = isPaymentDone(student.id, monthKey);
            const record = getPaymentRecord(student.id, monthKey);
            const uniqueDays = getStudentUniqueDays(student.id);
            const price = uniqueDays > 0 ? getPriceForDays(uniqueDays, pricing) : 0;

            return (
              <View
                key={student.id}
                style={[
                  styles.paymentCard,
                  paid && styles.paymentCardPaid,
                ]}
              >
                <TouchableOpacity
                  style={styles.paymentCardInner}
                  onPress={() => handleToggle(student.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.paymentLeft}>
                    <View
                      style={[
                        styles.avatar,
                        paid && styles.avatarPaid,
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarText,
                          paid && styles.avatarTextPaid,
                        ]}
                      >
                        {student.firstName[0]?.toUpperCase()}
                        {student.lastName[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.paymentInfo}>
                      <Text style={styles.paymentName}>
                        {student.firstName} {student.lastName}
                      </Text>
                      <View style={styles.paymentMetaRow}>
                        <Text
                          style={[
                            styles.paymentStatus,
                            paid ? styles.paymentPaid : styles.paymentUnpaid,
                          ]}
                        >
                          {paid
                            ? record?.method === 'mercadopago'
                              ? 'Pagó (MP)'
                              : 'Pagó (Manual)'
                            : 'Debe'}
                        </Text>
                        {uniqueDays > 0 && (
                          <Text style={styles.paymentPrice}>
                            {formatPrice(price)}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                  {paid ? (
                    <CheckCircle2 size={28} color={Colors.success} />
                  ) : (
                    <Circle size={28} color={Colors.border} />
                  )}
                </TouchableOpacity>
                {!paid && (
                  <TouchableOpacity
                    style={styles.whatsappSingleBtn}
                    onPress={() => handleWhatsAppSingle(student.id)}
                    activeOpacity={0.7}
                  >
                    <MessageCircle size={14} color="#25D366" />
                    <Text style={styles.whatsappSingleText}>WhatsApp</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function parseSheetRows(jsonData: Record<string, unknown>[]): { firstName: string; lastName: string; phone: string }[] {
  const rows: { firstName: string; lastName: string; phone: string }[] = [];

  const findColumn = (row: Record<string, unknown>, candidates: string[]): string => {
    for (const key of Object.keys(row)) {
      const normalized = key.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      for (const candidate of candidates) {
        if (normalized === candidate || normalized.includes(candidate)) {
          return String(row[key] ?? '').trim();
        }
      }
    }
    return '';
  };

  for (const row of jsonData) {
    const firstName = findColumn(row, ['nombre', 'first_name', 'firstname', 'first name', 'name']);
    const lastName = findColumn(row, ['apellido', 'last_name', 'lastname', 'last name', 'surname']);
    const phone = findColumn(row, ['telefono', 'phone', 'tel', 'celular', 'mobile', 'whatsapp']);

    if (firstName || lastName) {
      rows.push({ firstName, lastName, phone });
    }
  }

  return rows;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  monthArrow: {
    padding: 6,
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    minWidth: 160,
    textAlign: 'center' as const,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  statBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  statPaid: {
    backgroundColor: Colors.successLight,
  },
  statUnpaid: {
    backgroundColor: Colors.errorLight,
  },
  statPaidText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  statUnpaidText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  progressBg: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.success,
    minWidth: 36,
    textAlign: 'right' as const,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  whatsappAllBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    paddingVertical: 10,
    borderRadius: 10,
  },
  whatsappAllText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  importBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
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
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  emptyImportText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.black,
  },
  emptyHint: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginTop: 12,
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  searchContainer: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    gap: 8,
    paddingBottom: 24,
  },
  paymentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  paymentCardPaid: {
    borderColor: 'rgba(46, 213, 115, 0.4)',
  },
  paymentCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  paymentInfo: {
    flex: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPaid: {
    backgroundColor: Colors.successLight,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  avatarTextPaid: {
    color: Colors.success,
  },
  paymentName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  paymentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  paymentStatus: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  paymentPaid: {
    color: Colors.success,
  },
  paymentUnpaid: {
    color: Colors.error,
  },
  paymentPrice: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  whatsappSingleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  whatsappSingleText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#25D366',
  },
});
