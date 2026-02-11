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
import { useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router';
import { Plus, Trash2, Save, Search, X, Dumbbell, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useRutina } from '@/context/RutinaContext';

export default function DayScreen() {
  const { dayId, dayName, dayLetter } = useLocalSearchParams<{ dayId: string; dayName: string; dayLetter: string }>();
  const {
    exercises,
    getDayExercises,
    getExerciseById,
    addDayExercise,
    updateDayExercise,
    deleteDayExercise,
  } = useRutina();

  const dayExercises = useMemo(() => dayId ? getDayExercises(dayId) : [], [dayId, getDayExercises]);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerExerciseId, setPickerExerciseId] = useState<string | null>(null);
  const [pickerSets, setPickerSets] = useState('3');
  const [pickerReps, setPickerReps] = useState('10');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSets, setEditSets] = useState('');
  const [editReps, setEditReps] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const filteredExercises = useMemo(() => {
    if (!pickerSearch.trim()) return exercises;
    const q = pickerSearch.toLowerCase();
    return exercises.filter(
      e => e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q)
    );
  }, [exercises, pickerSearch]);

  const dayExerciseIds = useMemo(() => new Set(dayExercises.map(de => de.exerciseId)), [dayExercises]);

  const handleAddExercise = useCallback(async () => {
    if (!dayId || !pickerExerciseId) return;
    const sets = parseInt(pickerSets, 10) || 3;
    const reps = pickerReps.trim() || '10';
    await addDayExercise(dayId, pickerExerciseId, sets, reps);
    setPickerExerciseId(null);
    setPickerSets('3');
    setPickerReps('10');
    setShowPicker(false);
  }, [dayId, pickerExerciseId, pickerSets, pickerReps, addDayExercise]);

  const startEdit = useCallback((id: string, sets: number, reps: string) => {
    setEditingId(id);
    setEditSets(String(sets));
    setEditReps(reps);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    const sets = parseInt(editSets, 10) || 3;
    const reps = editReps.trim() || '10';
    await updateDayExercise(editingId, sets, reps);
    setEditingId(null);
  }, [editingId, editSets, editReps, updateDayExercise]);

  const handleDelete = useCallback((id: string, name: string) => {
    Alert.alert('Eliminar ejercicio', `¿Quitar "${name}" de este día?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteDayExercise(id) },
    ]);
  }, [deleteDayExercise]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Stack.Screen options={{ title: `${dayLetter ?? ''} - ${dayName ?? 'Día'}` }} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {dayExercises.length === 0 ? (
          <View style={styles.emptyState}>
            <Dumbbell size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No hay ejercicios en este día</Text>
          </View>
        ) : (
          dayExercises.map((de, index) => {
            const ex = getExerciseById(de.exerciseId);
            const isEditing = editingId === de.id;
            return (
              <View key={de.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.orderBadge}>
                    <Text style={styles.orderText}>{index + 1}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{ex?.name ?? 'Ejercicio'}</Text>
                    <Text style={styles.cardMeta}>{ex?.muscleGroup ?? ''}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(de.id, ex?.name ?? '')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Trash2 size={16} color={Colors.error} />
                  </TouchableOpacity>
                </View>

                {isEditing ? (
                  <View style={styles.editRow}>
                    <View style={styles.editField}>
                      <Text style={styles.editLabel}>Series</Text>
                      <TextInput style={styles.editInput} value={editSets} onChangeText={setEditSets} keyboardType="number-pad" />
                    </View>
                    <View style={styles.editField}>
                      <Text style={styles.editLabel}>Reps</Text>
                      <TextInput style={styles.editInput} value={editReps} onChangeText={setEditReps} />
                    </View>
                    <TouchableOpacity onPress={handleSaveEdit} style={styles.saveEditBtn}>
                      <Save size={18} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.setsRow} onPress={() => startEdit(de.id, de.sets, de.reps)}>
                    <Text style={styles.setsText}>{de.sets} series × {de.reps} reps</Text>
                    <Text style={styles.editHint}>Tocar para editar</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowPicker(true)} activeOpacity={0.8}>
        <Plus size={24} color={Colors.black} />
      </TouchableOpacity>

      <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowPicker(false); setPickerExerciseId(null); }}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Agregar Ejercicio</Text>
            <TouchableOpacity onPress={() => { setShowPicker(false); setPickerExerciseId(null); }}>
              <X size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {pickerExerciseId ? (
            <View style={styles.modalBody}>
              <View style={styles.modalBodyContent}>
                <Text style={styles.selectedName}>{exercises.find(e => e.id === pickerExerciseId)?.name}</Text>
                <Text style={styles.inputLabel}>Series</Text>
                <TextInput style={styles.input} value={pickerSets} onChangeText={setPickerSets} keyboardType="number-pad" placeholderTextColor={Colors.textMuted} />
                <Text style={styles.inputLabel}>Repeticiones</Text>
                <TextInput style={styles.input} value={pickerReps} onChangeText={setPickerReps} placeholder="Ej: 8-12" placeholderTextColor={Colors.textMuted} />
                <TouchableOpacity style={styles.submitBtn} onPress={handleAddExercise} activeOpacity={0.8}>
                  <Text style={styles.submitBtnText}>Agregar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.searchBar}>
                <Search size={18} color={Colors.textMuted} />
                <TextInput style={styles.searchInput} placeholder="Buscar ejercicio..." placeholderTextColor={Colors.textMuted} value={pickerSearch} onChangeText={setPickerSearch} />
                {pickerSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setPickerSearch('')}>
                    <X size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView style={styles.pickerList} contentContainerStyle={styles.pickerListContent}>
                {filteredExercises.map(ex => {
                  const alreadyAdded = dayExerciseIds.has(ex.id);
                  return (
                    <TouchableOpacity
                      key={ex.id}
                      style={[styles.pickerItem, alreadyAdded && styles.pickerItemDisabled]}
                      onPress={() => !alreadyAdded && setPickerExerciseId(ex.id)}
                      activeOpacity={alreadyAdded ? 1 : 0.7}
                    >
                      <View style={styles.pickerItemInfo}>
                        <Text style={[styles.pickerItemName, alreadyAdded && styles.pickerItemNameDisabled]}>{ex.name}</Text>
                        <Text style={styles.pickerItemMeta}>{ex.muscleGroup}</Text>
                      </View>
                      {alreadyAdded && (
                        <View style={styles.addedBadge}>
                          <Check size={14} color={Colors.primary} />
                          <Text style={styles.addedText}>Agregado</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100, gap: 10 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
  card: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orderBadge: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  orderText: { fontSize: 14, fontWeight: '800' as const, color: Colors.primary },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
  cardMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  setsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  setsText: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  editHint: { fontSize: 12, color: Colors.textMuted },
  editRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  editField: { flex: 1 },
  editLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  editInput: {
    backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  saveEditBtn: { padding: 10, backgroundColor: Colors.primaryLight, borderRadius: 10, marginBottom: 2 },
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
  selectedName: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, marginBottom: 8 },
  inputLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  submitBtnText: { fontSize: 16, fontWeight: '700' as const, color: Colors.black },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    backgroundColor: Colors.surface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  pickerList: { flex: 1 },
  pickerListContent: { padding: 16, gap: 6 },
  pickerItem: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.border,
  },
  pickerItemDisabled: { opacity: 0.5 },
  pickerItemInfo: { flex: 1 },
  pickerItemName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  pickerItemNameDisabled: { color: Colors.textMuted },
  pickerItemMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  addedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addedText: { fontSize: 12, color: Colors.primary, fontWeight: '600' as const },
});
