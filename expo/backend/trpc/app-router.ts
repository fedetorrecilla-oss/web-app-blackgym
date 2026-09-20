import { createTRPCRouter } from "./create-context";
import { crashRouter } from "./routes/crash";
import { gymRouter } from "./routes/gym";
import { rutinaRouter } from "./routes/rutina";
import { exercisedbRouter } from "./routes/exercisedb";

export const appRouter = createTRPCRouter({
  crash: crashRouter,
  gym: gymRouter,
  rutina: rutinaRouter,
  exercisedb: exercisedbRouter,
});

export type AppRouter = typeof appRouter;
