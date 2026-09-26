import { initialStages, readyStages, runOutcome } from './scheduler';
import { graph } from '@/test/helpers/graph';
import type { StageStatus } from '@/generated/prisma';

/*
 * The scheduler decides which stages are eligible and whether a run has reached a
 * verdict. Both are pure functions of (graph, outcomes) — no Redis, no Prisma, no shell
 * — so every case is one outcome literal rather than a sequence of mutations.
 *
 * That purity is the point rather than a convenience. The in-degree counter this
 * replaces was order-dependent: replay one completion and its tally was wrong forever.
 * Recomputing from the full outcome set is what lets a redelivered job or two parents
 * finishing at once converge on the same answer, which is the guarantee the runner's
 * compare-and-swap writes are built on.
 */

/** "a:SUCCEEDED b:FAILED" — the graph DSL's counterpart for stage state. */
const outcomes = (spec = ''): Map<string, StageStatus> =>
  new Map(spec.split(' ').filter(Boolean).map(pair => pair.split(':') as [string, StageStatus]));

/** a fans out to b and c, which join back at d. Every interesting decision lives here. */
const diamond = graph('a b c d', 'a>b a>c b>d c>d');

/** A gate between b and c, for the approval statuses. */
const gated = graph('a b:approval c', 'a>b b>c');

describe('initialStages', () => {
  it('returns the stages with no dependencies', () => {
    expect(initialStages(graph('a b c', 'a>c b>c')).sort()).toEqual(['a', 'b']);
  });

  it('returns every stage when there are no edges at all', () => {
    expect(initialStages(graph('a b c')).sort()).toEqual(['a', 'b', 'c']);
  });

  it('returns nothing for an empty graph', () => {
    expect(initialStages(graph(''))).toEqual([]);
  });

  it('starts a diamond at its single root', () => {
    expect(initialStages(diamond)).toEqual(['a']);
  });

  // Nothing has in-degree 0, so the run can never start. That is reported as an empty
  // ready list rather than an error — validatePipelineGraph is what prevents a cyclic
  // definition from reaching the runner in the first place.
  it('returns nothing for a fully cyclic graph', () => {
    expect(initialStages(graph('a b', 'a>b b>a'))).toEqual([]);
  });
});

