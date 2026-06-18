export type Webhook = {
  id: number
  repository: string;
  pipeline: string;
  status: boolean;
  branchFilters?: string[];
  events: string[];
  webhookSecret: string;
  createdBy: string | null;
  lastDelivery?: string;
  registeredAgo: string;
}

export type WebhookListItem = Omit<Webhook, 'webhookSecret'>;

const WEBHOOKS: Webhook[] = [
  { id: 1, repository: 'abcd/infra', pipeline: 'deploy-infra', status: true, events: ["push", "pull request"], branchFilters: ['main/*', 'release/*', 'hotfix/*'], webhookSecret: 'whsec_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', createdBy: 'coco', lastDelivery: '6/9/26, 21:27:34', registeredAgo: '6/9/26, 21:27:34' },
  { id: 2, repository: 'abcd/infra', pipeline: 'deploy-infra', status: false, events: ["push"], webhookSecret: 'whsec_b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5', createdBy: null, lastDelivery: '6/9/26, 21:27:34', registeredAgo: '6/9/26, 21:27:34' },
  { id: 3, repository: 'abcd/api-server', pipeline: 'deploy-api', status: false, events: ["pull request"], webhookSecret: 'whsec_c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6', createdBy: null, lastDelivery: '6/9/26, 21:27:34', registeredAgo: '6/9/26, 21:27:34' },
];

export async function getWebhooks(): Promise<WebhookListItem[]> {
  return WEBHOOKS.map(({ webhookSecret: _, ...webhooks }) => webhooks);
}

export async function getWebhookById(id: number): Promise<Webhook | undefined> {
  return WEBHOOKS.find(w => w.id === id);
}