import { render, screen } from '@testing-library/react';
import StageDetailView from '@/components/run-detail/StageDetailSidebar/StageDetailView';
import type { StageResultNode } from '@/lib/data/run-detail';

/*
 * The view is a read-only twin of StageConfigForm: it takes an already-enriched
 * node and renders it. There is no context and no callback, so the assertions
 * are about what reaches the screen — and, just as importantly, about what is
 * *not* rendered, since a run's configuration must not be editable from here.
 *
 * lib/data/run-detail is imported for its type only, but Jest still loads the
 * module — and it pulls in the Prisma singleton, which constructs a PrismaPg
 * adapter and fails on `TextEncoder is not defined`.
 */
jest.mock('@/lib/prisma');

const node = (data: Partial<StageResultNode['data']> = {}): StageResultNode => ({
  id: 'n1',
  position: { x: 0, y: 0 },
  data: {
    type: 'custom',
    name: 'build',
    label: 'script',
    command: 'npm run build',
    timeout: 900,
    retries: 1,
    env_vars: [{ key: 'NODE_ENV', value: 'production' }],
    duration: '30s',
    status: 'succeeded',
    attempt: 1,
    maxAttempts: 2,
    secretKeys: [],
    ...data,
  },
});

/*
 * envPresent defaults to true — the ordinary case, where the run still has the environment
 * its secrets were selected from. Only the cases that are about its absence pass it.
 */
const setup = (data: Partial<StageResultNode['data']> = {}, envPresent = true) =>
  render(<StageDetailView node={node(data)} envPresent={envPresent} />);

