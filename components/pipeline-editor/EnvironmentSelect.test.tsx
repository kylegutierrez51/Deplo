import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EnvironmentSelect from '@/components/pipeline-editor/EnvironmentSelect';
import { usePipelineGraph } from '@/components/pipeline-editor/PipelineGraphProvider';
import type { Environment } from '@/lib/data/environments';
import type { CustomNode } from '@/lib/types';

/*
 * The picker mirrors its selection into ?environment, which the page reads back on a
 * refresh. An absent param means "open on the pipeline's default", so clearing the picker
 * has to write an explicit "none" — dropping the param would bring the default back.
 * The graph context is stubbed for the same reason HeaderButtons.test.tsx stubs it.
 */
jest.mock('@/components/pipeline-editor/PipelineGraphProvider', () => ({
  usePipelineGraph: jest.fn(),
}));

const useGraph = usePipelineGraph as jest.MockedFunction<typeof usePipelineGraph>;
const setSelectedEnvironmentId = jest.fn();

const environments = [
  { id: 'env-1', name: 'staging', type: 'staging' },
  { id: 'env-2', name: 'prod', type: 'production' },
] as Environment[];

const stage = (id: string, secrets?: Record<string, string[]>): CustomNode => ({
  id, position: { x: 0, y: 0 }, data: { type: 'custom', name: id, secrets },
});

const setup = (
  selectedEnvironmentId: string | null = 'env-2',
  defaultEnvironmentId: string | null = 'env-2',
  nodes: CustomNode[] = [],
) => {
  useGraph.mockReturnValue({ selectedEnvironmentId, setSelectedEnvironmentId, nodes } as unknown as ReturnType<typeof usePipelineGraph>);
  render(<EnvironmentSelect environments={environments} defaultEnvironmentId={defaultEnvironmentId} />);
};

const environmentParam = () => new URLSearchParams(window.location.search).get('environment');

beforeEach(() => {
  setSelectedEnvironmentId.mockClear();
  window.history.replaceState(null, '', '/pipelines/p1');
});

it('writes the picked environment into the URL', async () => {
  setup(null);
  const user = userEvent.setup();

  await user.click(screen.getByPlaceholderText('Select environment'));
  await user.click(screen.getByRole('button', { name: /staging/i }));

  expect(setSelectedEnvironmentId).toHaveBeenLastCalledWith('env-1');
  expect(environmentParam()).toBe('env-1');
});

it('writes an explicit none when the picker is cleared, so a refresh does not restore the default', async () => {
  setup();
  const user = userEvent.setup();

  await user.clear(screen.getByPlaceholderText('Select environment'));

  expect(setSelectedEnvironmentId).toHaveBeenLastCalledWith(null);
  expect(environmentParam()).toBe('none');
});

it("marks the pipeline's default environment in the list", async () => {
  setup(null);
  const user = userEvent.setup();

  await user.click(screen.getByPlaceholderText('Select environment'));

  expect(screen.getByRole('button', { name: /prod/i })).toHaveTextContent('default');
  expect(screen.getByRole('button', { name: /staging/i })).not.toHaveTextContent('default');
});

/*
 * Secrets are selected per environment and the runner resolves none without one, so a run
 * with no environment quietly drops them. The hint says so before the run, and only when it
 * is true — a user who never selects secrets never sees it.
 */
describe('the unused-secrets hint', () => {
  const hint = () => screen.queryByRole('img', { name: /secrets that won't be used/i });

  it('names the stages whose secrets a run without an environment would drop', () => {
    setup(null, null, [stage('build', { 'env-1': ['s1'] }), stage('lint'), stage('deploy', { 'env-2': ['s2'] })]);

    expect(hint()).toHaveAccessibleName("You do not have an environment selected, so these stages have secrets that won't be used: build, deploy");
    expect(screen.getByPlaceholderText('Select environment')).toHaveAccessibleDescription(
      "You do not have an environment selected, so these stages have secrets that won't be used: build, deploy",
    );
  });

  it('is absent once an environment is selected', () => {
    setup('env-1', null, [stage('build', { 'env-1': ['s1'] })]);

    expect(hint()).not.toBeInTheDocument();
  });

  it('is absent when no stage has secrets selected', () => {
    setup(null, null, [stage('build'), stage('lint', { 'env-1': [] })]);

    expect(hint()).not.toBeInTheDocument();
  });
});

