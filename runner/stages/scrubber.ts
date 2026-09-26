import { MASK, MIN_MASKABLE_LENGTH } from '@/lib/secret-mask';

/*
==============================================================================================
 * Masks secret values in a command's output
 *
 * Without this, the value lands in the ring buffer, in the runner's own console, and in 
 * stage_results.logSnippet, where reapStaleStages then appends to rather than overwrites it.
 *
 * This is a guardrail against accidents, not a security boundary. The command can transform
 * the value before printing it (`echo ${API_KEY:0:4}` defeats any matcher), and the UI copy
 * says "masked" rather than "never logged" for exactly that reason.
 *
 * Aho-Corasick, chosen for resumable state rather than for throughput. Chunks arrive on pipe
 * boundaries, so a value is routinely torn in half between two 'data' events and a matcher
 * that only sees one chunk at a time never fires. The automaton's entire cursor is a single
 * node index, so it resumes across chunks by construction, and that node's depth is exactly
 * how many trailing characters are still ambiguous and must be withheld — usually none. This
 * prevents 1 part of a secret and another that are split between two chunks from being logged
==============================================================================================
*/

// marks start and end indices for a found secret
type Span = [start: number, end: number];

interface Node {
  next: Map<number, number>;
  fail: number;
  depth: number;

  // length of longest pattern ending at a node
  out: number;
}

export interface ScrubCursor {
  // Returns the portion of the stream that is now safe to emit, masked.
  push(chunk: string): string;
  // Returns whatever was being withheld. The cursor is reusable afterwards.
  end(): string;
}

export interface Scrubber {
  cursor(): ScrubCursor;

  // scrub input just once without calling cursor()
  scrub(text: string): string;
}

const PASSTHROUGH: Scrubber = {
  cursor: () => ({ push: (chunk: string) => chunk, end: () => '' }),
  scrub: (text: string) => text,
};