describe('configuration fields', () => {
  it.each([
    ['STAGE NAME', 'build'],
    ['LABEL', 'script'],
    ['COMMAND', 'npm run build'],
    ['TIMEOUT (S)', '900'],
    ['RETRIES', '1'],
  ])('renders %s as %s', (label, value) => {
    setup();

    expect(screen.getByLabelText(label)).toHaveTextContent(value);
  });

  it('marks the stage type in the grid and leaves the others unmarked', () => {
    setup({ type: 'deploy' });

    expect(screen.getByText('Deploy').parentElement).toHaveAttribute('aria-current');
    expect(screen.getByText('Custom').parentElement).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Approval').parentElement).not.toHaveAttribute('aria-current');
  });

  it('renders every env var as a key/value pair', () => {
    setup({ env_vars: [{ key: 'NODE_ENV', value: 'production' }, { key: 'CI', value: 'true' }] });

    expect(screen.getByText('NODE_ENV')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
  });

  it('lists the selected secrets by key', () => {
    setup({ secretKeys: ['API_KEY', 'DATABASE_URL'] });

    expect(screen.getByText('API_KEY')).toBeInTheDocument();
    expect(screen.getByText('DATABASE_URL')).toBeInTheDocument();
  });

  // The keys come from lib/data/run-detail, which never selects the encrypted
  // columns; this pins that the view has nothing else to show either.
  it('renders the never-logged notice above the secrets', () => {
    setup({ secretKeys: ['API_KEY'] });

    expect(screen.getByText('Injected at runtime. Never logged.')).toBeInTheDocument();
  });
});

describe('attempt', () => {
  it('renders the current attempt out of the total', () => {
    setup({ attempt: 2, maxAttempts: 3 });

    expect(screen.getByLabelText('ATTEMPT')).toHaveTextContent('2 of 3');
  });

  // maxRetries counts retries after the first try, so a stage with no retry
  // budget still reads as one attempt rather than "1 of 0".
  it('renders a stage with no retry budget as 1 of 1', () => {
    setup({ attempt: 1, maxAttempts: 1 });

    expect(screen.getByLabelText('ATTEMPT')).toHaveTextContent('1 of 1');
  });
});

describe('empty values', () => {
  it.each([
    ['STAGE NAME', { name: undefined }],
    ['LABEL', { label: undefined }],
    ['COMMAND', { command: undefined }],
    ['TIMEOUT (S)', { timeout: undefined }],
    ['RETRIES', { retries: undefined }],
  ] as const)('renders an em dash for an unset %s', (label, data) => {
    setup(data);

    expect(screen.getByLabelText(label)).toHaveTextContent('—');
  });

  it('reports an empty env var list rather than rendering nothing', () => {
    setup({ env_vars: [] });

    expect(screen.getByText('No environment variables.')).toBeInTheDocument();
  });

  it('reports an empty secret list rather than rendering nothing', () => {
    setup({ secretKeys: [] });

    expect(screen.getByText('No secrets selected.')).toBeInTheDocument();
  });
});

/*
 * An empty secret list has two quite different causes, and the run's environment is what
 * tells them apart.
 *
 * lib/data/run-detail.ts reads a stage's secret ids out of node.data.secrets keyed by the
 * run's own environmentId, so a run with no environment resolves to [] for every stage no
 * matter what the definition selected. That is indistinguishable from a stage that simply
 * selected nothing — unless the view is told which it is looking at, which is all
 * envPresent is for. Saying "No secrets selected." over a run whose environment has gone
 * is the view asserting something it cannot know.
 */
describe('secrets against a missing environment', () => {
  it('says the environment was not found when the run has none', () => {
    setup({ secretKeys: [] }, false);

    expect(screen.getByText(/the environment was not found/)).toBeInTheDocument();
    expect(screen.queryByText('No secrets selected.')).not.toBeInTheDocument();
  });

  it('says nothing was selected when the environment is still there', () => {
    setup({ secretKeys: [] }, true);

    expect(screen.getByText('No secrets selected.')).toBeInTheDocument();
    expect(screen.queryByText(/the environment was not found/)).not.toBeInTheDocument();
  });

  /*
   * The branch is reached only by the empty list. Keys that did resolve are the same keys
   * whatever the flag says — and a stage that has secrets to show is proof the environment
   * was found, so the notice would contradict the list printed directly beneath it.
   */
  it('leaves resolved secret keys alone regardless of the flag', () => {
    setup({ secretKeys: ['API_KEY'] }, false);

    expect(screen.getByText('API_KEY')).toBeInTheDocument();
    expect(screen.queryByText(/the environment was not found/)).not.toBeInTheDocument();
    expect(screen.queryByText('No secrets selected.')).not.toBeInTheDocument();
  });
});

describe('stage type guards', () => {
  // Mirrors StageConfigForm: an approval stage runs no command, so it has no
  // command, timeout, retries, env vars or secrets to show.
  it('renders only the name and type for an approval stage', () => {
    setup({ type: 'approval' });

    expect(screen.getByLabelText('STAGE NAME')).toBeInTheDocument();
    expect(screen.getByText('Approval')).toBeInTheDocument();
    expect(screen.queryByText('COMMAND')).not.toBeInTheDocument();
    expect(screen.queryByText('TIMEOUT (S)')).not.toBeInTheDocument();
    expect(screen.queryByText('ATTEMPT')).not.toBeInTheDocument();
    expect(screen.queryByText('SECRETS')).not.toBeInTheDocument();
  });

  // The editor forces a deploy stage's label to "Deploy" and hides the field.
  it('hides the label field for a deploy stage', () => {
    setup({ type: 'deploy' });

    expect(screen.queryByText('LABEL')).not.toBeInTheDocument();
    expect(screen.getByLabelText('COMMAND')).toBeInTheDocument();
  });
});

// The whole point of the panel: a run executes a frozen definition, so nothing
// here may be editable. The close button lives in the shell, not in the view.
describe('read-only', () => {
  it.each(['textbox', 'checkbox', 'button', 'combobox'] as const)('renders no %s', (role) => {
    setup({ secretKeys: ['API_KEY'] });

    expect(screen.queryAllByRole(role)).toHaveLength(0);
  });

  it('renders no editable element at all', () => {
    const { container } = setup({ secretKeys: ['API_KEY'] });

    expect(container.querySelectorAll('input, textarea, select, button')).toHaveLength(0);
  });
});
