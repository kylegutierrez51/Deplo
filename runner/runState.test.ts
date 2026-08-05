import { startRun, completeStage, failRun } from './runState';
import { configJson, graphJson } from './sample';
import type { ConfigJson, GraphJson } from './types';

/*
 * runState is the runner's scheduler: it decides which stages become eligible as
 * others finish. It is pure in-memory bookkeeping, so it tests without Redis or a
 * shell — importantly, this file must never import runner/bullmq.ts, which opens
 * a Redis connection and calls triggerRun() at module load.
 *
 * The state is module-level and keyed by runId, so every test uses its own id
 * rather than relying on cleanup between cases.
 */

let nextId = 0;
const freshRunId = () => `run-${nextId++}`;

/** "a b c" plus "a>b" edges, matching the DSL in test/helpers/graph. */
function runnerGraph(nodeSpecs: string, edgeSpecs = ''): GraphJson {
  return {
    nodes: nodeSpecs.split(' ').filter(Boolean).map(id => ({
      id, type: 'standardStage', position: { x: 0, y: 0 }, data: { type: 'custom', name: id, label: id },
    })),
    edges: edgeSpecs.split(' ').filter(Boolean).map((spec, i) => {
      const [source, target] = spec.split('>');
      return { id: `e${i}`, source, target };
    }),
  } as GraphJson;
}

const emptyConfig = {} as ConfigJson;

describe('startRun', () => {
  it('returns the stages with no dependencies', () => {
    const ready = startRun(freshRunId(), runnerGraph('a b c', 'a>c b>c'), emptyConfig);

    expect(ready.sort()).toEqual(['a', 'b']);
  });

  it('returns every stage when there are no edges at all', () => {
    const ready = startRun(freshRunId(), runnerGraph('a b c'), emptyConfig);

    expect(ready.sort()).toEqual(['a', 'b', 'c']);
  });

  it('returns nothing for an empty graph', () => {
    expect(startRun(freshRunId(), runnerGraph(''), emptyConfig)).toEqual([]);
  });

  // Nothing has in-degree 0, so the run can never start. startRun reports that
  // as an empty ready list rather than throwing — validatePipelineGraph is what
  // prevents a cyclic definition from reaching the runner.
  it('returns nothing for a fully cyclic graph', () => {
    expect(startRun(freshRunId(), runnerGraph('a b', 'a>b b>a'), emptyConfig)).toEqual([]);
  });

  it('starts the sample pipeline at install only', () => {
    expect(startRun(freshRunId(), graphJson, configJson)).toEqual(['stage_install']);
  });
});

describe('completeStage', () => {
  it('returns null for a run it is not tracking', () => {
    expect(completeStage('never-started', 'a')).toBeNull();
  });

  it('releases a dependent once its only dependency finishes', () => {
    const runId = freshRunId();
    startRun(runId, runnerGraph('a b', 'a>b'), emptyConfig);

    expect(completeStage(runId, 'a')?.ready).toEqual(['b']);
  });

  it('fans out to every dependent at once', () => {
    const runId = freshRunId();
    startRun(runId, runnerGraph('a b c', 'a>b a>c'), emptyConfig);

    expect(completeStage(runId, 'a')?.ready.sort()).toEqual(['b', 'c']);
  });

  // The join is the case the in-degree counter exists for: d must not start
  // until both branches are done.
  it('holds a join until every parent has finished', () => {
    const runId = freshRunId();
    startRun(runId, runnerGraph('a b c d', 'a>b a>c b>d c>d'), emptyConfig);
    completeStage(runId, 'a');

    expect(completeStage(runId, 'b')?.ready).toEqual([]);
    expect(completeStage(runId, 'c')?.ready).toEqual(['d']);
  });

  it('returns an empty ready list for a terminal stage', () => {
    const runId = freshRunId();
    startRun(runId, runnerGraph('a b', 'a>b'), emptyConfig);
    completeStage(runId, 'a');

    expect(completeStage(runId, 'b')?.ready).toEqual([]);
  });

  it('hands back the run config alongside the ready stages', () => {
    const runId = freshRunId();
    startRun(runId, graphJson, configJson);

    expect(completeStage(runId, 'stage_install')?.config).toBe(configJson);
  });

  it('walks the sample pipeline through to deploy', () => {
    const runId = freshRunId();

    expect(startRun(runId, graphJson, configJson)).toEqual(['stage_install']);
    expect(completeStage(runId, 'stage_install')?.ready.sort()).toEqual(['stage_build', 'stage_test']);
    expect(completeStage(runId, 'stage_build')?.ready).toEqual([]);
    expect(completeStage(runId, 'stage_test')?.ready).toEqual(['stage_approve']);
    expect(completeStage(runId, 'stage_approve')?.ready).toEqual(['stage_deploy']);
  });
});

