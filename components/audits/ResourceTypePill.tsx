import Pill from '@/components/ui/Pill';
import type { ResourceType } from '@/lib/types';

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  'pipeline': 'Pipeline',
  'pipeline-run': 'Pipeline Run',
  'environment': 'Environment',
  'secret': 'Secret',
  'webhook': 'Webhook',
};

export default function ResourceTypePill({ type }: { type: ResourceType }) {
  return <Pill variant={type} label={RESOURCE_TYPE_LABELS[type]} />;
}
