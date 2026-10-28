import { isSmeeChannelUrl, RELAY_URL_ERROR } from './relay-url';

describe('isSmeeChannelUrl', () => {
  it.each(['https://smee.io/abc123', 'https://smee.io/ju3dbVoWNZC00wg7', 'https://smee.io/a_b-c'])('accepts %p', url => {
    expect(isSmeeChannelUrl(url)).toBe(true);
  });

  it.each([
    'http://smee.io/abc', 'https://evil.example/abc', 'https://smee.io/', 'https://smee.io/abc/',
    'https://smee.io/abc?x=1', 'https://smee.io/abc; rm -rf ~', 'https://smee.io/abc\n', ' https://smee.io/abc', '',
  ])('rejects %p', url => {
    expect(isSmeeChannelUrl(url)).toBe(false);
  });

  it('has the exact error copy', () => {
    expect(RELAY_URL_ERROR).toBe('Relay URL must be a smee.io channel, e.g. https://smee.io/abc123.');
  });
});
