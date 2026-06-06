type PillVariant =
  | 'running' | 'succeeded' | 'failed' | 'queued' | 'cancelled'
  | 'production' | 'staging' | 'development' | 'preview' | 'custom'
  | 'processed' | 'ignored' | 'push' | 'pull-request' | 'webhook'
  | 'manual' | 'api' | 'total' | 'approval';

interface PillProps {
  variant: PillVariant;
  label: string;
}

export default function Pill({ variant, label }: PillProps) {
  return <div className={`pill pill--${variant}`}>{label}</div>;
}

export type { PillVariant };
