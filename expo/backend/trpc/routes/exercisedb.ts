import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { searchExerciseDb, fetchExerciseGif } from "../../exercisedb-client";
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

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
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