// merges 2 back to back secrets into one mask rather than showing both (*** instead of *** ***)
/* 
  e.g.
  2 secrets: cat, atc 
      pattern 1: catatc     pattern 2: tgcatcg   pattern 3: catdatc

      result 1: ***         result 2: tg***g       result 3: ***d***   
*/
function merge(spans: Span[]): Span[] {
  if (spans.length < 2) return spans;

  const sorted = [...spans].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Span[] = [[...sorted[0]] as Span];

  for (const [start, end] of sorted.slice(1)) {
    const last = merged[merged.length - 1];

    if (start <= last[1] + 1) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  return merged;
}



// masks the secrets, returns scrubbed chunk to place in logger
function render(text: string, spans: Span[]): string {
  if (spans.length === 0) return text;

  let out = '';
  let at = 0;

  for (const [start, end] of spans) {
    out += text.slice(at, start) + MASK;
    at = end + 1;
  }

  return out + text.slice(at);
}

/*
==============================================================================================
 * Compiles the values into an automaton, which is immutable and safe to share.
 *
 * State lives in the cursors, never here, because a single stage hands the same automaton to
 * both stdout and stderr and five stages run at once.
 *
 * Values are registered trimmed, and the floor is measured after trimming.
 *
 * A pasted value routinely carries a trailing newline, and the command decides which form
 * reaches the log: `echo "$KEY"` keeps it, `echo $KEY` word-splits it away. The trimmed form
 * covers both, because it is a substring of the stored one — an occurrence that kept its
 * whitespace still has its contents masked, and the whitespace left beside the mask is not
 * the secret.
 *
 * Registering the stored form as well would let padding smuggle a value past the floor: a
 * secret value of four spaces is long enough as stored but has no content at all, and would
 * mask every four-space indent in every build log — the exact outcome MIN_MASKABLE_LENGTH
 * exists to prevent.
==============================================================================================
*/
export function buildScrubber(values: Iterable<string>): Scrubber {
  const patterns = new Set<string>();

  // 1. normalize values
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length >= MIN_MASKABLE_LENGTH) patterns.add(trimmed);
  }

  if (patterns.size === 0) return PASSTHROUGH;

  // 2. build trie
  const nodes: Node[] = [{ next: new Map(), fail: 0, depth: 0, out: 0 }];

  for (const pattern of patterns) {
    let node = 0;

    for (let at = 0; at < pattern.length; at++) {
      const code = pattern.charCodeAt(at);
      let child = nodes[node].next.get(code);

      if (child === undefined) {
        child = nodes.length;
        nodes.push({ next: new Map(), fail: 0, depth: nodes[node].depth + 1, out: 0 });
        nodes[node].next.set(code, child);
      }

      node = child;
    }

    nodes[node].out = Math.max(nodes[node].out, nodes[node].depth);
  }

  // 3. failure links -- BFS
  const queue = [...nodes[0].next.values()];

  for (let at = 0; at < queue.length; at++) {
    const node = queue[at];

    if (nodes[node].out === 0) nodes[node].out = nodes[nodes[node].fail].out;

    for (const [code, next] of nodes[node].next) {
      let fail = nodes[node].fail;

      while (fail !== 0 && !nodes[fail].next.has(code)) fail = nodes[fail].fail;

      const target = nodes[fail].next.get(code) ?? 0;
      nodes[next].fail = target === next ? 0 : target;
      queue.push(next);
    }
  }


  const step = (node: number, code: number): number => {
    while (node !== 0 && !nodes[node].next.has(code)) node = nodes[node].fail;

    return nodes[node].next.get(code) ?? 0;
  };

  const cursor = (): ScrubCursor => {
    let state = 0;
    let held = '';
    // Spans already matched inside `held`, in `held` coordinates. Carried because the held
    // text is never re-walked: the automaton has consumed it once and will not do so again.
    let spans: Span[] = [];

    return {
      push(chunk: string): string {
        if (!chunk) return '';

        const buffer = held + chunk;
        const found = spans;

        // `held` is a prefix of `buffer`, so carried spans need no shifting and the pattern matching
        // resumes at the first genuinely new character.
        for (let at = held.length; at < buffer.length; at++) {
          state = step(state, buffer.charCodeAt(at));

          const length = nodes[state].out;
          if (length > 0) found.push([at - length + 1, at]);
        }

        const merged = merge(found);


        // for a string like 'tgcatc', and 4 secrets: 'acc', 'atc', 'cat', 'gcg':
        // this var truncates the pattern to 'tgc' (safe = 3)
        let safe = buffer.length - nodes[state].depth;

        // from example above, this truncates the 'c' in 'tgc' (since it can risk matching 'cat') by making safe = 2 ('tg')
        for (let at = merged.length - 1; at >= 0; at--) {
          const [start, end] = merged[at];
          if (start < safe && end >= safe) safe = start;
        }

        // masks secrets in truncated pattern
        const emitted = render(
          buffer.slice(0, safe),
          merged.filter(([, end]) => end < safe),
        );


        // holds chunk skipped by 'safe' var. 
        // updates position of secrets skipped by 'safe' var
        // e.g. 'tgcatc', secrets = 'cat', 'atc', 'acc', 'gcg'
        // held = 'catc' (safe = 2)
        // merged = [[2, 5], [3, 5]] (cat, atc - respectively)
        // spans = [[0, 3], [1, 3]] -- updated positions from merged
        held = buffer.slice(safe);
        spans = merged
          .filter(([, end]) => end >= safe)
          .map(([start, end]) => [start - safe, end - safe] as Span);

        return emitted;
      },

      end(): string {
        const remainder = render(held, merge(spans));

        state = 0;
        held = '';
        spans = [];

        return remainder;
      },
    };
  };

  return {
    cursor,
    scrub(text: string): string {
      const one = cursor();

      return one.push(text) + one.end();
    },
  };
}
