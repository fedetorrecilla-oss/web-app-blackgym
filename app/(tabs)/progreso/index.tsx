import { useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { Trophy, Flame, TrendingUp, Dumbbell, Calendar, Award } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useGym } from '@/context/GymContext';
import { useRutina } from '@/context/RutinaContext';

export default function ProgresoScreen() {
  const { currentUser } = useGym();
  const {
    getStudentWorkouts,
    getWorkoutSets,
    getStudentDays,
    getDayExercises,
    getExerciseById,
    workouts,
    workoutSets,
    exercises,
  } = useRutina();

  const studentId = currentUser?.studentId ?? '';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const studentWorkouts = useMemo(() => getStudentWorkouts(studentId), [studentId, getStudentWorkouts, workouts]);

  const stats = useMemo(() => {
    const totalWorkouts = studentWorkouts.length;

    const now = new Date();
    const startOfWeek = new Date(now);
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    startOfWeek.setDate(now.getDate() - diff);
    startOfWeek.setHours(0, 0, 0, 0);
    const weekStr = startOfWeek.toISOString().split('T')[0];
    const thisWeek = studentWorkouts.filter(w => w.date >= weekStr).length;

    let streak = 0;
    if (studentWorkouts.length > 0) {
      const sortedDates = [...new Set(studentWorkouts.map(w => w.date))].sort().reverse();
      const today = new Date().toISOString().split('T')[0];
      let checkDate = today;

      for (const date of sortedDates) {
        if (date === checkDate) {
          streak++;
          const d = new Date(checkDate);
          d.setDate(d.getDate() - 1);
          checkDate = d.toISOString().split('T')[0];
        } else if (date < checkDate) {
          if (streak === 0 && date === (() => {
            const d = new Date(today);
            d.setDate(d.getDate() - 1);
            return d.toISOString().split('T')[0];
          })()) {
            streak = 1;
            const d = new Date(date);
            d.setDate(d.getDate() - 1);
            checkDate = d.toISOString().split('T')[0];
          } else {
            break;
          }
        }
      }
    }

    let totalKg = 0;
    for (const w of studentWorkouts) {
      const sets = getWorkoutSets(w.id);
      for (const s of sets) {
        if (s.completed && s.weight > 0) {
          totalKg += s.weight;
        }
      }
    }

    return { totalWorkouts, thisWeek, streak, totalKg: Math.round(totalKg) };
  }, [studentWorkouts, getWorkoutSets, workoutSets]);

  const personalRecords = useMemo(() => {
    const records: Record<string, { exerciseId: string; maxWeight: number }> = {};

    for (const w of studentWorkouts) {
      const sets = getWorkoutSets(w.id);
      for (const s of sets) {
        if (s.completed && s.weight > 0) {
          if (!records[s.exerciseId] || s.weight > records[s.exerciseId].maxWeight) {
            records[s.exerciseId] = { exerciseId: s.exerciseId, maxWeight: s.weight };
          }
        }
      }
    }

    return Object.values(records)
      .sort((a, b) => b.maxWeight - a.maxWeight)
      .slice(0, 6)
      .map(r => ({
        ...r,
        name: getExerciseById(r.exerciseId)?.name ?? 'Ejercicio',
        muscleGroup: getExerciseById(r.exerciseId)?.muscleGroup ?? '',
      }));
  }, [studentWorkouts, getWorkoutSets, workoutSets, getExerciseById]);

  const recentWorkouts = useMemo(() => {
    const studentDays = getStudentDays(studentId);
    const dayMap = new Map(studentDays.map(d => [d.id, d]));

    return studentWorkouts.slice(0, 5).map(w => {
      const day = dayMap.get(w.dayId);
      return {
        id: w.id,
        date: w.date,
        dayLetter: day?.dayLetter ?? '?',
        dayName: day?.name ?? 'Día',
      };
    });
  }, [studentWorkouts, studentId, getStudentDays]);

  const evolutionData = useMemo(() => {
    if (exercises.length === 0 || studentWorkouts.length === 0) return [];

    const exerciseHistory: Record<string, { date: string; maxWeight: number }[]> = {};

    for (const w of studentWorkouts) {
      const sets = getWorkoutSets(w.id);
      for (const s of sets) {
        if (s.completed && s.weight > 0) {
          if (!exerciseHistory[s.exerciseId]) {
            exerciseHistory[s.exerciseId] = [];
          }
          const existing = exerciseHistory[s.exerciseId].find(e => e.date === w.date);
          if (existing) {
            existing.maxWeight = Math.max(existing.maxWeight, s.weight);
          } else {
            exerciseHistory[s.exerciseId].push({ date: w.date, maxWeight: s.weight });
          }
        }
      }
    }

    return Object.entries(exerciseHistory)
      .filter(([_, history]) => history.length >= 2)
      .map(([exId, history]) => {
        const sorted = history.sort((a, b) => a.date.localeCompare(b.date));
        const recent = sorted.slice(-12);
        const first = recent[0].maxWeight;
        const last = recent[recent.length - 1].maxWeight;
        const improvement = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
        const maxInHistory = Math.max(...recent.map(r => r.maxWeight));
        const ex = getExerciseById(exId);

        return {
          exerciseId: exId,
          name: ex?.name ?? 'Ejercicio',
          data: recent,
          first,
          last,
          improvement,
          maxInHistory,
        };
      })
      .sort((a, b) => b.data.length - a.data.length)
      .slice(0, 4);
  }, [exercises, studentWorkouts, getWorkoutSets, workoutSets, getExerciseById]);

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}`;
  };

  if (!studentId) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <TrendingUp size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Iniciá sesión como alumno para ver tu progreso</Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Dumbbell size={20} color={Colors.primary} />
            <Text style={styles.statValue}>{stats.totalWorkouts}</Text>
            <Text style={styles.statLabel}>Entrenamientos</Text>
          </View>
          <View style={styles.statCard}>
            <Calendar size={20} color="#4FC3F7" />
            <Text style={styles.statValue}>{stats.thisWeek}</Text>
            <Text style={styles.statLabel}>Esta semana</Text>
          </View>
          <View style={styles.statCard}>
            <Flame size={20} color="#FF7043" />
            <Text style={styles.statValue}>{stats.streak}</Text>
            <Text style={styles.statLabel}>Racha</Text>
          </View>
          <View style={styles.statCard}>
            <TrendingUp size={20} color="#66BB6A" />
            <Text style={styles.statValue}>{stats.totalKg > 1000 ? `${(stats.totalKg / 1000).toFixed(1)}k` : stats.totalKg}</Text>
            <Text style={styles.statLabel}>Kg totales</Text>
          </View>
        </View>

        {personalRecords.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Trophy size={18} color="#FFD700" />
              <Text style={styles.sectionTitle}>Récords Personales</Text>
            </View>
            <View style={styles.recordsList}>
              {personalRecords.map((record, index) => (
                <View key={record.exerciseId} style={styles.recordRow}>
                  <View style={styles.recordRank}>
                    <Text style={styles.recordRankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.recordInfo}>
                    <Text style={styles.recordName}>{record.name}</Text>
                    <Text style={styles.recordMuscle}>{record.muscleGroup}</Text>
                  </View>
                  <View style={styles.recordWeight}>
                    <Text style={styles.recordWeightText}>{record.maxWeight} kg</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {recentWorkouts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Calendar size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Últimos Entrenamientos</Text>
            </View>
            <View style={styles.recentList}>
              {recentWorkouts.map((w) => (
                <View key={w.id} style={styles.recentRow}>
                  <View style={styles.recentDayBadge}>
                    <Text style={styles.recentDayLetter}>{w.dayLetter}</Text>
                  </View>
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentName}>{w.dayName}</Text>
                    <Text style={styles.recentDate}>{formatDate(w.date)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {evolutionData.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Award size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Evolución</Text>
            </View>
            {evolutionData.map((evo) => (
              <View key={evo.exerciseId} style={styles.evoCard}>
                <View style={styles.evoHeader}>
                  <Text style={styles.evoName}>{evo.name}</Text>
                  <View style={[styles.evoBadge, evo.improvement >= 0 ? styles.evoBadgeUp : styles.evoBadgeDown]}>
                    <Text style={[styles.evoBadgeText, evo.improvement >= 0 ? styles.evoBadgeTextUp : styles.evoBadgeTextDown]}>
                      {evo.improvement >= 0 ? '+' : ''}{evo.improvement}%
                    </Text>
                  </View>
                </View>
                <View style={styles.evoStats}>
                  <Text style={styles.evoStatText}>Inicio: {evo.first} kg</Text>
                  <Text style={styles.evoStatText}>Actual: {evo.last} kg</Text>
                </View>
                <View style={styles.barChart}>
                  {evo.data.map((point, i) => {
                    const barHeight = evo.maxInHistory > 0 ? (point.maxWeight / evo.maxInHistory) * 60 : 10;
                    return (
                      <View key={`${point.date}-${i}`} style={styles.barCol}>
                        <View style={[styles.bar, { height: Math.max(barHeight, 4) }]} />
                        <Text style={styles.barLabel}>{formatDate(point.date)}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}

        {studentWorkouts.length === 0 && (
          <View style={styles.emptyState}>
            <Dumbbell size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Sin entrenamientos aún</Text>
            <Text style={styles.emptyText}>
              Empezá a entrenar desde "Mi Rutina" y acá vas a ver tu progreso
            </Text>
          </View>
        )}
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
    paddingBottom: 32,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '45%' as any,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  recordsList: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  recordRank: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordRankText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  recordInfo: {
    flex: 1,
  },
  recordName: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  recordMuscle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  recordWeight: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  recordWeightText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  recentList: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  recentDayBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentDayLetter: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  recentDate: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  evoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  evoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  evoName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  evoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  evoBadgeUp: {
    backgroundColor: Colors.successLight,
  },
  evoBadgeDown: {
    backgroundColor: Colors.errorLight,
  },
  evoBadgeText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  evoBadgeTextUp: {
    color: Colors.success,
  },
  evoBadgeTextDown: {
    color: Colors.error,
  },
  evoStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  evoStatText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 80,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '70%' as any,
    backgroundColor: Colors.primary,
    borderRadius: 3,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 8,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
