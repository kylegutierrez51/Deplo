import { Prisma } from '@/generated/prisma/client';
import { updateWebhookEvent } from '@/lib/webhooks/webhook-events';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';

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
