// A small, self-hosted (bundled into this repo) database of real exercise
// demonstration videos — the replacement for the old ExerciseDB GIF pipeline
// (see gif-utils.ts / exercisedb-client.ts, kept around only so previously
// imported GIFs keep working).
//
// Source: harshvishu/free-exercise-db-with-videos (MIT licensed), a free,
// no-API-key, no-account dataset of 317 exercises with real Full-HD MP4
// demo videos (a male-model and a female-model take of almost every
// exercise) plus rich English instructional text. The data file at
// ./data/exercise-video-db.json is a one-time export of that dataset:
//   - the exercise `name` and every text field (short description,
//     step-by-step instructions, common mistakes) have been translated to
//     Spanish ("vos" form); the instructional text is pre-assembled into a
//     single `notes` string, ready to drop straight into an exercise's
//     notes field. The original English name is kept as `nameEn` (see
//     below) and folded into `aliases`, so search still works by either
//     language.
//   - `muscleGroup`/`equipment`/`difficulty` have been mapped onto this
//     app's own Spanish categories (types/rutina.ts: MUSCLE_GROUPS,
//     EQUIPMENT_TYPES, DIFFICULTIES) so an imported result can be used
//     as-is, no further mapping needed on the frontend
// The actual video files are NOT bundled here (that would be ~250MB) — they
// stay hosted on the dataset's own public Cloudflare R2 bucket
// (pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev), which importVideo() in
// trpc/routes/exercisedb.ts downloads from once per exercise, then re-hosts
// permanently in our own Supabase Storage — same "never depend on a third
// party forever" pattern already used for GIFs.
import rawData from "./data/exercise-video-db.json";

export interface ExerciseVideoDbEntry {
  sourceId: string;
  /** Display name, in Spanish — this is what search shows and what gets
   *  filled into an exercise's name on import. */
  name: string;
  /** The dataset's original English name, kept around so the client can
   *  recognize (and rename) exercises that were imported before names were
   *  translated to Spanish — see handleBulkImportAll in catalog.tsx. Also
   *  copied into `aliases` so English-term search still works. */
  nameEn: string;
  aliases: string[];
  searchSlug: string;
  muscleGroup: string;
  equipment: string;
  difficulty: string;
  notes: string;
  videoUrlMale: string | null;
  videoUrlFemale: string | null;
  posterUrlMale: string | null;
  posterUrlFemale: string | null;
}

const ENTRIES = rawData as ExerciseVideoDbEntry[];
const BY_ID = new Map(ENTRIES.map((e) => [e.sourceId, e]));

export const EXERCISE_VIDEO_DB_COUNT = ENTRIES.length;

export function getExerciseVideoDbEntry(sourceId: string): ExerciseVideoDbEntry | undefined {
  return BY_ID.get(sourceId);
}

/** Lightweight metadata for every exercise in the dataset — no video URLs,
 *  cheap to send to the client in one shot for the "import the whole
 *  catalog" flow. */
export function listExerciseVideoDb(): Pick<
  ExerciseVideoDbEntry,
  "sourceId" | "name" | "nameEn" | "muscleGroup" | "equipment" | "difficulty"
>[] {
  return ENTRIES.map((e) => ({
    sourceId: e.sourceId,
    name: e.name,
    nameEn: e.nameEn,
    muscleGroup: e.muscleGroup,
    equipment: e.equipment,
    difficulty: e.difficulty,
  }));
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Name/alias search, cheapest-possible relevance scoring: exact match >
 *  prefix match > substring match > partial token overlap. Good enough for
 *  a 317-entry in-memory dataset — no need for a real search index. */
export function searchExerciseVideoDb(query: string, limit = 20): ExerciseVideoDbEntry[] {
  const q = normalize(query);
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);

  const scored = ENTRIES.map((e) => {
    const haystacks = [e.name, ...e.aliases, e.searchSlug.replace(/-/g, " ")].map(normalize);
    let score = 0;
    for (const h of haystacks) {
      if (h === q) score = Math.max(score, 100);
      else if (h.startsWith(q)) score = Math.max(score, 80);
      else if (h.includes(q)) score = Math.max(score, 60);
      else {
        const matched = tokens.filter((t) => h.includes(t)).length;
        if (matched > 0) score = Math.max(score, (matched / tokens.length) * 40);
      }
    }
    return { e, score };
  }).filter((x) => x.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.e);
}

/** Picks the video URL for the requested gender, falling back to the other
 *  gender's video when the requested one isn't available (27 of the 317
 *  exercises only shipped one gender's take) — so every exercise in the
 *  dataset always has SOME usable video. */
export function pickExerciseVideoUrl(
  entry: ExerciseVideoDbEntry,
  preferredGender: "male" | "female" = "male",
): string | null {
  if (preferredGender === "male") {
    return entry.videoUrlMale ?? entry.videoUrlFemale ?? null;
  }
  return entry.videoUrlFemale ?? entry.videoUrlMale ?? null;
}
