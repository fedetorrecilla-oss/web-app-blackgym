import type {
  RutinaExercise,
  RutinaTemplate,
  RutinaDay,
  RutinaDayExercise,
  RutinaWorkout,
  RutinaWorkoutSet,
} from "@/types/rutina";

import { supabase } from "../supabase-client";

interface RutinaStore {
  exercises: RutinaExercise[];
  templates: RutinaTemplate[];
  days: RutinaDay[];
  dayExercises: RutinaDayExercise[];
  workouts: RutinaWorkout[];
  workoutSets: RutinaWorkoutSet[];
}

// Same Supabase-backed pattern as store.ts (see the comment there): the
// exported function names/shapes are unchanged from the old in-memory
// version, just made async, so routes/rutina.ts only needed `await` added.

export async function getRutinaStore(): Promise<RutinaStore> {
  const [exercisesRes, templatesRes, daysRes, dayExercisesRes, workoutsRes, workoutSetsRes] =
    await Promise.all([
      supabase.from("rutina_exercises").select("id, name, video_url, muscle_group, equipment, difficulty, notes"),
      supabase.from("rutina_templates").select("id, name, gender, level"),
      supabase.from("rutina_days").select("id, name, day_letter, order_num, template_id, student_id"),
      supabase.from("rutina_day_exercises").select("id, day_id, exercise_id, sets, reps, order_num"),
      supabase.from("rutina_workouts").select("id, day_id, date, student_id"),
      supabase.from("rutina_workout_sets").select("id, workout_id, exercise_id, set_number, weight, completed"),
    ]);

  for (const [label, res] of [
    ["exercises", exercisesRes],
    ["templates", templatesRes],
    ["days", daysRes],
    ["dayExercises", dayExercisesRes],
    ["workouts", workoutsRes],
    ["workoutSets", workoutSetsRes],
  ] as const) {
    if (res.error) {
      console.log(`[RutinaStore] Failed to load ${label}:`, res.error.message);
      throw res.error;
    }
  }

  const exercises: RutinaExercise[] = (exercisesRes.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    videoUrl: r.video_url,
    muscleGroup: r.muscle_group,
    equipment: r.equipment ?? undefined,
    difficulty: r.difficulty ?? undefined,
    notes: r.notes ?? undefined,
  }));

  const templates: RutinaTemplate[] = (templatesRes.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    gender: r.gender,
    level: r.level,
  }));

  const days: RutinaDay[] = (daysRes.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    dayLetter: r.day_letter,
    order: r.order_num,
    templateId: r.template_id ?? undefined,
    studentId: r.student_id ?? undefined,
  }));

  const dayExercises: RutinaDayExercise[] = (dayExercisesRes.data ?? []).map((r) => ({
    id: r.id,
    dayId: r.day_id,
    exerciseId: r.exercise_id,
    sets: r.sets,
    reps: r.reps,
    order: r.order_num,
  }));

  const workouts: RutinaWorkout[] = (workoutsRes.data ?? []).map((r) => ({
    id: r.id,
    dayId: r.day_id,
    date: r.date,
    studentId: r.student_id,
  }));

  const workoutSets: RutinaWorkoutSet[] = (workoutSetsRes.data ?? []).map((r) => ({
    id: r.id,
    workoutId: r.workout_id,
    exerciseId: r.exercise_id,
    setNumber: r.set_number,
    weight: r.weight,
    completed: r.completed,
  }));

  return { exercises, templates, days, dayExercises, workouts, workoutSets };
}

export async function setRutinaExercises(data: RutinaExercise[]): Promise<void> {
  const { error: delErr } = await supabase.from("rutina_exercises").delete().not("id", "is", null);
  if (delErr) throw delErr;

  if (data.length > 0) {
    const rows = data.map((e) => ({
      id: e.id,
      name: e.name,
      video_url: e.videoUrl,
      muscle_group: e.muscleGroup,
      equipment: e.equipment ?? null,
      difficulty: e.difficulty ?? null,
      notes: e.notes ?? null,
    }));
    const { error: insErr } = await supabase.from("rutina_exercises").insert(rows);
    if (insErr) throw insErr;
  }

  console.log("[RutinaStore] Exercises updated:", data.length);
}

export async function setRutinaTemplates(data: RutinaTemplate[]): Promise<void> {
  const { error: delErr } = await supabase.from("rutina_templates").delete().not("id", "is", null);
  if (delErr) throw delErr;

  if (data.length > 0) {
    const { error: insErr } = await supabase.from("rutina_templates").insert(data);
    if (insErr) throw insErr;
  }

  console.log("[RutinaStore] Templates updated:", data.length);
}

export async function setRutinaDays(data: RutinaDay[]): Promise<void> {
  const { error: delErr } = await supabase.from("rutina_days").delete().not("id", "is", null);
  if (delErr) throw delErr;

  if (data.length > 0) {
    const rows = data.map((d) => ({
      id: d.id,
      name: d.name,
      day_letter: d.dayLetter,
      order_num: d.order,
      template_id: d.templateId ?? null,
      student_id: d.studentId ?? null,
    }));
    const { error: insErr } = await supabase.from("rutina_days").insert(rows);
    if (insErr) throw insErr;
  }

  console.log("[RutinaStore] Days updated:", data.length);
}

export async function setRutinaDayExercises(data: RutinaDayExercise[]): Promise<void> {
  const { error: delErr } = await supabase.from("rutina_day_exercises").delete().not("id", "is", null);
  if (delErr) throw delErr;

  if (data.length > 0) {
    const rows = data.map((d) => ({
      id: d.id,
      day_id: d.dayId,
      exercise_id: d.exerciseId,
      sets: d.sets,
      reps: d.reps,
      order_num: d.order,
    }));
    const { error: insErr } = await supabase.from("rutina_day_exercises").insert(rows);
    if (insErr) throw insErr;
  }

  console.log("[RutinaStore] DayExercises updated:", data.length);
}

export async function setRutinaWorkouts(data: RutinaWorkout[]): Promise<void> {
  const { error: delErr } = await supabase.from("rutina_workouts").delete().not("id", "is", null);
  if (delErr) throw delErr;

  if (data.length > 0) {
    const rows = data.map((w) => ({
      id: w.id,
      day_id: w.dayId,
      date: w.date,
      student_id: w.studentId,
    }));
    const { error: insErr } = await supabase.from("rutina_workouts").insert(rows);
    if (insErr) throw insErr;
  }

  console.log("[RutinaStore] Workouts updated:", data.length);
}

export async function setRutinaWorkoutSets(data: RutinaWorkoutSet[]): Promise<void> {
  const { error: delErr } = await supabase.from("rutina_workout_sets").delete().not("id", "is", null);
  if (delErr) throw delErr;

  if (data.length > 0) {
    const rows = data.map((s) => ({
      id: s.id,
      workout_id: s.workoutId,
      exercise_id: s.exerciseId,
      set_number: s.setNumber,
      weight: s.weight,
      completed: s.completed,
    }));
    const { error: insErr } = await supabase.from("rutina_workout_sets").insert(rows);
    if (insErr) throw insErr;
  }

  console.log("[RutinaStore] WorkoutSets updated:", data.length);
}
