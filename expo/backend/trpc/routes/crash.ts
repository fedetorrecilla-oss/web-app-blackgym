import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

// Reportes de crash que sube el código nativo (CrashDiagnostics) al arrancar.
// Se conservan en memoria y se loguean completos para poder leerlos desde
// los logs del backend sin depender del usuario.
const receivedReports: {
  receivedAt: string;
  build: string;
  device: string;
  report: string;
}[] = [];

export const crashRouter = createTRPCRouter({
  submit: publicProcedure
    .input(
      z.object({
        report: z.string(),
        build: z.string().optional(),
        device: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const entry = {
        receivedAt: new Date().toISOString(),
        build: input.build ?? "?",
        device: input.device ?? "?",
        report: input.report,
      };
      receivedReports.unshift(entry);
      if (receivedReports.length > 20) {
        receivedReports.pop();
      }
      console.log("=== BLACKGYM CRASH REPORT ===");
      console.log(entry.report);
      console.log("=== END BLACKGYM CRASH REPORT ===");
      return { ok: true };
    }),

  list: publicProcedure.query(() => receivedReports),
});
