import { buildMaps } from '@/lib/pipeline/adjacency';
import type { GraphJson } from '@/lib/types';
import type { StageStatus } from '@/generated/prisma';

// stageId → status of that stage's latest attempt. Absent = no StageResult row yet.
export type Outcomes = ReadonlyMap<string, StageStatus>;

type Terminality = 'success' | 'failure' | 'in-flight';

const TERMINALITY: Record<StageStatus, Terminality> = {
  PENDING:           'in-flight',
  QUEUED:            'in-flight',
  RUNNING:           'in-flight',
  AWAITING_APPROVAL: 'in-flight',
  SUCCEEDED:         'success',
  APPROVED:          'success',
  FAILED:            'failure',
  UNAPPROVED:        'failure',
  CANCELLED:         'failure',
};

const terminality = (status: StageStatus | undefined): Terminality =>
  status ? TERMINALITY[status] : 'in-flight';

// Nothing has claimed this stage: no row yet, or a row still at PENDING.
const isUnstarted = (status: StageStatus | undefined) => (status ?? 'PENDING') === 'PENDING';


/*
==============================================================================================
 * The stages eligible to be acted on, recomputed from the full outcome set rather than
 * tracked incrementally. Idempotent: a stage already QUEUED or RUNNING is not returned
 * again, so a redelivered job or two parents finishing at once cannot double-enqueue.
 *
 * Approval stages come back like any other — the caller decides whether acting on one
 * means enqueuing a job or writing AWAITING_APPROVAL.
==============================================================================================
 */
export function readyStages(graph: GraphJson, outcomes: Outcomes): string[] {
  const { adjacency } = buildMaps(graph.edges, graph.nodes);

  // Inverted: rather than each node asking after its parents, every parent that has not
  // succeeded vetoes its children.
  const blocked = new Set<string>();
  for (const [source, targets] of adjacency) {
    if (terminality(outcomes.get(source)) !== 'success') {
      for (const t of targets) blocked.add(t);
    }
  }

  // Candidates come from graph.nodes, not from the maps. This is because buildMaps 
  // seeds an entry for every edge target, including a dangling one naming an id that is not a node.
  return graph.nodes
    .map(n => n.id)
    .filter(id => !blocked.has(id) && isUnstarted(outcomes.get(id)));
}


export const initialStages = (graph: GraphJson) => readyStages(graph, new Map<string, StageStatus>());



export function runOutcome(graph: GraphJson, outcomes: Outcomes): 'SUCCEEDED' | 'FAILED' | null {
  let allSucceeded = true;

  for (const node of graph.nodes) {
    const status = terminality(outcomes.get(node.id));
    if (status === 'failure') return 'FAILED';
    if (status !== 'success') allSucceeded = false;
  }

  return allSucceeded ? 'SUCCEEDED' : null;
}
