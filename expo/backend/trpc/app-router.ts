import { createTRPCRouter } from "./create-context";
import { crashRouter } from "./routes/crash";
import { gymRouter } from "./routes/gym";
import { rutinaRouter } from "./routes/rutina";

export const appRouter = createTRPCRouter({
  crash: crashRouter,
  gym: gymRouter,
  rutina: rutinaRouter,
});

export type AppRouter = typeof appRouter;
