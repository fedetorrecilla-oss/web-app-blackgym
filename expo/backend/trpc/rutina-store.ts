import type {
  RutinaExercise,
  RutinaTemplate,
  RutinaDay,
  RutinaDayExercise,
  RutinaWorkout,
  RutinaWorkoutSet,
} from "@/types/rutina";

interface RutinaStore {
  exercises: RutinaExercise[];
  templates: RutinaTemplate[];
  days: RutinaDay[];
  dayExercises: RutinaDayExercise[];
  workouts: RutinaWorkout[];
  workoutSets: RutinaWorkoutSet[];
}

const store: RutinaStore = {
  exercises: [],
  templates: [],
  days: [],
  dayExercises: [],
  workouts: [],
  workoutSets: [],
};

console.log("[RutinaStore] In-memory store initialized");

export function getRutinaStore(): RutinaStore {
  return store;
}

export function setRutinaExercises(data: RutinaExercise[]) {
  store.exercises = data;
  console.log("[RutinaStore] Exercises updated:", data.length);
}

export function setRutinaTemplates(data: RutinaTemplate[]) {
  store.templates = data;
  console.log("[RutinaStore] Templates updated:", data.length);
}

export function setRutinaDays(data: RutinaDay[]) {
  store.days = data;
  console.log("[RutinaStore] Days updated:", data.length);
}

export function setRutinaDayExercises(data: RutinaDayExercise[]) {
  store.dayExercises = data;
  console.log("[RutinaStore] DayExercises updated:", data.length);
}

export function setRutinaWorkouts(data: RutinaWorkout[]) {
  store.workouts = data;
  console.log("[RutinaStore] Workouts updated:", data.length);
}

export function setRutinaWorkoutSets(data: RutinaWorkoutSet[]) {
  store.workoutSets = data;
  console.log("[RutinaStore] WorkoutSets updated:", data.length);
}
