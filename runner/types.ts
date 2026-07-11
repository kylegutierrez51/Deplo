// Sample data that the Pipeline Trigger Server Action receives

import type { StageType } from '@/generated/prisma';

interface StageNode {
  id: string;
  type: 'stageNode';
  position: { x: number; y: number };
  data: { label: string; stageType: StageType };
}

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
  nodes: StageNode[];
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
  timeout: number;
  retries: number;
  env: { key: string, value: string }[];
  secrets: string[];
}