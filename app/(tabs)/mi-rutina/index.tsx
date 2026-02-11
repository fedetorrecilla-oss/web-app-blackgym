import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Dumbbell, ChevronRight, Trophy, Zap } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useGym } from '@/context/GymContext';
import { useRutina } from '@/context/RutinaContext';

function ExerciseRow({
  de,
  index,
  getExerciseById,
  getExerciseProgress,
  selectedDay,
  router,
}: {
  de: { id: string; exerciseId: string; sets: number; reps: string };
  index: number;
  getExerciseById: (id: string) => { name: string; muscleGroup: string } | null;
  getExerciseProgress: (exerciseId: string, totalSets: number) => { completed: number; total: number; ratio: number };
  selectedDay: { id: string } | null;
  router: ReturnType<typeof useRouter>;
}) {
  const ex = getExerciseById(de.exerciseId);
  const prog = getExerciseProgress(de.exerciseId, de.sets);
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: 1,
      duration: 400,
      delay: index * 60,
      useNativeDriver: true,
    }).start();
  }, [animValue, index]);

  return (
    <Animated.View
      style={{
        opacity: animValue,
        transform: [{ translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      }}
    >
      <TouchableOpacity
        style={styles.exerciseCard}
        onPress={() => {
          if (selectedDay) {
            router.push({
              pathname: '/(tabs)/mi-rutina/exercise' as any,
              params: {
                dayId: selectedDay.id,
                exerciseId: de.exerciseId,
                dayExerciseId: de.id,
                sets: String(de.sets),
                reps: de.reps,
              },
            });
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.exerciseLeft}>
          <View style={[styles.exerciseIndex, prog.ratio >= 1 && styles.exerciseIndexDone]}>
            {prog.ratio >= 1 ? (
              <Zap size={16} color={Colors.black} />
            ) : (
              <Text style={styles.exerciseIndexText}>{index + 1}</Text>
            )}
          </View>
          <View style={styles.exerciseInfo}>
            <Text style={styles.exerciseName}>{ex?.name ?? 'Ejercicio'}</Text>
            <Text style={styles.exerciseMeta}>
              {ex?.muscleGroup ?? ''} · {de.sets}×{de.reps}
            </Text>
            <View style={styles.miniProgressBg}>
              <View style={[styles.miniProgressFill, { width: `${prog.ratio * 100}%` as any }]} />
            </View>
          </View>
        </View>
        <View style={styles.exerciseRight}>
          <Text style={styles.exerciseProgressLabel}>{prog.completed}/{prog.total}</Text>
          <ChevronRight size={18} color={Colors.textMuted} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function MiRutinaScreen() {
  const router = useRouter();
  const { currentUser } = useGym();
  const {
    getStudentDays,
    getDayExercises,
    getExerciseById,
    getTodayWorkout,
    getWorkoutSets,
    workoutSets,
    isLoading,
  } = useRutina();

  const studentId = currentUser?.studentId ?? '';
  const studentDays = useMemo(() => getStudentDays(studentId), [studentId, getStudentDays]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const selectedDay = studentDays[selectedDayIndex] ?? null;

  const exercises = useMemo(() => {
    if (!selectedDay) return [];
    return getDayExercises(selectedDay.id);
  }, [selectedDay, getDayExercises]);

  const todayWorkout = useMemo(() => {
    if (!selectedDay || !studentId) return null;
    return getTodayWorkout(selectedDay.id, studentId);
  }, [selectedDay, studentId, getTodayWorkout]);

  const todaySets = useMemo(() => {
    if (!todayWorkout) return [];
    return getWorkoutSets(todayWorkout.id);
  }, [todayWorkout, getWorkoutSets, workoutSets]);

  const progressData = useMemo(() => {
    let totalSets = 0;
    let completedSets = 0;
    let completedExercises = 0;

    for (const de of exercises) {
      totalSets += de.sets;
      const exSets = todaySets.filter(ws => ws.exerciseId === de.exerciseId);
      const exCompleted = exSets.filter(ws => ws.completed).length;
      completedSets += exCompleted;
      if (exCompleted >= de.sets) {
        completedExercises++;
      }
    }

    const percentage = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

    return { totalSets, completedSets, completedExercises, totalExercises: exercises.length, percentage };
  }, [exercises, todaySets]);

  const getExerciseProgress = useCallback((exerciseId: string, totalSets: number) => {
    const exSets = todaySets.filter(ws => ws.exerciseId === exerciseId);
    const completed = exSets.filter(ws => ws.completed).length;
    return { completed, total: totalSets, ratio: totalSets > 0 ? completed / totalSets : 0 };
  }, [todaySets]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  if (!studentId) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Dumbbell size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Sin acceso</Text>
          <Text style={styles.emptyText}>Iniciá sesión como alumno para ver tu rutina</Text>
        </View>
      </View>
    );
  }

  if (studentDays.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Dumbbell size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Sin rutina asignada</Text>
          <Text style={styles.emptyText}>Tu profesor todavía no te asignó una rutina. Contactalo para que te arme tu plan de entrenamiento.</Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.daySelector}
        style={styles.daySelectorScroll}
      >
        {studentDays.map((day, index) => {
          const isActive = index === selectedDayIndex;
          return (
            <TouchableOpacity
              key={day.id}
              style={[styles.dayPill, isActive && styles.dayPillActive]}
              onPress={() => setSelectedDayIndex(index)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dayPillLetter, isActive && styles.dayPillLetterActive]}>
                {day.dayLetter}
              </Text>
              <Text style={[styles.dayPillName, isActive && styles.dayPillNameActive]} numberOfLines={1}>
                {day.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {progressData.totalSets > 0 && (
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <View style={styles.progressLabels}>
              <Text style={styles.progressTitle}>Progreso del día</Text>
              <Text style={styles.progressDetail}>
                {progressData.completedSets}/{progressData.totalSets} series · {progressData.completedExercises}/{progressData.totalExercises} ejercicios
              </Text>
            </View>
            <View style={styles.percentBadge}>
              <Text style={styles.percentText}>{progressData.percentage}%</Text>
            </View>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressData.percentage}%` as any }]} />
          </View>
          {progressData.percentage === 100 && (
            <View style={styles.completeBanner}>
              <Trophy size={18} color="#FFD700" />
              <Text style={styles.completeBannerText}>¡Día completado! 🎉</Text>
            </View>
          )}
        </View>
      )}

      <ScrollView
        style={styles.exercisesList}
        contentContainerStyle={styles.exercisesContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {exercises.map((de, index) => (
          <ExerciseRow
            key={de.id}
            de={de}
            index={index}
            getExerciseById={getExerciseById}
            getExerciseProgress={getExerciseProgress}
            selectedDay={selectedDay}
            router={router}
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  daySelectorScroll: {
    maxHeight: 72,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  daySelector: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    alignItems: 'center',
  },
  dayPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayPillLetter: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.textSecondary,
  },
  dayPillLetterActive: {
    color: Colors.black,
  },
  dayPillName: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  dayPillNameActive: {
    color: Colors.black,
    fontWeight: '600' as const,
  },
  progressSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressLabels: {
    flex: 1,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  progressDetail: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  percentBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  percentText: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  completeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingVertical: 10,
    borderRadius: 10,
  },
  completeBannerText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFD700',
  },
  exercisesList: {
    flex: 1,
  },
  exercisesContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 8,
  },
  exerciseCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exerciseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  exerciseIndex: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseIndexDone: {
    backgroundColor: Colors.primary,
  },
  exerciseIndexText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: Colors.textSecondary,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  exerciseMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  miniProgressBg: {
    height: 3,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  exerciseRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseProgressLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
  },
});
