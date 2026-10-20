import { connectHint, isLocalOrigin, readPublicUrl, smeeCommand, webhookEndpoint } from './endpoint';

describe('webhookEndpoint', () => {
  it('joins the origin and the webhook id', () => {
    expect(webhookEndpoint('http://localhost:3000', 'wh-1')).toBe('http://localhost:3000/api/webhook/wh-1');
  });

  it.each(['https://deplo.example.com/', 'https://deplo.example.com//'])('drops trailing slashes on %p', origin => {
    expect(webhookEndpoint(origin, 'wh-1')).toBe('https://deplo.example.com/api/webhook/wh-1');
  });
});

describe('smeeCommand', () => {
  it('builds the exact smee-client invocation', () => {
    expect(smeeCommand('https://smee.io/abc123', 'http://localhost:3000/api/webhook/wh-1'))
      .toBe('npx smee-client --url https://smee.io/abc123 --target http://localhost:3000/api/webhook/wh-1');
  });
});

describe('readPublicUrl', () => {
  it.each([undefined, '', '   ', 'deplo.example.com', 'ftp://x.example', 'not a url'])('rejects %p', raw => {
    expect(readPublicUrl(raw)).toBeNull();
  });

  it('trims a valid https URL', () => {
    expect(readPublicUrl(' https://deplo.example.com/ ')).toBe('https://deplo.example.com/');
  });

  it('does not force https', () => {
    expect(readPublicUrl('http://192.168.1.5:3000')).toBe('http://192.168.1.5:3000');
  });
});

describe('isLocalOrigin', () => {
  it.each(['http://localhost', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000'])('treats %p as local', origin => {
    expect(isLocalOrigin(origin)).toBe(true);
  });

  it.each(['https://deplo.example.com', 'http://192.168.1.5:3000', 'garbage', ''])('treats %p as not local', origin => {
    expect(isLocalOrigin(origin)).toBe(false);
  });
});

describe('connectHint', () => {
  it.each([null, 'http://localhost:3000'])('warns that GitHub cannot reach localhost for %p', origin => {
    expect(connectHint(origin)).toMatch(/can't reach Deplo on localhost/);
  });

  it('offers the endpoint first on a real host', () => {
    expect(connectHint('https://deplo.example.com'))
      .toBe("Paste the Deplo endpoint into GitHub as the payload URL, or add a smee.io relay URL if GitHub can't reach this host.");
  });
});
