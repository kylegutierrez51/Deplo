// drops trailing slash on origin
export function webhookEndpoint(origin: string, id: string): string {
  return `${origin.replace(/\/+$/, '')}/api/webhook/${id}`;
}


export function smeeCommand(relayUrl: string, endpoint: string): string {
  return `npx smee-client --url ${relayUrl} --target ${endpoint}`;
}


export function readPublicUrl(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const { protocol } = new URL(trimmed);
    return protocol === 'http:' || protocol === 'https:' ? trimmed : null;
  } catch {
    return null;
  }
}


const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isLocalOrigin(origin: string): boolean {
  try {
    return LOCAL_HOSTNAMES.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}


/* A null origin is SSR: assume local until the client has hydrated. */
export function connectHint(origin: string | null): string {
  if (origin === null || isLocalOrigin(origin)) {
    return "GitHub can't reach Deplo on localhost. Edit this webhook to add a smee.io relay URL.";
  }
  return "Paste the Deplo endpoint into GitHub as the payload URL, or add a smee.io relay URL if GitHub can't reach this host.";
}
