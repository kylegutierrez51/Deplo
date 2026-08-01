// Sample data that the Pipeline Trigger Server Action receives

import type { CustomNode } from '@/lib/types';

interface StageEdge {
  id: string;
  source: string;
  target: string;
}

interface StageConfig {
  command: string | null;
  timeout: number;
  retries: number;
  env: { key: string, value: string }[];
  secrets: string[];
}

export interface GraphJson {
  nodes: CustomNode[];
  edges: StageEdge[];
}

export type ConfigJson = Record<string, StageConfig>;

export interface StagePayload {
  runId: string;
  definitionId: string;
  pipelineId: string;
  stageId: string;
  stageName: string;
  stageType: string;
  command: string;
  cwd: string;
  timeout: number;
  attempt: number;
  maxRetries: number;
  environmentId: string;
  env: { key: string, value: string }[];
  secrets: string[];
  commitSha: string;
  branch: string;
}

export interface CompressedStagePayload {
  runId: string;
  stageId: string;
  attempt: number;
  command: string;
  cwd: string;
  timeout: number;
  retries: number;
  env: { key: string, value: string }[];
  secrets: string[];
}



