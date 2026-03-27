import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Animated,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router';
import { Check, Dumbbell } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useGym } from '@/context/GymContext';
import { useRutina } from '@/context/RutinaContext';

function SetRow({
  setNumber,
  getSetData,
  localWeights,
  handleWeightChange,
  handleWeightBlur,
  handleToggleSet,
}: {
  setNumber: number;
  getSetData: (setNumber: number) => { weight: number; completed: boolean };
  localWeights: Record<number, string>;
  handleWeightChange: (setNumber: number, value: string) => void;
  handleWeightBlur: (setNumber: number) => void;
  handleToggleSet: (setNumber: number) => void;
}) {
  const data = getSetData(setNumber);
  const displayWeight = localWeights[setNumber] !== undefined
    ? localWeights[setNumber]
    : data.weight > 0 ? String(data.weight) : '';

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true, speed: 50 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }),
    ]).start();
    handleToggleSet(setNumber);
  };

  return (
    <Animated.View style={[styles.setRow, { transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.setNumberBadge}>
        <Text style={styles.setNumberText}>{setNumber}</Text>
      </View>

      <View style={styles.weightInputWrap}>
        <Dumbbell size={14} color={Colors.textMuted} />
        <TextInput
          style={styles.weightInput}
          value={displayWeight}
          onChangeText={(v) => handleWeightChange(setNumber, v)}
          onBlur={() => handleWeightBlur(setNumber)}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={Colors.textMuted}
        />
        <Text style={styles.kgLabel}>kg</Text>
      </View>

      <TouchableOpacity
        style={[styles.checkBtn, data.completed && styles.checkBtnDone]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Check size={20} color={data.completed ? Colors.black : Colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ExerciseScreen() {
  const { dayId, exerciseId, dayExerciseId, sets: setsStr, reps } = useLocalSearchParams<{
    dayId: string;
    exerciseId: string;
    dayExerciseId: string;
    sets: string;
    reps: string;
  }>();

  const { currentUser } = useGym();
  const {
    getExerciseById,
    getOrCreateWorkout,
    saveWorkoutSet,
    getTodayWorkout,
    getWorkoutSets,
    workoutSets: allWorkoutSets,
  } = useRutina();

  const studentId = currentUser?.studentId ?? '';
  const exercise = useMemo(() => getExerciseById(exerciseId ?? ''), [exerciseId, getExerciseById]);
  const totalSets = parseInt(setsStr ?? '3', 10);

  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [localWeights, setLocalWeights] = useState<Record<number, string>>({});

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => {
    if (!dayId || !studentId) return;
    const init = async () => {
      try {
        const workout = await getOrCreateWorkout(dayId, studentId);
        setWorkoutId(workout.id);
        console.log('[Exercise] Workout ready:', workout.id);
      } catch (e) {
        console.log('[Exercise] Error creating workout:', e);
      }
    };
    init();
  }, [dayId, studentId, getOrCreateWorkout]);

  const currentSets = useMemo(() => {
    if (!workoutId || !exerciseId) return [];
    return getWorkoutSets(workoutId).filter(ws => ws.exerciseId === exerciseId);
  }, [workoutId, exerciseId, getWorkoutSets, allWorkoutSets]);

  const completedCount = useMemo(() => {
    return currentSets.filter(ws => ws.completed).length;
  }, [currentSets]);

  const getSetData = useCallback((setNumber: number) => {
    const existing = currentSets.find(ws => ws.setNumber === setNumber);
    return {
      weight: existing?.weight ?? 0,
      completed: existing?.completed ?? false,
    };
  }, [currentSets]);

  const handleToggleSet = useCallback(async (setNumber: number) => {
    if (!workoutId || !exerciseId) return;
    const current = getSetData(setNumber);
    const weightStr = localWeights[setNumber];
    const weight = weightStr !== undefined ? parseFloat(weightStr) || 0 : current.weight;
    const newCompleted = !current.completed;

    try {
      await saveWorkoutSet(workoutId, exerciseId, setNumber, weight, newCompleted);
      console.log('[Exercise] Set toggled:', setNumber, 'completed:', newCompleted, 'weight:', weight);
    } catch (e) {
      console.log('[Exercise] Error saving set:', e);
    }
  }, [workoutId, exerciseId, getSetData, localWeights, saveWorkoutSet]);

  const handleWeightChange = useCallback((setNumber: number, value: string) => {
    setLocalWeights(prev => ({ ...prev, [setNumber]: value }));
  }, []);

  const handleWeightBlur = useCallback(async (setNumber: number) => {
    if (!workoutId || !exerciseId) return;
    const weightStr = localWeights[setNumber];
    if (weightStr === undefined) return;
    const weight = parseFloat(weightStr) || 0;
    const current = getSetData(setNumber);

    try {
      await saveWorkoutSet(workoutId, exerciseId, setNumber, weight, current.completed);
      console.log('[Exercise] Weight saved:', setNumber, weight);
    } catch (e) {
      console.log('[Exercise] Error saving weight:', e);
    }
  }, [workoutId, exerciseId, localWeights, getSetData, saveWorkoutSet]);

  const progressRatio = totalSets > 0 ? completedCount / totalSets : 0;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Stack.Screen options={{ title: exercise?.name ?? 'Ejercicio' }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={styles.muscleTag}>
              <Text style={styles.muscleTagText}>{exercise?.muscleGroup ?? ''}</Text>
            </View>
          </View>
          <Text style={styles.exerciseName}>{exercise?.name ?? 'Ejercicio'}</Text>
          <Text style={styles.exerciseDetail}>{totalSets} series × {reps ?? ''} reps</Text>

          <View style={styles.motivationalBar}>
            <Text style={styles.motivationalText}>
              Serie {Math.min(completedCount + 1, totalSets)} de {totalSets}
            </Text>
            <View style={styles.motivationalProgressBg}>
              <View style={[styles.motivationalProgressFill, { width: `${progressRatio * 100}%` as any }]} />
            </View>
          </View>

          {completedCount >= totalSets && (
            <View style={styles.allDoneBanner}>
              <Text style={styles.allDoneText}>¡Ejercicio completado! 💪</Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Series</Text>

        {Array.from({ length: totalSets }, (_, i) => i + 1).map((setNumber) => (
          <SetRow
            key={setNumber}
            setNumber={setNumber}
            getSetData={getSetData}
            localWeights={localWeights}
            handleWeightChange={handleWeightChange}
            handleWeightBlur={handleWeightBlur}
            handleToggleSet={handleToggleSet}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  muscleTag: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  muscleTagText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  exerciseName: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  exerciseDetail: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  motivationalBar: {
    gap: 8,
  },
  motivationalText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  motivationalProgressBg: {
    height: 5,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 3,
    overflow: 'hidden',
  },
  motivationalProgressFill: {
    height: 5,
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  allDoneBanner: {
    marginTop: 14,
    backgroundColor: 'rgba(198, 241, 53, 0.12)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  allDoneText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  setNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumberText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: Colors.textSecondary,
  },
  weightInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
  },
  weightInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    paddingVertical: 0,
  },
  kgLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600' as const,
  },
  checkBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnDone: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
});
