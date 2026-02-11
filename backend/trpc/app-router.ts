import { createTRPCRouter } from "./create-context";
import { gymRouter } from "./routes/gym";

export const appRouter = createTRPCRouter({
  gym: gymRouter,
});

export type AppRouter = typeof appRouter;
