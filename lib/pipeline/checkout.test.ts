import { graph } from '@/test/helpers/graph';
import { CHECKOUT_STAGE_ID, checkoutCommand, withCheckoutStage } from './checkout';

const URL = 'https://github.com/o/r';
const SHA = 'a'.repeat(40);

describe('checkoutCommand', () => {
  it('builds the idempotent clone-at-commit command', () => {
    expect(checkoutCommand(URL, SHA)).toBe(
      `git init --quiet . && git config remote.origin.url "${URL}" && git fetch --depth 1 origin ${SHA} && git checkout --force --quiet FETCH_HEAD`
    );
  });
});

describe('withCheckoutStage', () => {
  it.each([
    ['commitSha is null', { repoUrl: URL, commitSha: null }],
    ['repoUrl is null', { repoUrl: null, commitSha: SHA }],
    ['the SHA is too short', { repoUrl: URL, commitSha: 'a'.repeat(39) }],
    ['the SHA is uppercase', { repoUrl: URL, commitSha: 'A'.repeat(40) }],
    ['the SHA is not hex', { repoUrl: URL, commitSha: 'g'.repeat(40) }],
    ['the repo URL is not cloneable', { repoUrl: 'https://x/$(id)', commitSha: SHA }],
    ['the repo URL carries credentials', { repoUrl: 'https://user:tok@github.com/o/r', commitSha: SHA }],
  ])('returns the graph unchanged when %s', (_label, run) => {
    const input = graph('a b c', 'a>c b>c');
    expect(withCheckoutStage(input, run)).toEqual(input);
  });

  it('prepends a checkout node feeding only the root stages', () => {
    const input = graph('a b c', 'a>c b>c');
    const result = withCheckoutStage(input, { repoUrl: URL, commitSha: SHA });

    expect(result.nodes.map(node => node.id)).toEqual([CHECKOUT_STAGE_ID, 'a', 'b', 'c']);
    expect(CHECKOUT_STAGE_ID).toBe('deplo-checkout');
    expect(result.nodes[0].data).toEqual({
      type: 'custom',
      name: 'Checkout',
      command: checkoutCommand(URL, SHA),
      retries: 2,
      timeout: 300,
      env_vars: [
        { key: 'GIT_TERMINAL_PROMPT', value: '0' },
        { key: 'GCM_INTERACTIVE', value: 'never' },
        { key: 'GIT_SSH_COMMAND', value: 'ssh -o BatchMode=yes' },
      ],
    });

    const added = result.edges.filter(edge => edge.source === CHECKOUT_STAGE_ID);
    expect(added.map(edge => edge.target).sort()).toEqual(['a', 'b']);
    expect(result.edges.filter(edge => edge.source !== CHECKOUT_STAGE_ID)).toEqual(input.edges);
    expect(new Set(result.edges.map(edge => edge.id)).size).toBe(result.edges.length);
  });

  it('keeps the original nodes after the checkout node, in order', () => {
    const input = graph('a b c', 'a>c b>c');
    const result = withCheckoutStage(input, { repoUrl: URL, commitSha: SHA });
    expect(result.nodes.slice(1)).toEqual(input.nodes);
  });

  it('positions the checkout node above the roots, centred on them', () => {
    const input = graph('a b c', 'a>c b>c');
    input.nodes[0].position = { x: 0, y: 200 };
    input.nodes[1].position = { x: 400, y: 300 };
    input.nodes[2].position = { x: 200, y: 500 };

    const result = withCheckoutStage(input, { repoUrl: URL, commitSha: SHA });
    expect(result.nodes[0].position).toEqual({ x: 200, y: 50 });
  });

  // A child dragged above its parent in the editor can sit exactly where the checkout
  // would go; the checkout then moves above the whole graph instead of covering it.
  it('moves above every stage when a stage occupies the spot above the roots', () => {
    const input = graph('a b', 'a>b');
    input.nodes[0].position = { x: 0, y: 300 };
    input.nodes[1].position = { x: 0, y: 180 };

    const result = withCheckoutStage(input, { repoUrl: URL, commitSha: SHA });
    expect(result.nodes[0].position).toEqual({ x: 0, y: 30 });
  });

  it('keeps the spot above the roots when the nearest stage is clear of it sideways', () => {
    const input = graph('a b', 'a>b');
    input.nodes[0].position = { x: 0, y: 300 };
    input.nodes[1].position = { x: 400, y: 150 };

    const result = withCheckoutStage(input, { repoUrl: URL, commitSha: SHA });
    expect(result.nodes[0].position).toEqual({ x: 0, y: 150 });
  });

  // 275 × 90 is a rendered stage (presentable-stage.module.css); 60 is the gap kept around it.
  it.each([
    ['a stage directly above the root', [[0, 300], [0, 180]]],
    ['a stage overlapping the spot from the side', [[0, 300], [150, 200]]],
    ['a crowded layout', [[0, 300], [100, 120], [-200, 60], [300, 240]]],
    ['stages spread across the canvas', [[0, 0], [600, -400], [-600, 200]]],
  ])('never covers or crowds a stage: %s', (_label, positions) => {
    const ids = positions.map((_, i) => `s${i}`);
    const input = graph(ids.join(' '), ids.slice(1).map(id => `s0>${id}`).join(' '));
    input.nodes.forEach((node, i) => { node.position = { x: positions[i][0], y: positions[i][1] }; });

    const { position } = withCheckoutStage(input, { repoUrl: URL, commitSha: SHA }).nodes[0];

    for (const node of input.nodes) {
      const clearSideways = Math.abs(position.x - node.position.x) >= 275 + 60;
      const clearVertically = Math.abs(position.y - node.position.y) >= 90 + 60;
      expect(clearSideways || clearVertically).toBe(true);
    }
  });

  it('does not mutate the input graph', () => {
    const input = graph('a b c', 'a>c b>c');
    const snapshot = JSON.parse(JSON.stringify(input));
    withCheckoutStage(input, { repoUrl: URL, commitSha: SHA });
    expect(input).toEqual(snapshot);
  });
});
