/*
 * Shared by the runner's scrubber, the secret form's validation and the form input itself,
 * so all three agree on what can be masked.
 */

/* What a masked secret value reads as in a stage's logs. */
export const MASK = '***';


/*
 * Values shorter than this are never masked. 
 * Without this, if a secret value is literally '1', 
 * that would mask all occcurrences of '1' in the logs.
 */
export const MIN_MASKABLE_LENGTH = 4;
