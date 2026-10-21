import type { Edge } from '@xyflow/react';
import type { CustomNode, GraphJson } from '@/lib/types';
import { buildMaps } from './adjacency';
import { isCloneableRepoUrl } from './repo-url';

export const CHECKOUT_STAGE_ID = 'deplo-checkout';

const COMMIT_SHA = /^[0-9a-f]{40}$/;

// A stage as Run Detail renders it (presentable-stage.module.css), and the clear space
// kept between the checkout and any stage. Positions are each node's top-left corner.
const NODE_WIDTH = 275;
const NODE_HEIGHT = 90;
const GAP = 60;

const crowds = (a: { x: number, y: number }, b: { x: number, y: number }) =>
  Math.abs(a.x - b.x) < NODE_WIDTH + GAP && Math.abs(a.y - b.y) < NODE_HEIGHT + GAP;



/*
 * Positions the checkout stage above the roots, centered on them.
 * However, if a child stage sits too close, then it repositions the checkout stage up by 150px,
 * guaranteeing it sits above all the stages without overlapping
 */
function checkoutPosition(nodes: CustomNode[], roots: CustomNode[]): { x: number, y: number } {
  if (!roots.length) return { x: 0, y: 0 };

  const x = roots.reduce((sum, node) => sum + node.position.x, 0) / roots.length;
  const aboveRoots = { x, y: Math.min(...roots.map(node => node.position.y)) - NODE_HEIGHT - GAP };

  if (!nodes.some(node => crowds(aboveRoots, node.position))) return aboveRoots;

  return { x, y: Math.min(...nodes.map(node => node.position.y)) - NODE_HEIGHT - GAP };
}



/*
 * `git config remote.origin.url <url>` - tells the repo where 'origin' lives by writing to `.git/config`
 *  We don't use `git remote add origin <url>` because it fails if the 'origin' already exists
 *  
 * `git fetch --depth 1 origin <sha>` - downloads that one commit
 * 
 * `git checkout --force --quiet FETCH_HEAD` - switches working directory to the downloaded commit
 * `--force` overwrites any files already in the way
 */
export function checkoutCommand(repoUrl: string, commitSha: string): string {
  return [
    'git init --quiet .',
    `git config remote.origin.url "${repoUrl}"`,
    `git fetch --depth 1 origin ${commitSha}`,
    'git checkout --force --quiet FETCH_HEAD',
  ].join(' && ');
}


// Prepends a Checkout stage as the initial stage, connected to every root of the graph.
// Reads only the run's own repoUrl/commitSha, never the live pipeline, so the graph cannot change mid-run.
export function withCheckoutStage(
  graph: GraphJson,
  run: { repoUrl: string | null, commitSha: string | null }
): GraphJson {
  const { repoUrl, commitSha } = run;
  if (!repoUrl || !commitSha) return graph;
  if (!COMMIT_SHA.test(commitSha) || !isCloneableRepoUrl(repoUrl)) return graph;

  const { inDegree } = buildMaps(graph.edges, graph.nodes);
  const roots = graph.nodes.filter(node => inDegree.get(node.id) === 0);

  const checkout: CustomNode = {
    id: CHECKOUT_STAGE_ID,
    type: 'standardStage',
    position: checkoutPosition(graph.nodes, roots),
    data: {
      type: 'custom',
      name: 'Checkout',
      command: checkoutCommand(repoUrl, commitSha),
      retries: 2,
      timeout: 300,

      // GIT_TERMINAL_PROMPT=0 - Git doesn't ask for a username/password in the terminal
      // GCM_INTERACTIVE=never - never opens a sign-in window or prompt
      // GIT_SSH_COMMAND - ssh does not ask for anything (no password, passphrase, etc.)
      env_vars: [
        { key: 'GIT_TERMINAL_PROMPT', value: '0' },
        { key: 'GCM_INTERACTIVE', value: 'never' },
        { key: 'GIT_SSH_COMMAND', value: 'ssh -o BatchMode=yes' },
      ],
    },
  };

  const edges: Edge[] = roots.map(root => ({
    id: `${CHECKOUT_STAGE_ID}>${root.id}`,
    source: CHECKOUT_STAGE_ID,
    target: root.id,
    type: 'customEdge',
    markerEnd: 'marker',
  }));

  return { nodes: [checkout, ...graph.nodes], edges: [...graph.edges, ...edges] };
}