describe('readyStages', () => {
  it('releases a dependent once its only dependency succeeds', () => {
    expect(readyStages(graph('a b', 'a>b'), outcomes('a:SUCCEEDED'))).toEqual(['b']);
  });

  it('fans out to every dependent at once', () => {
    const ready = readyStages(graph('a b c', 'a>b a>c'), outcomes('a:SUCCEEDED'));

    expect(ready.sort()).toEqual(['b', 'c']);
  });

  // The join is the case the whole parent check exists for: d must not start until
  // both branches are done, however far apart they finish.
  it('holds a join until every parent has succeeded', () => {
    expect(readyStages(diamond, outcomes('a:SUCCEEDED b:SUCCEEDED c:RUNNING'))).toEqual([]);
  });

  it('releases a join once its last parent succeeds', () => {
    expect(readyStages(diamond, outcomes('a:SUCCEEDED b:SUCCEEDED c:SUCCEEDED'))).toEqual(['d']);
  });

  it('returns nothing once every stage has succeeded', () => {
    expect(readyStages(diamond, outcomes('a:SUCCEEDED b:SUCCEEDED c:SUCCEEDED d:SUCCEEDED'))).toEqual([]);
  });

  // A stage with no row yet and a materialised row still at PENDING are the same thing
  // to this function. materializeStages writes every row as PENDING before anything is
  // enqueued, so the second shape is what a real run actually looks like at step 0.
  it('treats an explicit PENDING row exactly like a missing one', () => {
    const materialised = outcomes('a:PENDING b:PENDING c:PENDING d:PENDING');

    expect(readyStages(diamond, materialised)).toEqual(initialStages(diamond));
  });

  it('does not return a stage that has already been enqueued', () => {
    expect(readyStages(diamond, outcomes('a:SUCCEEDED b:QUEUED c:QUEUED'))).toEqual([]);
  });

  // The double-enqueue case. Both parents of d commit their write and then recompute,
  // so at least one of them sees d already claimed and must not enqueue it again.
  it('does not re-release a join whose stage is already enqueued', () => {
    expect(readyStages(diamond, outcomes('a:SUCCEEDED b:SUCCEEDED c:SUCCEEDED d:QUEUED'))).toEqual([]);
  });

  it('returns the same answer however many times it is recomputed', () => {
    const partial = outcomes('a:SUCCEEDED');

    expect(readyStages(diamond, partial)).toEqual(readyStages(diamond, partial));
    expect(readyStages(diamond, partial).sort()).toEqual(['b', 'c']);
  });

  it('never releases a dependent of a failed parent', () => {
    expect(readyStages(diamond, outcomes('a:SUCCEEDED b:FAILED c:SUCCEEDED'))).toEqual([]);
  });

  // CANCELLED is written to a failed run's PENDING siblings, so it has to block just
  // like FAILED does — otherwise the sweep could release work on a dead run.
  it('never releases a dependent of a cancelled parent', () => {
    expect(readyStages(diamond, outcomes('a:SUCCEEDED b:CANCELLED c:SUCCEEDED'))).toEqual([]);
  });

  it('returns an approval stage like any other, leaving the caller to gate it', () => {
    expect(readyStages(gated, outcomes('a:SUCCEEDED'))).toEqual(['b']);
  });

  it('holds dependents while an approval is awaiting a decision', () => {
    expect(readyStages(gated, outcomes('a:SUCCEEDED b:AWAITING_APPROVAL'))).toEqual([]);
  });

  it('releases dependents once an approval is granted', () => {
    expect(readyStages(gated, outcomes('a:SUCCEEDED b:APPROVED'))).toEqual(['c']);
  });

  // Rejection needs no path of its own: UNAPPROVED is failure-terminal, so it blocks
  // here and makes runOutcome report FAILED on its own.
  it('never releases dependents of a rejected approval', () => {
    expect(readyStages(gated, outcomes('a:SUCCEEDED b:UNAPPROVED'))).toEqual([]);
  });

  // A cycle downstream of a real root is the reachable shape of the problem: a runs,
  // and then b and c wait on each other with nothing left to release them.
  it('deadlocks on a cycle downstream of a root once that root finishes', () => {
    expect(readyStages(graph('a b c', 'a>b b>c c>b'), outcomes('a:SUCCEEDED'))).toEqual([]);
  });

  // An edge whose source is not a node blocks its target permanently. Erring towards
  // blocked is the safe direction, and validatePipelineGraph rejects dangling edges
  // before a run is created, so this only ever guards against a corrupt definition.
  it('blocks a stage whose parent is not in the graph at all', () => {
    expect(readyStages(graph('a b', 'zz>b'), outcomes())).toEqual(['a']);
  });
});

