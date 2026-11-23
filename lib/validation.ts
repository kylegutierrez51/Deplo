import { z } from 'zod';
import { isCloneableRepoUrl, REPO_URL_ERROR } from './pipeline/repo-url';
import { MIN_MASKABLE_LENGTH } from '@/lib/secret-mask';

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
  defaultEnvironmentId: z.string().nullable()
});

export type PipelineInput = z.infer<typeof pipelineSchema>;



// SecretModal
export const secretSchema = z.object({
  key: z.string()
    .trim()
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

export type SecretInput = z.infer<typeof secretSchema>;