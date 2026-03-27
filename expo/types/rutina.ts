export interface RutinaExercise {
  id: string;
  name: string;
  videoUrl: string;
  muscleGroup: string;
}

export interface RutinaTemplate {
  id: string;
  name: string;
  gender: 'hombre' | 'mujer';
  level: 'principiante' | 'intermedio' | 'avanzado';
}

export interface RutinaDay {
  id: string;
  name: string;
  dayLetter: string;
  order: number;
  templateId?: string;
  studentId?: string;
}

export interface RutinaDayExercise {
  id: string;
  dayId: string;
  exerciseId: string;
  sets: number;
  reps: string;
  order: number;
}

export interface RutinaWorkout {
  id: string;
  dayId: string;
  date: string;
  studentId: string;
}

export interface RutinaWorkoutSet {
  id: string;
  workoutId: string;
  exerciseId: string;
  setNumber: number;
  weight: number;
  completed: boolean;
}

export const MUSCLE_GROUPS = [
  'Pecho', 'Espalda', 'Hombros', 'Piernas', 'Brazos', 'Core', 'Full Body',
] as const;

export type MuscleGroup = typeof MUSCLE_GROUPS[number];
