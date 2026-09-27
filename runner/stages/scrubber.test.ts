import { buildScrubber } from './scrubber';
import { MIN_MASKABLE_LENGTH } from '@/lib/secret-mask';

const scrubAll = (values: string[], ...chunks: string[]) => {
  const cursor = buildScrubber(values).cursor();
  return chunks.map(chunk => cursor.push(chunk)).join('') + cursor.end();
};

describe('whole values', () => {
  it('masks a value that arrives in one piece', () => {
    expect(scrubAll(['hunter2'], 'token is hunter2 ok')).toBe('token is *** ok');
  });

  it('masks every occurrence, not only the first', () => {
    expect(scrubAll(['hunter2'], 'hunter2 and hunter2')).toBe('*** and ***');
  });

  it('masks values from different secrets in the same line', () => {
    expect(scrubAll(['alpha-key', 'beta-key'], 'a=alpha-key b=beta-key')).toBe('a=*** b=***');
  });

  it('leaves output containing no secret untouched', () => {
    expect(scrubAll(['hunter2'], 'nothing to see here')).toBe('nothing to see here');
  });

  it('passes text through unchanged when there are no secrets at all', () => {
    expect(scrubAll([], 'hunter2 stays')).toBe('hunter2 stays');
  });
});



describe('values split across chunks', () => {
  it('masks a value split across two writes', () => {
    expect(scrubAll(['hunter2'], 'pw: hunte', 'r2 done')).toBe('pw: *** done');
  });

  it('masks a value delivered one character at a time', () => {
    expect(scrubAll(['hunter2'], ...'x hunter2 y'.split(''))).toBe('x *** y');
  });

  it('masks a value split at every possible offset', () => {
    for (let at = 1; at < 'hunter2'.length; at++) {
      const left = 'pre hunter2'.slice(0, 4 + at);
      const right = 'pre hunter2'.slice(4 + at) + ' post';

      expect(scrubAll(['hunter2'], left, right)).toBe('pre *** post');
    }
  });

  // The holdback must not eat output. Text that merely starts like a secret and then turns
  // out not to be one has to come back out verbatim, or a stage's logs silently lose their
  // last line every time it happens to begin with a secret value's letter.
  it('emits a partial match that never completes', () => {
    expect(scrubAll(['hunter2'], 'hunt', 'ing season')).toBe('hunting season');
  });

  it('emits a trailing partial match when the command exits mid-value', () => {
    expect(scrubAll(['hunter2'], 'stopped at hunte')).toBe('stopped at hunte');
  });
});

/*
 * Two streams, two cursors. execute.ts feeds stdout and stderr into one line buffer, and a
 * shared cursor would both invent matches across them and tear real ones apart.
 */
describe('independent cursors', () => {
  it('does not match a value assembled from two different cursors', () => {
    const scrubber = buildScrubber(['hunter2']);
    const out = scrubber.cursor();
    const err = scrubber.cursor();

    // Read each stream back on its own. Since they use 2 different cursors, 'hunter2' returns since neither cursor ever saw a whole value.
    const stdout = out.push('hunte') + out.end();
    const stderr = err.push('r2') + err.end();

    expect(stdout + stderr).toBe('hunter2');
  });

  it('masks each cursor independently', () => {
    const scrubber = buildScrubber(['hunter2']);
    const out = scrubber.cursor();
    const err = scrubber.cursor();

    expect(out.push('a hunter2') + out.end()).toBe('a ***');
    expect(err.push('b hunter2') + err.end()).toBe('b ***');
  });
});

/*
 * Masking the shorter of two overlapping secrets and stopping there would print the rest of
 * the longer one in clear. Longest-match-wins is not a tidiness preference here.
 */
