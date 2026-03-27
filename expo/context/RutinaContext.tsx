import { useCallback, useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import {
  RutinaExercise,
  RutinaTemplate,
  RutinaDay,
  RutinaDayExercise,
  RutinaWorkout,
  RutinaWorkoutSet,
} from '@/types/rutina';
import { SEED_EXERCISES } from '@/constants/rutina-seeds';
import { STANDARD_TEMPLATES } from '@/constants/rutina-templates';
import { trpc } from '@/lib/trpc';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const KEYS = {
  exercises: 'rutina_exercises',
  templates: 'rutina_templates',
  days: 'rutina_days',
  dayExercises: 'rutina_day_exercises',
  workouts: 'rutina_workouts',
  workoutSets: 'rutina_workout_sets',
  seeded: 'rutina_seeded',
} as const;

export const [RutinaProvider, useRutina] = createContextHook(() => {
  const [exercises, setExercises] = useState<RutinaExercise[]>([]);
  const [templates, setTemplates] = useState<RutinaTemplate[]>([]);
  const [days, setDays] = useState<RutinaDay[]>([]);
  const [dayExercises, setDayExercises] = useState<RutinaDayExercise[]>([]);
  const [workouts, setWorkouts] = useState<RutinaWorkout[]>([]);
  const [workoutSets, setWorkoutSets] = useState<RutinaWorkoutSet[]>([]);
  const [localLoaded, setLocalLoaded] = useState(false);
  const initialSyncDone = useRef(false);

  const utils = trpc.useUtils();

  const localDataQuery = useQuery({
    queryKey: ['localRutinaData'],
    queryFn: async () => {
      console.log('[RutinaContext] Loading local data...');
      const [sExercises, sTemplates, sDays, sDayExercises, sWorkouts, sWorkoutSets, sSeeded] =
        await Promise.all([
          AsyncStorage.getItem(KEYS.exercises),
          AsyncStorage.getItem(KEYS.templates),
          AsyncStorage.getItem(KEYS.days),
          AsyncStorage.getItem(KEYS.dayExercises),
          AsyncStorage.getItem(KEYS.workouts),
          AsyncStorage.getItem(KEYS.workoutSets),
          AsyncStorage.getItem(KEYS.seeded),
        ]);

      let parsedExercises = sExercises ? JSON.parse(sExercises) as RutinaExercise[] : [];
      let parsedTemplates = sTemplates ? JSON.parse(sTemplates) as RutinaTemplate[] : [];
      let parsedDays = sDays ? JSON.parse(sDays) as RutinaDay[] : [];
      let parsedDayExercises = sDayExercises ? JSON.parse(sDayExercises) as RutinaDayExercise[] : [];
      const parsedWorkouts = sWorkouts ? JSON.parse(sWorkouts) as RutinaWorkout[] : [];
      const parsedWorkoutSets = sWorkoutSets ? JSON.parse(sWorkoutSets) as RutinaWorkoutSet[] : [];

      if (sSeeded !== 'true') {
        console.log('[RutinaContext] Seeding initial data...');
        const newExercises: RutinaExercise[] = SEED_EXERCISES.map(e => ({
          ...e,
          id: generateId(),
        }));

        const newTemplates: RutinaTemplate[] = [];
        const newDays: RutinaDay[] = [];
        const newDayExercises: RutinaDayExercise[] = [];

        for (const def of STANDARD_TEMPLATES) {
          const templateId = generateId();
          newTemplates.push({
            id: templateId,
            name: def.name,
            gender: def.gender,
            level: def.level,
          });

          def.days.forEach((dayDef, dayIndex) => {
            const dayId = generateId();
            newDays.push({
              id: dayId,
              name: dayDef.name,
              dayLetter: dayDef.letter,
              order: dayIndex,
              templateId,
            });

            dayDef.exercises.forEach((exDef, exIndex) => {
              const exercise = newExercises.find(e => e.name === exDef.exerciseName);
              if (exercise) {
                newDayExercises.push({
                  id: generateId(),
                  dayId,
                  exerciseId: exercise.id,
                  sets: exDef.sets,
                  reps: exDef.reps,
                  order: exIndex,
                });
              }
            });
          });
        }

        parsedExercises = newExercises;
        parsedTemplates = newTemplates;
        parsedDays = newDays;
        parsedDayExercises = newDayExercises;

        await Promise.all([
          AsyncStorage.setItem(KEYS.exercises, JSON.stringify(newExercises)),
          AsyncStorage.setItem(KEYS.templates, JSON.stringify(newTemplates)),
          AsyncStorage.setItem(KEYS.days, JSON.stringify(newDays)),
          AsyncStorage.setItem(KEYS.dayExercises, JSON.stringify(newDayExercises)),
          AsyncStorage.setItem(KEYS.seeded, 'true'),
        ]);
        console.log('[RutinaContext] Seed complete:', newExercises.length, 'exercises,', newTemplates.length, 'templates');
      }

      return {
        exercises: parsedExercises,
        templates: parsedTemplates,
        days: parsedDays,
        dayExercises: parsedDayExercises,
        workouts: parsedWorkouts,
        workoutSets: parsedWorkoutSets,
      };
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (localDataQuery.data && !localLoaded) {
      console.log('[RutinaContext] Applying local data');
      setExercises(localDataQuery.data.exercises);
      setTemplates(localDataQuery.data.templates);
      setDays(localDataQuery.data.days);
      setDayExercises(localDataQuery.data.dayExercises);
      setWorkouts(localDataQuery.data.workouts);
      setWorkoutSets(localDataQuery.data.workoutSets);
      setLocalLoaded(true);
    }
  }, [localDataQuery.data, localLoaded]);

  const dataQuery = trpc.rutina.getData.useQuery(undefined, {
    refetchInterval: 8000,
    staleTime: 3000,
    retry: 2,
    retryDelay: 2000,
  });

  const setExercisesMut = trpc.rutina.setExercises.useMutation({
    onSuccess: () => { utils.rutina.getData.invalidate(); },
    onError: (err) => { console.log('[RutinaContext] Exercises sync failed:', err.message); },
  });
  const setTemplatesMut = trpc.rutina.setTemplates.useMutation({
    onSuccess: () => { utils.rutina.getData.invalidate(); },
    onError: (err) => { console.log('[RutinaContext] Templates sync failed:', err.message); },
  });
  const setDaysMut = trpc.rutina.setDays.useMutation({
    onSuccess: () => { utils.rutina.getData.invalidate(); },
    onError: (err) => { console.log('[RutinaContext] Days sync failed:', err.message); },
  });
  const setDayExercisesMut = trpc.rutina.setDayExercises.useMutation({
    onSuccess: () => { utils.rutina.getData.invalidate(); },
    onError: (err) => { console.log('[RutinaContext] DayExercises sync failed:', err.message); },
  });
  const setWorkoutsMut = trpc.rutina.setWorkouts.useMutation({
    onSuccess: () => { utils.rutina.getData.invalidate(); },
    onError: (err) => { console.log('[RutinaContext] Workouts sync failed:', err.message); },
  });
  const setWorkoutSetsMut = trpc.rutina.setWorkoutSets.useMutation({
    onSuccess: () => { utils.rutina.getData.invalidate(); },
    onError: (err) => { console.log('[RutinaContext] WorkoutSets sync failed:', err.message); },
  });

  useEffect(() => {
    if (!dataQuery.data || !localLoaded) return;

    const bd = dataQuery.data;
    const backendHasData = bd.exercises.length > 0 || bd.templates.length > 0 || bd.days.length > 0;
    const localHasData = exercises.length > 0 || templates.length > 0 || days.length > 0;

    if (!initialSyncDone.current && !backendHasData && localHasData) {
      console.log('[RutinaContext] Pushing local data to backend');
      initialSyncDone.current = true;
      if (exercises.length > 0) setExercisesMut.mutate({ exercises });
      if (templates.length > 0) setTemplatesMut.mutate({ templates });
      if (days.length > 0) setDaysMut.mutate({ days });
      if (dayExercises.length > 0) setDayExercisesMut.mutate({ dayExercises });
      if (workouts.length > 0) setWorkoutsMut.mutate({ workouts });
      if (workoutSets.length > 0) setWorkoutSetsMut.mutate({ workoutSets });
      return;
    }

    initialSyncDone.current = true;
    console.log('[RutinaContext] Backend data received');
    setExercises(bd.exercises);
    setTemplates(bd.templates);
    setDays(bd.days);
    setDayExercises(bd.dayExercises);
    setWorkouts(bd.workouts);
    setWorkoutSets(bd.workoutSets);

    AsyncStorage.setItem(KEYS.exercises, JSON.stringify(bd.exercises)).catch(() => {});
    AsyncStorage.setItem(KEYS.templates, JSON.stringify(bd.templates)).catch(() => {});
    AsyncStorage.setItem(KEYS.days, JSON.stringify(bd.days)).catch(() => {});
    AsyncStorage.setItem(KEYS.dayExercises, JSON.stringify(bd.dayExercises)).catch(() => {});
    AsyncStorage.setItem(KEYS.workouts, JSON.stringify(bd.workouts)).catch(() => {});
    AsyncStorage.setItem(KEYS.workoutSets, JSON.stringify(bd.workoutSets)).catch(() => {});
  }, [dataQuery.data, localLoaded]);

  const persistExercises = useCallback(async (data: RutinaExercise[]) => {
    setExercises(data);
    await AsyncStorage.setItem(KEYS.exercises, JSON.stringify(data));
    setExercisesMut.mutate({ exercises: data });
  }, [setExercisesMut]);

  const persistTemplates = useCallback(async (data: RutinaTemplate[]) => {
    setTemplates(data);
    await AsyncStorage.setItem(KEYS.templates, JSON.stringify(data));
    setTemplatesMut.mutate({ templates: data });
  }, [setTemplatesMut]);

  const persistDays = useCallback(async (data: RutinaDay[]) => {
    setDays(data);
    await AsyncStorage.setItem(KEYS.days, JSON.stringify(data));
    setDaysMut.mutate({ days: data });
  }, [setDaysMut]);

  const persistDayExercises = useCallback(async (data: RutinaDayExercise[]) => {
    setDayExercises(data);
    await AsyncStorage.setItem(KEYS.dayExercises, JSON.stringify(data));
    setDayExercisesMut.mutate({ dayExercises: data });
  }, [setDayExercisesMut]);

  const persistWorkouts = useCallback(async (data: RutinaWorkout[]) => {
    setWorkouts(data);
    await AsyncStorage.setItem(KEYS.workouts, JSON.stringify(data));
    setWorkoutsMut.mutate({ workouts: data });
  }, [setWorkoutsMut]);

  const persistWorkoutSets = useCallback(async (data: RutinaWorkoutSet[]) => {
    setWorkoutSets(data);
    await AsyncStorage.setItem(KEYS.workoutSets, JSON.stringify(data));
    setWorkoutSetsMut.mutate({ workoutSets: data });
  }, [setWorkoutSetsMut]);

  const addExercise = useCallback(async (name: string, videoUrl: string, muscleGroup: string) => {
    const exercise: RutinaExercise = { id: generateId(), name, videoUrl, muscleGroup };
    await persistExercises([...exercises, exercise]);
    console.log('[RutinaContext] Exercise added:', name);
    return exercise;
  }, [exercises, persistExercises]);

  const updateExercise = useCallback(async (id: string, name: string, videoUrl: string, muscleGroup: string) => {
    const updated = exercises.map(e => e.id === id ? { ...e, name, videoUrl, muscleGroup } : e);
    await persistExercises(updated);
  }, [exercises, persistExercises]);

  const deleteExercise = useCallback(async (id: string) => {
    await persistExercises(exercises.filter(e => e.id !== id));
    await persistDayExercises(dayExercises.filter(de => de.exerciseId !== id));
  }, [exercises, dayExercises, persistExercises, persistDayExercises]);

  const addTemplate = useCallback(async (name: string, gender: 'hombre' | 'mujer', level: 'principiante' | 'intermedio' | 'avanzado') => {
    const template: RutinaTemplate = { id: generateId(), name, gender, level };
    await persistTemplates([...templates, template]);
    console.log('[RutinaContext] Template added:', name);
    return template;
  }, [templates, persistTemplates]);

  const updateTemplate = useCallback(async (id: string, name: string, gender: 'hombre' | 'mujer', level: 'principiante' | 'intermedio' | 'avanzado') => {
    await persistTemplates(templates.map(t => t.id === id ? { ...t, name, gender, level } : t));
  }, [templates, persistTemplates]);

  const deleteTemplate = useCallback(async (id: string) => {
    const templateDayIds = days.filter(d => d.templateId === id).map(d => d.id);
    await persistTemplates(templates.filter(t => t.id !== id));
    await persistDays(days.filter(d => d.templateId !== id));
    await persistDayExercises(dayExercises.filter(de => !templateDayIds.includes(de.dayId)));
  }, [templates, days, dayExercises, persistTemplates, persistDays, persistDayExercises]);

  const addDay = useCallback(async (letter: string, name: string, templateId?: string) => {
    const existingDays = templateId
      ? days.filter(d => d.templateId === templateId)
      : days.filter(d => !d.templateId && !d.studentId);
    const day: RutinaDay = {
      id: generateId(),
      name,
      dayLetter: letter,
      order: existingDays.length,
      templateId,
    };
    await persistDays([...days, day]);
    console.log('[RutinaContext] Day added:', letter, name);
    return day;
  }, [days, persistDays]);

  const deleteDay = useCallback(async (id: string) => {
    await persistDays(days.filter(d => d.id !== id));
    await persistDayExercises(dayExercises.filter(de => de.dayId !== id));
  }, [days, dayExercises, persistDays, persistDayExercises]);

  const addDayExercise = useCallback(async (dayId: string, exerciseId: string, sets: number, reps: string) => {
    const existing = dayExercises.filter(de => de.dayId === dayId);
    const de: RutinaDayExercise = {
      id: generateId(),
      dayId,
      exerciseId,
      sets,
      reps,
      order: existing.length,
    };
    await persistDayExercises([...dayExercises, de]);
    return de;
  }, [dayExercises, persistDayExercises]);

  const updateDayExercise = useCallback(async (id: string, sets: number, reps: string) => {
    await persistDayExercises(dayExercises.map(de => de.id === id ? { ...de, sets, reps } : de));
  }, [dayExercises, persistDayExercises]);

  const deleteDayExercise = useCallback(async (id: string) => {
    await persistDayExercises(dayExercises.filter(de => de.id !== id));
  }, [dayExercises, persistDayExercises]);

  const assignTemplateToStudent = useCallback(async (templateId: string, studentId: string) => {
    const existingStudentDayIds = days.filter(d => d.studentId === studentId).map(d => d.id);
    let updatedDays = days.filter(d => d.studentId !== studentId);
    let updatedDayExercises = dayExercises.filter(de => !existingStudentDayIds.includes(de.dayId));

    const sourceDays = days.filter(d => d.templateId === templateId);
    const newDays: RutinaDay[] = [];
    const newDayExercises: RutinaDayExercise[] = [];

    for (const srcDay of sourceDays) {
      const newDayId = generateId();
      newDays.push({
        id: newDayId,
        name: srcDay.name,
        dayLetter: srcDay.dayLetter,
        order: srcDay.order,
        studentId,
      });

      const srcExercises = dayExercises.filter(de => de.dayId === srcDay.id);
      for (const srcEx of srcExercises) {
        newDayExercises.push({
          id: generateId(),
          dayId: newDayId,
          exerciseId: srcEx.exerciseId,
          sets: srcEx.sets,
          reps: srcEx.reps,
          order: srcEx.order,
        });
      }
    }

    updatedDays = [...updatedDays, ...newDays];
    updatedDayExercises = [...updatedDayExercises, ...newDayExercises];

    await persistDays(updatedDays);
    await persistDayExercises(updatedDayExercises);
    console.log('[RutinaContext] Template assigned to student:', studentId, 'days:', newDays.length);
  }, [days, dayExercises, persistDays, persistDayExercises]);

  const assignCustomToStudent = useCallback(async (studentId: string) => {
    const existingStudentDayIds = days.filter(d => d.studentId === studentId).map(d => d.id);
    let updatedDays = days.filter(d => d.studentId !== studentId);
    let updatedDayExercises = dayExercises.filter(de => !existingStudentDayIds.includes(de.dayId));

    const customDays = days.filter(d => !d.templateId && !d.studentId);
    const newDays: RutinaDay[] = [];
    const newDayExercises: RutinaDayExercise[] = [];

    for (const srcDay of customDays) {
      const newDayId = generateId();
      newDays.push({
        id: newDayId,
        name: srcDay.name,
        dayLetter: srcDay.dayLetter,
        order: srcDay.order,
        studentId,
      });

      const srcExercises = dayExercises.filter(de => de.dayId === srcDay.id);
      for (const srcEx of srcExercises) {
        newDayExercises.push({
          id: generateId(),
          dayId: newDayId,
          exerciseId: srcEx.exerciseId,
          sets: srcEx.sets,
          reps: srcEx.reps,
          order: srcEx.order,
        });
      }
    }

    updatedDays = [...updatedDays, ...newDays];
    updatedDayExercises = [...updatedDayExercises, ...newDayExercises];

    await persistDays(updatedDays);
    await persistDayExercises(updatedDayExercises);
    console.log('[RutinaContext] Custom routine assigned to student:', studentId);
  }, [days, dayExercises, persistDays, persistDayExercises]);

  const removeStudentRoutine = useCallback(async (studentId: string) => {
    const studentDayIds = days.filter(d => d.studentId === studentId).map(d => d.id);
    await persistDays(days.filter(d => d.studentId !== studentId));
    await persistDayExercises(dayExercises.filter(de => !studentDayIds.includes(de.dayId)));
    console.log('[RutinaContext] Student routine removed:', studentId);
  }, [days, dayExercises, persistDays, persistDayExercises]);

  const getOrCreateWorkout = useCallback(async (dayId: string, studentId: string): Promise<RutinaWorkout> => {
    const today = new Date().toISOString().split('T')[0];
    const existing = workouts.find(w => w.dayId === dayId && w.studentId === studentId && w.date === today);
    if (existing) return existing;

    const workout: RutinaWorkout = { id: generateId(), dayId, studentId, date: today };
    const updated = [...workouts, workout];
    await persistWorkouts(updated);
    return workout;
  }, [workouts, persistWorkouts]);

  const saveWorkoutSet = useCallback(async (
    workoutId: string,
    exerciseId: string,
    setNumber: number,
    weight: number,
    completed: boolean,
  ) => {
    const existing = workoutSets.find(
      ws => ws.workoutId === workoutId && ws.exerciseId === exerciseId && ws.setNumber === setNumber
    );

    let updated: RutinaWorkoutSet[];
    if (existing) {
      updated = workoutSets.map(ws =>
        ws.id === existing.id ? { ...ws, weight, completed } : ws
      );
    } else {
      updated = [...workoutSets, {
        id: generateId(),
        workoutId,
        exerciseId,
        setNumber,
        weight,
        completed,
      }];
    }

    await persistWorkoutSets(updated);
  }, [workoutSets, persistWorkoutSets]);

  const getExerciseById = useCallback((id: string) => {
    return exercises.find(e => e.id === id) ?? null;
  }, [exercises]);

  const getTemplateDays = useCallback((templateId: string) => {
    return days.filter(d => d.templateId === templateId).sort((a, b) => a.order - b.order);
  }, [days]);

  const getCustomDays = useCallback(() => {
    return days.filter(d => !d.templateId && !d.studentId).sort((a, b) => a.order - b.order);
  }, [days]);

  const getStudentDays = useCallback((studentId: string) => {
    return days.filter(d => d.studentId === studentId).sort((a, b) => a.order - b.order);
  }, [days]);

  const getDayExercises = useCallback((dayId: string) => {
    return dayExercises.filter(de => de.dayId === dayId).sort((a, b) => a.order - b.order);
  }, [dayExercises]);

  const getWorkoutSets = useCallback((workoutId: string) => {
    return workoutSets.filter(ws => ws.workoutId === workoutId);
  }, [workoutSets]);

  const getStudentWorkouts = useCallback((studentId: string) => {
    return workouts
      .filter(w => w.studentId === studentId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [workouts]);

  const getTodayWorkout = useCallback((dayId: string, studentId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return workouts.find(w => w.dayId === dayId && w.studentId === studentId && w.date === today) ?? null;
  }, [workouts]);

  const getStudentHasRoutine = useCallback((studentId: string) => {
    return days.some(d => d.studentId === studentId);
  }, [days]);

  return {
    exercises,
    templates,
    days,
    dayExercises,
    workouts,
    workoutSets,
    isLoading: !localLoaded && localDataQuery.isLoading,
    addExercise,
    updateExercise,
    deleteExercise,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    addDay,
    deleteDay,
    addDayExercise,
    updateDayExercise,
    deleteDayExercise,
    assignTemplateToStudent,
    assignCustomToStudent,
    removeStudentRoutine,
    getOrCreateWorkout,
    saveWorkoutSet,
    getExerciseById,
    getTemplateDays,
    getCustomDays,
    getStudentDays,
    getDayExercises,
    getWorkoutSets,
    getStudentWorkouts,
    getTodayWorkout,
    getStudentHasRoutine,
  };
});
