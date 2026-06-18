export type EnvType = 'production' | 'staging' | 'development' | 'preview' | 'custom';

export type Audit = {
  id: number;
  action: string; 
  resource: string;
  category?: string;
  actor: string;
  time: string;
};

const AUDITS: Audit[] = [
  { id: 1, action: 'Run Completed', resource: 'deploy-api #482', category: "Pipeline", actor: 'github', time: '6/9/26, 21:27:34' },
  { id: 2, action: 'Pipeline Triggered', resource: 'deploy-api #482', category: "Pipeline", actor: 'github', time: '6/9/26, 21:27:34' },
  { id: 3, action: 'Webhook Received', resource: 'push → acme/api-server', category: "Webhook", actor: 'github', time: '6/9/26, 21:27:34' },
];

export async function getAudits(): Promise<Audit[]> {
  return AUDITS.map(({ ...audits }) => audits);
}

export async function getAuditById(id: number): Promise<Audit | undefined> {
  return AUDITS.find(a => a.id === id);
}