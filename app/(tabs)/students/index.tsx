import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  Search,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Clock,
  Trash2,
  Users,
  Phone,
  Upload,
  X,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  FileUp,
  UserMinus,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import Colors from '@/constants/colors';
import { DAYS, formatHourRange, formatPrice, getPriceForDays } from '@/constants/gym';
import { useGym } from '@/context/GymContext';

const DAY_ALIASES: Record<string, number> = {
  'lunes': 0, 'lun': 0, 'lu': 0, 'l': 0, 'monday': 0, 'mon': 0,
  'martes': 1, 'mar': 1, 'ma': 1, 'tuesday': 1, 'tue': 1,
  'miercoles': 2, 'miércoles': 2, 'mie': 2, 'mié': 2, 'mi': 2, 'wednesday': 2, 'wed': 2,
  'jueves': 3, 'jue': 3, 'ju': 3, 'thursday': 3, 'thu': 3,
  'viernes': 4, 'vie': 4, 'vi': 4, 'friday': 4, 'fri': 4,
};

function parseDayOfWeek(raw: string): number | undefined {
  const normalized = raw.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [alias, idx] of Object.entries(DAY_ALIASES)) {
    const normalizedAlias = alias.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized === normalizedAlias) return idx;
  }
  return undefined;
}

function parseHour(raw: string): number | undefined {
  const cleaned = raw.trim().replace(/[^0-9:]/g, '');
  let hour: number;
  if (cleaned.includes(':')) {
    hour = parseInt(cleaned.split(':')[0], 10);
  } else {
    hour = parseInt(cleaned, 10);
  }
  if (isNaN(hour) || hour < 7 || hour > 21) return undefined;
  return hour;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === ',' || char === ';' || char === '\t') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

interface ImportRow {
  firstName: string;
  lastName: string;
  phone: string;
  dayOfWeek?: number;
  hour?: number;
}

function parseImportData(text: string): ImportRow[] {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const results: ImportRow[] = [];

  for (const line of lines) {
    const parts = parseCSVLine(line);
    if (parts.length >= 2) {
      const firstName = parts[0] ?? '';
      const lastName = parts[1] ?? '';
      const phone = parts[2] ?? '';
      const dayRaw = parts[3] ?? '';
      const hourRaw = parts[4] ?? '';

      if (!firstName || !lastName) continue;

      const row: ImportRow = { firstName, lastName, phone };

      if (dayRaw) {
        const day = parseDayOfWeek(dayRaw);
        if (day !== undefined) row.dayOfWeek = day;
      }
      if (hourRaw) {
        const hour = parseHour(hourRaw);
        if (hour !== undefined) row.hour = hour;
      }

      results.push(row);
    }
  }
  return results;
}

