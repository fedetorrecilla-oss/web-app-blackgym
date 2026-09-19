import { serve } from "@hono/node-server";

import app from "./hono";

// Standalone entrypoint for running the Gym Turnos API as its own web
// service (e.g. on Render), separate from the Expo app it also ships
// inside of. Not used by Expo/Metro at all — this is only ever run
// directly with `bun run backend/server.ts` (see package.json).
const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Gym Turnos API listening on port ${info.port}`);
});
