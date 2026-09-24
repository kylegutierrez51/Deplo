/*
 * Builds `path?query` from the current query string plus some changes. A `null` update
 * removes the key. Pages use this to open and close a record's modal without
 * discarding the filters that sit alongside `id`/`mode` in the URL.
 */
export function withParams(
  path: string,
  current: { toString(): string } | null,
  updates: Record<string, string | null | undefined>,
): string {
  const params = new URLSearchParams(current?.toString() ?? '');

  for (const [key, value] of Object.entries(updates)) {
    if (value == null) params.delete(key);
    else params.set(key, value);
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
