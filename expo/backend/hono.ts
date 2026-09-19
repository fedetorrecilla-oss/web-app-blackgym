import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

const app = new Hono();

app.use("*", cors());

// Mounted at the same path the client calls (see expo/lib/trpc.ts:
// `${baseUrl}/api/trpc`). On Rork's own hosting this used to be mounted at
// "/trpc/*" because their proxy stripped the "/api" prefix before it ever
// reached this file; serving the backend standalone on Render (no such
// proxy in front of it), the mount path has to match what the client
// actually requests, so it's "/api/trpc/*" here.
app.use(
  "/api/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  }),
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "Gym Turnos API is running" });
});

export default app;
