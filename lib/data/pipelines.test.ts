import { getPipelines, getPipelineById, getPipelineDefinition } from '@/lib/data/pipelines';
import { toDefinition } from '@/lib/pipeline/definition';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';
import type { CustomNode } from '@/lib/types';

jest.mock('@/lib/prisma');

beforeEach(resetPrismaMock);

const run = (status: string, finishedAt: Date | null = new Date('2026-01-02T00:00:00Z')) => ({
  id: 'r1', status, finishedAt,
});

const row = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  name: 'CI',
  repoUrl: 'https://github.com/o/r',
  description: null,
  branchFilters: ['main'],
  createdById: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  runs: [],
  _count: { runs: 0 },
  ...over,
});

describe('getPipelines status', () => {
  it.each([
    ['QUEUED', 'queued'],
    ['RUNNING', 'running'],
    ['SUCCEEDED', 'succeeded'],
    ['FAILED', 'failed'],
    ['CANCELLED', 'cancelled'],
  ])('reports the latest run status %s as %s', async (prismaStatus, expected) => {
    prismaMock.pipeline.findMany.mockResolvedValue([row({ runs: [run(prismaStatus)] })] as never);

    const [pipeline] = await getPipelines();

    expect(pipeline.status).toBe(expected);
  });

  // 'idle' is a PipelineStatus with no Prisma counterpart — it is the fallback
  // for a pipeline that has never run, not a mapped enum member.
  it('reports a pipeline that has never run as idle', async () => {
    prismaMock.pipeline.findMany.mockResolvedValue([row()] as never);

    const [pipeline] = await getPipelines();

    expect(pipeline.status).toBe('idle');
    expect(pipeline.lastRun).toBeNull();
  });

  it('takes only the newest run to decide status', async () => {
    prismaMock.pipeline.findMany.mockResolvedValue([] as never);

    await getPipelines();

    expect(prismaMock.pipeline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          runs: { orderBy: { createdAt: 'desc' }, take: 1 },
        }),
      }),
    );
  });

  // An in-flight run has no finishedAt yet, so lastRun is legitimately null even
  // though the pipeline is not idle.
  it('leaves lastRun null for a run still in flight', async () => {
    prismaMock.pipeline.findMany.mockResolvedValue([row({ runs: [run('RUNNING', null)] })] as never);

    const [pipeline] = await getPipelines();

    expect(pipeline.status).toBe('running');
    expect(pipeline.lastRun).toBeNull();
  });

  it('surfaces the run count and drops the raw relation', async () => {
    prismaMock.pipeline.findMany.mockResolvedValue([
      row({ runs: [run('SUCCEEDED')], _count: { runs: 12 } }),
    ] as never);

    const [pipeline] = await getPipelines();

    expect(pipeline.runCount).toBe(12);
    expect(pipeline).not.toHaveProperty('runs');
    expect(pipeline).not.toHaveProperty('_count');
  });
});

describe('getPipelineById', () => {
  it('returns null for an id that does not exist', async () => {
    prismaMock.pipeline.findUnique.mockResolvedValue(null as never);

    await expect(getPipelineById('nope')).resolves.toBeNull();
  });

  it('applies the same idle fallback as the list', async () => {
    prismaMock.pipeline.findUnique.mockResolvedValue(row({ createdBy: null }) as never);

    expect((await getPipelineById('p1'))?.status).toBe('idle');
  });

  it('flattens the creator to a name', async () => {
    prismaMock.pipeline.findUnique.mockResolvedValue(
      row({ createdBy: { name: 'kyle' }, runs: [run('SUCCEEDED')] }) as never,
    );

    expect((await getPipelineById('p1'))?.createdBy).toBe('kyle');
  });
});

describe('getPipelineDefinition', () => {
  // A pipeline always gets a version 0 on creation, but a definition can be
  // swept away, so the editor has to cope with finding nothing.
  it('returns an empty graph when the pipeline has no definition', async () => {
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue(null as never);

    await expect(getPipelineDefinition('p1')).resolves.toEqual({ nodes: [], edges: [] });
  });

  it('reads the highest version, not the newest row', async () => {
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue(null as never);

    await getPipelineDefinition('p1');

    expect(prismaMock.pipelineDefinition.findFirst).toHaveBeenCalledWith({
      where: { pipelineId: 'p1' },
      orderBy: { version: 'desc' },
    });
  });

  it('rehydrates the stored definition into editor nodes', async () => {
    const nodes: CustomNode[] = [
      { id: 'a', position: { x: 5, y: 6 }, data: { type: 'custom', name: 'build', command: 'npm run build' } },
    ];
    const { graphJson, configJson } = toDefinition(nodes, []);
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue({ graphJson, configJson } as never);

    const definition = await getPipelineDefinition('p1');

    expect(definition.nodes[0]).toMatchObject({
      id: 'a',
      type: 'standardStage',
      position: { x: 5, y: 6 },
      data: { type: 'custom', name: 'build', command: 'npm run build' },
    });
  });

  // A definition written before the current shape is still readable rather than
  // crashing the editor.
  it('survives a definition holding malformed json', async () => {
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue(
      { graphJson: 'not an object', configJson: null } as never,
    );

    await expect(getPipelineDefinition('p1')).resolves.toEqual({ nodes: [], edges: [] });
  });
});
