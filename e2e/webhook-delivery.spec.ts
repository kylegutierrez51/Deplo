import { test, expect, type APIRequestContext } from '@playwright/test';
import { createHmac, randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';
import { encryptSecret } from '@/lib/utils/crypto';

/*
 * The GitHub delivery route end to end: signature check, JSON parsing, the event row,
 * the outcome, and the page that shows it. processDelivery has unit tests; only here do
 * the route, proxy.ts, Postgres and the Webhook Events page run together.
 *
 * Deliveries go through a request context with no session cookie — GitHub has none — and
 * with redirects off, so proxy.ts bouncing the request to `/` shows up as a 3xx instead of
 * being followed to a page that answers 200.
 *
 * No case reaches run creation: the E2E environment has no Redis, so an enqueue would sit
 * out its 5s timeout and fail. A pipeline with no saved definition is the last stop.
 */

const SECRET = 'whsec_e2e_delivery';
const PIPELINE_NAME = 'e2e-webhook-delivery'; // the e2e- prefix lets global-setup clear it

let github: APIRequestContext;
let pipelineId: string;
let webhookId: string;
let inactiveWebhookId: string;

const sign = (body: string, secret = SECRET) =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

const deliver = (id: string, event: string, body: string, options: { signature?: string, contentType?: string } = {}) =>
  github.post(`/api/webhook/${id}`, {
    data: body,
    maxRedirects: 0,
    headers: {
      'content-type': options.contentType ?? 'application/json',
      'x-github-event': event,
      'x-github-delivery': randomUUID(),
      'x-hub-signature-256': options.signature ?? sign(body),
    },
  });

const pushTo = (branch: string) => JSON.stringify({
  ref: `refs/heads/${branch}`,
  after: 'a'.repeat(40),
  deleted: false,
  head_commit: { message: 'e2e delivery' },
});

const latestEvent = () =>
  prisma.webhookEvent.findFirst({ where: { webhookId }, orderBy: { receivedAt: 'desc' } });

const eventCount = () => prisma.webhookEvent.count({ where: { webhookId: { in: [webhookId, inactiveWebhookId] } } });

test.beforeAll(async ({ playwright }, testInfo) => {
  // The empty storageState is required: inside a test, newContext inherits the project's
  // storageState — the E2E session cookie — and proxy.ts would then wave every delivery
  // through whether or not it exempts the route.
  github = await playwright.request.newContext({
    baseURL: testInfo.project.use.baseURL,
    storageState: { cookies: [], origins: [] },
  });

  ({ id: pipelineId } = await prisma.pipeline.create({ data: { name: PIPELINE_NAME } }));

  // Encrypted with the same ENCRYPTION_KEY the app under test reads from .env.test.
  const webhook = (isActive: boolean) => prisma.webhook.create({
    data: { pipelineId, isActive, events: ['PUSH'], branchFilters: ['main'], ...encryptSecret(SECRET) },
  });

  ({ id: webhookId } = await webhook(true));
  ({ id: inactiveWebhookId } = await webhook(false));
});

test.afterAll(async () => {
  const ids = [webhookId, inactiveWebhookId].filter(Boolean);
  await prisma.webhookEvent.deleteMany({ where: { webhookId: { in: ids } } });
  await prisma.webhook.deleteMany({ where: { id: { in: ids } } });
  if (pipelineId) await prisma.pipeline.delete({ where: { id: pipelineId } }).catch(() => {});
  await github?.dispose();
  await prisma.$disconnect();
});

test('needs no session: a signed ping reaches the route and is recorded as processed', async () => {
  const response = await deliver(webhookId, 'ping', JSON.stringify({ zen: 'Keep it logically awesome.' }));

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ message: 'Ping received: GitHub can reach this webhook.' });

  const event = await latestEvent();
  expect(event).toMatchObject({ eventType: 'PING', status: 'PROCESSED', statusReason: 'Ping received: GitHub can reach this webhook.' });

  const webhook = await prisma.webhook.findUniqueOrThrow({ where: { id: webhookId } });
  expect(webhook.lastDelivery).not.toBeNull();
});

test('rejects a delivery signed with the wrong secret and records nothing', async () => {
  const before = await eventCount();
  const body = pushTo('main');

  const response = await deliver(webhookId, 'push', body, { signature: sign(body, 'whsec_not_the_secret') });

  expect(response.status()).toBe(401);
  expect(await eventCount()).toBe(before);
});

test('answers 404 for an unknown or inactive webhook', async () => {
  expect((await deliver('no-such-webhook', 'ping', '{}')).status()).toBe(404);
  expect((await deliver(inactiveWebhookId, 'ping', '{}')).status()).toBe(404);
});

// GitHub's default content type is form-encoded; the signature still matches, the parse does not.
test('rejects a signed body that is not JSON', async () => {
  const body = 'payload=%7B%7D';

  const response = await deliver(webhookId, 'push', body, { contentType: 'application/x-www-form-urlencoded' });

  expect(response.status()).toBe(400);
});

test('ignores a push outside the branch filters and drops its payload', async () => {
  const response = await deliver(webhookId, 'push', pushTo('dev'));

  expect(response.status()).toBe(200);

  const event = await latestEvent();
  expect(event).toMatchObject({
    eventType: 'PUSH',
    status: 'IGNORED',
    statusReason: 'Branch "dev" does not match the branch filters (main).',
    payload: null,
  });
});

test('records a failure the Webhook Events page then shows', async ({ page }) => {
  const response = await deliver(webhookId, 'push', pushTo('main'));

  expect(response.status()).toBe(422);
  expect(await response.json()).toEqual({ message: 'The pipeline has no saved definition.' });

  const event = await latestEvent();
  expect(event).toMatchObject({ status: 'FAILED', statusReason: 'The pipeline has no saved definition.' });
  expect(event?.payload).not.toBeNull(); // only ignored events drop it

  await page.goto(`/webhooks/events?id=${event!.id}`);
  await expect(page.getByTestId('status-reason')).toHaveText('The pipeline has no saved definition.');
});
