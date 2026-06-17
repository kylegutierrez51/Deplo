export type EnvType = 'production' | 'staging' | 'development' | 'preview' | 'custom';

export type PipelineStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type Pipeline = {
  id: number;
  name: string; 
  status: PipelineStatus; 
  lastRun?: string;
  repoUrl: string;
  commitMessage: string; 
  description?: string;
  branchFilters: string[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string
}

const PIPELINES: Pipeline[] = [
  { id: 1, name: 'build-frontend', status: 'running', lastRun: '1h 2m 14s ago', repoUrl: 'https://github.com/abcd/web-client', commitMessage: 'f4e5d6c feat: add retry logic to webhook...',  description: 'Builds and deploys the web client on every push to main', branchFilters: ['main', 'release/*', 'hotfix/*'], createdBy: 'coco', createdAt: '6/9/26, 21:27:34', updatedAt: '6/9/26, 21:27:34' },
  { id: 2, name: 'deploy-api', status: 'succeeded', lastRun: '1h 7m 7s ago', repoUrl: 'https://github.com/abcd/api-server', commitMessage: 'a1b2c3d fix: resolve connection pool exh...', branchFilters: ['main'], createdBy: 'coco', createdAt: '6/9/26, 21:27:34', updatedAt: '6/9/26, 21:27:34' },
  { id: 3, name: 'release-mobile', status: 'failed', repoUrl: 'https://github.com/abcd/mobile-app', commitMessage: '7890abc chore: bump dependencies to l...', branchFilters: ['main', 'release/*'], createdBy: 'coco', createdAt: '6/9/26, 21:27:34', updatedAt: '6/9/26, 21:27:34' },
  { id: 4, name: 'release-mobile', status: 'queued',  repoUrl: 'https://github.com/abcd/mobile-app', commitMessage: '7890abc chore: bump dependencies to l...', branchFilters: ['main'], createdBy: 'coco', createdAt: '6/9/26, 21:27:34', updatedAt: '6/9/26, 21:27:34' },
  { id: 5, name: 'release-mobile', status: 'cancelled',  repoUrl: 'https://github.com/abcd/mobile-app', commitMessage: '7890abc chore: bump dependencies to l...', branchFilters: [], createdAt: '6/9/26, 21:27:34', updatedAt: '6/9/26, 21:27:34' },
];

export async function getPipelines(): Promise<Pipeline[]> {
  return PIPELINES.map(({ ...pipeline }) => pipeline);
}

export async function getPipelineById(id: number): Promise<Pipeline | undefined> {
  return PIPELINES.find(p => p.id === id);
}