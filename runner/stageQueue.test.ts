import { Queue } from 'bullmq';
import { enqueueStageJob, reclaimStageJob } from './stageQueue';

/*
 * bullmq is mocked at the module boundary rather than through a fake Redis: the file
 * constructs a Queue at module scope, and importing the real package pulls in msgpackr,
 * which is ESM far enough down that the suite does not parse at all.
 *
 * The assertions below are about the two things a mock cannot paper over — the job id, which
 * is the whole dedupe contract, and the lock key, which is a string this file has to build
 * identically to the one BullMQ's own removeJob script builds internally.
 */
const remove = jest.fn<Promise<number>, [string]>();
const add = jest.fn();
const del = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: (...args: unknown[]) => add(...args),
    remove: (jobId: string) => remove(jobId),
    client: Promise.resolve({ del: (key: string) => del(key) }),
    // Mirrors QueueBase.toKey: the queue's prefix and name, then the id.
    toKey: (id: string) => `bull:pipeline-stages:${id}`,
  })),
}));

const stage = { runId: 'run-1', stageId: 'build', attempt: 2 };

/*
 * Captured here rather than inside a test: stageQueue.ts constructs its Queue exactly once,
 * at module scope, during this file's own top-level import above — before any test body or
 * beforeEach hook runs. beforeEach's jest.clearAllMocks() wipes Queue.mock.calls before the
 * first test executes, so reading it from inside a test sees nothing.
 */
const stageQueueConstructorArgs = (Queue as unknown as jest.Mock).mock.calls[0];

beforeEach(() => {
  jest.clearAllMocks();
  remove.mockResolvedValue(1);
});

/*
 * The queue is constructed once, at module scope, when this file's own top-level import of
 * stageQueue.ts first runs — before any test body executes and before jest.clearAllMocks()
 * in beforeEach can touch it. So this is the constructor call every test in the file shares,
 * not one a particular test triggers.
 */
describe('the stage queue connection', () => {
  /*
   * The regression this pins: claimStageForQueue's Postgres CAS (PENDING -> QUEUED) commits
   * before enqueueStageJob ever reaches Redis, and nothing rolls it back if that second write
   * fails. BullMQ only defaults maxRetriesPerRequest to null on a Worker's own dedicated
   * blocking connection, never on a plain Queue — so left at ioredis's real default of 20, a
   * Redis outage of a few minutes was enough to exhaust it, and the resulting
   * MaxRetriesPerRequestError left a stage QUEUED with no job behind it and no path back,
   * since readyStages only ever reconsiders a PENDING row. runner/connection.ts sets it
   * explicitly so the command buffers and is sent once Redis reconnects, instead of giving up.
   */
  it('disables maxRetriesPerRequest so a Redis outage buffers instead of failing the claim', () => {
    expect(stageQueueConstructorArgs[1]).toEqual(expect.objectContaining({
      connection: expect.objectContaining({ maxRetriesPerRequest: null }),
    }));
  });
});

describe('enqueueStageJob', () => {
  /*
   * The id is the dedupe contract: BullMQ returns the existing job rather than enqueuing
   * when an id is already in the keyspace, which is what makes a redelivered run job
   * harmless. Dropping `attempt` from it would make a retry collide with the attempt it is
   * retrying and silently enqueue nothing.
   */
  it('derives the job id from run, stage and attempt', async () => {
    await enqueueStageJob(stage);

    expect(add.mock.calls[0][2]).toEqual(expect.objectContaining({ jobId: 'run-1-build-2' }));
  });

  // attempts: 1 because retries are ours — a new row per attempt, not a BullMQ re-execution.
  it('leaves BullMQ no retries of its own', async () => {
    await enqueueStageJob(stage);

    expect(add.mock.calls[0][2]).toEqual(expect.objectContaining({ attempts: 1 }));
  });

  it.each([
    ['defaults to no delay', undefined, 0],
    ['passes a retry delay through', 5_000, 5_000],
  ])('%s', async (_label, given, expected) => {
    await enqueueStageJob(stage, given);

    expect(add.mock.calls[0][2]).toEqual(expect.objectContaining({ delay: expected }));
  });
});

describe('reclaimStageJob', () => {
  // Queue.remove reports 1 both for a job it removed and for one that was never there —
  // the two recoverable windows — so the common path must not touch the lock at all.
  it('does not break any lock when the job comes away cleanly', async () => {
    remove.mockResolvedValue(1);

    expect(await reclaimStageJob(stage)).toBe(true);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(del).not.toHaveBeenCalled();
  });

  /*
   * The locked case. A 0 means a worker holds the job, and at boot that worker is the dead
   * one — its lock is a key with a 30s TTL that outlived it. Deleting the orphan and
   * retrying is what turns this from a stage we give up on into one that runs.
   */
  it('breaks a dead process lock and removes the job on the second try', async () => {
    remove.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    expect(await reclaimStageJob(stage)).toBe(true);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledTimes(1);
  });

  /*
   * The lock key has to be the exact string BullMQ's removeJob script builds for itself —
   * `<job key>:lock`, from toKey(jobId). Deleting a near-miss would delete nothing, the
   * second remove would fail the same way as the first, and the stage would be given up on
   * with the recovery having silently done nothing.
   */
  it('deletes the lock at the key BullMQ derives from the job id', async () => {
    remove.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    await reclaimStageJob(stage);

    expect(del).toHaveBeenCalledWith('bull:pipeline-stages:run-1-build-2:lock');
  });

  it('removes by the same id it would enqueue under', async () => {
    await reclaimStageJob(stage);

    expect(remove).toHaveBeenCalledWith('run-1-build-2');
  });

  // Still locked after the orphan was deleted means something outside this process's model
  // holds it. The caller fails the row rather than resetting it, so reporting the loss
  // honestly is what keeps a hung run from being reported as recovered.
  it('reports failure when the job is still locked after the break', async () => {
    remove.mockResolvedValue(0);

    expect(await reclaimStageJob(stage)).toBe(false);
    expect(del).toHaveBeenCalledTimes(1);
  });
});
