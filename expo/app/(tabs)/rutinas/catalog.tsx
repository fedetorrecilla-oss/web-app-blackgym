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
  Linking,
} from 'react-native';
import {
  Plus,
  Trash2,
  Edit3,
  Search,
  X,
  Dumbbell,
  PlayCircle,
  StickyNote,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useRutina } from '@/context/RutinaContext';
import {
  MUSCLE_GROUPS,
  EQUIPMENT_TYPES,
  DIFFICULTIES,
  Difficulty,
  RutinaExercise,
} from '@/types/rutina';

const MUSCLE_ICONS: Record<string, string> = {
  'Pecho': '🫁', 'Espalda': '🔙', 'Hombros': '💪', 'Piernas': '🦵',
  'Brazos': '💪', 'Core': '🎯', 'Full Body': '🏋️',
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  principiante: '🟢 Principiante',
  intermedio: '🟡 Intermedio',
  avanzado: '🔴 Avanzado',
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  principiante: Colors.success,
  intermedio: Colors.warning,
  avanzado: Colors.error,
};

export default function CatalogScreen() {
  const { exercises, addExercise, updateExercise, deleteExercise } = useRutina();

  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formMuscleGroup, setFormMuscleGroup] = useState('');
  const [formEquipment, setFormEquipment] = useState('');
  const [formDifficulty, setFormDifficulty] = useState<Difficulty>('principiante');

  const [detailExercise, setDetailExercise] = useState<RutinaExercise | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises.filter(e => {
      if (muscleFilter && e.muscleGroup !== muscleFilter) return false;
      if (equipmentFilter && e.equipment !== equipmentFilter) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.muscleGroup.toLowerCase().includes(q) ||
        (e.equipment ?? '').toLowerCase().includes(q) ||
        (e.notes ?? '').toLowerCase().includes(q)
      );
    });
  }, [exercises, search, muscleFilter, equipmentFilter]);

  const grouped = useMemo(() => {
    const byGroup = new Map<string, RutinaExercise[]>();
    for (const ex of filtered) {
      const list = byGroup.get(ex.muscleGroup) ?? [];
      list.push(ex);
      byGroup.set(ex.muscleGroup, list);
    }
    return [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const usedEquipment = useMemo(
    () => EQUIPMENT_TYPES.filter(eq => exercises.some(e => e.equipment === eq)),
    [exercises],
  );

  const resetForm = useCallback(() => {
    setFormName('');
    setFormVideoUrl('');
    setFormNotes('');
    setFormMuscleGroup('');
    setFormEquipment('');
    setFormDifficulty('principiante');
    setEditingId(null);
    setShowForm(false);
  }, []);

  const openEdit = useCallback((ex: RutinaExercise) => {
    setEditingId(ex.id);
    setFormName(ex.name);
    setFormVideoUrl(ex.videoUrl);
    setFormNotes(ex.notes ?? '');
    setFormMuscleGroup(ex.muscleGroup);
    setFormEquipment(ex.equipment ?? '');
    setFormDifficulty(ex.difficulty ?? 'principiante');
    setDetailExercise(null);
    setShowForm(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formName.trim() || !formMuscleGroup) {
      Alert.alert('Error', 'Completá el nombre y grupo muscular');
      return;
    }
    const extras = {
      equipment: formEquipment || undefined,
      difficulty: formDifficulty,
      notes: formNotes.trim() || undefined,
    };
    if (editingId) {
      await updateExercise(editingId, formName.trim(), formVideoUrl.trim(), formMuscleGroup, extras);
    } else {
      await addExercise(formName.trim(), formVideoUrl.trim(), formMuscleGroup, extras);
    }
    resetForm();
  }, [formName, formVideoUrl, formNotes, formMuscleGroup, formEquipment, formDifficulty, editingId, addExercise, updateExercise, resetForm]);

  const handleDelete = useCallback((id: string, name: string) => {
    Alert.alert('Eliminar ejercicio', `¿Eliminar "${name}"? Se quitará de todas las rutinas.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => { deleteExercise(id); setDetailExercise(null); } },
    ]);
  }, [deleteExercise]);

  const openVideo = useCallback(async (url: string) => {
    if (!url) return;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'No se pudo abrir el enlace del video');
    }
  }, []);

  const hasFilters = muscleFilter !== null || equipmentFilter !== null || search.trim().length > 0;

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

      <View style={styles.filtersBlock}>
        <Text style={styles.filterLabel}>GRUPO MUSCULAR</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          <FilterChip label="Todos" active={muscleFilter === null} onPress={() => setMuscleFilter(null)} />
          {MUSCLE_GROUPS.map(g => (
            <FilterChip
              key={g}
              label={`${MUSCLE_ICONS[g] ?? '🏋️'} ${g}`}
              active={muscleFilter === g}
              onPress={() => setMuscleFilter(muscleFilter === g ? null : g)}
            />
          ))}
        </ScrollView>
        {usedEquipment.length > 0 && (
          <>
            <Text style={styles.filterLabel}>EQUIPAMIENTO</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {usedEquipment.map(eq => (
                <FilterChip
                  key={eq}
                  label={eq}
                  active={equipmentFilter === eq}
                  onPress={() => setEquipmentFilter(equipmentFilter === eq ? null : eq)}
                />
              ))}
            </ScrollView>
          </>
        )}
      </View>

      <Text style={styles.resultCount}>
        {filtered.length} ejercicio{filtered.length !== 1 ? 's' : ''}
      </Text>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Dumbbell size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {hasFilters ? 'No hay ejercicios con esos filtros' : 'Todavía no hay ejercicios. ¡Creá el primero!'}
            </Text>
          </View>
        ) : (
          grouped.map(([group, list]) => (
            <View key={group} style={styles.groupSection}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupIcon}>{MUSCLE_ICONS[group] ?? '🏋️'}</Text>
                <Text style={styles.groupTitle}>{group}</Text>
                <View style={styles.groupCount}>
                  <Text style={styles.groupCountText}>{list.length}</Text>
                </View>
              </View>
              {list.map(ex => (
                <TouchableOpacity key={ex.id} style={styles.card} onPress={() => setDetailExercise(ex)} activeOpacity={0.7}>
                  <View style={styles.cardLeft}>
                    <View style={styles.cardInfo}>
                      <View style={styles.cardNameRow}>
                        <Text style={styles.cardName}>{ex.name}</Text>
                        {ex.videoUrl ? <PlayCircle size={15} color={Colors.primary} /> : null}
                        {ex.notes ? <StickyNote size={14} color={Colors.textMuted} /> : null}
                      </View>
                      <View style={styles.badgeRow}>
                        {ex.equipment ? (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{ex.equipment}</Text>
                          </View>
                        ) : null}
                        <View style={[styles.badge, styles.badgeDifficulty]}>
                          <View style={[styles.difficultyDot, { backgroundColor: DIFFICULTY_COLORS[ex.difficulty ?? 'principiante'] }]} />
                          <Text style={styles.badgeText}>
                            {(ex.difficulty ?? 'principiante').charAt(0).toUpperCase() + (ex.difficulty ?? 'principiante').slice(1)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => openEdit(ex)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Edit3 size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowForm(true)} activeOpacity={0.8}>
        <Plus size={24} color={Colors.black} />
      </TouchableOpacity>

      {/* Detail modal */}
      <Modal visible={detailExercise !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailExercise(null)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>{detailExercise?.name ?? ''}</Text>
            <TouchableOpacity onPress={() => setDetailExercise(null)}>
              <X size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {detailExercise && (
            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} keyboardShouldPersistTaps="handled">
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{MUSCLE_ICONS[detailExercise.muscleGroup] ?? '🏋️'} {detailExercise.muscleGroup}</Text>
                </View>
                {detailExercise.equipment ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{detailExercise.equipment}</Text>
                  </View>
                ) : null}
                <View style={[styles.badge, styles.badgeDifficulty]}>
                  <View style={[styles.difficultyDot, { backgroundColor: DIFFICULTY_COLORS[detailExercise.difficulty ?? 'principiante'] }]} />
                  <Text style={styles.badgeText}>{DIFFICULTY_LABELS[detailExercise.difficulty ?? 'principiante'].split(' ')[1]}</Text>
                </View>
              </View>

              {detailExercise.notes ? (
                <View style={styles.notesCard}>
                  <View style={styles.notesHeader}>
                    <StickyNote size={15} color={Colors.primary} />
                    <Text style={styles.notesTitle}>Notas técnicas</Text>
                  </View>
                  <Text style={styles.notesText}>{detailExercise.notes}</Text>
                </View>
              ) : null}

              {detailExercise.videoUrl ? (
                <TouchableOpacity style={styles.videoBtn} onPress={() => openVideo(detailExercise.videoUrl)} activeOpacity={0.8}>
                  <PlayCircle size={20} color={Colors.black} />
                  <Text style={styles.videoBtnText}>Ver video del ejercicio</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.noVideoText}>Sin video cargado para este ejercicio</Text>
              )}

              <View style={styles.detailActions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(detailExercise)} activeOpacity={0.8}>
                  <Edit3 size={16} color={Colors.primary} />
                  <Text style={styles.editBtnText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(detailExercise.id, detailExercise.name)}
                  activeOpacity={0.8}
                >
                  <Trash2 size={16} color={Colors.error} />
                  <Text style={styles.deleteBtnText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Create / edit form modal */}
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
            <Text style={styles.inputLabel}>Grupo Muscular</Text>
            <View style={styles.chipRow}>
              {MUSCLE_GROUPS.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, formMuscleGroup === g && styles.chipActive]}
                  onPress={() => setFormMuscleGroup(g)}
                >
                  <Text style={[styles.chipText, formMuscleGroup === g && styles.chipTextActive]}>
                    {MUSCLE_ICONS[g]} {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.inputLabel}>Equipamiento</Text>
            <View style={styles.chipRow}>
              {EQUIPMENT_TYPES.map(eq => (
                <TouchableOpacity
                  key={eq}
                  style={[styles.chip, formEquipment === eq && styles.chipActive]}
                  onPress={() => setFormEquipment(formEquipment === eq ? '' : eq)}
                >
                  <Text style={[styles.chipText, formEquipment === eq && styles.chipTextActive]}>{eq}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.inputLabel}>Dificultad</Text>
            <View style={styles.chipRow}>
              {DIFFICULTIES.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.chip, formDifficulty === d && styles.chipActive]}
                  onPress={() => setFormDifficulty(d)}
                >
                  <Text style={[styles.chipText, formDifficulty === d && styles.chipTextActive]}>
                    {DIFFICULTY_LABELS[d]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.inputLabel}>URL de Video (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="https://youtube.com/..."
              placeholderTextColor={Colors.textMuted}
              value={formVideoUrl}
              onChangeText={setFormVideoUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            <Text style={styles.inputLabel}>Notas técnicas (opcional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Ej: codos a 45°, bajar a la línea del pecho..."
              placeholderTextColor={Colors.textMuted}
              value={formNotes}
              onChangeText={setFormNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.submitBtnText}>{editingId ? 'Guardar Cambios' : 'Crear Ejercicio'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </Animated.View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: Colors.surface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  filtersBlock: { marginTop: 12, gap: 6 },
  filterLabel: {
    fontSize: 10, fontWeight: '700' as const, letterSpacing: 1,
    color: Colors.textMuted, marginHorizontal: 16,
  },
  chipScroll: { paddingHorizontal: 16, gap: 6, flexGrow: 1 },
  resultCount: {
    fontSize: 12, color: Colors.textMuted,
    marginHorizontal: 16, marginTop: 10, marginBottom: 4,
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 4, paddingBottom: 100, gap: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },
  groupSection: { gap: 8 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  groupIcon: { fontSize: 16 },
  groupTitle: { fontSize: 14, fontWeight: '800' as const, color: Colors.text, flex: 1 },
  groupCount: {
    backgroundColor: Colors.primaryLight, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  groupCountText: { fontSize: 12, fontWeight: '700' as const, color: Colors.primary },
  card: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.border,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cardInfo: { flex: 1, gap: 6 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: { fontSize: 15, fontWeight: '700' as const, color: Colors.text, flexShrink: 1 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    backgroundColor: Colors.surfaceElevated, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeDifficulty: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  difficultyDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' as const, color: Colors.textSecondary },
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
  modalTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, flex: 1, marginRight: 12 },
  modalBody: { flex: 1 },
  modalBodyContent: { padding: 20, paddingBottom: 40 },
  notesCard: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border, marginTop: 16,
  },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  notesTitle: { fontSize: 13, fontWeight: '700' as const, color: Colors.primary },
  notesText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  videoBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 16,
  },
  videoBtnText: { fontSize: 15, fontWeight: '700' as const, color: Colors.black },
  noVideoText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: 20 },
  detailActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.primaryLight, borderRadius: 12, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.primary,
  },
  editBtnText: { fontSize: 14, fontWeight: '700' as const, color: Colors.primary },
  deleteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.errorLight, borderRadius: 12, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.error,
  },
  deleteBtnText: { fontSize: 14, fontWeight: '700' as const, color: Colors.error },
  inputLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  notesInput: { minHeight: 80, paddingTop: 14 },
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
