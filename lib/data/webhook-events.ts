export type WebhookStatus = 'processed' | 'pending' | 'ignored' | 'failed';
export type EnvType = 'production' | 'staging' | 'development' | 'preview' | 'custom';
export type EventType = 'push' | 'pull-request'

export type WebhookEvent = {
  id: number;
  status: WebhookStatus;
  eventType: EventType;
  repository: string; branch: string;
  commitHash: string; commitMessage: string;
  pipeline: string; received: string;
};

const WEBHOOK_EVENTS: WebhookEvent[] = [
    { id: 1, status: 'pending', eventType: 'pull-request', repository: 'abcd/api-server', branch: 'main', commitHash: 'a1b2c3d', commitMessage: 'feat: add retry logic to webhook delivery handler', pipeline: 'deploy-api', received: '1h ago' },
    { id: 2, status: 'processed', eventType: 'push', repository: 'abcd/api-server', branch: 'main', commitHash: 'a1b2c3d', commitMessage: 'feat: add retry logic to webhook delivery handler', pipeline: 'deploy-api', received: '1h ago' },
    { id: 3, status: 'ignored', eventType: 'push', repository: 'abcd/web-client', branch: 'release/v2.4.0', commitHash: 'f4e5d6c', commitMessage: 'chore: bump dependencies to latest stable versions', pipeline: 'build-frontend', received: '2h ago' },
    { id: 4, status: 'failed', eventType: 'pull-request', repository: 'abcd/web-client', branch: 'feature/auth-flow', commitHash: '7890abc', commitMessage: 'feat: add user role migration for RBAC system', pipeline: 'db-migrate', received: '3h ago' },
  ];

export async function getWebhookEvents(): Promise<WebhookEvent[]> {
  return WEBHOOK_EVENTS.map(({ ...events }) => events);
}

export async function getWebhookEventById(id: number): Promise<WebhookEvent | undefined> {
  return WEBHOOK_EVENTS.find(w => w.id === id);
}