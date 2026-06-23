export type PipelineStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type EnvType = 'production' | 'staging' | 'development' | 'preview' | 'custom';
export type TriggerType = 'api' | 'manual' | 'webhook';
export type JobStatus = 'succeeded' | 'failed' | 'running' | 'queued' | 'pending';
export type LogStatus = 'succeeded' | 'failed' | 'running';

export type RunJob = {
  name: string;
  status: JobStatus;
  duration?: string;
  isActive?: boolean;
};

export type RunGraphNode =
  | ({ type: 'job' } & RunJob)
  | { type: 'connector-straight'; active?: boolean }
  | { type: 'connector-fork' }
  | { type: 'connector-merge' }
  | { type: 'parallel'; jobs: RunJob[] };

export type LogLine = { lineNumber: number; timestamp: string; content: string };

export type JobLog = {
  jobName: string;
  command: string;
  status: LogStatus;
  duration: string;
  lines: LogLine[];
};

export type JobCounts = {
  total: number;
  succeeded: number;
  running: number;
  queued: number;
  failed: number;
  awaitingApproval: number;
};

export type RunDetail = {
  id: number;
  runNumber: number;
  pipelineName: string;
  status: PipelineStatus;
  environment: EnvType;
  commitHash: string;
  commitMessage: string;
  branch: string;
  repo: string;
  trigger: TriggerType;
  triggeredBy: string;
  duration: string;
  timeAgo: string;
  jobCounts: JobCounts;
  graph: RunGraphNode[];
  logFilters: { value: string; label: string }[];
  logs: JobLog[];
};

const RUN_DETAILS: RunDetail[] = [
  {
    id: 1,
    runNumber: 1,
    pipelineName: 'deploy-api',
    status: 'running',
    environment: 'production',
    commitHash: 'a1b2c3d',
    commitMessage: 'fix: resolve connection pool e...',
    branch: 'main',
    repo: 'acme/api-server',
    trigger: 'webhook',
    triggeredBy: 'sarah.chen',
    duration: '7m 12s',
    timeAgo: '7m',
    jobCounts: { total: 8, succeeded: 4, running: 1, queued: 3, failed: 0, awaitingApproval: 0 },
    graph: [
      { type: 'job', name: 'install-deps', status: 'succeeded', duration: '42s' },
      { type: 'connector-fork' },
      {
        type: 'parallel',
        jobs: [
          { name: 'lint', status: 'succeeded', duration: '38s' },
          { name: 'unit-tests', status: 'succeeded', duration: '2m 13s' },
        ],
      },
      { type: 'connector-merge' },
      { type: 'job', name: 'build', status: 'succeeded', duration: '1m 25s' },
      { type: 'connector-straight', active: true },
      { type: 'job', name: 'deploy-staging', status: 'running', duration: '24m 4s' },
      { type: 'connector-straight' },
      { type: 'job', name: 'smoke-tests', status: 'queued' },
      { type: 'connector-straight' },
      { type: 'job', name: 'manual-approval', status: 'queued' },
    ],
    logFilters: [
      { value: 'stage', label: 'install deps - succeeded' },
      { value: 'stage', label: 'lint - succeeded' },
      { value: 'stage', label: 'unit-tests - succeeded' },
      { value: 'stage', label: 'build - succeeded' },
      { value: 'stage', label: 'deploy-staging - running' },
      { value: 'stage', label: 'smoke-tests - pending' },
      { value: 'stage', label: 'manual-approval - pending' },
      { value: 'stage', label: 'deploy-production - pending' },
    ],
    logs: [
      {
        jobName: 'install-deps',
        command: 'npm ci --production=false',
        status: 'running',
        duration: '42s',
        lines: [
          { lineNumber: 1, timestamp: '00:00.0', content: 'npm ci --production=false' },
          { lineNumber: 2, timestamp: '00:00.3', content: 'npm warn deprecated inflight@1.0.6: This module is not supported' },
          { lineNumber: 3, timestamp: '00:02.1', content: 'added 1,247 packages in 38s' },
          { lineNumber: 4, timestamp: '00:02.2', content: '182 packages are looking for funding' },
          { lineNumber: 5, timestamp: '00:42.0', content: '&#10003; Dependencies installed successfully' },
        ],
      },
    ],
  },
  {
    id: 2,
    runNumber: 2,
    pipelineName: 'deploy-api',
    status: 'failed',
    environment: 'production',
    commitHash: '7890abc',
    commitMessage: 'chore: bump dependencies to latest',
    branch: 'main',
    repo: 'acme/api-server',
    trigger: 'manual',
    triggeredBy: 'sarah.chen',
    duration: '3m 51s',
    timeAgo: '2h',
    jobCounts: { total: 4, succeeded: 2, running: 0, queued: 0, failed: 1, awaitingApproval: 1 },
    graph: [
      { type: 'job', name: 'install-deps', status: 'succeeded', duration: '40s' },
      { type: 'connector-straight' },
      { type: 'job', name: 'build', status: 'succeeded', duration: '1m 10s' },
      { type: 'connector-straight' },
      { type: 'job', name: 'deploy-staging', status: 'failed', duration: '1m 41s' },
      { type: 'connector-straight' },
      { type: 'job', name: 'manual-approval', status: 'pending' },
    ],
    logFilters: [
      { value: 'stage', label: 'install-deps - succeeded' },
      { value: 'stage', label: 'build - succeeded' },
      { value: 'stage', label: 'deploy-staging - failed' },
      { value: 'stage', label: 'manual-approval - pending' },
    ],
    logs: [
      {
        jobName: 'deploy-staging',
        command: 'npm run deploy:staging',
        status: 'failed',
        duration: '1m 41s',
        lines: [
          { lineNumber: 1, timestamp: '00:00.0', content: 'npm run deploy:staging' },
          { lineNumber: 2, timestamp: '00:32.4', content: 'Error: connection timed out while reaching staging cluster' },
          { lineNumber: 3, timestamp: '01:41.0', content: '&#10007; Deployment failed' },
        ],
      },
    ],
  },
];

export async function getRunDetailById(id: number): Promise<RunDetail | undefined> {
  return RUN_DETAILS.find(r => r.id === id);
}
