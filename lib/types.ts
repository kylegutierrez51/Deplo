export type FormState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  errors?: {
    name?: string
    feedback?: string
  };
}

export type EnvType = 'production' | 'staging' | 'development' | 'preview' | 'custom';

export type PipelineStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'idle';

export type ToastIcon = 'checkmark-circle-outline' | 'create-outline' | 'trash-outline' | 'close-circle-outline';

export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type RunTrigger = "webhook" | "manual" | "api"

/* AuditAction and ResourceType can be capitalized since they're not used by a separate component (Pill, Toast) */
export type AuditAction = "Pipeline Created" | "Pipeline Updated" | "Pipeline Deleted" | "Pipeline Triggered" | "Secret Created" | "Secret Updated" | "Secret Deleted" | "Approval Granted" | "Approval Rejected" | "Run Completed" | "Run Cancelled" | "Webhook Received" | "Environment Created" | "Environment Deleted" | "User Role Changed";

export type ResourceType = "Webhook" | "Pipeline" | "PipelineRun" | "Approval" | "Environment" | "Secret" | "Stage Result" | "Setting";
