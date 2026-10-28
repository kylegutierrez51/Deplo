export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function truncateText(text: string | null, maxLength: number = 30): string | null {
  if (!text) return null;
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}



/* Reserved labels are stored capitalized ('Approval', 'Deploy'), so compare normalized. */
const RESERVED_LABELS = ['approval', 'deploy'] as const;

export function matchReservedLabel(value: string | undefined): typeof RESERVED_LABELS[number] | null {
  const normalized = value?.trim().toLowerCase();
  return RESERVED_LABELS.find(word => word === normalized) ?? null;
}