import { httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;

  // Do NOT throw here: this runs at module scope during JS startup, so a
  // missing env var would hard-crash the app on launch (e.g. production
  // builds where the variable was not inlined). Fall back to an empty base
  // URL instead — backend requests fail gracefully and the app keeps
  // working from its local AsyncStorage data.
  if (!url) {
    console.warn(
      "[trpc] EXPO_PUBLIC_RORK_API_BASE_URL no está definida — se usan solo datos locales",
    );
    return "";
  }

  return url;
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
    }),
  ],
});
