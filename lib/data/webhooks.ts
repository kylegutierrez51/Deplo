interface WebhookEvents {
  push?: boolean;
  pullRequest?: boolean;
}

export type Webhook = {
  id: number
  repository: string;
  pipeline: string;
  branchFilters?: string[];
  events: WebhookEvents;
  webhookSecret: string;
  createdBy: string | null;
  lastDelivery?: string;
  registeredAgo: string;
}

export type WebhookListItem = Omit<Webhook, 'webhookSecret'>;

const WEBHOOKS: Webhook[] = [
  { id: 1, repository: 'abcd/infra', pipeline: 'deploy-infra', events: { push: true, pullRequest: true }, branchFilters: ['main/*', 'release/*', 'hotfix/*'], webhookSecret: 'whsec_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', createdBy: 'coco', lastDelivery: '6/9/26, 21:27:34', registeredAgo: '6/9/26, 21:27:34' },
  { id: 2, repository: 'abcd/infra', pipeline: 'deploy-infra', events: { push: true, pullRequest: false }, webhookSecret: 'whsec_b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5', createdBy: null, lastDelivery: '6/9/26, 21:27:34', registeredAgo: '6/9/26, 21:27:34' },
  { id: 3, repository: 'abcd/api-server', pipeline: 'deploy-api', events: { push: false, pullRequest: true }, webhookSecret: 'whsec_c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6', createdBy: null, lastDelivery: '6/9/26, 21:27:34', registeredAgo: '6/9/26, 21:27:34' },
];

export async function getWebhooks(): Promise<WebhookListItem[]> {
  return WEBHOOKS.map(({ webhookSecret: _, ...webhooks }) => webhooks);
}

export async function getWebhookById(id: number): Promise<Webhook | undefined> {
  return WEBHOOKS.find(w => w.id === id);
}