export type FormState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  errors?: {
    name?: string
    feedback?: string
  };
}

export type EnvType = 'production' | 'staging' | 'development' | 'preview' | 'custom';