describe('run isolation', () => {
  // State is per-run precisely so two runs of the same pipeline cannot decrement
  // each other's counters.
  it('keeps two concurrent runs of the same graph independent', () => {
    const first = freshRunId();
    const second = freshRunId();
    const definition = runnerGraph('a b c', 'a>c b>c');

    startRun(first, definition, emptyConfig);
    startRun(second, definition, emptyConfig);

    // Completing both parents in the first run must not release c in the second.
    completeStage(first, 'a');
    expect(completeStage(first, 'b')?.ready).toEqual(['c']);
    expect(completeStage(second, 'a')?.ready).toEqual([]);
  });

  it('does not let a second startRun for the same id inherit the old progress', () => {
    const runId = freshRunId();
    startRun(runId, runnerGraph('a b', 'a>b'), emptyConfig);
    completeStage(runId, 'a');

    expect(startRun(runId, runnerGraph('a b', 'a>b'), emptyConfig)).toEqual(['a']);
    expect(completeStage(runId, 'a')?.ready).toEqual(['b']);
  });
});

describe('state eviction', () => {
  it('forgets a run once every stage has completed', () => {
    const runId = freshRunId();
    startRun(runId, runnerGraph('a b', 'a>b'), emptyConfig);
    completeStage(runId, 'a');
    completeStage(runId, 'b');

    expect(completeStage(runId, 'b')).toBeNull();
  });

  // TODO(bug): eviction counts completions rather than tracking which stages
  // completed, so replaying one stage discards a run that still has work left.
  // The worker's 'completed' handler is the only caller today, so this is not
  // currently reachable — pinned to catch it if that changes.
  it('evicts a run early when one stage is completed twice', () => {
    const runId = freshRunId();
    startRun(runId, runnerGraph('a b c', 'a>b b>c'), emptyConfig);

    completeStage(runId, 'a');
    completeStage(runId, 'a');
    completeStage(runId, 'a');

    expect(completeStage(runId, 'b')).toBeNull();
  });

  // A single-stage run completes on its first callback, so the state has to be
  // gone immediately rather than after a second one.
  it('forgets a one-stage run after its only completion', () => {
    const runId = freshRunId();
    startRun(runId, runnerGraph('a'), emptyConfig);

    expect(completeStage(runId, 'a')?.ready).toEqual([]);
    expect(completeStage(runId, 'a')).toBeNull();
  });
});

describe('failRun', () => {
  it('reports true when it discarded a tracked run', () => {
    const runId = freshRunId();
    startRun(runId, runnerGraph('a b', 'a>b'), emptyConfig);

    expect(failRun(runId)).toBe(true);
  });

  it('reports false for a run it was not tracking', () => {
    expect(failRun('never-started')).toBe(false);
  });

  it('reports false the second time, so a retry cannot double-clear', () => {
    const runId = freshRunId();
    startRun(runId, runnerGraph('a'), emptyConfig);

    expect(failRun(runId)).toBe(true);
    expect(failRun(runId)).toBe(false);
  });

  it('stops tracking the run, so later completions return null', () => {
    const runId = freshRunId();
    startRun(runId, runnerGraph('a b', 'a>b'), emptyConfig);
    failRun(runId);

    expect(completeStage(runId, 'a')).toBeNull();
  });

  it('leaves a sibling run untouched', () => {
    const doomed = freshRunId();
    const healthy = freshRunId();
    startRun(doomed, runnerGraph('a b', 'a>b'), emptyConfig);
    startRun(healthy, runnerGraph('a b', 'a>b'), emptyConfig);

    failRun(doomed);

    expect(completeStage(healthy, 'a')?.ready).toEqual(['b']);
  });
});
