export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  if (path.includes('/book')) {
    return '/book';
  }
  return path;
}