describe('overlapping secrets', () => {
  it('does not leak the tail of a longer secret that contains a shorter one', () => {
    expect(scrubAll(['abcd', 'abcd1234'], 'v=abcd1234.')).toBe('v=***.');
  });

  it('masks the longer value when the shorter one is a suffix', () => {
    expect(scrubAll(['1234', 'abcd1234'], 'v=abcd1234.')).toBe('v=***.');
  });

  it('collapses two adjacent secrets into a single mask', () => {
    expect(scrubAll(['aaaa', 'bbbb'], 'aaaabbbb')).toBe('***');
  });

  it('survives an overlap split across chunks', () => {
    expect(scrubAll(['abcd', 'abcd1234'], 'v=abcd12', '34.')).toBe('v=***.');
  });

  // covered by the first 'if' in the failure link phase.
  // Without it, prints out "postgres://app:hunter2"
  it('covers the substring but does not truncate the first value since "@db:5432/prod" is missing from the pattern', () => {
    expect(scrubAll(['postgres://app:hunter2@db:5432/prod', 'hunter2'], "FATAL: could not connect to postgres://app:hunter2")).toBe("FATAL: could not connect to postgres://app:***");
  });

  it('covers the substring and the main string', () => {
    expect(scrubAll(['postgres://app:hunter2@db:5432/prod', 'hunter2'], "FATAL: could not connect to postgres://app:hunter2@db:5432/prod")).toBe("FATAL: could not connect to ***");
  })
});

describe('multi-line values', () => {
  // A PEM key is the case that kills the simpler design of masking whole lines as they are
  // pushed into the ring buffer: by then the value has already been cut at every newline.
  const pem = '-----BEGIN KEY-----\nQUJDREVGRw==\nhijklmnop\n-----END KEY-----';

  it('masks a value spanning several lines', () => {
    expect(scrubAll([pem], `before\n${pem}\nafter`)).toBe('before\n***\nafter');
  });

  it('masks a multi-line value torn across writes at a newline', () => {
    const at = pem.indexOf('\n') + 1;

    expect(scrubAll([pem], pem.slice(0, at), `${pem.slice(at)} end`)).toBe('*** end');
  });
});

describe('values that would destroy the logs', () => {
  it.each(['1', 'ab', 'abc'])('ignores the value %p', value => {
    expect(scrubAll([value], `x ${value} y`)).toBe(`x ${value} y`);
  });

  it('masks a value exactly at the minimum length', () => {
    const value = 'a'.repeat(MIN_MASKABLE_LENGTH);

    expect(scrubAll([value], `x ${value} y`)).toBe('x *** y');
  });

  it('ignores an empty value rather than masking between every character', () => {
    expect(scrubAll([''], 'abc')).toBe('abc');
  });

  // the entered value is trimmed, so whitespaces don't count toward the length
  it('ignores a value that is nothing but whitespace', () => {
    const build = 'webpack compiled\n    assets by path static/\n    modules by path ./src/';

    expect(scrubAll(['    '], build)).toBe(build);
  });

  it('ignores a value whose content falls under MIN_MASKABLE_LENGTH once the value is trimmed', () => {
    expect(scrubAll(['  ab  '], 'x   ab   y')).toBe('x   ab   y');
  });
});

describe('stored value variants', () => {
  // the entered value is trimmed, so whitespaces don't count toward the length
  it('masks a value stored with surrounding whitespace', () => {
    expect(scrubAll(['  hunter2\n'], 'v=hunter2.')).toBe('v=***.');
  });

  it('masks the value inside an occurrence that kept its whitespace', () => {
    expect(scrubAll(['  hunter2\n'], 'v=[  hunter2\n].')).toBe('v=[  ***\n].');
  });

  it('matches case-sensitively, since a secret is exact', () => {
    expect(scrubAll(['hunter2'], 'HUNTER2')).toBe('HUNTER2');
  });
});

describe('the replacement itself', () => {
  // One asterisk per character would hand a reader the exact length of every credential
  it('does not reveal the length of the value it replaced', () => {
    const short = scrubAll(['abcd'], 'abcd');
    const long = scrubAll(['a'.repeat(200)], 'a'.repeat(200));

    expect(short).toBe(long);
  });
});

describe('scrub()', () => {
  it('masks a complete string in one call', () => {
    expect(buildScrubber(['hunter2']).scrub('v=hunter2')).toBe('v=***');
  });

  it('holds nothing back', () => {
    expect(buildScrubber(['hunter2']).scrub('ends mid hunte')).toBe('ends mid hunte');
  });
});