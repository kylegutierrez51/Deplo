import { revalidatePath } from 'next/cache';
import { prismaError } from '@/test/helpers/prisma-errors';
import { addWebhook, updateWebhook, deleteWebhook, regenerateWebhookSecret } from '@/lib/actions/webhooks';
import { decryptSecret } from '@/lib/utils/crypto';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';
import { setSession } from '@/test/mocks/auth';

jest.mock('@/lib/prisma');
jest.mock('@/auth');
jest.mock('next/cache', () => ({ revalidatePath: jest.fn(), revalidateTag: jest.fn() }));

const revalidate = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

const idle = { status: 'idle' as const, message: '' };

const form = (over: Record<string, string> = {}) => {
  const fd = new FormData();
  fd.set('pipeline_id', 'p1');
  fd.set('webhook_secret', 'whsec_abc123');
  Object.entries(over).forEach(([k, v]) => fd.set(k, v));
  fd.append('branch_filters', 'main');
  fd.append('events', 'push');
  return fd;
};

const writtenData = (fn: { mock: { calls: unknown[][] } }) =>
  (fn.mock.calls[0][0] as { data: Record<string, string | string[]> }).data;

beforeEach(() => {
  resetPrismaMock();
  revalidate.mockClear();
  setSession();
  jest.spyOn(console, 'log').mockImplementation(() => { });
});

afterEach(() => { jest.restoreAllMocks(); });

describe('addWebhook', () => {
  it('encrypts the signing secret before storing it', async () => {
    await addWebhook(idle, form({ webhook_secret: 'whsec_plain' }));
    const data = writtenData(prismaMock.webhook.create);

    expect(JSON.stringify(data)).not.toContain('whsec_plain');
    expect(decryptSecret({
      encryptedValue: data.encryptedValue as string,
      iv: data.iv as string,
      authTag: data.authTag as string,
    })).toBe('whsec_plain');
  });

  it('collects multi-valued branch filters and events', async () => {
    const fd = form();
    fd.append('branch_filters', 'develop');
    fd.append('events', 'pull_request');

    await addWebhook(idle, fd);

    expect(writtenData(prismaMock.webhook.create)).toMatchObject({
      branchFilters: ['main', 'develop'],
      events: ['push', 'pull_request'],
    });
  });

  it('revalidates on success', async () => {
    const result = await addWebhook(idle, form());

    expect(result).toEqual({ status: 'success', message: 'Webhook added' });
    expect(revalidate).toHaveBeenCalledWith('/webhooks');
  });

  // The pipeline was deleted between the form rendering and the submit.
  it('names the missing pipeline on a foreign key failure', async () => {
    prismaMock.webhook.create.mockRejectedValue(prismaError('P2003') as never);

    const result = await addWebhook(idle, form());

    expect(result).toEqual({ status: 'error', message: 'Selected pipeline no longer exists.' });
  });

  it('falls back to a generic message for anything else', async () => {
    prismaMock.webhook.create.mockRejectedValue(new Error('network') as never);

    const result = await addWebhook(idle, form());

    expect(result).toEqual({ status: 'error', message: 'Error adding webhook. Please try again.' });
  });
});

