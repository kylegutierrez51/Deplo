

export type EnvType = 'production' | 'staging' | 'development' | 'preview' | 'custom';

export type Secret = {
  secretKey: string;
  value: string;
  notes?: string;
  environmentType: EnvType;
  environmentName: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string; 
};

export type SecretListItem = Omit<Secret, 'value'>;

const SECRETS: Secret[] = [
  { secretKey: 'DATABASE_URL', value: 'asidaifaegauidfgaybaw2', notes: 'Primary Postgres connection — pool size 20, read replica enabled', environmentName: 'prod', environmentType: 'production', createdBy: 'sarah.chen', createdAt: '6/9/26, 21:27:34', updatedAt: '6/9/26, 21:27:34' },
  { secretKey: 'DATABASE_URL', value: "asidaifaegauidfgaybaw2", environmentName: 'staging', environmentType: 'staging', createdBy: 'sarah.chen', createdAt: '6/9/26, 21:27:34', updatedAt: '6/9/26, 21:27:34' },
  { secretKey: 'GITHUB_TOKEN', value: 'asidaifaegauidfgaybaw2', notes: 'Fine-grained PAT scoped to acme org, expires 2025-01-01', environmentName: 'dev', environmentType: 'development', createdBy: 'marcus.coco', createdAt: '6/9/26, 21:27:34', updatedAt: '6/9/26, 21:27:34' },
  { secretKey: 'GITHUB_TOKEN', value: 'asidaifaegauidfgaybaw2', notes: 'Fine-grained PAT scoped to acme org, expires 2025-01-01', environmentName: 'prev', environmentType: 'preview', createdBy: 'marcus.coco', createdAt: '6/9/26, 21:27:34', updatedAt: '6/9/26, 21:27:34' },
  { secretKey: 'GITHUB_TOKEN', value: 'asidaifaegauidfgaybaw2',  notes: 'Fine-grained PAT scoped to acme org, expires 2025-01-01', environmentName: 'custom', environmentType: 'custom', createdBy: 'marcus.coco', createdAt: '6/9/26, 21:27:34', updatedAt: '6/9/26, 21:27:34' },
];

export async function getSecrets(): Promise<SecretListItem[]> {
  return SECRETS.map(({ value: _, ...rest }) => rest);
}

export async function getSecret(key: string, env: string): Promise<Secret | undefined> {
  return SECRETS.find(s => s.secretKey === key && s.environmentName === env);
}