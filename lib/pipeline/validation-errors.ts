import type { ZodIssue } from 'zod';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const fieldLabels: Record<string, string> = {
  id: 'stage ID',
  name: 'name',
  label: 'label',
  type: 'stage type',
  command: 'command',
  timeout: 'timeout',
  retries: 'retries',
  env_vars: 'environment variables',
  secrets: 'secret selections',
  position: 'position',
};

// Formatting runs after a failed parse, so the graph itself cannot be trusted yet.
// Use only stage names and row numbers for context, never variable values.
export function formatPipelineValidationErrors(issues: readonly ZodIssue[], graph: unknown): string {
  const nodes: unknown[] = isRecord(graph) && Array.isArray(graph.nodes) ? graph.nodes : [];

  return issues.map(issue => {
    const path = issue.path[0] === 'graphJson' ? issue.path.slice(1) : issue.path;
    let stageIndex: number;
    let fieldPath: PropertyKey[];

    if (path[0] === 'nodes' && typeof path[1] === 'number') {
      stageIndex = path[1];
      fieldPath = path.slice(2);
      if (fieldPath[0] === 'data') fieldPath = fieldPath.slice(1);
    } else if (path[0] === 'configJson' && typeof path[1] === 'string') {
      stageIndex = nodes.findIndex(node => isRecord(node) && node.id === path[1]);
      fieldPath = path.slice(2);
    } else {
      return issue.message;
    }

    const node = nodes[stageIndex];
    const data = isRecord(node) && isRecord(node.data) ? node.data : {};
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const stage = stageIndex < 0 ? 'Stage configuration'
      : name ? `Stage "${name}"` : `Stage ${stageIndex + 1}`;

    if (fieldPath[0] === 'env_vars' && typeof fieldPath[1] === 'number') {
      const field = fieldPath[2] === 'key' || fieldPath[2] === 'value' ? ` ${fieldPath[2]}` : '';
      return `${stage}, environment variable ${fieldPath[1] + 1}${field}: ${issue.message}`;
    }

    const field = typeof fieldPath[0] === 'string' ? fieldLabels[fieldPath[0]] : undefined;
    return `${stage}${field ? `, ${field}` : ''}: ${issue.message}`;
  }).join('\n');
}