export default function StudentsScreen() {
  const { students, getStudentBookings, removeStudent, removeAllStudents, getStudentUniqueDays, pricing, bulkImportStudents } = useGym();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; importedBookings?: number } | null>(null);

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase().trim();
    return students.filter(
      (s) =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q))
    );
  }, [students, search]);

  const handleDeleteAll = useCallback(() => {
    if (students.length === 0) {
      Alert.alert('Sin alumnos', 'No hay alumnos para eliminar.');
      return;
    }
    Alert.alert(
      'Eliminar todos los alumnos',
      `¿Estás seguro de que querés eliminar a los ${students.length} alumnos? Se borrarán todas las reservas y pagos. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar todos',
          style: 'destructive',
          onPress: () => removeAllStudents(),
        },
      ]
    );
  }, [students.length, removeAllStudents]);

  const handleDeleteStudent = useCallback(
    (studentId: string, name: string) => {
      Alert.alert(
        'Eliminar alumno',
        `¿Querés eliminar a ${name}? Se borrarán todas sus reservas y pagos.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => removeStudent(studentId),
          },
        ]
      );
    },
    [removeStudent]
  );

  const handleImport = useCallback(async () => {
    const parsed = parseImportData(csvText);
    if (parsed.length === 0) {
      Alert.alert('Error', 'No se encontraron datos válidos. Asegurate de usar el formato:\nNombre, Apellido, Teléfono, Día, Hora');
      return;
    }
    setImporting(true);
    try {
      const result = await bulkImportStudents(parsed);
      setImportResult(result);
      console.log('[Students] Import result:', result);
    } catch (e) {
      console.log('[Students] Import error:', e);
      Alert.alert('Error', 'Hubo un error al importar los alumnos');
    } finally {
      setImporting(false);
    }
  }, [csvText, bulkImportStudents]);

  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'text/tab-separated-values', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '*/*'],
        copyToCacheDirectory: true,
      });
      console.log('[Students] DocumentPicker result:', result);
      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        const text = await response.text();
        setCsvText(text);
        console.log('[Students] File loaded on web, length:', text.length);
      } else {
        const text = await FileSystem.readAsStringAsync(asset.uri);
        setCsvText(text);
        console.log('[Students] File loaded on native, length:', text.length);
      }
    } catch (e) {
      console.log('[Students] File pick error:', e);
      Alert.alert('Error', 'No se pudo leer el archivo. Intentá con un archivo CSV o de texto.');
    }
  }, []);

  const closeImportModal = useCallback(() => {
    setShowImportModal(false);
    setCsvText('');
    setImportResult(null);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Users size={18} color={Colors.primary} />
            <Text style={styles.statNumber}>{students.length}</Text>
            <Text style={styles.statLabel}>Total alumnos</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.deleteAllButton}
              onPress={handleDeleteAll}
              activeOpacity={0.7}
              testID="btn-delete-all"
            >
              <UserMinus size={16} color={Colors.error} />
              <Text style={styles.deleteAllButtonText}>Eliminar todos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.importButton}
              onPress={() => setShowImportModal(true)}
              activeOpacity={0.7}
              testID="btn-bulk-import"
            >
              <Upload size={16} color={Colors.black} />
              <Text style={styles.importButtonText}>Importar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchBar}>
          <Search size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar alumno..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {filteredStudents.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {search ? 'No se encontraron alumnos' : 'Aún no hay alumnos registrados'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredStudents.map((student) => {
            const bookingsList = getStudentBookings(student.id);
            const isExpanded = expandedId === student.id;
            const sortedBookings = [...bookingsList].sort((a, b) => {
              if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
              return a.hour - b.hour;
            });
            const uniqueDays = getStudentUniqueDays(student.id);
            const price = uniqueDays > 0 ? getPriceForDays(uniqueDays, pricing) : 0;

            return (
              <TouchableOpacity
                key={student.id}
                style={styles.studentCard}
                onPress={() =>
                  setExpandedId(isExpanded ? null : student.id)
                }
                activeOpacity={0.7}
              >
                <View style={styles.studentHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {student.firstName[0]?.toUpperCase()}
                      {student.lastName[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>
                      {student.firstName} {student.lastName}
                    </Text>
                    <View style={styles.studentMetaRow}>
                      <Text style={styles.studentMeta}>
                        {bookingsList.length} turno
                        {bookingsList.length !== 1 ? 's' : ''}
                      </Text>
                      {uniqueDays > 0 && (
                        <Text style={styles.studentPrice}>
                          {formatPrice(price)}
                        </Text>
                      )}
                    </View>
                    {student.phone ? (
                      <View style={styles.phoneRow}>
                        <Phone size={11} color={Colors.textMuted} />
                        <Text style={styles.phoneText}>{student.phone}</Text>
                      </View>
                    ) : null}
                  </View>
                  {isExpanded ? (
                    <ChevronUp size={20} color={Colors.textMuted} />
                  ) : (
                    <ChevronDown size={20} color={Colors.textMuted} />
                  )}
                </View>

                {isExpanded && (
                  <View style={styles.expandedContent}>
                    {sortedBookings.length > 0 ? (
                      <View style={styles.bookingsList}>
                        {sortedBookings.map((b) => (
                          <View key={b.id} style={styles.bookingRow}>
                            <CalendarDays size={13} color={Colors.primary} />
                            <Text style={styles.bookingDayText}>
                              {DAYS[b.dayOfWeek]}
                            </Text>
                            <Clock size={13} color={Colors.textMuted} />
                            <Text style={styles.bookingTimeText}>
                              {formatHourRange(b.hour)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.noBookingsText}>
                        Sin turnos reservados
                      </Text>
                    )}

                    <TouchableOpacity
                      style={styles.deleteStudentBtn}
                      onPress={() =>
                        handleDeleteStudent(
                          student.id,
                          `${student.firstName} ${student.lastName}`
                        )
                      }
                    >
                      <Trash2 size={14} color={Colors.error} />
                      <Text style={styles.deleteStudentText}>
                        Eliminar alumno
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <Modal
        visible={showImportModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeImportModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <FileSpreadsheet size={22} color={Colors.primary} />
              <Text style={styles.modalTitle}>Importar Alumnos</Text>
            </View>
            <TouchableOpacity onPress={closeImportModal} style={styles.closeBtn}>
              <X size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={styles.modalBodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {importResult ? (
              <View style={styles.resultContainer}>
                <View style={styles.resultIconCircle}>
                  <CheckCircle size={40} color={Colors.success} />
                </View>
                <Text style={styles.resultTitle}>Importación completada</Text>
                <View style={styles.resultStats}>
                  <View style={styles.resultStatRow}>
                    <CheckCircle size={16} color={Colors.success} />
                    <Text style={styles.resultStatText}>
                      {importResult.imported} alumno{importResult.imported !== 1 ? 's' : ''} importado{importResult.imported !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {(importResult.importedBookings ?? 0) > 0 && (
                    <View style={styles.resultStatRow}>
                      <CheckCircle size={16} color={Colors.success} />
                      <Text style={styles.resultStatText}>
                        {importResult.importedBookings} turno{importResult.importedBookings !== 1 ? 's' : ''} asignado{importResult.importedBookings !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                  {importResult.skipped > 0 && (
                    <View style={styles.resultStatRow}>
                      <AlertTriangle size={16} color={Colors.warning} />
                      <Text style={styles.resultStatTextWarning}>
                        {importResult.skipped} omitido{importResult.skipped !== 1 ? 's' : ''} (duplicados o inválidos)
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={closeImportModal}
                  activeOpacity={0.8}
                >
                  <Text style={styles.doneButtonText}>Listo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.instructionCard}>
                  <Text style={styles.instructionTitle}>¿Cómo importar?</Text>
                  <Text style={styles.instructionText}>
                    1. Abrí tu archivo Excel{"\n"}
                    2. Seleccioná las columnas: Nombre, Apellido, Teléfono, Día, Hora{"\n"}
                    3. Copiá las filas (sin encabezados){"\n"}
                    4. Pegá el contenido acá abajo
                  </Text>
                  <View style={styles.formatExample}>
                    <Text style={styles.formatLabel}>Formato con horarios:</Text>
                    <Text style={styles.formatText}>Juan, Pérez, 1155667788, Lunes, 8</Text>
                    <Text style={styles.formatText}>Juan, Pérez, 1155667788, Miércoles, 10</Text>
                    <Text style={styles.formatText}>María, López, 1144553322, Martes, 9</Text>
                  </View>
                  <Text style={styles.instructionHint}>
                    Si un alumno va varios días, poné una fila por cada día/hora.{"\n"}
                    El día puede ser: Lunes, Martes, Miércoles, Jueves, Viernes (o abreviado: Lun, Mar, Mié, Jue, Vie).{"\n"}
                    La hora es el número de inicio (ej: 8 para 08:00-09:00).{"\n"}
                    Día, hora y teléfono son opcionales.
                  </Text>
                </View>

                <View style={styles.textAreaHeader}>
                  <Text style={styles.textAreaLabel}>Pegá los datos aquí o subí un archivo:</Text>
                  <TouchableOpacity
                    style={styles.pickFileButton}
                    onPress={handlePickFile}
                    activeOpacity={0.7}
                    testID="btn-pick-file"
                  >
                    <FileUp size={16} color={Colors.primary} />
                    <Text style={styles.pickFileButtonText}>Subir archivo</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  testID="input-csv"
                  style={styles.textArea}
                  multiline
                  numberOfLines={10}
                  placeholder={"Juan, Pérez, 1155667788, Lunes, 8\nJuan, Pérez, 1155667788, Miércoles, 10\nMaría, López, 1144553322, Martes, 9"}
                  placeholderTextColor={Colors.textMuted}
                  value={csvText}
                  onChangeText={setCsvText}
                  textAlignVertical="top"
                  autoCapitalize="words"
                />

                {csvText.trim().length > 0 && (() => {
                  const parsed = parseImportData(csvText);
                  const uniqueStudents = new Set(parsed.map((r) => `${r.firstName.toLowerCase()}|${r.lastName.toLowerCase()}`));
                  const rowsWithBookings = parsed.filter((r) => r.dayOfWeek !== undefined && r.hour !== undefined).length;
                  return (
                    <View style={styles.previewBox}>
                      <Text style={styles.previewLabel}>
                        {uniqueStudents.size} alumno{uniqueStudents.size !== 1 ? 's' : ''} detectado{uniqueStudents.size !== 1 ? 's' : ''}
                      </Text>
                      {rowsWithBookings > 0 && (
                        <Text style={styles.previewSublabel}>
                          {rowsWithBookings} turno{rowsWithBookings !== 1 ? 's' : ''} a asignar
                        </Text>
                      )}
                    </View>
                  );
                })()}

                <TouchableOpacity
                  testID="btn-import-confirm"
                  style={[
                    styles.importConfirmButton,
                    (!csvText.trim() || importing) && styles.importConfirmButtonDisabled,
                  ]}
                  onPress={handleImport}
                  disabled={!csvText.trim() || importing}
                  activeOpacity={0.8}
                >
                  {importing ? (
                    <ActivityIndicator color={Colors.black} size="small" />
                  ) : (
                    <>
                      <Upload size={18} color={Colors.black} />
                      <Text style={styles.importConfirmText}>Importar Alumnos</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
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
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    gap: 8,
    paddingBottom: 24,
  },
  studentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  studentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  studentMeta: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  studentPrice: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  phoneText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  bookingsList: {
    gap: 6,
    marginBottom: 12,
  },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  bookingDayText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    width: 80,
  },
  bookingTimeText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  noBookingsText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic' as const,
    marginBottom: 12,
  },
  deleteStudentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.errorLight,
  },
  deleteStudentText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  deleteAllButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.error,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  importButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.black,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 20,
    paddingBottom: 40,
  },
  instructionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 10,
  },
  instructionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  formatExample: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  formatLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginBottom: 6,
  },
  formatText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
  },
  instructionHint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 10,
    fontStyle: 'italic' as const,
  },
  textAreaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  textAreaLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    flex: 1,
  },
  pickFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  pickFileButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  textArea: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 160,
    textAlignVertical: 'top' as const,
  },
  previewBox: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  previewSublabel: {
    fontSize: 12,
    color: Colors.primary,
    marginTop: 4,
    opacity: 0.8,
  },
  importConfirmButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  importConfirmButtonDisabled: {
    opacity: 0.5,
  },
  importConfirmText: {
    color: Colors.black,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  resultContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  resultIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 20,
  },
  resultStats: {
    gap: 10,
    marginBottom: 32,
  },
  resultStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultStatText: {
    fontSize: 15,
    color: Colors.success,
    fontWeight: '500' as const,
  },
  resultStatTextWarning: {
    fontSize: 15,
    color: Colors.warning,
    fontWeight: '500' as const,
  },
  doneButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  doneButtonText: {
    color: Colors.black,
    fontSize: 16,
    fontWeight: '700' as const,
  },
});
