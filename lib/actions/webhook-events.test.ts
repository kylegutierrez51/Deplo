import { revalidatePath } from 'next/cache';
import { replayWebhookEvent } from '@/lib/actions/webhook-events';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';
import { setSession, signedOut, sessionWithoutUserId } from '@/test/mocks/auth';
import { processDelivery } from '@/lib/webhooks/process-delivery';
import { addWebhookEvent, updateWebhookEvent } from '@/lib/webhooks/webhook-events';

jest.mock('@/lib/prisma');
jest.mock('@/auth');
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));
jest.mock('@/lib/webhooks/process-delivery', () => ({ processDelivery: jest.fn() }));
jest.mock('@/lib/webhooks/webhook-events', () => ({
  addWebhookEvent: jest.fn(),
  updateWebhookEvent: jest.fn(),
}));

const revalidate = revalidatePath as jest.MockedFunction<typeof revalidatePath>;
const deliver = processDelivery as jest.MockedFunction<typeof processDelivery>;
const add = addWebhookEvent as jest.MockedFunction<typeof addWebhookEvent>;
const update = updateWebhookEvent as jest.MockedFunction<typeof updateWebhookEvent>;

const payload = { ref: 'refs/heads/dev' };
const headers = { 'x-github-event': 'push' };

const storedEvent = (over: Record<string, unknown> = {}) => ({
  status: 'PROCESSED',
  eventType: 'PUSH',
  payload,
  headers,
  webhook: {
    id: 'wh-1',
    isActive: true,
    events: ['PUSH', 'PULL_REQUEST'],
    branchFilters: ['main'],
    pipelineId: 'pipe-current',
    environmentId: 'env-1',
  },
  ...over,
});

const find = () => prismaMock.webhookEvent.findUnique;

beforeEach(() => {
  resetPrismaMock();
  revalidate.mockClear();
  deliver.mockReset();
  add.mockReset();
  update.mockReset();
  setSession();
  add.mockResolvedValue({ status: 'success', message: 'ok', webhookEventId: 'evt-new' });
  update.mockResolvedValue({ status: 'success', message: 'ok' });
});

describe('replayWebhookEvent', () => {
  it('asks a signed-out caller to sign in and reads nothing', async () => {
    signedOut();
    expect(await replayWebhookEvent('evt-1')).toEqual({ status: 'error', message: 'Sign in to replay a webhook event.' });
    expect(find()).not.toHaveBeenCalled();
  });

  it('treats a session without a user id as signed out', async () => {
    sessionWithoutUserId();
    expect(await replayWebhookEvent('evt-1')).toEqual({ status: 'error', message: 'Sign in to replay a webhook event.' });
    expect(find()).not.toHaveBeenCalled();
  });

  it('reports an unknown event', async () => {
    find().mockResolvedValue(null as never);
    expect(await replayWebhookEvent('evt-1')).toEqual({ status: 'error', message: 'This webhook event no longer exists.' });
    expect(add).not.toHaveBeenCalled();
  });

  it('returns the blocker message and writes nothing when the event cannot be replayed', async () => {
    find().mockResolvedValue(storedEvent({ payload: null }) as never);
    expect(await replayWebhookEvent('evt-1')).toEqual({
      status: 'error',
      message: 'This event was ignored, so its payload was not kept and it cannot be replayed.',
    });
    expect(add).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
  });

  it('blocks an old event with no webhook rather than crashing', async () => {
    find().mockResolvedValue(storedEvent({ webhook: null }) as never);
    expect(await replayWebhookEvent('evt-1')).toEqual({
      status: 'error',
      message: 'The webhook this event arrived on no longer exists.',
    });
    expect(add).not.toHaveBeenCalled();
  });

  it('replays through the current webhook as the signed-in user', async () => {
    find().mockResolvedValue(storedEvent() as never);
    deliver.mockResolvedValue({ status: 'processed', reason: 'Started CI #4.', httpStatus: 200, runId: 'run-1' });

    const result = await replayWebhookEvent('evt-1');

    expect(add).toHaveBeenCalledWith(
      { eventType: 'push', payload, headers, webhookId: 'wh-1', pipelineId: 'pipe-current' },
      { replayedBy: { id: 'user-1', name: 'kyle' } },
    );
    expect(deliver).toHaveBeenCalledWith(
      {
        events: ['push', 'pull-request'],
        branchFilters: ['main'],
        pipelineId: 'pipe-current',
        environmentId: 'env-1',
      },
      'push',
      payload,
      { id: 'user-1', name: 'kyle' },
    );
    expect(update).toHaveBeenCalledWith('evt-new', 'processed', { reason: 'Started CI #4.', runId: 'run-1' });
    expect(revalidate).toHaveBeenCalledWith('/webhooks/events');
    expect(result).toEqual({
      status: 'success',
      message: 'Replayed: Started CI #4.',
      webhookEventId: 'evt-new',
      runId: 'run-1',
      eventStatus: 'processed',
    });
  });

  it('replays a pull request event as pull_request', async () => {
    find().mockResolvedValue(storedEvent({ eventType: 'PULL_REQUEST' }) as never);
    deliver.mockResolvedValue({ status: 'processed', reason: 'Started CI #5.', httpStatus: 200, runId: 'run-2' });

    await replayWebhookEvent('evt-1');

    expect(add).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'pull-request' }), expect.anything());
    expect(deliver).toHaveBeenCalledWith(expect.anything(), 'pull_request', payload, expect.anything());
  });

  it('reports an ignored outcome as success', async () => {
    find().mockResolvedValue(storedEvent() as never);
    deliver.mockResolvedValue({
      status: 'ignored',
      reason: 'Branch "dev" does not match the branch filters (main).',
      httpStatus: 200,
    });

    const result = await replayWebhookEvent('evt-1');

    expect(update).toHaveBeenCalledWith('evt-new', 'ignored', {
      reason: 'Branch "dev" does not match the branch filters (main).',
      runId: undefined,
    });
    expect(result).toMatchObject({
      status: 'success',
      message: 'Replayed: Branch "dev" does not match the branch filters (main).',
      webhookEventId: 'evt-new',
      eventStatus: 'ignored',
    });
  });

  it('reports a failed outcome as an error', async () => {
    find().mockResolvedValue(storedEvent() as never);
    deliver.mockResolvedValue({ status: 'failed', reason: 'The pipeline is not ready.', httpStatus: 422 });

    const result = await replayWebhookEvent('evt-1');

    expect(update).toHaveBeenCalledWith('evt-new', 'failed', { reason: 'The pipeline is not ready.', runId: undefined });
    expect(result).toMatchObject({ status: 'error', message: 'Replayed: The pipeline is not ready.' });
  });

  it('settles the new event as failed when processing throws', async () => {
    find().mockResolvedValue(storedEvent() as never);
    deliver.mockRejectedValue(new Error('boom'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await replayWebhookEvent('evt-1');
    spy.mockRestore();

    expect(update).toHaveBeenCalledWith('evt-new', 'failed', {
      reason: 'Could not process this replay because of an unexpected error. Check the server logs.',
    });
    expect(result.status).toBe('error');
  });

  it('returns the insert error and does not process when the new event cannot be stored', async () => {
    find().mockResolvedValue(storedEvent() as never);
    add.mockResolvedValue({ status: 'error', message: 'Could not record the event.' });

    expect(await replayWebhookEvent('evt-1')).toEqual({ status: 'error', message: 'Could not record the event.' });
    expect(deliver).not.toHaveBeenCalled();
  });
});
