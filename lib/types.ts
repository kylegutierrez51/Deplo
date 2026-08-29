import type { Edge, Node } from '@xyflow/react';

export type FormState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  errors?: {
    name?: string;
    feedback?: string;
  };
}

export type ToastIcon = 'checkmark-circle-outline' | 'create-outline' | 'trash-outline' | 'close-circle-outline';

export type EnvType = 'production' | 'staging' | 'development' | 'preview' | 'custom';

export type PipelineStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'idle';

export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type RunTrigger = "webhook" | "manual" | "api";

export type WebhookEventStatus = 'processed' | 'pending' | 'ignored' | 'failed';

export type EventType = 'push' | 'pull-request';


/* AuditAction and ResourceType can be capitalized since they're not used by a separate component (Pill, Toast) */
export type AuditAction = "Pipeline Created" | "Pipeline Updated" | "Pipeline Deleted" | "Pipeline Triggered" | "Secret Created" | "Secret Updated" | "Secret Deleted" | "Approval Granted" | "Approval Rejected" | "Run Completed" | "Run Cancelled" | "Webhook Received" | "Environment Created" | "Environment Deleted" | "User Role Changed";

export type ResourceType = "Webhook" | "Pipeline" | "PipelineRun" | "Approval" | "Environment" | "Secret" | "Stage Result" | "Setting";


export type StageType = 'custom' | 'deploy' | 'approval';

export type PipelineRun = {
  id: string;
  version: number;
  graphJson: GraphJson;
  configJson: ConfigJson;
} | null;

export type CustomNode = Omit<Node, 'data'> & {
  data: {
    type: StageType;
    name?: string;
    label?: string;
    command?: string;
    timeout?: number;
    retries?: number;
    env_vars?: Record<string, string>[];
    secrets?: Record<string, string[]>;
  }
}

/*
===================================================
PipelineDefinition types
===================================================
*/

export type GraphJson = {
  nodes: CustomNode[];
  edges: Edge[];
}

export type StageConfig = {
  command: string | null;
  timeout: number | null;
  retries: number | null;
  env_vars: Record<string, string>[];
  secrets: Record<string, string[]>; // environmentId -> secretId[]
}

export type ConfigJson = Record<string, StageConfig>;


/*
===================================================
Runner availability
===================================================
*/

// no-workers: 'npm run runner' hasn't started
// unreachable: redis is down
export type RunnerAvailability =
  | { available: true }
  | { available: false; reason: 'no-workers' | 'unreachable' };
