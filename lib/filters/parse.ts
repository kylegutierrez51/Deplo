import type { DateRange, FilterDefinitions, FiltersOf } from './options';

type RawParam = string | string[] | undefined;


/*
 * Reads a page's filter out of its searchParams. Every value is checked against the options.
 * If an unknown option like `?status=UNKNOWN` or a repeated key (`status=failed&status=running` -- nextjs builds it as [ failed, status ])
 * is entered, this keeps only the first value of a repeated key, then falls back to the
 * default (first) option for anything unrecognised, so a hand-edited value never reaches Prisma.
 */
export function parseFilters<D extends FilterDefinitions>(
  searchParams: Record<string, RawParam>,
  definitions: D,
): FiltersOf<D> {
  return Object.fromEntries(
    Object.entries(definitions).map(([key, options]) => {
      const raw = searchParams[key];
      const value = Array.isArray(raw) ? raw[0] : raw;
      return [key, (options.find((option) => option.value === value) ?? options[0]).value];
    }),
  ) as FiltersOf<D>;
}

/** True when any filter is off its default value */
export function hasActiveFilters<D extends FilterDefinitions>(filters: FiltersOf<D>, definitions: D): boolean {
  return Object.entries(definitions).some(([key, options]) => filters[key] !== options[0].value);
}



/*
Flips (e.g., Audits ResourceType):
  PIPELINE: "pipeline",
  PIPELINE_RUN: "pipeline-run",
  ...

to: 
  "pipeline": PIPELINE,
  "pipeline-run": PIPELINE_RUN,
  ...
 */
export function invert<K extends string, V extends string>(map: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k])) as Record<V, K>;
}

const RANGE_DAYS: Record<Exclude<DateRange, 'all' | 'today'>, number> = { '7days': 7, '30days': 30, '90days': 90 };


// `today` means since midnight UTC, the zone the server and its tests run in.
export function dateRangeCutoff(range: DateRange, now: Date = new Date()): Date | undefined {
  if (range === 'all') return undefined;
  if (range === 'today') return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000);
}
