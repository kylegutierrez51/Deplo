import { z } from 'zod';
import { isCloneableRepoUrl, REPO_URL_ERROR } from './pipeline/repo-url';

// EnvironmentModal
export const environmentSchema = z.object({
  name: z.string()
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
    .min(1, 'Name is required.')
    .max(50, 'Name must be 50 characters or fewer.'),
  description: z.string()
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