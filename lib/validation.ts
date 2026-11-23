import { z } from 'zod';

// Matches the values submitted by EnvironmentModal.
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
