import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
import { useRouter } from 'expo-router';
import {
  Dumbbell,
  Plus,
  Trash2,
  ChevronRight,
  Library,
  UserPlus,
  X,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useRutina } from '@/context/RutinaContext';

export default function RutinasScreen() {
  const router = useRouter();
  const {
    templates,
    getTemplateDays,
    getCustomDays,
    getDayExercises,
    addTemplate,
    deleteTemplate,
    addDay,
    deleteDay,
  } = useRutina();

  const [activeTab, setActiveTab] = useState<'standard' | 'custom'>('standard');
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [showAddDay, setShowAddDay] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateGender, setNewTemplateGender] = useState<'hombre' | 'mujer'>('hombre');
  const [newTemplateLevel, setNewTemplateLevel] = useState<'principiante' | 'intermedio' | 'avanzado'>('principiante');
  const [newDayLetter, setNewDayLetter] = useState('');
  const [newDayName, setNewDayName] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const customDays = useMemo(() => getCustomDays(), [getCustomDays]);

  const getLevelEmoji = (level: string) => {
    if (level === 'principiante') return '🟢';
    if (level === 'intermedio') return '🟡';
    return '🔴';
  };

  const getGenderIcon = (gender: string) => gender === 'hombre' ? '♂️' : '♀️';

  const handleCreateTemplate = useCallback(async () => {
    if (!newTemplateName.trim()) {
      Alert.alert('Error', 'Ingresá un nombre para la rutina');
      return;
    }
    await addTemplate(newTemplateName.trim(), newTemplateGender, newTemplateLevel);
    setShowCreateTemplate(false);
    setNewTemplateName('');
  }, [newTemplateName, newTemplateGender, newTemplateLevel, addTemplate]);

  const handleDeleteTemplate = useCallback((id: string, name: string) => {
    Alert.alert('Eliminar rutina', `¿Eliminar "${name}"? Se borrarán todos sus días y ejercicios.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteTemplate(id) },
    ]);
  }, [deleteTemplate]);

  const handleAddDay = useCallback(async () => {
    if (!newDayLetter.trim() || !newDayName.trim()) {
      Alert.alert('Error', 'Completá la letra y el nombre del día');
      return;
    }
    await addDay(newDayLetter.trim().toUpperCase(), newDayName.trim());
    setShowAddDay(false);
    setNewDayLetter('');
    setNewDayName('');
  }, [newDayLetter, newDayName, addDay]);

  const handleDeleteDay = useCallback((id: string, name: string) => {
    Alert.alert('Eliminar día', `¿Eliminar "${name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteDay(id) },
    ]);
  }, [deleteDay]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.push('/rutinas/catalog' as any)}
          activeOpacity={0.7}
        >
          <Library size={16} color={Colors.primary} />
          <Text style={styles.headerBtnText}>Ejercicios</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.push('/rutinas/assign' as any)}
          activeOpacity={0.7}
        >
          <UserPlus size={16} color={Colors.primary} />
          <Text style={styles.headerBtnText}>Asignar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'standard' && styles.tabActive]}
          onPress={() => setActiveTab('standard')}
        >
          <Text style={[styles.tabText, activeTab === 'standard' && styles.tabTextActive]}>Estándar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'custom' && styles.tabActive]}
          onPress={() => setActiveTab('custom')}
        >
          <Text style={[styles.tabText, activeTab === 'custom' && styles.tabTextActive]}>Personalizadas</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'standard' ? (
          templates.length === 0 ? (
            <View style={styles.emptyState}>
              <Dumbbell size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No hay rutinas estándar</Text>
            </View>
          ) : (
            templates.map((template) => {
              const templateDays = getTemplateDays(template.id);
              return (
                <TouchableOpacity
                  key={template.id}
                  style={styles.card}
                  onPress={() => router.push({ pathname: '/rutinas/template' as any, params: { templateId: template.id } })}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardGender}>{getGenderIcon(template.gender)}</Text>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName}>{template.name}</Text>
                      <Text style={styles.cardMeta}>
                        {getLevelEmoji(template.level)} {template.level} · {templateDays.length} día{templateDays.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      onPress={() => handleDeleteTemplate(template.id, template.name)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Trash2 size={16} color={Colors.error} />
                    </TouchableOpacity>
                    <ChevronRight size={18} color={Colors.textMuted} />
                  </View>
                </TouchableOpacity>
              );
            })
          )
        ) : (
          customDays.length === 0 ? (
            <View style={styles.emptyState}>
              <Dumbbell size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No hay rutinas personalizadas</Text>
            </View>
          ) : (
            customDays.map((day) => {
              const exCount = getDayExercises(day.id).length;
              return (
                <TouchableOpacity
                  key={day.id}
                  style={styles.card}
                  onPress={() => router.push({ pathname: '/rutinas/day' as any, params: { dayId: day.id, dayName: day.name, dayLetter: day.dayLetter } })}
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
                    <TouchableOpacity
                      onPress={() => handleDeleteDay(day.id, day.name)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Trash2 size={16} color={Colors.error} />
                    </TouchableOpacity>
                    <ChevronRight size={18} color={Colors.textMuted} />
                  </View>
                </TouchableOpacity>
              );
            })
          )
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => activeTab === 'standard' ? setShowCreateTemplate(true) : setShowAddDay(true)}
        activeOpacity={0.8}
      >
        <Plus size={24} color={Colors.black} />
      </TouchableOpacity>

      <Modal visible={showCreateTemplate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreateTemplate(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nueva Rutina Estándar</Text>
            <TouchableOpacity onPress={() => setShowCreateTemplate(false)}>
              <X size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.inputLabel}>Nombre</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Hombre Avanzado"
              placeholderTextColor={Colors.textMuted}
              value={newTemplateName}
              onChangeText={setNewTemplateName}
            />
            <Text style={styles.inputLabel}>Género</Text>
            <View style={styles.chipRow}>
              {(['hombre', 'mujer'] as const).map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, newTemplateGender === g && styles.chipActive]}
                  onPress={() => setNewTemplateGender(g)}
                >
                  <Text style={[styles.chipText, newTemplateGender === g && styles.chipTextActive]}>
                    {g === 'hombre' ? '♂️ Hombre' : '♀️ Mujer'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.inputLabel}>Nivel</Text>
            <View style={styles.chipRow}>
              {(['principiante', 'intermedio', 'avanzado'] as const).map(l => (
                <TouchableOpacity
                  key={l}
                  style={[styles.chip, newTemplateLevel === l && styles.chipActive]}
                  onPress={() => setNewTemplateLevel(l)}
                >
                  <Text style={[styles.chipText, newTemplateLevel === l && styles.chipTextActive]}>
                    {getLevelEmoji(l)} {l.charAt(0).toUpperCase() + l.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateTemplate} activeOpacity={0.8}>
              <Text style={styles.submitBtnText}>Crear Rutina</Text>
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
              <TextInput
                style={styles.input}
                placeholder="Ej: A"
                placeholderTextColor={Colors.textMuted}
                value={newDayLetter}
                onChangeText={setNewDayLetter}
                maxLength={2}
                autoCapitalize="characters"
              />
              <Text style={styles.inputLabel}>Nombre</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Empuje"
                placeholderTextColor={Colors.textMuted}
                value={newDayName}
                onChangeText={setNewDayName}
              />
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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  headerBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.black,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    gap: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cardGender: {
    fontSize: 24,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  cardMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  chipTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.black,
  },
});
