import { createHash } from "crypto";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { searchExerciseDb, fetchExerciseGif } from "../../exercisedb-client";
import { normalizeGifFrameDelays } from "../../gif-utils";
import {
  getExerciseVideoDbEntry,
  listExerciseVideoDb,
  pickExerciseVideoUrl,
  searchExerciseVideoDb,
} from "../../exercise-video-db";
import { supabase } from "../../supabase-client";

// Supabase Storage bucket that holds the re-hosted exercise GIFs. Must be
// created once in the Supabase dashboard (Storage > New bucket, public)
// before this route works — see BUCKET name below.
const BUCKET = "exercise-gifs";

// Bucket for the real MP4 demo videos (see exercise-video-db.ts). Created
// automatically on first use (see ensureVideoBucket below) — unlike BUCKET
// above, nothing needs to be set up by hand in the Supabase dashboard for
// this one.
const VIDEO_BUCKET = "exercise-videos";

let videoBucketEnsured = false;

async function ensureVideoBucket(): Promise<void> {
  if (videoBucketEnsured) return;
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (!error && !buckets?.some((b) => b.name === VIDEO_BUCKET)) {
    const { error: createError } = await supabase.storage.createBucket(VIDEO_BUCKET, { public: true });
    if (createError && !createError.message?.toLowerCase().includes("already exists")) {
      throw new Error(`No se pudo crear el bucket de videos en Supabase: ${createError.message}`);
    }
  }
  videoBucketEnsured = true;
}

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

      // The path (and therefore the public URL) is deterministic per
      // exercise, so re-importing the same exercise later (e.g. after we
      // improve how we process the GIF, like the frame-retiming above)
      // re-uploads to the *same* URL. Phones aggressively cache images on
      // disk by URL, so without this the app can keep showing the old
      // bytes indefinitely even after a force-quit/reopen. Appending a
      // short hash of the actual (post-processing) file content makes the
      // URL change whenever the content changes, so the app is guaranteed
      // to fetch fresh bytes instead of serving a stale disk cache — while
      // re-importing identical content keeps the same URL (no needless
      // cache invalidation).
      const contentHash = createHash("sha1").update(uploadBuffer).digest("hex").slice(0, 10);
      const videoUrl = `${publicUrlData.publicUrl}?v=${contentHash}`;

      console.log("[exercisedb] Imported GIF for", input.exerciseName, "->", videoUrl);

      return { videoUrl };
    }),

  // --- Real-video pipeline (see exercise-video-db.ts) ---------------------
  // Replaces the flow above for new imports: a self-hosted, translated
  // dataset of real MP4 demo videos instead of ExerciseDB's choppy free
  // GIFs. Search is instant (no network call, just an in-memory lookup);
  // importVideo is the one that actually downloads+re-hosts, same as
  // importGif above.

  // Cheap metadata search against the bundled video dataset, for the
  // "Buscar ejercicio" box in the exercise form.
  searchVideos: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(({ input }) => {
      const results = searchExerciseVideoDb(input.query).map((e) => ({
        sourceId: e.sourceId,
        name: e.name,
        muscleGroup: e.muscleGroup,
        equipment: e.equipment,
        difficulty: e.difficulty,
      }));
      return { results };
    }),

  // Full lightweight listing of the dataset (no video URLs), used by the
  // "importar todo el catálogo" bulk-add flow to know what's available and
  // let the client skip exercises the admin already has.
  listVideoDb: publicProcedure.query(() => {
    return { results: listExerciseVideoDb() };
  }),

  // Downloads the real demo video for one dataset entry and re-hosts it in
  // our own Supabase Storage, same "never depend on the third party again"
  // pattern as importGif. Also hands back the ready-to-use Spanish notes
  // and mapped muscleGroup/equipment/difficulty so the admin form can be
  // filled in one shot.
  importVideo: publicProcedure
    .input(
      z.object({
        sourceId: z.string().min(1),
        gender: z.enum(["male", "female"]).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const entry = getExerciseVideoDbEntry(input.sourceId);
      if (!entry) {
        throw new Error("Ese ejercicio ya no está disponible en la base de videos.");
      }

      const sourceUrl = pickExerciseVideoUrl(entry, input.gender ?? "male");
      if (!sourceUrl) {
        throw new Error("Este ejercicio no tiene ningún video disponible.");
      }

      const videoRes = await fetch(sourceUrl);
      if (!videoRes.ok) {
        throw new Error(`No se pudo descargar el video (${videoRes.status}).`);
      }
      const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

      await ensureVideoBucket();

      const path = `${entry.sourceId}.mp4`;
      const { error: uploadError } = await supabase.storage.from(VIDEO_BUCKET).upload(path, videoBuffer, {
        contentType: "video/mp4",
        upsert: true,
      });
      if (uploadError) {
        console.log("[exercisedb] Video upload failed:", uploadError.message);
        throw new Error(`No se pudo guardar el video en Supabase: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path);
      const contentHash = createHash("sha1").update(videoBuffer).digest("hex").slice(0, 10);
      const videoUrl = `${publicUrlData.publicUrl}?v=${contentHash}`;

      console.log("[exercisedb] Imported video for", entry.name, "->", videoUrl);

      return {
        videoUrl,
        name: entry.name,
        muscleGroup: entry.muscleGroup,
        equipment: entry.equipment,
        difficulty: entry.difficulty,
        notes: entry.notes,
      };
    }),
});
