import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
import { Plus, Trash2, Edit3, Search, X, Dumbbell } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useRutina } from '@/context/RutinaContext';
import { MUSCLE_GROUPS } from '@/types/rutina';

export default function CatalogScreen() {
  const { exercises, addExercise, updateExercise, deleteExercise } = useRutina();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formMuscleGroup, setFormMuscleGroup] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const filtered = useMemo(() => {
    if (!search.trim()) return exercises;
    const q = search.toLowerCase();
    return exercises.filter(
      e => e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q)
    );
  }, [exercises, search]);

  const resetForm = useCallback(() => {
    setFormName('');
    setFormVideoUrl('');
    setFormMuscleGroup('');
    setEditingId(null);
    setShowForm(false);
  }, []);

  const openEdit = useCallback((id: string) => {
    const ex = exercises.find(e => e.id === id);
    if (!ex) return;
    setEditingId(id);
    setFormName(ex.name);
    setFormVideoUrl(ex.videoUrl);
    setFormMuscleGroup(ex.muscleGroup);
    setShowForm(true);
  }, [exercises]);

  const handleSave = useCallback(async () => {
    if (!formName.trim() || !formMuscleGroup) {
      Alert.alert('Error', 'Completá el nombre y grupo muscular');
      return;
    }
    if (editingId) {
      await updateExercise(editingId, formName.trim(), formVideoUrl.trim(), formMuscleGroup);
    } else {
      await addExercise(formName.trim(), formVideoUrl.trim(), formMuscleGroup);
    }
    resetForm();
  }, [formName, formVideoUrl, formMuscleGroup, editingId, addExercise, updateExercise, resetForm]);

  const handleDelete = useCallback((id: string, name: string) => {
    Alert.alert('Eliminar ejercicio', `¿Eliminar "${name}"? Se quitará de todas las rutinas.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteExercise(id) },
    ]);
  }, [deleteExercise]);

  const getMuscleIcon = (group: string) => {
    const icons: Record<string, string> = {
      'Pecho': '🫁', 'Espalda': '🔙', 'Hombros': '💪', 'Piernas': '🦵',
      'Brazos': '💪', 'Core': '🎯', 'Full Body': '🏋️',
    };
    return icons[group] ?? '🏋️';
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.searchBar}>
        <Search size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar ejercicio..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Dumbbell size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No se encontraron ejercicios</Text>
          </View>
        ) : (
          filtered.map((ex) => (
            <View key={ex.id} style={styles.card}>
              <View style={styles.cardLeft}>
                <Text style={styles.cardIcon}>{getMuscleIcon(ex.muscleGroup)}</Text>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{ex.name}</Text>
                  <Text style={styles.cardMeta}>{ex.muscleGroup}</Text>
                </View>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => openEdit(ex.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Edit3 size={16} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(ex.id, ex.name)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Trash2 size={16} color={Colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowForm(true)} activeOpacity={0.8}>
        <Plus size={24} color={Colors.black} />
      </TouchableOpacity>

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetForm}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingId ? 'Editar Ejercicio' : 'Nuevo Ejercicio'}</Text>
            <TouchableOpacity onPress={resetForm}>
              <X size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.inputLabel}>Nombre</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Press Banca"
              placeholderTextColor={Colors.textMuted}
              value={formName}
              onChangeText={setFormName}
            />
            <Text style={styles.inputLabel}>URL de Video</Text>
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor={Colors.textMuted}
              value={formVideoUrl}
              onChangeText={setFormVideoUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            <Text style={styles.inputLabel}>Grupo Muscular</Text>
            <View style={styles.chipRow}>
              {MUSCLE_GROUPS.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, formMuscleGroup === g && styles.chipActive]}
                  onPress={() => setFormMuscleGroup(g)}
                >
                  <Text style={[styles.chipText, formMuscleGroup === g && styles.chipTextActive]}>
                    {getMuscleIcon(g)} {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.submitBtnText}>{editingId ? 'Guardar Cambios' : 'Crear Ejercicio'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    backgroundColor: Colors.surface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
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
  cardIcon: { fontSize: 24 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
  cardMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
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
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' as const },
  chipTextActive: { color: Colors.primary, fontWeight: '600' as const },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  submitBtnText: { fontSize: 16, fontWeight: '700' as const, color: Colors.black },
});
