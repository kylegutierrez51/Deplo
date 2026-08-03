type PillVariant =
  | 'running' | 'succeeded' | 'failed' | 'queued' | 'cancelled'
  | 'production' | 'staging' | 'development' | 'preview' | 'custom'
  | 'processed' | 'ignored' | 'pending' | 'push' | 'pull-request' | 'webhook'
  | 'manual' | 'api' | 'total' | 'awaiting-approval' | 'idle'
  | 'approved' | 'unapproved';

interface PillProps {
  variant: PillVariant;
  label: string;
}

export default function Pill({ variant, label }: PillProps) {
  return <div className={`pill pill--${variant}`}>{label}</div>;
}

export type { PillVariant };
