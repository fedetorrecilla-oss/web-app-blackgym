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
  ActivityIndicator,
} from 'react-native';
// expo-image (not react-native's core Image) is used for the ExerciseDB GIFs
// below: React Native's built-in <Image> only decodes and shows a single
// static frame of a multi-frame GIF on iOS, which is exactly the "looks like
// a photo"/"two photos" symptom reported — expo-image uses the platform's
// animated-image decoders (SDWebImage on iOS, Glide on Android) and plays
// GIFs properly.
import { Image as GifImage } from 'expo-image';
// Real per-exercise demo videos (see backend/exercise-video-db.ts) are MP4s,
// not GIFs — expo-video is the maintained Expo video component (expo-av is
// being phased out) and, same idea as GifImage above, loops/autoplays them
// muted so they read as a moving demo rather than something you have to hit
// play on.
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  Plus,
  Trash2,
  Edit3,
  Search,
  X,
  Dumbbell,
  PlayCircle,
  StickyNote,
  Wand2,
  Download,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useRutina } from '@/context/RutinaContext';
import { trpc } from '@/lib/trpc';
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
  const { exercises, addExercise, updateExercise, deleteExercise, addExercisesBulk, replaceAllExercises } = useRutina();

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

  // --- Real exercise video search (see backend/exercise-video-db.ts) ---
  // Search is instant/local on the backend (no external API), so no need
  // for a long debounce — this just avoids re-querying on every keystroke.
  const [showEdbSearch, setShowEdbSearch] = useState(false);
  const [edbQuery, setEdbQuery] = useState('');
  const [edbDebouncedQuery, setEdbDebouncedQuery] = useState('');
  const [importingExerciseId, setImportingExerciseId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setEdbDebouncedQuery(edbQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [edbQuery]);

  const videoSearchQuery = trpc.exercisedb.searchVideos.useQuery(
    { query: edbDebouncedQuery },
    { enabled: edbDebouncedQuery.length >= 2 },
  );
  const importVideoMutation = trpc.exercisedb.importVideo.useMutation();

  const handlePickEdbResult = useCallback(
    async (result: { sourceId: string; name: string; muscleGroup: string; equipment: string; difficulty: string }) => {
      setImportingExerciseId(result.sourceId);
      try {
        const res = await importVideoMutation.mutateAsync({ sourceId: result.sourceId });
        setFormVideoUrl(res.videoUrl);
        setFormNotes(res.notes);
        setFormMuscleGroup(res.muscleGroup);
        if (res.equipment) setFormEquipment(res.equipment);
        if (res.difficulty === 'principiante' || res.difficulty === 'intermedio' || res.difficulty === 'avanzado') {
          setFormDifficulty(res.difficulty);
        }
        if (!formName.trim()) {
          setFormName(res.name);
        }
        setShowEdbSearch(false);
        setEdbQuery('');
      } catch (err) {
        console.log('[catalog] Video import failed:', err);
        Alert.alert(
          'Error',
          'No se pudo traer el video del ejercicio. Probá de nuevo en un momento.',
        );
      } finally {
        setImportingExerciseId(null);
      }
    },
    [importVideoMutation, formName],
  );

  // --- Bulk "import the whole catalog" flow ---
  const [bulkImport, setBulkImport] = useState<{
    running: boolean;
    done: number;
    total: number;
    currentName: string;
    failed: string[];
  } | null>(null);
  const bulkCancelRef = useRef(false);
  const listVideoDbQuery = trpc.exercisedb.listVideoDb.useQuery(undefined, { enabled: false });

  const handleBulkImportAll = useCallback(async () => {
    const listRes = await listVideoDbQuery.refetch();
    const all = listRes.data?.results ?? [];
    if (all.length === 0) {
      Alert.alert('Error', 'No se pudo cargar la base de videos. Probá de nuevo en un momento.');
      return;
    }

    // Exercise names in the dataset used to be in English; they're Spanish
    // now, but anything imported before that change still has its old
    // English name saved. Fix those first, in one shot, before figuring out
    // what's still missing — otherwise every already-imported exercise
    // would look "missing" (its stored English name no longer matches the
    // dataset's Spanish name) and get re-imported as a duplicate.
    const nameEnToEs = new Map(all.map(e => [e.nameEn.trim().toLowerCase(), e.name]));
    let currentExercises = exercises;
    const renamed = exercises.map(e => {
      const es = nameEnToEs.get(e.name.trim().toLowerCase());
      return es && es !== e.name ? { ...e, name: es } : e;
    });
    if (renamed.some((e, i) => e.name !== exercises[i].name)) {
      await replaceAllExercises(renamed);
      currentExercises = renamed;
    }

    const existingNames = new Set(currentExercises.map(e => e.name.trim().toLowerCase()));
    const toImport = all.filter(e => !existingNames.has(e.name.trim().toLowerCase()));

    if (toImport.length === 0) {
      Alert.alert('Listo', 'Ya tenés cargados todos los ejercicios de la base de videos.');
      return;
    }

    bulkCancelRef.current = false;
    setBulkImport({ running: true, done: 0, total: toImport.length, currentName: '', failed: [] });

    // Accumulate locally instead of calling addExercise once per item: the
    // context's addExercise reads its `exercises` list from a closure that
    // only updates on the next render, so many rapid-fire calls would each
    // append to the same stale snapshot and silently drop all but the last
    // one. addExercisesBulk takes the full list of new exercises at once
    // and appends them in a single, race-free update — see RutinaContext.
    const newOnes: RutinaExercise[] = [];
    let checkpointed = 0;
    const failed: string[] = [];

    for (const entry of toImport) {
      if (bulkCancelRef.current) break;
      setBulkImport(prev => (prev ? { ...prev, currentName: entry.name } : prev));
      try {
        const res = await importVideoMutation.mutateAsync({ sourceId: entry.sourceId });
        newOnes.push({
          id: generateLocalId(),
          name: res.name,
          videoUrl: res.videoUrl,
          muscleGroup: res.muscleGroup,
          equipment: res.equipment || undefined,
          difficulty:
            res.difficulty === 'principiante' || res.difficulty === 'intermedio' || res.difficulty === 'avanzado'
              ? res.difficulty
              : 'principiante',
          notes: res.notes || undefined,
        });
      } catch (err) {
        console.log('[catalog] Bulk import failed for', entry.name, err);
        failed.push(entry.name);
      }
      setBulkImport(prev =>
        prev ? { ...prev, done: prev.done + 1, failed: [...failed] } : prev,
      );
      // Checkpoint every 15 imports so a crash/close mid-run doesn't lose
      // everything imported so far — not just one final save at the end.
      if (newOnes.length - checkpointed >= 15) {
        await addExercisesBulk(newOnes.slice(checkpointed));
        checkpointed = newOnes.length;
      }
    }

    if (newOnes.length > checkpointed) {
      await addExercisesBulk(newOnes.slice(checkpointed));
    }

    setBulkImport(prev => (prev ? { ...prev, running: false } : prev));
  }, [exercises, listVideoDbQuery, importVideoMutation, addExercisesBulk, replaceAllExercises]);

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

      <TouchableOpacity
        style={styles.fabSecondary}
        onPress={() =>
          Alert.alert(
            'Importar catálogo',
            'Esto traduce al español los nombres de los ejercicios que ya importaste (si estaban en inglés) y agrega automáticamente los que todavía no tenés cargados, cada uno con su video real y sus indicaciones en español. Puede tardar varios minutos.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Importar', onPress: handleBulkImportAll },
            ],
          )
        }
        activeOpacity={0.8}
      >
        <Download size={20} color={Colors.primary} />
      </TouchableOpacity>

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
              {detailExercise.videoUrl ? (
                isVideoUrl(detailExercise.videoUrl) ? (
                  // Real MP4 demo video (see backend/exercise-video-db.ts).
                  <View style={[styles.gifCard, styles.gifCardTop]}>
                    <ExerciseVideoPlayer uri={detailExercise.videoUrl} />
                  </View>
                ) : isImageUrl(detailExercise.videoUrl) ? (
                  // GIF imported from the old ExerciseDB pipeline (or any direct
                  // image URL): render it inline so it actually animates in the
                  // app, instead of handing off to the system browser/Quick
                  // Look, which can show it as a frozen still frame.
                  <View style={[styles.gifCard, styles.gifCardTop]}>
                    <GifImage
                      source={{ uri: detailExercise.videoUrl }}
                      style={styles.gifImage}
                      contentFit="contain"
                      autoplay
                    />
                  </View>
                ) : (
                  <TouchableOpacity style={styles.videoBtn} onPress={() => openVideo(detailExercise.videoUrl)} activeOpacity={0.8}>
                    <PlayCircle size={20} color={Colors.black} />
                    <Text style={styles.videoBtnText}>Ver video del ejercicio</Text>
                  </TouchableOpacity>
                )
              ) : (
                <Text style={styles.noVideoText}>Sin video cargado para este ejercicio</Text>
              )}

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
            <TouchableOpacity
              style={styles.edbSearchBtn}
              onPress={() => setShowEdbSearch(true)}
              activeOpacity={0.8}
            >
              <Wand2 size={16} color={Colors.primary} />
              <Text style={styles.edbSearchBtnText}>Buscar video real del ejercicio</Text>
            </TouchableOpacity>
            {formVideoUrl ? (
              isVideoUrl(formVideoUrl) ? (
                <ExerciseVideoPlayer uri={formVideoUrl} style={styles.formGifPreview} />
              ) : (
                <GifImage source={{ uri: formVideoUrl }} style={styles.formGifPreview} contentFit="contain" autoplay />
              )
            ) : null}
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

      {/* Real-video search modal — pick a real exercise demo video, it gets
          downloaded once and re-hosted permanently in our own Supabase
          Storage bucket (no ongoing dependency on the external source), and
          its Spanish instructions get filled in automatically. */}
      <Modal
        visible={showEdbSearch}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEdbSearch(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Buscar ejercicio</Text>
            <TouchableOpacity onPress={() => setShowEdbSearch(false)}>
              <X size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.edbModalBody}>
            <View style={styles.searchBar}>
              <Search size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Ej: sentadilla, press de banca..."
                placeholderTextColor={Colors.textMuted}
                value={edbQuery}
                onChangeText={setEdbQuery}
                autoCapitalize="none"
                autoFocus
              />
              {edbQuery.length > 0 && (
                <TouchableOpacity onPress={() => setEdbQuery('')}>
                  <X size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.edbHint}>
              Podés buscar en español o en inglés. El video y las indicaciones técnicas se cargan solos al elegir un
              resultado.
            </Text>

            {edbDebouncedQuery.length > 0 && edbDebouncedQuery.length < 2 && (
              <Text style={styles.edbHint}>Escribí al menos 2 letras...</Text>
            )}

            {videoSearchQuery.isFetching && (
              <View style={styles.edbLoadingRow}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={styles.edbHint}>Buscando...</Text>
              </View>
            )}

            {videoSearchQuery.isError && (
              <Text style={styles.edbErrorText}>
                No se pudo buscar en la base de videos. Probá de nuevo en un momento.
              </Text>
            )}

            <ScrollView style={styles.edbResultsScroll} keyboardShouldPersistTaps="handled">
              {(videoSearchQuery.data?.results ?? []).map(result => {
                const isImporting = importingExerciseId === result.sourceId;
                return (
                  <TouchableOpacity
                    key={result.sourceId}
                    style={styles.edbResultCard}
                    onPress={() => handlePickEdbResult(result)}
                    disabled={importVideoMutation.isPending}
                    activeOpacity={0.7}
                  >
                    <View style={styles.edbResultInfo}>
                      <Text style={styles.edbResultName}>{result.name}</Text>
                      <View style={styles.badgeRow}>
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{MUSCLE_ICONS[result.muscleGroup] ?? '🏋️'} {result.muscleGroup}</Text>
                        </View>
                        {result.equipment ? (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{result.equipment}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    {isImporting ? (
                      <ActivityIndicator color={Colors.primary} />
                    ) : (
                      <Download size={18} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
              {videoSearchQuery.data && videoSearchQuery.data.results.length === 0 && (
                <Text style={styles.edbHint}>Sin resultados para &quot;{edbDebouncedQuery}&quot;.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bulk "import the whole catalog" progress modal. */}
      <Modal
        visible={bulkImport !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!bulkImport?.running) setBulkImport(null);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Importar catálogo</Text>
            {!bulkImport?.running && (
              <TouchableOpacity onPress={() => setBulkImport(null)}>
                <X size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.edbModalBody}>
            {bulkImport && (
              <>
                <Text style={styles.bulkProgressText}>
                  {bulkImport.done} / {bulkImport.total} ejercicios
                </Text>
                <View style={styles.bulkProgressBarTrack}>
                  <View
                    style={[
                      styles.bulkProgressBarFill,
                      { width: `${bulkImport.total > 0 ? (bulkImport.done / bulkImport.total) * 100 : 0}%` },
                    ]}
                  />
                </View>
                {bulkImport.running ? (
                  <>
                    <View style={styles.edbLoadingRow}>
                      <ActivityIndicator color={Colors.primary} />
                      <Text style={styles.edbHint} numberOfLines={1}>
                        Importando: {bulkImport.currentName}
                      </Text>
                    </View>
                    <Text style={styles.edbHint}>
                      Puede tardar varios minutos. Mantené la app abierta hasta que termine.
                    </Text>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => { bulkCancelRef.current = true; }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.deleteBtnText}>Cancelar</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.edbHint}>
                      {bulkImport.failed.length === 0
                        ? '¡Listo! Se importaron todos los ejercicios.'
                        : `Listo, con ${bulkImport.failed.length} ejercicio(s) que no se pudieron importar.`}
                    </Text>
                    {bulkImport.failed.length > 0 && (
                      <Text style={styles.edbHint}>{bulkImport.failed.join(', ')}</Text>
                    )}
                    <TouchableOpacity style={styles.submitBtn} onPress={() => setBulkImport(null)} activeOpacity={0.8}>
                      <Text style={styles.submitBtnText}>Cerrar</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

/** True for a direct image/GIF URL (e.g. our Supabase-hosted ExerciseDB
 *  imports) as opposed to a page URL like a YouTube link. */
function isImageUrl(url: string): boolean {
  return /\.(gif|png|jpe?g|webp)(\?.*)?$/i.test(url.trim());
}

/** True for a direct video file URL (our Supabase-hosted real exercise
 *  demo videos) as opposed to a page URL like a YouTube link. */
function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(url.trim());
}

/** Simple locally-generated id for exercises created outside RutinaContext
 *  (the bulk-import flow builds RutinaExercise objects directly instead of
 *  going through addExercise once per item — see handleBulkImportAll). */
function generateLocalId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Real exercise demo video — loops, muted, autoplaying, no controls, same
 *  "just show the movement" treatment as GifImage above but for MP4s. */
function ExerciseVideoPlayer({ uri, style }: { uri: string; style?: object }) {
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={style ?? styles.gifImage}
      contentFit="contain"
      nativeControls={false}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
    />
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
  fabSecondary: {
    position: 'absolute', bottom: 24, right: 86, width: 48, height: 48,
    borderRadius: 24, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.primary,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6,
  },
  bulkProgressText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, marginTop: 8 },
  bulkProgressBarTrack: {
    height: 10, borderRadius: 5, backgroundColor: Colors.surface, marginTop: 10, marginBottom: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.border,
  },
  bulkProgressBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 5 },
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
  gifCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, marginTop: 16,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  gifCardTop: { marginTop: 4, marginBottom: 16 },
  gifImage: { width: '100%', height: 260 },
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
  edbSearchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primaryLight, borderRadius: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.primary, borderStyle: 'dashed', marginTop: 10,
  },
  edbSearchBtnText: { fontSize: 13, fontWeight: '700' as const, color: Colors.primary },
  formGifPreview: {
    width: '100%', height: 160, marginTop: 12,
    backgroundColor: '#FFFFFF', borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  edbModalBody: { flex: 1, padding: 16 },
  edbHint: { fontSize: 12, color: Colors.textMuted, marginTop: 8, paddingHorizontal: 2 },
  edbErrorText: { fontSize: 13, color: Colors.error, marginTop: 10, paddingHorizontal: 2 },
  edbLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  edbResultsScroll: { flex: 1, marginTop: 10 },
  edbResultCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  edbResultInfo: { flex: 1, gap: 6 },
  edbResultName: { fontSize: 14, fontWeight: '700' as const, color: Colors.text, textTransform: 'capitalize' },
});
