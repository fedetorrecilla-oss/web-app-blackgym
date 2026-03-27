import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import {
  getRutinaStore,
  setRutinaExercises,
  setRutinaTemplates,
  setRutinaDays,
  setRutinaDayExercises,
  setRutinaWorkouts,
  setRutinaWorkoutSets,
} from "../rutina-store";

const exerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  videoUrl: z.string(),
  muscleGroup: z.string(),
});

const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  gender: z.enum(["hombre", "mujer"]),
  level: z.enum(["principiante", "intermedio", "avanzado"]),
});

const daySchema = z.object({
  id: z.string(),
  name: z.string(),
  dayLetter: z.string(),
  order: z.number(),
  templateId: z.string().optional(),
  studentId: z.string().optional(),
});

const dayExerciseSchema = z.object({
  id: z.string(),
  dayId: z.string(),
  exerciseId: z.string(),
  sets: z.number(),
  reps: z.string(),
  order: z.number(),
});

const workoutSchema = z.object({
  id: z.string(),
  dayId: z.string(),
  date: z.string(),
  studentId: z.string(),
});

const workoutSetSchema = z.object({
  id: z.string(),
  workoutId: z.string(),
  exerciseId: z.string(),
  setNumber: z.number(),
  weight: z.number(),
  completed: z.boolean(),
});

export const rutinaRouter = createTRPCRouter({
  getData: publicProcedure.query(() => {
    return getRutinaStore();
  }),

  setExercises: publicProcedure
    .input(z.object({ exercises: z.array(exerciseSchema) }))
    .mutation(({ input }) => {
      setRutinaExercises(input.exercises);
      return { ok: true };
    }),

  setTemplates: publicProcedure
    .input(z.object({ templates: z.array(templateSchema) }))
    .mutation(({ input }) => {
      setRutinaTemplates(input.templates);
      return { ok: true };
    }),

  setDays: publicProcedure
    .input(z.object({ days: z.array(daySchema) }))
    .mutation(({ input }) => {
      setRutinaDays(input.days);
      return { ok: true };
    }),

  setDayExercises: publicProcedure
    .input(z.object({ dayExercises: z.array(dayExerciseSchema) }))
    .mutation(({ input }) => {
      setRutinaDayExercises(input.dayExercises);
      return { ok: true };
    }),

  setWorkouts: publicProcedure
    .input(z.object({ workouts: z.array(workoutSchema) }))
    .mutation(({ input }) => {
      setRutinaWorkouts(input.workouts);
      return { ok: true };
    }),

  setWorkoutSets: publicProcedure
    .input(z.object({ workoutSets: z.array(workoutSetSchema) }))
    .mutation(({ input }) => {
      setRutinaWorkoutSets(input.workoutSets);
      return { ok: true };
    }),
});
