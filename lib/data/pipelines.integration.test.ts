import prisma from '@/lib/prisma';
import { getPipelines } from '@/lib/data/pipelines';
import { createPipelineRun, enqueueOrDiscardRun } from '@/lib/actions/run-trigger';
import { enqueuePipelineRun } from '@/lib/queue/runs';
import { parseFilters } from '@/lib/filters/parse';
import { PIPELINE_FILTERS } from '@/lib/filters/options';
import { makeDefinition, makePipeline, makeRun, makeUser } from '@/test/integration/factories';

// bullmq opens an ioredis socket at module scope; only enqueuePipelineRun is reached here.
jest.mock('@/lib/queue/runs', () => ({ enqueuePipelineRun: jest.fn() }));

const enqueue = enqueuePipelineRun as jest.MockedFunction<typeof enqueuePipelineRun>;

/*
 * Pipeline.lastRunId is what the pipelines list filters "Recent Status" through, so it has
 * to name the newest run by runNumber no matter how runs arrive or leave. The unit tier can
 * only pin the statements; whether the row lock and the forward-only guard actually hold,
 * and whether ON DELETE SET NULL fires, is only visible against Postgres.
 */

const setup = async () => {
  const user = await makeUser();
  const pipeline = await makePipeline();
  const definition = await makeDefinition(pipeline.id, 0);
  return { user, pipeline, definition };
};

const pointer = async (pipelineId: string) =>
  (await prisma.pipeline.findUniqueOrThrow({ where: { id: pipelineId } })).lastRunId;

const statusFilter = (status: string) => parseFilters({ status }, PIPELINE_FILTERS);

beforeEach(() => enqueue.mockReset());

describe('the lastRun pointer', () => {
  it('starts null and follows each new run', async () => {
    const { user, pipeline, definition } = await setup();
    expect(await pointer(pipeline.id)).toBeNull();

    await makeRun(pipeline.id, definition.id, user.id);
    const second = await makeRun(pipeline.id, definition.id, user.id);

    expect(await pointer(pipeline.id)).toBe(second.id);
  });

  it('ends on the highest run number when triggers race', async () => {
    const { user, pipeline, definition } = await setup();

    const trigger = () => createPipelineRun({
      pipelineId: pipeline.id, definitionId: definition.id, environmentId: null, trigger: 'manual',
      user: { id: user.id, name: null },
    });
    const runs = await Promise.all([trigger(), trigger(), trigger()]);

    const newest = runs.reduce((a, b) => (a.runNumber > b.runNumber ? a : b));
    expect(await pointer(pipeline.id)).toBe(newest.id);
  });

  it('falls back to the previous run when the newest is discarded', async () => {
    const { user, pipeline, definition } = await setup();
    const first = await makeRun(pipeline.id, definition.id, user.id);
    const second = await makeRun(pipeline.id, definition.id, user.id);

    enqueue.mockRejectedValue(new Error('ECONNREFUSED'));
    await enqueueOrDiscardRun(second.id);

    expect(await pointer(pipeline.id)).toBe(first.id);
  });

  it('goes back to idle when the only run is discarded', async () => {
    const { user, pipeline, definition } = await setup();
    const only = await makeRun(pipeline.id, definition.id, user.id);

    enqueue.mockRejectedValue(new Error('ECONNREFUSED'));
    await enqueueOrDiscardRun(only.id);

    expect(await pointer(pipeline.id)).toBeNull();
  });
});

describe('filtering pipelines on recent status', () => {
  it('matches on the latest run only, and treats a pipeline with no runs as idle', async () => {
    const { user, pipeline, definition } = await setup();
    const idle = await makePipeline();

    const older = await makeRun(pipeline.id, definition.id, user.id);
    await prisma.pipelineRun.update({ where: { id: older.id }, data: { status: 'FAILED' } });
    await makeRun(pipeline.id, definition.id, user.id); // newest, still QUEUED

    expect((await getPipelines(statusFilter('queued'))).map((p) => p.id)).toEqual([pipeline.id]);
    expect(await getPipelines(statusFilter('failed'))).toEqual([]);
    expect((await getPipelines(statusFilter('idle'))).map((p) => p.id)).toEqual([idle.id]);
  });

  it('follows the latest run as its status changes, with no write to the pipeline', async () => {
    const { user, pipeline, definition } = await setup();
    const run = await makeRun(pipeline.id, definition.id, user.id);

    await prisma.pipelineRun.update({ where: { id: run.id }, data: { status: 'SUCCEEDED' } });

    expect((await getPipelines(statusFilter('succeeded'))).map((p) => p.id)).toEqual([pipeline.id]);
  });
});
