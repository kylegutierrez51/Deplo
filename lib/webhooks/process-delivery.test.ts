jest.mock('@/lib/prisma');
jest.mock('@/lib/data/pipelines', () => ({ getLatestDefinition: jest.fn() }));
// An explicit factory: run-trigger reaches lib/queue/runs, which constructs a BullMQ Queue
jest.mock('@/lib/actions/run-trigger', () => ({
  createPipelineRun: jest.fn(),
  enqueueOrDiscardRun: jest.fn(),
  verifyPipelineRunReady: jest.fn(),
}));

import { getLatestDefinition } from '@/lib/data/pipelines';
import { createPipelineRun, enqueueOrDiscardRun, verifyPipelineRunReady } from '@/lib/actions/run-trigger';
import { processDelivery, DeliveryWebhook } from './process-delivery';

const getDefinition = getLatestDefinition as jest.Mock;
const createRun = createPipelineRun as jest.Mock;
const enqueue = enqueueOrDiscardRun as jest.Mock;
const verifyReady = verifyPipelineRunReady as jest.Mock;

const SHA = 'a'.repeat(40);
const triggeredBy = { id: null, name: 'GitHub' };

const webhook: DeliveryWebhook = {
  events: ['push', 'pull-request'],
  branchFilters: ['main'],
  pipelineId: 'p1',
  environmentId: null,
};

const pushPayload = { ref: 'refs/heads/main', after: SHA };

const prPayload = (overrides: Record<string, unknown> = {}) => ({
  action: 'opened',
  pull_request: {
    base: { ref: 'main' },
    head: { sha: SHA, ref: 'feature/x', repo: { full_name: 'o/r' } },
  },
  repository: { full_name: 'o/r' },
  ...overrides,
});

beforeEach(() => {
  getDefinition.mockReset().mockResolvedValue({ id: 'd1', graphJson: {}, configJson: {} });
  verifyReady.mockReset().mockResolvedValue({ status: 'success' });
  createRun.mockReset().mockResolvedValue({ id: 'run-1', name: 'CI', runNumber: 4 });
  enqueue.mockReset().mockResolvedValue(true);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('processDelivery', () => {
  it('answers a ping', async () => {
    expect(await processDelivery(webhook, 'ping', {}, triggeredBy)).toEqual({
      status: 'processed', reason: 'Ping received: GitHub can reach this webhook.', httpStatus: 200,
    });
  });

  it('ignores a push when the webhook is not subscribed to push', async () => {
    const result = await processDelivery({ ...webhook, events: ['pull-request'] }, 'push', pushPayload, triggeredBy);
    expect(result).toEqual({ status: 'ignored', reason: 'This webhook is not subscribed to push events.', httpStatus: 200 });
  });

  it('ignores a tag push', async () => {
    const result = await processDelivery(webhook, 'push', { ref: 'refs/tags/v1', after: SHA }, triggeredBy);
    expect(result).toEqual({ status: 'ignored', reason: 'Nothing to build for refs/tags/v1.', httpStatus: 200 });
  });

  it('ignores a branch deletion', async () => {
    const result = await processDelivery(webhook, 'push', { ...pushPayload, deleted: true }, triggeredBy);
    expect(result).toEqual({ status: 'ignored', reason: 'Nothing to build for refs/heads/main (deleted).', httpStatus: 200 });
  });

  it('ignores a pull request action that does not change what would be built', async () => {
    const result = await processDelivery(webhook, 'pull_request', prPayload({ action: 'closed' }), triggeredBy);
    expect(result).toEqual({ status: 'ignored', reason: 'Pull request action "closed" does not trigger a run.', httpStatus: 200 });
  });

  it('ignores a pull request from a fork', async () => {
    const payload = prPayload();
    payload.pull_request.head.repo.full_name = 'attacker/r';
    const result = await processDelivery(webhook, 'pull_request', payload, triggeredBy);
    expect(result).toEqual({
      status: 'ignored',
      reason: "Pull requests from forks are not built: they would run untrusted code with this environment's secrets.",
      httpStatus: 200,
    });
  });

  it('ignores a branch the filters do not match', async () => {
    const result = await processDelivery(webhook, 'push', { ref: 'refs/heads/dev', after: SHA }, triggeredBy);
    expect(result).toEqual({ status: 'ignored', reason: 'Branch "dev" does not match the branch filters (main).', httpStatus: 200 });
  });

  it('ignores a delivery for a webhook with no pipeline', async () => {
    const result = await processDelivery({ ...webhook, pipelineId: null }, 'push', pushPayload, triggeredBy);
    expect(result).toEqual({ status: 'ignored', reason: 'This webhook has no pipeline to run.', httpStatus: 422 });
  });

  it('fails when the pipeline has no saved definition', async () => {
    getDefinition.mockResolvedValue(null);
    const result = await processDelivery(webhook, 'push', pushPayload, triggeredBy);
    expect(result).toEqual({ status: 'failed', reason: 'The pipeline has no saved definition.', httpStatus: 422 });
    expect(createRun).not.toHaveBeenCalled();
  });

  it('fails with the validator message when the pipeline is not ready', async () => {
    verifyReady.mockResolvedValue({ status: 'error', message: 'This pipeline has no stages. Add at least one.' });
    const result = await processDelivery(webhook, 'push', pushPayload, triggeredBy);
    expect(result).toEqual({ status: 'failed', reason: 'This pipeline has no stages. Add at least one.', httpStatus: 422 });
    expect(createRun).not.toHaveBeenCalled();
  });

  it('fails with 503 when the run cannot be enqueued', async () => {
    enqueue.mockResolvedValue(false);
    const result = await processDelivery(webhook, 'push', pushPayload, triggeredBy);
    expect(result).toEqual({
      status: 'failed', reason: 'Could not reach the job queue, so the run was not started.', httpStatus: 503,
    });
  });

  it('starts a run for a push to a matching branch', async () => {
    const user = { id: 'u1', name: 'Kyle' };
    const result = await processDelivery(webhook, 'push', pushPayload, user);
    expect(result).toEqual({ status: 'processed', reason: 'Started CI #4.', httpStatus: 200, runId: 'run-1' });
    expect(createRun).toHaveBeenCalledWith({
      pipelineId: 'p1',
      environmentId: null,
      definitionId: 'd1',
      user,
      trigger: 'webhook',
      commitSha: SHA,
      branch: 'main',
    });
    expect(enqueue).toHaveBeenCalledWith('run-1');
  });

  it('starts a run for a same-repo pull request', async () => {
    const result = await processDelivery(webhook, 'pull_request', prPayload(), triggeredBy);
    expect(result).toMatchObject({ status: 'processed', runId: 'run-1' });
    expect(createRun).toHaveBeenCalledWith(expect.objectContaining({ commitSha: SHA, branch: 'feature/x' }));
  });

  it('ignores an event it does not handle', async () => {
    expect(await processDelivery(webhook, 'issues', {}, triggeredBy)).toEqual({
      status: 'ignored', reason: 'Deplo does not handle "issues" events.', httpStatus: 200,
    });
  });

  it('reports a missing event header as unknown', async () => {
    expect(await processDelivery(webhook, null, {}, triggeredBy)).toEqual({
      status: 'ignored', reason: 'Deplo does not handle "unknown" events.', httpStatus: 200,
    });
  });
});
