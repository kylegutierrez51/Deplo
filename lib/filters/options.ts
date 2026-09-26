import type { EnvType, EventType, PipelineStatus, ResourceType, RunStatus, RunTrigger, WebhookEventStatus } from '@/lib/types';

/*
 * Option lists for the URL-driven filters, shared by the page that renders them and the
 * parser that reads them back, so a value the dropdown can offer is exactly a value the
 * query accepts.
 *
 * The FIRST option of every list is its default: it is what a missing or unrecognised
 * query param falls back to, and choosing it removes the param from the URL.
 */

export type FilterOption = { readonly value: string; readonly label: string };


/** The query keys a page filters on, each mapped to the options it accepts. */
export type FilterDefinitions = Record<string, readonly FilterOption[]>;


type ValueOf<O extends readonly FilterOption[]> = O[number]['value'];


export type FiltersOf<D extends FilterDefinitions> = { [K in keyof D]: ValueOf<D[K]> };


export const ALL = 'all';


export const RECENCY_OPTIONS = [
  { value: 'most-recent', label: 'Most recent' },
  { value: 'least-recent', label: 'Least recent' },
] as const;


export const ENV_TYPE_OPTIONS = [
  { value: ALL, label: 'All environment types' },
  { value: 'production', label: 'Production' },
  { value: 'staging', label: 'Staging' },
  { value: 'development', label: 'Development' },
  { value: 'preview', label: 'Preview' },
  { value: 'custom', label: 'Custom' },
] as const satisfies readonly { value: EnvType | typeof ALL; label: string }[];


export const RUN_STATUS_OPTIONS = [
  { value: ALL, label: 'All statuses' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const satisfies readonly { value: RunStatus | typeof ALL; label: string }[];


export const RUN_TRIGGER_OPTIONS = [
  { value: ALL, label: 'All triggers' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'manual', label: 'Manual' },
  { value: 'api', label: 'API' },
] as const satisfies readonly { value: RunTrigger | typeof ALL; label: string }[];


export const RUN_FILTERS = {
  status: RUN_STATUS_OPTIONS,
  trigger: RUN_TRIGGER_OPTIONS,
  environment: ENV_TYPE_OPTIONS,
  recency: RECENCY_OPTIONS,
} as const satisfies FilterDefinitions;


export type RunFilters = FiltersOf<typeof RUN_FILTERS>;


/* Values are windows back from now; lib/filters/parse.ts turns them into a cutoff date. */
export const DATE_RANGE_OPTIONS = [
  { value: ALL, label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7days', label: 'Last 7 days' },
  { value: '30days', label: 'Last 30 days' },
  { value: '90days', label: 'Last 90 days' },
] as const;


export type DateRange = (typeof DATE_RANGE_OPTIONS)[number]['value'];


export const UPDATED_RANGE_OPTIONS = [
  { value: ALL, label: 'Updated any time' },
  { value: 'today', label: 'Updated today' },
  { value: '7days', label: 'Updated in last 7 days' },
  { value: '30days', label: 'Updated in last 30 days' },
  { value: '90days', label: 'Updated in last 90 days' },
] as const satisfies readonly { value: DateRange; label: string }[];


export const PIPELINE_FILTERS = {
  status: [
    ...RUN_STATUS_OPTIONS,
    { value: 'idle', label: 'Idle' },
  ] as const satisfies readonly { value: PipelineStatus | typeof ALL; label: string }[],
  updated: UPDATED_RANGE_OPTIONS,
} as const satisfies FilterDefinitions;


export type PipelineFilters = FiltersOf<typeof PIPELINE_FILTERS>;


export const ENVIRONMENT_FILTERS = {
  environment: ENV_TYPE_OPTIONS,
  updated: UPDATED_RANGE_OPTIONS,
} as const satisfies FilterDefinitions;


export type EnvironmentFilters = FiltersOf<typeof ENVIRONMENT_FILTERS>;


export const SECRET_FILTERS = {
  environment: ENV_TYPE_OPTIONS,
  updated: UPDATED_RANGE_OPTIONS,
} as const satisfies FilterDefinitions;


export type SecretFilters = FiltersOf<typeof SECRET_FILTERS>;


export const AUDIT_FILTERS = {
  resource: [
    { value: ALL, label: 'All resources' },
    { value: 'pipeline-run', label: 'Runs' },
    { value: 'pipeline', label: 'Pipelines' },
    { value: 'environment', label: 'Environments' },
    { value: 'secret', label: 'Secrets' },
    { value: 'webhook', label: 'Webhooks' },
  ] as const satisfies readonly { value: ResourceType | typeof ALL; label: string }[],
  range: DATE_RANGE_OPTIONS,
  recency: RECENCY_OPTIONS,
} as const satisfies FilterDefinitions;


export type AuditFilters = FiltersOf<typeof AUDIT_FILTERS>;


// The approvals queue defaults to oldest first, so its default is not "Most recent" like the other filters
export const APPROVAL_FILTERS = {
  environment: ENV_TYPE_OPTIONS,
  recency: [
    { value: 'longest-waiting', label: 'Longest waiting' },
    { value: 'most-recent', label: 'Most recent' },
  ],
} as const satisfies FilterDefinitions;


export type ApprovalFilters = FiltersOf<typeof APPROVAL_FILTERS>;


export const WEBHOOK_FILTERS = {
  active: [
    { value: ALL, label: 'All statuses' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ],
  recency: [
    { value: 'most-recent', label: 'Most recently registered' },
    { value: 'least-recent', label: 'Least recently registered' },
  ],
} as const satisfies FilterDefinitions;


export type WebhookFilters = FiltersOf<typeof WEBHOOK_FILTERS>;


export const WEBHOOK_EVENT_FILTERS = {
  status: [
    { value: ALL, label: 'All statuses' },
    { value: 'processed', label: 'Processed' },
    { value: 'pending', label: 'Pending' },
    { value: 'ignored', label: 'Ignored' },
    { value: 'failed', label: 'Failed' },
  ] as const satisfies readonly { value: WebhookEventStatus | typeof ALL; label: string }[],
  'event-type': [
    { value: ALL, label: 'All event types' },
    { value: 'push', label: 'Push' },
    { value: 'pull-request', label: 'Pull Request' },
  ] as const satisfies readonly { value: EventType | typeof ALL; label: string }[],
} as const satisfies FilterDefinitions;


export type WebhookEventFilters = FiltersOf<typeof WEBHOOK_EVENT_FILTERS>;
