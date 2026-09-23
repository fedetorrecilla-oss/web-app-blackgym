import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { PRIVACY_POLICY_HTML } from "./privacy-policy";
import { SUPPORT_PAGE_HTML } from "./support-page";

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

// Public, stable URL for the App Store / Google Play listings' privacy
// policy field. "/privacy-policy" is the primary link; "/privacidad" is
// kept as a friendlier alias pointing at the same content.
app.get("/privacy-policy", (c) => c.html(PRIVACY_POLICY_HTML));
app.get("/privacidad", (c) => c.html(PRIVACY_POLICY_HTML));

// Public "Support URL" for the App Store / Google Play listings.
app.get("/support", (c) => c.html(SUPPORT_PAGE_HTML));
app.get("/soporte", (c) => c.html(SUPPORT_PAGE_HTML));

export default app;
