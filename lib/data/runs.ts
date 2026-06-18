export type PipelineStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type EnvType = 'production' | 'staging' | 'development' | 'preview' | 'custom';
export type TriggerType = 'api' | 'manual' | 'webhook';

export type Run = {
  id: number;
  status: PipelineStatus;
  pipeline: string; 
  repo: string;
  environment: EnvType;
  trigger: TriggerType;
  duration: string; 
  time: string;
};

const RUNS: Run[] = [
  { id: 1, status: 'queued', pipeline: 'deploy-api', repo: 'acbcd/api-server', environment: 'production', trigger: 'webhook', duration: '-', time: '6h ago' },
  { id: 2, status: 'running', pipeline: 'build-frontend', repo: 'acbcd/web-client', environment: 'staging', trigger: 'manual', duration: '6h 1m', time: '6h ago' },
  { id: 3, status: 'succeeded', pipeline: 'deploy-api', repo: 'acbcd/api-server', environment: 'development', trigger: 'api', duration: '8m 0s', time: '11h ago' },
  { id: 4, status: 'failed', pipeline: 'deploy-api', repo: 'acbcd/api-server', environment: 'preview', trigger: 'webhook', duration: '8m 0s', time: '11h ago' },
  { id: 5, status: 'cancelled', pipeline: 'deploy-api', repo: 'acbcd/api-server', environment: 'custom', trigger: 'manual', duration: '8m 0s', time: '12h ago' },
];

export async function getRuns(): Promise<Run[]> {
  return RUNS.map(({ ...runs }) => runs);
}

export async function getRunById(id: number): Promise<Run | undefined> {
  return RUNS.find(r => r.id === id);
}