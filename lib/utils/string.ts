export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getRepoName(repoUrl: string): string {
  const lastOccurrence = repoUrl.lastIndexOf('/');
  if (lastOccurrence === -1) return repoUrl;
  return repoUrl.slice(lastOccurrence + 1) 
}

export function getBranch(ref: string): string {
  return ref.slice(11);
}



/* Reserved labels are stored capitalized ('Approval', 'Deploy'), so compare normalized. */
const RESERVED_LABELS = ['approval', 'deploy'] as const;

export function matchReservedLabel(value: string | undefined): typeof RESERVED_LABELS[number] | null {
  const normalized = value?.trim().toLowerCase();
  return RESERVED_LABELS.find(word => word === normalized) ?? null;
}