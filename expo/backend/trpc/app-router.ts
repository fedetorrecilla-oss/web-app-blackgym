import { createTRPCRouter } from "./create-context";
import { gymRouter } from "./routes/gym";
import { rutinaRouter } from "./routes/rutina";

export const appRouter = createTRPCRouter({
  gym: gymRouter,
  rutina: rutinaRouter,
});

export type AppRouter = typeof appRouter;
