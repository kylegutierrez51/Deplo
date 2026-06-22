export type EnvType = 'production' | 'staging' | 'development' | 'preview' | 'custom';
export type StageType = 'build' | 'test' | 'deploy' | 'approval' | 'script';
export type StageStatus = 'pending' | 'queued' | 'running' | 'succeeded' | 'failed' | 'awaiting_approval' | 'approved' | 'unapproved' | 'cancelled';

export type Stage = {
  id: number;
  stageType: StageType;
  status: StageStatus;
  name: string;
  isApproval?: boolean;
}


export type Approval = {
  id: number;
  runId: number;
  waitingTime: string;
  createdBy: string | null;
  /* below come from runId in PipelineRun model */
  pipelineName: string;
  commitSha: string;
  commitMessage: string;
  environment: EnvType;
  branch: string;

  /* below are stages */
  stages: Stage[];
}

// build -> hammer-outline
// test -> flask-outline
// deploy -> rocket-outline
// approval -> shield-outline
// script -> code-outline

//


const APPROVALS: Approval[] = [
  { id: 1, runId: 1, waitingTime: '18h 17m', createdBy: 'coco', pipelineName: 'abcd/infra', commitSha: 'c3d435f', commitMessage: "fix: resolve deep link crash on Android 14", environment: 'production', branch: 'main',
    stages: [
      { id: 1, stageType: 'build', status: 'succeeded', name: 'install-deps', },
      { id: 2, stageType: 'build', status: 'succeeded', name: 'lint', },
      { id: 3, stageType: 'test', status: 'succeeded', name: 'unit-tests', },
      { id: 4, stageType: 'approval', status: 'awaiting_approval', name: 'release-approval', isApproval: true },
      { id: 5, stageType: 'script', status: 'queued', name: 'db-backup', },
      { id: 6, stageType: 'deploy', status: 'queued', name: 'publish-stores', },
    ]
   },
  { id: 2, runId: 2, waitingTime: '18h 17m', createdBy: null, pipelineName: 'abcd/infra', commitSha: 'c3d435f', commitMessage: "fix: resolve deep link crash on Android 14", environment: 'production', branch: 'main',
    stages: [
      { id: 1, stageType: 'build', status: 'succeeded', name: 'install-deps', },
      { id: 2, stageType: 'build', status: 'succeeded', name: 'lint', },
      { id: 3, stageType: 'test', status: 'succeeded', name: 'unit-tests', },
      { id: 4, stageType: 'approval', status: 'awaiting_approval', name: 'release-approval', isApproval: true },
      { id: 5, stageType: 'script', status: 'queued', name: 'db-backup', },
      { id: 6, stageType: 'deploy', status: 'queued', name: 'publish-stores', },
    ]
   },
  { id: 3, runId: 3, waitingTime: '18h 17m', createdBy: null, pipelineName: 'abcd/infra', commitSha: 'c3d435f', commitMessage: "fix: resolve deep link crash on Android 14", environment: 'production', branch: 'main',
    stages: [
      { id: 1, stageType: 'build', status: 'succeeded', name: 'install-deps', },
      { id: 2, stageType: 'build', status: 'succeeded', name: 'lint', },
      { id: 3, stageType: 'test', status: 'succeeded', name: 'unit-tests', },
      { id: 4, stageType: 'approval', status: 'awaiting_approval', name: 'release-approval', isApproval: true },
      { id: 5, stageType: 'script', status: 'queued', name: 'db-backup', },
      { id: 6, stageType: 'deploy', status: 'queued', name: 'publish-stores', },
    ]
   },
];

export async function getApprovals(): Promise<Approval[]> {
  return APPROVALS.map(({ ...approvals }) => approvals);
}

export async function getApprovalById(id: number): Promise<Approval | undefined> {
  return APPROVALS.find(a => a.id === id);
}