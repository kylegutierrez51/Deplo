import { z } from 'zod';
import { isCloneableRepoUrl, REPO_URL_ERROR } from './pipeline/repo-url';
import { MIN_MASKABLE_LENGTH } from '@/lib/secret-mask';
import { isSmeeChannelUrl, RELAY_URL_ERROR } from '@/lib/webhooks/relay-url';
import { MAX_STAGE_TIMEOUT_S, MAX_STAGE_RETRIES } from '@/lib/pipeline/defaults';


// shared between SecretModal key and Pipeline Editor Environment Key
const environmentVariableKeySchema = z.string()
  .trim()
  .regex(
    /^[A-Za-z_][A-Za-z0-9_]*$/,
    'Start with a letter or underscore; use only letters, numbers, and underscores.',
  );


// EnvironmentModal
export const environmentSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Environment name is required.')
    .max(50, 'Environment name must be 50 characters or fewer.')
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only.'),
  type: z.enum(['production', 'staging', 'development', 'preview', 'custom']),
  // FormData contains strings; validate before converting to a boolean.
  requireApproval: z.enum(['true', 'false'])
    .transform(value => value === 'true'),
});

export const updateEnvironmentSchema = environmentSchema.extend({
  id: z.string().min(1, 'Select an environment to update.'),
});

export type EnvironmentInput = z.infer<typeof environmentSchema>;



// PipelineModal
export const pipelineSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Name is required.')
    .max(50, 'Name must be 50 characters or fewer.'),
  description: z.string()
    .trim()
    .max(1000, 'Description must be 1000 characters or fewer.'),
  repoUrl: z.string()
    .trim()
    .nullish()
    .transform(value => value || null)
    .refine(
      value => value === null || isCloneableRepoUrl(value),
      REPO_URL_ERROR,
    ),
  defaultEnvironmentId: z.string()
    .nullable()
    .transform(value => value === '' ? null : value),
});

export const updatePipelineSchema = pipelineSchema.extend({
  id: z.string().min(1, 'Select a pipeline to update.'),
});

export type PipelineInput = z.infer<typeof pipelineSchema>;



// SecretModal
export const secretSchema = z.object({
  key: environmentVariableKeySchema
    .min(1, 'Key is required.')
    .max(50, 'Key must be 50 characters or fewer.'),
  notes: z.string()
    .trim()
    .max(1000, 'Notes must be 1000 characters or fewer.'),
  value: z.string()
    .trim()
    .min(MIN_MASKABLE_LENGTH, `A secret value must be at least ${MIN_MASKABLE_LENGTH} characters, so it can be masked in run logs.`),
  environmentId: z.string()
    .min(1, 'Select an environment to scope the secret to.')
});

export const updateSecretSchema = secretSchema.extend({
  id: z.string().min(1, 'Select a secret to update.'),
});

export type SecretInput = z.infer<typeof secretSchema>;

// WebhookModal: shared metadata for create and update.
export const webhookSchema = z.object({
  pipelineId: z.string()
    .trim()
    .min(1, 'Select a pipeline from the list.'),
  environmentId: z.string()
    .trim()
    .nullish()
    .transform(value => value || null),
  environmentName: z.string()
    .trim()
    .nullish(),
  branchFilters: z.array(
    z.string()
      .trim()
      .min(1, 'Branch filters cannot be blank.') // covers an empty string (e.g.,  '    ')
  ).refine(filters => new Set(filters).size === filters.length, 'Duplicate branch filters are not allowed.'),
  events: z.array(
    z.enum(['push', 'pull-request'], {
      error: 'Error adding trigger event data. Please try again.',
    })),
  // A missing flag retains the existing default of active.
  isActive: z.enum(['true', 'false'])
    .nullish()
    .transform(value => value !== 'false'),
  relayUrl: z.string()
    .trim()
    .nullish()
    .transform(value => value || null)
    .refine(value => value === null || isSmeeChannelUrl(value), RELAY_URL_ERROR),
}).refine(value => value.environmentId !== null || !value.environmentName, {
  message: 'Select an environment from the list, or leave it empty.',
  path: ['environmentId'],
});


export const createWebhookSchema = webhookSchema.safeExtend({
  // Check for blank values without changing the secret used to verify signatures.
  secret: z.string({ error: 'Webhook secret is required.' })
    .refine(value => value.trim().length > 0, 'Webhook secret is required.'),
});

export const updateWebhookSchema = webhookSchema.safeExtend({
  id: z.string().min(1, 'Select a webhook to update.'),
});

export type WebhookInput = z.infer<typeof webhookSchema>;


// Pipeline editor: validate the submitted graph before serializing it.
const timeoutError = `Timeout must be a whole number from 1 to ${MAX_STAGE_TIMEOUT_S} seconds.`;
const retriesError = `Retries must be a whole number from 0 to ${MAX_STAGE_RETRIES}.`;
const stageTimeoutSchema = z.number({ error: timeoutError })
  .int(timeoutError).min(1, timeoutError).max(MAX_STAGE_TIMEOUT_S, timeoutError);
const stageRetriesSchema = z.number({ error: retriesError })
  .int(retriesError).min(0, retriesError).max(MAX_STAGE_RETRIES, retriesError);
const stageEnvVarsSchema = z.array(z.object({
  key: environmentVariableKeySchema,
  value: z.string(),
}));
const stageSecretsSchema = z.record(z.string(), z.array(z.string()));

const pipelineGraphSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().min(1),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.object({
      type: z.enum(['custom', 'deploy', 'approval']).default('custom'),
      // Drafts can have unnamed stages and missing commands; readiness checks handle those.
      name: z.string().optional(),
      label: z.string().optional(),
      command: z.string().nullish().transform(value => value ?? undefined),
      timeout: stageTimeoutSchema.nullish().transform(value => value ?? undefined),
      retries: stageRetriesSchema.nullish().transform(value => value ?? undefined),
      env_vars: stageEnvVarsSchema.optional(),
      secrets: stageSecretsSchema.optional(),
    }),
  })),
  edges: z.array(z.object({
    id: z.string().min(1),
    source: z.string().min(1),
    target: z.string().min(1),
  })),
}).refine(graph => new Set(graph.nodes.map(node => node.id)).size === graph.nodes.length, {
  message: 'Duplicate stage IDs are not allowed.',
  path: ['nodes'],
});

export const pipelineEditorSchema = pipelineGraphSchema.safeExtend({
  defaultDirectory: z.string().nullish(),
});


export const pipelineDefinitionSchema = z.object({
  graphJson: pipelineGraphSchema,
  configJson: z.record(z.string(), z.object({
    command: z.string().nullable().default(null),
    timeout: stageTimeoutSchema.nullable().default(null),
    retries: stageRetriesSchema.nullable().default(null),
    env_vars: stageEnvVarsSchema.default([]),
    secrets: stageSecretsSchema.default({}),
  })),
});

export type PipelineEditorInput = z.infer<typeof pipelineEditorSchema>;
