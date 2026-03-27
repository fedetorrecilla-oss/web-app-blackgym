import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import { Stack } from 'expo-router';
import { UserCheck, Trash2, Dumbbell, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useRutina } from '@/context/RutinaContext';
import { useGym } from '@/context/GymContext';

export default function AssignScreen() {
  const { students } = useGym();
  const {
    templates,
    getStudentDays,
    getStudentHasRoutine,
    assignTemplateToStudent,
    assignCustomToStudent,
    removeStudentRoutine,
    getCustomDays,
  } = useRutina();

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const customDays = useMemo(() => getCustomDays(), [getCustomDays]);

  const handleAssignTemplate = useCallback(async (studentId: string, templateId: string, templateName: string) => {
    Alert.alert(
      'Asignar rutina',
      `¿Asignar "${templateName}" a este alumno? Se reemplazará la rutina actual.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Asignar',
          onPress: async () => {
            await assignTemplateToStudent(templateId, studentId);
            setSelectedStudentId(null);
            Alert.alert('Listo', 'Rutina asignada correctamente');
          },
        },
      ]
    );
  }, [assignTemplateToStudent]);

  const handleAssignCustom = useCallback(async (studentId: string) => {
    if (customDays.length === 0) {
      Alert.alert('Error', 'No hay rutinas personalizadas creadas');
      return;
    }
    Alert.alert(
      'Asignar rutina personalizada',
      '¿Asignar la rutina personalizada a este alumno?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Asignar',
          onPress: async () => {
            await assignCustomToStudent(studentId);
            setSelectedStudentId(null);
            Alert.alert('Listo', 'Rutina personalizada asignada');
          },
        },
      ]
    );
  }, [customDays, assignCustomToStudent]);

  const handleRemoveRoutine = useCallback(async (studentId: string) => {
    Alert.alert('Quitar rutina', '¿Quitar la rutina de este alumno?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => removeStudentRoutine(studentId),
      },
    ]);
  }, [removeStudentRoutine]);

  const getLevelEmoji = (level: string) => {
    if (level === 'principiante') return '🟢';
    if (level === 'intermedio') return '🟡';
    return '🔴';
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Stack.Screen options={{ title: 'Asignar Rutina' }} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {students.length === 0 ? (
          <View style={styles.emptyState}>
            <UserCheck size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No hay alumnos registrados</Text>
          </View>
        ) : (
          students.map((student) => {
            const hasRoutine = getStudentHasRoutine(student.id);
            const studentDays = getStudentDays(student.id);
            const isSelected = selectedStudentId === student.id;

            return (
              <View key={student.id}>
                <TouchableOpacity
                  style={[styles.studentCard, isSelected && styles.studentCardSelected]}
                  onPress={() => setSelectedStudentId(isSelected ? null : student.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {student.firstName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{student.firstName} {student.lastName}</Text>
                    {hasRoutine ? (
                      <View style={styles.routineBadge}>
                        <Check size={12} color={Colors.success} />
                        <Text style={styles.routineBadgeText}>{studentDays.length} día{studentDays.length !== 1 ? 's' : ''} asignados</Text>
                      </View>
                    ) : (
                      <Text style={styles.noRoutineText}>Sin rutina</Text>
                    )}
                  </View>
                  {hasRoutine && (
                    <TouchableOpacity
                      onPress={() => handleRemoveRoutine(student.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Trash2 size={16} color={Colors.error} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                {isSelected && (
                  <View style={styles.assignOptions}>
                    <Text style={styles.assignTitle}>Asignar rutina:</Text>
                    {templates.length > 0 && (
                      <>
                        <Text style={styles.assignSubtitle}>Estándar</Text>
                        {templates.map(t => (
                          <TouchableOpacity
                            key={t.id}
                            style={styles.assignOption}
                            onPress={() => handleAssignTemplate(student.id, t.id, t.name)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.assignOptionIcon}>{t.gender === 'hombre' ? '♂️' : '♀️'}</Text>
                            <Text style={styles.assignOptionText}>{t.name}</Text>
                            <Text style={styles.assignOptionLevel}>{getLevelEmoji(t.level)}</Text>
                          </TouchableOpacity>
                        ))}
                      </>
                    )}
                    {customDays.length > 0 && (
                      <>
                        <Text style={styles.assignSubtitle}>Personalizada</Text>
                        <TouchableOpacity
                          style={styles.assignOption}
                          onPress={() => handleAssignCustom(student.id)}
                          activeOpacity={0.7}
                        >
                          <Dumbbell size={16} color={Colors.primary} />
                          <Text style={styles.assignOptionText}>Rutina personalizada ({customDays.length} días)</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {templates.length === 0 && customDays.length === 0 && (
                      <Text style={styles.noOptionsText}>No hay rutinas creadas. Creá una primero.</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
  studentCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  studentCardSelected: { borderColor: Colors.primary },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700' as const, color: Colors.primary },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
  routineBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  routineBadgeText: { fontSize: 13, color: Colors.success },
  noRoutineText: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  assignOptions: {
    backgroundColor: Colors.surfaceAlt, borderRadius: 14, padding: 16, marginTop: 4, marginBottom: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  assignTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.text, marginBottom: 12 },
  assignSubtitle: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary, marginTop: 8, marginBottom: 6 },
  assignOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 10, padding: 12,
    marginBottom: 6, borderWidth: 1, borderColor: Colors.border,
  },
  assignOptionIcon: { fontSize: 18 },
  assignOptionText: { flex: 1, fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  assignOptionLevel: { fontSize: 16 },
  noOptionsText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingVertical: 12 },
});