describe('runOutcome', () => {
  it('is null before anything has run', () => {
    expect(runOutcome(diamond, outcomes())).toBeNull();
  });

  it('is null while a stage is still running', () => {
    expect(runOutcome(diamond, outcomes('a:SUCCEEDED b:SUCCEEDED c:RUNNING'))).toBeNull();
  });

  it('is null when the last stage is enqueued but undecided', () => {
    expect(runOutcome(diamond, outcomes('a:SUCCEEDED b:SUCCEEDED c:SUCCEEDED d:QUEUED'))).toBeNull();
  });

  it('succeeds once every stage has succeeded', () => {
    const done = outcomes('a:SUCCEEDED b:SUCCEEDED c:SUCCEEDED d:SUCCEEDED');

    expect(runOutcome(diamond, done)).toBe('SUCCEEDED');
  });

  // Failure is checked before success and short-circuits, so a run is failed the moment
  // one stage fails rather than when its siblings happen to finish.
  it('fails as soon as one stage fails, with siblings still in flight', () => {
    expect(runOutcome(diamond, outcomes('a:SUCCEEDED b:FAILED c:RUNNING d:PENDING'))).toBe('FAILED');
  });

  it('stays failed after the cancel sweep rewrites the pending siblings', () => {
    expect(runOutcome(diamond, outcomes('a:SUCCEEDED b:FAILED c:SUCCEEDED d:CANCELLED'))).toBe('FAILED');
  });

  it('counts an approved stage as a success', () => {
    expect(runOutcome(gated, outcomes('a:SUCCEEDED b:APPROVED c:SUCCEEDED'))).toBe('SUCCEEDED');
  });

  it('is null while an approval is awaiting a decision', () => {
    expect(runOutcome(gated, outcomes('a:SUCCEEDED b:AWAITING_APPROVAL'))).toBeNull();
  });

  it('fails a run whose approval was rejected', () => {
    expect(runOutcome(gated, outcomes('a:SUCCEEDED b:UNAPPROVED'))).toBe('FAILED');
  });

  // Vacuously true, and deliberate: a definition with no stages has nothing left to do.
  it('succeeds a graph with no stages at all', () => {
    expect(runOutcome(graph(''), outcomes())).toBe('SUCCEEDED');
  });

  // Nothing fails and nothing can succeed, so a cyclic run would sit in RUNNING for
  // ever. Same reasoning as initialStages: validation is the guard, not this function.
  it('is null for a cyclic graph, which therefore never reaches a verdict', () => {
    expect(runOutcome(graph('a b', 'a>b b>a'), outcomes())).toBeNull();
  });

  // The verdict is decided by the definition the run pinned, so a stray outcome — a
  // stage id from another version — must not be able to fail an otherwise clean run.
  it('ignores an outcome for a stage that is not in the graph', () => {
    const stray = outcomes('a:SUCCEEDED b:SUCCEEDED zz:FAILED');

    expect(runOutcome(graph('a b', 'a>b'), stray)).toBe('SUCCEEDED');
  });
});

describe('a run from start to finish', () => {
  // The two functions in concert, over the shape a real gated pipeline has. Each step is
  // the state the runner would have written before recomputing.
  it('walks a gated pipeline through to its deploy', () => {
    const pipeline = graph(
      'install build test approve:approval deploy:deploy',
      'install>build install>test build>approve test>approve approve>deploy',
    );
    const at = (spec: string) => ({
      ready: readyStages(pipeline, outcomes(spec)).sort(),
      outcome: runOutcome(pipeline, outcomes(spec)),
    });

    expect(at('')).toEqual({ ready: ['install'], outcome: null });
    expect(at('install:SUCCEEDED')).toEqual({ ready: ['build', 'test'], outcome: null });
    expect(at('install:SUCCEEDED build:SUCCEEDED test:RUNNING')).toEqual({ ready: [], outcome: null });
    expect(at('install:SUCCEEDED build:SUCCEEDED test:SUCCEEDED')).toEqual({ ready: ['approve'], outcome: null });
    expect(at('install:SUCCEEDED build:SUCCEEDED test:SUCCEEDED approve:AWAITING_APPROVAL'))
      .toEqual({ ready: [], outcome: null });
    expect(at('install:SUCCEEDED build:SUCCEEDED test:SUCCEEDED approve:APPROVED'))
      .toEqual({ ready: ['deploy'], outcome: null });
    expect(at('install:SUCCEEDED build:SUCCEEDED test:SUCCEEDED approve:APPROVED deploy:SUCCEEDED'))
      .toEqual({ ready: [], outcome: 'SUCCEEDED' });
  });

  it('fails the run when the approval is rejected instead', () => {
    const pipeline = graph('build approve:approval deploy:deploy', 'build>approve approve>deploy');
    const rejected = outcomes('build:SUCCEEDED approve:UNAPPROVED');

    expect(readyStages(pipeline, rejected)).toEqual([]);
    expect(runOutcome(pipeline, rejected)).toBe('FAILED');
  });
});
