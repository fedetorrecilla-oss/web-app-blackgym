// Thin wrapper around the RapidAPI ExerciseDB endpoints used to search for
// exercises and fetch their demonstration GIFs when building the exercise
// catalog. Requires RAPIDAPI_KEY to be set (Render env var) — the same key
// tied to the free "Basic" ExerciseDB plan on RapidAPI (fedetorrecilla-oss
// account).
//
// Docs (RapidAPI "ExerciseDB" by justin-WFnsXH_t6, API version 2.2):
//   GET https://exercisedb.p.rapidapi.com/exercises/name/{name}?limit=N
//   GET https://exercisedb.p.rapidapi.com/image?exerciseId={id}&resolution={180|360|720|1080}
// The Basic ($0/mo) plan is capped at 180px-resolution GIFs — higher
// resolutions need a paid RapidAPI plan, so this defaults to 180 and lets a
// future upgrade raise it via the EXERCISEDB_IMAGE_RESOLUTION env var
// without a code change.

const RAPIDAPI_HOST = "exercisedb.p.rapidapi.com";
const BASE_URL = `https://${RAPIDAPI_HOST}`;

function getApiKey(): string {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) {
    throw new Error(
      "[exercisedb-client] RAPIDAPI_KEY is not set. Add it as an environment variable in the Render dashboard for this service.",
    );
  }
  return key;
}

function requestHeaders(): Record<string, string> {
  return {
    "x-rapidapi-host": RAPIDAPI_HOST,
    "x-rapidapi-key": getApiKey(),
  };
}

export interface ExerciseDbResult {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
  difficulty?: string;
}

// Search ExerciseDB by (partial) exercise name. Returns bare metadata only —
// no image bytes yet, so this is cheap to call as the admin types in the
// search box.
export async function searchExerciseDb(query: string, limit = 20): Promise<ExerciseDbResult[]> {
  const url = `${BASE_URL}/exercises/name/${encodeURIComponent(query)}?limit=${limit}`;
  const res = await fetch(url, { headers: requestHeaders() });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[exercisedb-client] Search failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as unknown;
  const list = Array.isArray(data) ? data : [];

  return list.map((raw) => {
    const e = raw as Record<string, unknown>;
    return {
      id: String(e.id ?? ""),
      name: String(e.name ?? ""),
      bodyPart: String(e.bodyPart ?? ""),
      equipment: String(e.equipment ?? ""),
      target: String(e.target ?? ""),
      difficulty: e.difficulty ? String(e.difficulty) : undefined,
    };
  });
}

const DEFAULT_RESOLUTION = process.env.EXERCISEDB_IMAGE_RESOLUTION ?? "180";

// Fetches the actual GIF bytes for one exercise. This is the endpoint that
// costs RapidAPI bandwidth-fee quota, so it's only called once per exercise
// (when the admin picks a result), never during search itself — the result
// then gets re-hosted permanently in Supabase Storage so this endpoint is
// never called again for that exercise.
export async function fetchExerciseGif(exerciseId: string): Promise<{ buffer: Buffer; contentType: string }> {
  const url = `${BASE_URL}/image?exerciseId=${encodeURIComponent(exerciseId)}&resolution=${DEFAULT_RESOLUTION}`;
  const res = await fetch(url, { headers: requestHeaders() });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[exercisedb-client] Image fetch failed (${res.status}): ${body}`);
  }

  const contentType = res.headers.get("content-type") ?? "image/gif";
  const arrayBuffer = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType };
}
