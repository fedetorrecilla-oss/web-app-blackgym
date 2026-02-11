import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { Plus, Trash2, ChevronRight, Edit3, X, Dumbbell } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useRutina } from '@/context/RutinaContext';

export default function TemplateScreen() {
  const router = useRouter();
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const {
    templates,
    getTemplateDays,
    getDayExercises,
    updateTemplate,
    addDay,
    deleteDay,
  } = useRutina();

  const template = useMemo(() => templates.find(t => t.id === templateId), [templates, templateId]);
  const templateDays = useMemo(() => templateId ? getTemplateDays(templateId) : [], [templateId, getTemplateDays]);

  const [showEditTemplate, setShowEditTemplate] = useState(false);
  const [showAddDay, setShowAddDay] = useState(false);
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState<'hombre' | 'mujer'>('hombre');
  const [editLevel, setEditLevel] = useState<'principiante' | 'intermedio' | 'avanzado'>('principiante');
  const [newDayLetter, setNewDayLetter] = useState('');
  const [newDayName, setNewDayName] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const getLevelEmoji = (level: string) => {
    if (level === 'principiante') return '🟢';
    if (level === 'intermedio') return '🟡';
    return '🔴';
  };

  const openEditTemplate = useCallback(() => {
    if (!template) return;
    setEditName(template.name);
    setEditGender(template.gender);
    setEditLevel(template.level);
    setShowEditTemplate(true);
  }, [template]);

  const handleSaveTemplate = useCallback(async () => {
    if (!templateId || !editName.trim()) return;
    await updateTemplate(templateId, editName.trim(), editGender, editLevel);
    setShowEditTemplate(false);
  }, [templateId, editName, editGender, editLevel, updateTemplate]);

  const handleAddDay = useCallback(async () => {
    if (!newDayLetter.trim() || !newDayName.trim()) {
      Alert.alert('Error', 'Completá la letra y el nombre del día');
      return;
    }
    await addDay(newDayLetter.trim().toUpperCase(), newDayName.trim(), templateId);
    setShowAddDay(false);
    setNewDayLetter('');
    setNewDayName('');
  }, [newDayLetter, newDayName, templateId, addDay]);

  const handleDeleteDay = useCallback((id: string, name: string) => {
    Alert.alert('Eliminar día', `¿Eliminar "${name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteDay(id) },
    ]);
  }, [deleteDay]);

  if (!template) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Template' }} />
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Template no encontrado</Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Stack.Screen options={{ title: template.name }} />

      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerGender}>{template.gender === 'hombre' ? '♂️' : '♀️'}</Text>
          <View>
            <Text style={styles.headerName}>{template.name}</Text>
            <Text style={styles.headerMeta}>
              {getLevelEmoji(template.level)} {template.level} · {templateDays.length} día{templateDays.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={openEditTemplate} style={styles.editBtn}>
          <Edit3 size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {templateDays.length === 0 ? (
          <View style={styles.emptyState}>
            <Dumbbell size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No hay días en este template</Text>
          </View>
        ) : (
          templateDays.map((day) => {
            const exCount = getDayExercises(day.id).length;
            return (
              <TouchableOpacity
                key={day.id}
                style={styles.card}
                onPress={() => router.push({ pathname: '/(tabs)/rutinas/day' as const, params: { dayId: day.id, dayName: day.name, dayLetter: day.dayLetter } })}
                activeOpacity={0.7}
              >
                <View style={styles.cardLeft}>
                  <View style={styles.dayBadge}>
                    <Text style={styles.dayBadgeText}>{day.dayLetter}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{day.name}</Text>
                    <Text style={styles.cardMeta}>{exCount} ejercicio{exCount !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => handleDeleteDay(day.id, day.name)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Trash2 size={16} color={Colors.error} />
                  </TouchableOpacity>
                  <ChevronRight size={18} color={Colors.textMuted} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowAddDay(true)} activeOpacity={0.8}>
        <Plus size={24} color={Colors.black} />
      </TouchableOpacity>

      <Modal visible={showEditTemplate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEditTemplate(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Editar Template</Text>
            <TouchableOpacity onPress={() => setShowEditTemplate(false)}>
              <X size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.inputLabel}>Nombre</Text>
            <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholderTextColor={Colors.textMuted} />
            <Text style={styles.inputLabel}>Género</Text>
            <View style={styles.chipRow}>
              {(['hombre', 'mujer'] as const).map(g => (
                <TouchableOpacity key={g} style={[styles.chip, editGender === g && styles.chipActive]} onPress={() => setEditGender(g)}>
                  <Text style={[styles.chipText, editGender === g && styles.chipTextActive]}>{g === 'hombre' ? '♂️ Hombre' : '♀️ Mujer'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.inputLabel}>Nivel</Text>
            <View style={styles.chipRow}>
              {(['principiante', 'intermedio', 'avanzado'] as const).map(l => (
                <TouchableOpacity key={l} style={[styles.chip, editLevel === l && styles.chipActive]} onPress={() => setEditLevel(l)}>
                  <Text style={[styles.chipText, editLevel === l && styles.chipTextActive]}>{getLevelEmoji(l)} {l.charAt(0).toUpperCase() + l.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSaveTemplate} activeOpacity={0.8}>
              <Text style={styles.submitBtnText}>Guardar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showAddDay} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddDay(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Agregar Día</Text>
            <TouchableOpacity onPress={() => setShowAddDay(false)}>
              <X size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <View style={styles.modalBodyContent}>
              <Text style={styles.inputLabel}>Letra del día</Text>
              <TextInput style={styles.input} placeholder="Ej: A" placeholderTextColor={Colors.textMuted} value={newDayLetter} onChangeText={setNewDayLetter} maxLength={2} autoCapitalize="characters" />
              <Text style={styles.inputLabel}>Nombre</Text>
              <TextInput style={styles.input} placeholder="Ej: Empuje" placeholderTextColor={Colors.textMuted} value={newDayName} onChangeText={setNewDayName} />
              <TouchableOpacity style={styles.submitBtn} onPress={handleAddDay} activeOpacity={0.8}>
                <Text style={styles.submitBtnText}>Agregar Día</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerGender: { fontSize: 32 },
  headerName: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  headerMeta: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  editBtn: { padding: 8, backgroundColor: Colors.primaryLight, borderRadius: 10 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100, gap: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
  card: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.border,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  dayBadge: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  dayBadgeText: { fontSize: 16, fontWeight: '800' as const, color: Colors.primary },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
  cardMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fab: {
    position: 'absolute', bottom: 24, right: 20, width: 56, height: 56,
    borderRadius: 28, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
  },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text },
  modalBody: { flex: 1 },
  modalBodyContent: { padding: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipText: { fontSize: 14, color: Colors.textMuted, fontWeight: '500' as const },
  chipTextActive: { color: Colors.primary, fontWeight: '600' as const },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  submitBtnText: { fontSize: 16, fontWeight: '700' as const, color: Colors.black },
});
