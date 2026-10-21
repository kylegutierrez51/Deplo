// The relay URL ends up in a command the user copies into their own terminal, so only a
// plain smee.io channel is accepted: no other host, no path segments, no query string.
const SMEE_CHANNEL = /^https:\/\/smee\.io\/[A-Za-z0-9_-]+$/;

export const RELAY_URL_ERROR = 'Relay URL must be a smee.io channel, e.g. https://smee.io/abc123.';

export function isSmeeChannelUrl(url: string): boolean {
  return SMEE_CHANNEL.test(url);
}
