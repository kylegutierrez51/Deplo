import Pill from '@/components/ui/Pill';
import RunLabel from '@/components/runs/RunLabel';
import type { AuditMeta } from '@/lib/types';
import { capitalize } from '@/lib/utils/string';

interface AuditResourceLabelProps {
  resourceLabel: string | null;
  resourceMeta: AuditMeta | null;
}

export default function AuditResourceLabel({ resourceLabel, resourceMeta }: AuditResourceLabelProps) {
  if (!resourceMeta) return <>{resourceLabel ?? '—'}</>; // pipeline, webhook

  switch (resourceMeta.kind) {
    case 'run':
      return <RunLabel pipelineName={resourceMeta.pipelineName} runNumber={resourceMeta.runNumber} status={resourceMeta.status} />;

    case 'environment':
      return (
        <>
          {resourceMeta.prevName ? `${resourceMeta.prevName} → ${resourceMeta.name}` : resourceMeta.name}{' '}
          {resourceMeta.prevType && <Pill variant={resourceMeta.prevType} label={capitalize(resourceMeta.prevType)} />}
          {resourceMeta.prevType && ' → '}
          <Pill variant={resourceMeta.type} label={capitalize(resourceMeta.type)} />
        </>
      );

    case 'secret':
      return (
        <>
          {resourceMeta.prevKey ? `${resourceMeta.prevKey} → ${resourceMeta.key}` : resourceMeta.key}{' '}
          <Pill variant={resourceMeta.type} label={capitalize(resourceMeta.type)} />
        </>
      );
  }
}
