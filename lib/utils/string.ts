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