describe('updateWebhook', () => {
  // Rotation is deliberately a separate action, so editing metadata must never
  // re-sign or discard the stored secret.
  it('leaves the stored secret untouched', async () => {
    await updateWebhook(idle, form({ id: 'wh-1' }));
    const data = writtenData(prismaMock.webhook.update);

    expect(data).not.toHaveProperty('encryptedValue');
    expect(data).not.toHaveProperty('iv');
    expect(data).not.toHaveProperty('authTag');
  });

  it('updates only the metadata, by id', async () => {
    await updateWebhook(idle, form({ id: 'wh-1', pipeline_id: 'p2' }));

    expect(prismaMock.webhook.update).toHaveBeenCalledWith({
      where: { id: 'wh-1' },
      data: { pipelineId: 'p2', branchFilters: ['main'], events: ['push'] },
    });
  });

  it('names the missing pipeline on a foreign key failure', async () => {
    prismaMock.webhook.update.mockRejectedValue(prismaError('P2003') as never);

    const result = await updateWebhook(idle, form({ id: 'wh-1' }));

    expect(result).toEqual({ status: 'error', message: 'Selected pipeline no longer exists.' });
  });

  it('reports a webhook deleted from under the edit', async () => {
    prismaMock.webhook.update.mockRejectedValue(prismaError('P2025') as never);

    const result = await updateWebhook(idle, form({ id: 'wh-1' }));

    expect(result).toEqual({ status: 'error', message: 'This webhook no longer exists.' });
  });

  it('falls back to a generic message for anything else', async () => {
    prismaMock.webhook.update.mockRejectedValue(new Error('network') as never);

    const result = await updateWebhook(idle, form({ id: 'wh-1' }));

    expect(result).toEqual({ status: 'error', message: 'Error updating webhook. Please try again.' });
  });
});

describe('regenerateWebhookSecret', () => {
  // The plaintext is shown to the user exactly once, so it has to come back out
  // of the action — it can never be recovered from the row afterwards.
  it('returns the new plaintext secret once', async () => {
    const result = await regenerateWebhookSecret('wh-1');

    expect(result.status).toBe('success');
    expect(result.secret).toMatch(/^whsec_[0-9a-f]{64}$/);
  });

  it('stores the encrypted form of exactly the secret it returned', async () => {
    const result = await regenerateWebhookSecret('wh-1');
    const data = writtenData(prismaMock.webhook.update);

    expect(decryptSecret({
      encryptedValue: data.encryptedValue as string,
      iv: data.iv as string,
      authTag: data.authTag as string,
    })).toBe(result.secret);
  });

  it('rotates only the secret columns', async () => {
    await regenerateWebhookSecret('wh-1');

    expect(prismaMock.webhook.update).toHaveBeenCalledWith({
      where: { id: 'wh-1' },
      data: {
        encryptedValue: expect.any(String), iv: expect.any(String), authTag: expect.any(String),
      },
    });
  });

  it('produces a different secret every time', async () => {
    const first = await regenerateWebhookSecret('wh-1');
    const second = await regenerateWebhookSecret('wh-1');

    expect(first.secret).not.toBe(second.secret);
  });

  it('reports a deleted webhook rather than a generic failure', async () => {
    prismaMock.webhook.update.mockRejectedValue(prismaError('P2025') as never);

    const result = await regenerateWebhookSecret('wh-1');

    expect(result).toEqual({ status: 'error', message: 'This webhook no longer exists.' });
  });

  it('falls back to the generic message for an unrecognised error', async () => {
    prismaMock.webhook.update.mockRejectedValue(new Error('network') as never);

    const result = await regenerateWebhookSecret('wh-1');

    expect(result).toEqual({ status: 'error', message: 'Error regenerating webhook. Please try again.' });
  });

  it('does not leak a secret alongside an error', async () => {
    prismaMock.webhook.update.mockRejectedValue(prismaError('P2025') as never);

    const result = await regenerateWebhookSecret('wh-1');

    expect(result.secret).toBeUndefined();
  });
});

describe('deleteWebhook', () => {
  it('deletes and revalidates', async () => {
    prismaMock.webhook.delete.mockResolvedValue({ id: 'wh-1' } as never);

    const result = await deleteWebhook('wh-1');

    expect(result.status).toBe('success');
    expect(revalidate).toHaveBeenCalledWith('/webhooks');
  });

  it('reports the row being already gone rather than a generic failure', async () => {
    prismaMock.webhook.delete.mockRejectedValue(prismaError('P2025') as never);

    const result = await deleteWebhook('wh-1');

    expect(result).toEqual({ status: 'error', message: 'This webhook no longer exists.' });
  });

  it('returns the generic message for an unrecognised error', async () => {
    prismaMock.webhook.delete.mockRejectedValue(new Error('network') as never);

    const result = await deleteWebhook('wh-1');

    expect(result).toEqual({ status: 'error', message: 'Error deleting webhook. Please try again.' });
  });
});
