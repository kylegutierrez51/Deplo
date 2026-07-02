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