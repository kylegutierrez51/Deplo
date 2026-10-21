import { Prisma } from '@/generated/prisma/client';
import { addWebhookEvent, updateWebhookEvent } from '@/lib/webhooks/webhook-events';
import { prismaError } from '@/test/helpers/prisma-errors';
import { prismaMock, resetPrismaMock, runTransactionsInline, transactionMock as makeTransactionMock } from '@/test/mocks/prisma';

jest.mock('@/lib/prisma');

beforeEach(() => {
  resetPrismaMock();
  prismaMock.webhookEvent.update.mockResolvedValue({} as never);
});

const written = () => prismaMock.webhookEvent.update.mock.calls[0][0];

describe('updateWebhookEvent', () => {
  it('records the status, the reason and the run', async () => {
    await updateWebhookEvent('evt-1', 'processed', { reason: 'Started CI #4.', runId: 'run-1' });

    expect(written()).toEqual({
      where: { id: 'evt-1' },
      data: { status: 'PROCESSED', statusReason: 'Started CI #4.', runId: 'run-1' },
    });
  });

  // Nothing ran, so there is nothing to audit or replay, and a push payload can be large.
  it('drops the stored payload when the event is ignored', async () => {
    await updateWebhookEvent('evt-1', 'ignored', { reason: 'Branch "dev" does not match the branch filters (main).' });

    expect(written().data).toEqual({
      status: 'IGNORED',
      statusReason: 'Branch "dev" does not match the branch filters (main).',
      payload: Prisma.DbNull,
    });
  });

  // A failed or processed event keeps its payload: it is what the commit columns and a
  // redelivery are read from.
  it.each(['processed', 'failed'] as const)('keeps the payload when the event is %s', async (status) => {
    await updateWebhookEvent('evt-1', status, { reason: 'x' });

    expect(written().data).not.toHaveProperty('payload');
  });

  it('writes no runId when none is given', async () => {
    await updateWebhookEvent('evt-1', 'failed', { reason: 'The pipeline has no saved definition.' });

    expect(written().data).not.toHaveProperty('runId');
  });
});

describe('addWebhookEvent', () => {
  const data = { eventType: 'push' as const, payload: { ref: 'refs/heads/main' }, headers: { event: 'push', delivery: 'd-1' }, webhookId: 'wh-1', pipelineId: 'p1' };
  let tx: ReturnType<typeof makeTransactionMock>;

  beforeEach(() => {
    tx = makeTransactionMock();
    runTransactionsInline(tx);
    tx.webhookEvent.create.mockResolvedValue({ id: 'evt-new', pipeline: { name: 'CI' } } as never);
  });

  it('links the event to its webhook and records a GitHub delivery', async () => {
    const result = await addWebhookEvent(data);

    expect(result.webhookEventId).toBe('evt-new');
    expect(tx.webhookEvent.create.mock.calls[0][0].data).toMatchObject({ webhookId: 'wh-1', pipelineId: 'p1' });
    expect(tx.webhookEvent.create.mock.calls[0][0].data).not.toHaveProperty('source');
    expect(tx.webhook.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'wh-1' } }));
    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: 'WEBHOOK_RECEIVED', actor: 'GitHub', userId: null });
  });

  it('records a replay as its own source, by the user, without touching lastDelivery', async () => {
    await addWebhookEvent(data, { replayedBy: { id: 'u1', name: 'kyle' } });

    expect(tx.webhookEvent.create.mock.calls[0][0].data).toMatchObject({ webhookId: 'wh-1', source: 'replay' });
    expect(tx.webhook.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: 'WEBHOOK_REPLAYED', actor: 'kyle', userId: 'u1' });
  });

  it('audits a replay by a user with no name as a null actor, like every other action', async () => {
    await addWebhookEvent(data, { replayedBy: { id: 'u1', name: null } });

    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: 'WEBHOOK_REPLAYED', actor: null, userId: 'u1' });
  });

  describe('a foreign key violation', () => {
    beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
    afterEach(() => jest.restoreAllMocks());

    it('names the webhook when the webhook was deleted before the insert', async () => {
      tx.webhookEvent.create.mockRejectedValue(prismaError('P2003', 'fk', { field_name: 'WebhookEvent_webhookId_fkey (index)' }));

      expect(await addWebhookEvent(data)).toEqual({ status: 'error', message: 'Webhook no longer exists.' });
    });

    it('names the pipeline when the pipeline was deleted', async () => {
      tx.webhookEvent.create.mockRejectedValue(prismaError('P2003', 'fk', { field_name: 'WebhookEvent_pipelineId_fkey (index)' }));

      expect(await addWebhookEvent(data)).toEqual({ status: 'error', message: 'Pipeline associated with webhook no longer exists.' });
    });

    it('falls back to the pipeline message when the field is not reported', async () => {
      tx.webhookEvent.create.mockRejectedValue(prismaError('P2003'));

      expect(await addWebhookEvent(data)).toEqual({ status: 'error', message: 'Pipeline associated with webhook no longer exists.' });
    });
  });
});
