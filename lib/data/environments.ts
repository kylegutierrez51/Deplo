export type EnvType = 'production' | 'staging' | 'development' | 'preview' | 'custom';

export type Environment = {
  id: number;
  name: string;
  type: EnvType;
  secrets?: number;
  pipelines?: number; 
  requireApproval?: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

const ENVIRONMENTS: Environment[] = [
  { id: 1, name: 'dev',  type: 'development', secrets: 14, pipelines: 6, requireApproval: true,  createdBy: 'coco', createdAt: '6/9/26, 21:27:34', updatedAt: '6/9/26, 21:27:34' },
  { id: 2, name: 'staging', type: 'staging', secrets: 12, pipelines: 2, requireApproval: false, createdBy: 'coco', createdAt: '6/9/26, 21:27:34', updatedAt: '6/9/26, 21:27:34' },
  { id: 3, name: 'prod', type: 'production', secrets: 8, pipelines: 3, requireApproval: false, createdBy: 'coco', createdAt: '6/9/26, 21:27:34', updatedAt: '6/9/26, 21:27:34' },
  { id: 4, name: 'prev', type: 'preview', secrets: 8, pipelines: 3, requireApproval: false, createdBy: 'coco', createdAt: '6/9/26, 21:27:34', updatedAt: '6/9/26, 21:27:34' },
  { id: 5, name: 'custom', type: 'custom', secrets: 8, pipelines: 3, requireApproval: false, createdBy: 'coco', createdAt: '6/9/26, 21:27:34', updatedAt: '6/9/26, 21:27:34' },
];

export async function getEnvironments(): Promise<Environment[]> {
  return ENVIRONMENTS.map(({ ...rest }) => rest);
}

export async function getEnvironmentById(id: number): Promise<Environment | undefined> {
  return ENVIRONMENTS.find(env => env.id === id);
}