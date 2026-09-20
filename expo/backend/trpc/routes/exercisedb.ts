import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { searchExerciseDb, fetchExerciseGif } from "../../exercisedb-client";
import { normalizeGifFrameDelays } from "../../gif-utils";
import { supabase } from "../../supabase-client";

// Supabase Storage bucket that holds the re-hosted exercise GIFs. Must be
// created once in the Supabase dashboard (Storage > New bucket, public)
// before this route works — see BUCKET name below.
const BUCKET = "exercise-gifs";

export const exercisedbRouter = createTRPCRouter({
  // Search ExerciseDB by name while the admin types in the "Nuevo Ejercicio"
  // form. Cheap/no images fetched here — just metadata for the results list.
  search: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const results = await searchExerciseDb(input.query);
      return { results };
    }),

  // Called once, when the admin picks a specific result: downloads the GIF
  // from ExerciseDB and re-uploads it to our own Supabase Storage bucket, so
  // the app never depends on ExerciseDB again for that exercise (no ongoing
  // API cost, no risk of the external GIF disappearing).
  importGif: publicProcedure
    .input(z.object({ exerciseId: z.string().min(1), exerciseName: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { buffer, contentType } = await fetchExerciseGif(input.exerciseId);

      const ext = contentType.includes("gif") ? "gif" : "png";
      const path = `${input.exerciseId}.${ext}`;

      // ExerciseDB's free-plan GIFs are genuinely animated, but timed as a
      // long hold on each end position with only a brief transition burst
      // between them — that reads as "flipping between two photos" instead
      // of a moving demo. Re-time every frame to a small uniform delay so
      // the exact same frames play back as continuous motion. No-op (safe
      // passthrough) for non-GIF images.
      const uploadBuffer = ext === "gif" ? normalizeGifFrameDelays(buffer) : buffer;

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, uploadBuffer, {
        contentType,
        upsert: true,
      });

      if (uploadError) {
        console.log("[exercisedb] Supabase upload failed:", uploadError.message);
        throw new Error(`No se pudo guardar el GIF en Supabase: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

      console.log("[exercisedb] Imported GIF for", input.exerciseName, "->", publicUrlData.publicUrl);

      return { videoUrl: publicUrlData.publicUrl };
    }),
});
