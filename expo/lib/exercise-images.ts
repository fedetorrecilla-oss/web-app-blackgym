import IMAGE_MAP from '@/constants/exercise-image-map.json';

/**
 * Image data sourced from free-exercise-db (public domain / Unlicense).
 * https://github.com/yuhonas/free-exercise-db
 */
const BASE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

const NAME_MAP = IMAGE_MAP as Record<string, string[]>;

/** Normalize a display name the same way the dataset map keys were built. */
export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Resolve reference images for an exercise by name.
 * Order: curated Spanish alias → exact normalized match → fuzzy token match.
 * Returns full remote image URLs (may be empty).
 */
export function getExerciseImages(name: string): string[] {
  const key = normalizeExerciseName(name);
  if (!key) return [];

  const paths =
    NAME_MAP[`alias:${key}`] ??
    NAME_MAP[key] ??
    fuzzyMatch(key);
  if (!paths?.length) return [];

  return paths.map(p => `${BASE_URL}${p}`);
}

/** Best-effort match for custom exercise names typed in English. */
function fuzzyMatch(key: string): string[] | null {
  const tokens = key.split(' ').filter(t => t.length > 2);
  if (tokens.length < 2) return null;

  let best: { images: string[]; score: number } | null = null;
  for (const [mapKey, images] of Object.entries(NAME_MAP)) {
    if (mapKey.startsWith('alias:')) continue;
    let matched = 0;
    for (const t of tokens) if (mapKey.includes(t)) matched++;
    const score = matched / tokens.length;
    if (score >= 0.6 && (!best || score > best.score)) {
      best = { images, score };
    }
  }
  return best?.images ?? null;
}
