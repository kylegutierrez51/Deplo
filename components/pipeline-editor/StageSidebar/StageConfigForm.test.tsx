import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StageConfigForm from '@/components/pipeline-editor/StageSidebar/StageConfigForm';
import { usePipelineGraph } from '@/components/pipeline-editor/PipelineGraphProvider';
import type { CustomNode } from '@/lib/types';

/*
 * The form talks to the editor only through updateNodeData, so the graph context
 * is stubbed and the assertions are about what patch each interaction produces.
 * Mounting the real provider would drag in a ReactFlow canvas for no benefit.
 */
jest.mock('@/components/pipeline-editor/PipelineGraphProvider', () => ({
  usePipelineGraph: jest.fn(),
}));

const useGraph = usePipelineGraph as jest.MockedFunction<typeof usePipelineGraph>;

const updateNodeData = jest.fn();

const node = (data: Partial<CustomNode['data']> = {}): CustomNode => ({
  id: 'n1', position: { x: 0, y: 0 }, data: { type: 'custom', name: 'build', ...data },
});

function setup(nodeOver: Partial<CustomNode['data']> = {}, graphOver: Record<string, unknown> = {}) {
  useGraph.mockReturnValue({
    updateNodeData,
    selectedEnvironmentId: 'env-1',
    secrets: [
      { id: 's1', key: 'API_KEY', environmentId: 'env-1' },
      { id: 's2', key: 'DB_URL', environmentId: 'env-1' },
      { id: 's3', key: 'OTHER', environmentId: 'env-2' },
    ],
    ...graphOver,
  } as never);

  const user = userEvent.setup();
  const subject = node(nodeOver);
  render(<StageConfigForm node={subject} />);
  return { user, subject };
}

/** The merged patch across every updateNodeData call. */
const lastPatch = () => updateNodeData.mock.calls.at(-1)?.[1];

/*
 * Timeout and retries seed with the runner's defaults, so typing into either one
 * appends to a number that is already there. Anything testing what a given entry
 * produces has to start from the empty field the reader gets by backspacing.
 */
const emptied = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  const field = screen.getByLabelText(label);
  await user.clear(field);
  return field;
};

beforeEach(() => { updateNodeData.mockClear(); });

describe('timeout and retries validation', () => {
  // The guard re-tests the whole field on every keystroke, so a character that
  // would make the value non-numeric is dropped while the digits around it are
  // still accepted. Typing "1.5" therefore leaves "15", not "1.5" and not "".
  it.each([
    ['abc', ''],
    ['1.5', '15'],
    ['-1', '1'],
    ['3e4', '34'],
    [' 5', '5'],
  ])('drops the non-digit characters of %s, leaving %s', async (input, expected) => {
    const { user } = setup();
    const field = await emptied(user, 'TIMEOUT (S)');

    await user.type(field, input);

    expect(field).toHaveValue(expected);
  });

  it('never patches the node from a wholly non-numeric entry', async () => {
    const { user } = setup();
    const field = await emptied(user, 'TIMEOUT (S)');
    updateNodeData.mockClear();

    await user.type(field, 'abc');

    expect(updateNodeData).not.toHaveBeenCalled();
  });

  it('accepts digits', async () => {
    const { user } = setup();

    await user.type(await emptied(user, 'TIMEOUT (S)'), '90');

    expect(lastPatch()).toEqual({ timeout: 90 });
  });

  it('sends a number, not the raw string', async () => {
    const { user } = setup();

    await user.type(await emptied(user, 'RETRIES'), '3');

    expect(lastPatch()).toEqual({ retries: 3 });
  });

  // The runner reads these directly, so the ceilings are what stop a stage
  // from being configured to hang for a day or retry forever.
  it('clamps retries to 10', async () => {
    const { user } = setup();

    await user.type(await emptied(user, 'RETRIES'), '99');

    expect(lastPatch()).toEqual({ retries: 10 });
    expect(screen.getByLabelText('RETRIES')).toHaveValue('10');
  });

  it('clamps timeout to 43200', async () => {
    const { user } = setup();

    await user.type(await emptied(user, 'TIMEOUT (S)'), '99999');

    expect(lastPatch()).toEqual({ timeout: 43200 });
    expect(screen.getByLabelText('TIMEOUT (S)')).toHaveValue('43200');
  });

  it('allows exactly the maximum', async () => {
    const { user } = setup();

    await user.type(await emptied(user, 'RETRIES'), '10');

    expect(lastPatch()).toEqual({ retries: 10 });
  });

  it('seeds the inputs from the node', () => {
    setup({ timeout: 120, retries: 2 });

    expect(screen.getByLabelText('TIMEOUT (S)')).toHaveValue('120');
    expect(screen.getByLabelText('RETRIES')).toHaveValue('2');
  });

  // A stage that carries no numbers of its own shows the runner's defaults, so
  // the reader sees what the stage will actually do rather than two blank boxes.
  it('seeds the runner defaults when the node carries neither', () => {
    setup();

    expect(screen.getByLabelText('TIMEOUT (S)')).toHaveValue('1800');
    expect(screen.getByLabelText('RETRIES')).toHaveValue('0');
  });
});

describe('the reserved label rule', () => {
  // StageTypeGrid labels deploy and approval stages itself, so a custom stage
  // claiming one of those words would render as something it is not.
  it.each(['deploy', 'Approval', 'DEPLOY'])('flags %s as reserved', async (word) => {
    const { user } = setup();

    await user.type(screen.getByLabelText('LABEL'), word);

    expect(screen.getByLabelText('LABEL')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/is reserved for the/)).toBeInTheDocument();
  });

  it('accepts an ordinary label', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText('LABEL'), 'script');

    expect(screen.getByLabelText('LABEL')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(/is reserved/)).not.toBeInTheDocument();
  });

  it('names the stage type the word belongs to', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText('LABEL'), 'approval');

    expect(screen.getByText(/reserved for the Approval stage type/)).toBeInTheDocument();
  });

  // A node that already carries a reserved label got it from its stage type,
  // so the field starts empty rather than immediately showing an error.
  it('starts blank when the node already holds a reserved label', () => {
    setup({ label: 'Deploy' });

    expect(screen.getByLabelText('LABEL')).toHaveValue('');
    expect(screen.queryByText(/is reserved/)).not.toBeInTheDocument();
  });

  // The rule warns but does not block — validatePipelineGraph is what actually
  // refuses the run.
  it('still records the reserved value on the node', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText('LABEL'), 'deploy');

    expect(lastPatch()).toEqual({ label: 'deploy' });
  });
});

describe('fields shown per stage type', () => {
  // An approval is a human gate with nothing to execute.
  it('hides everything executable for an approval stage', () => {
    setup({ type: 'approval' });

    expect(screen.queryByLabelText('COMMAND')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('LABEL')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('TIMEOUT (S)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('RETRIES')).not.toBeInTheDocument();
  });

  it('still names an approval stage', () => {
    setup({ type: 'approval' });

    expect(screen.getByLabelText('STAGE NAME')).toBeInTheDocument();
  });

  // A deploy stage is labelled "Deploy" by its type, so only the label field goes.
  it('hides only the label for a deploy stage', () => {
    setup({ type: 'deploy' });

    expect(screen.queryByLabelText('LABEL')).not.toBeInTheDocument();
    expect(screen.getByLabelText('COMMAND')).toBeInTheDocument();
    expect(screen.getByLabelText('TIMEOUT (S)')).toBeInTheDocument();
  });

  it('shows every field for a custom stage', () => {
    setup({ type: 'custom' });

    expect(screen.getByLabelText('LABEL')).toBeInTheDocument();
    expect(screen.getByLabelText('COMMAND')).toBeInTheDocument();
  });
});

describe('name and command', () => {
  it('patches the name as it is typed', async () => {
    const { user } = setup({ name: '' });

    await user.type(screen.getByLabelText('STAGE NAME'), 'lint');

    expect(lastPatch()).toEqual({ name: 'lint' });
  });

  it('patches the command as it is typed', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText('COMMAND'), 'npm ci');

    expect(lastPatch()).toEqual({ command: 'npm ci' });
  });
});

describe('secrets', () => {
  // Secrets are keyed by environment, so toggling one must not disturb the
  // selections stored for another.
  it('checks a secret into the selected environment', async () => {
    const { user } = setup({ secrets: {} });

    await user.click(screen.getByRole('checkbox', { name: /API_KEY/ }));

    expect(lastPatch()).toEqual({ secrets: { 'env-1': ['s1'] } });
  });

  it('unchecks a secret that was already selected', async () => {
    const { user } = setup({ secrets: { 'env-1': ['s1', 's2'] } });

    await user.click(screen.getByRole('checkbox', { name: /API_KEY/ }));

    expect(lastPatch()).toEqual({ secrets: { 'env-1': ['s2'] } });
  });

  it('leaves other environments untouched', async () => {
    const { user } = setup({ secrets: { 'env-2': ['s3'] } });

    await user.click(screen.getByRole('checkbox', { name: /API_KEY/ }));

    expect(lastPatch()).toEqual({ secrets: { 'env-2': ['s3'], 'env-1': ['s1'] } });
  });

  it('offers only the selected environment’s secrets', () => {
    setup();

    expect(screen.getByRole('checkbox', { name: /API_KEY/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /OTHER/ })).not.toBeInTheDocument();
  });

  it('does nothing when no environment is selected', async () => {
    const { user } = setup({}, { selectedEnvironmentId: null });

    const checkbox = screen.queryByRole('checkbox', { name: /API_KEY/ });
    if (checkbox) await user.click(checkbox);

    expect(updateNodeData).not.toHaveBeenCalled();
  });
});

describe('environment variables', () => {

  it('patches the post-edit array when a variable is edited', async () => {
    const { user } = setup({ env_vars: [{ key: 'A', value: '1' }] });

    await user.type(screen.getByDisplayValue('A'), 'B');

    expect(lastPatch()).toEqual({ env_vars: [{ key: 'AB', value: '1' }] });
  });

  it('renders the variables the node arrived with', () => {
    setup({ env_vars: [{ key: 'NODE_ENV', value: 'production' }] });

    expect(screen.getByDisplayValue('NODE_ENV')).toBeInTheDocument();
    expect(screen.getByDisplayValue('production')).toBeInTheDocument();
  });
});

describe('clearing timeout and retries', () => {
  it('leaves the timeout field empty when it is backspaced away', async () => {
    const { user } = setup({ timeout: 1800 });
    const field = screen.getByLabelText('TIMEOUT (S)');

    await user.clear(field);

    expect(field).toHaveValue('');
  });

  it('stays empty under further backspaces', async () => {
    const { user } = setup({ timeout: 1800 });
    const field = screen.getByLabelText('TIMEOUT (S)');

    await user.clear(field);
    await user.type(field, '{Backspace}{Backspace}');

    expect(field).toHaveValue('');
  });

  it('leaves the retries field empty when it is backspaced away', async () => {
    const { user } = setup({ retries: 3 });
    const field = screen.getByLabelText('RETRIES');

    await user.clear(field);

    expect(field).toHaveValue('');
  });

  it('clears the value on the node rather than patching a number', async () => {
    const { user } = setup({ timeout: 1800 });

    await user.clear(screen.getByLabelText('TIMEOUT (S)'));

    expect(lastPatch()).toStrictEqual({ timeout: undefined });
  });

  it('clears retries on the node too', async () => {
    const { user } = setup({ retries: 3 });

    await user.clear(screen.getByLabelText('RETRIES'));

    expect(lastPatch()).toStrictEqual({ retries: undefined });
  });

  it('accepts a fresh number after being cleared', async () => {
    const { user } = setup({ timeout: 1800 });
    const field = screen.getByLabelText('TIMEOUT (S)');

    await user.clear(field);
    await user.type(field, '90');

    expect(field).toHaveValue('90');
    expect(lastPatch()).toEqual({ timeout: 90 });
  });
});

describe('settling an empty field on blur', () => {
  // when timeout input loses focus and is either 0 or blank, default to 1800
  it('settles an emptied timeout on 1800', async () => {
    const { user } = setup({ timeout: 1800 });
    const field = screen.getByLabelText('TIMEOUT (S)');

    await user.clear(field);
    await user.tab();

    expect(field).toHaveValue('1800');
    expect(lastPatch()).toEqual({ timeout: 1800 });
  });

  it('settles a timeout typed as 0 on 1800 as well', async () => {
    const { user } = setup({ timeout: 1800 });
    const field = screen.getByLabelText('TIMEOUT (S)');

    await user.clear(field);
    await user.type(field, '0');
    await user.tab();

    expect(field).toHaveValue('1800');
    expect(lastPatch()).toEqual({ timeout: 1800 });
  });

  // catches '00' or '000' and sets them to 1800
  it.each(['00', '000'])('settles a timeout typed as %s', async (typed) => {
    const { user } = setup({ timeout: 1800 });
    const field = screen.getByLabelText('TIMEOUT (S)');

    await user.clear(field);
    await user.type(field, typed);
    await user.tab();

    expect(field).toHaveValue('1800');
    expect(lastPatch()).toEqual({ timeout: 1800 });
  });

  it('leaves a field that holds a number alone', async () => {
    const { user } = setup({ timeout: 1800 });
    const field = screen.getByLabelText('TIMEOUT (S)');

    await user.clear(field);
    await user.type(field, '90');
    updateNodeData.mockClear();
    await user.tab();

    expect(field).toHaveValue('90');
    expect(updateNodeData).not.toHaveBeenCalled();
  });

  // The reader can still empty it again after it has been settled once.
  it('can be emptied again after settling', async () => {
    const { user } = setup({ timeout: 1800 });
    const field = screen.getByLabelText('TIMEOUT (S)');

    await user.clear(field);
    await user.tab();
    await user.clear(field);

    expect(field).toHaveValue('');
  });

  // default blank retries input to 0
  it('settles emptied retries on 0, not on the timeout default', async () => {
    const { user } = setup({ retries: 3 });
    const field = screen.getByLabelText('RETRIES');

    await user.clear(field);
    await user.tab();

    expect(field).toHaveValue('0');
    expect(lastPatch()).toEqual({ retries: 0 });
  });

  it('leaves an untouched retries field at 0 when tabbed through', async () => {
    const { user } = setup();
    const field = screen.getByLabelText('RETRIES');

    expect(field).toHaveValue('0');

    await user.click(field);
    await user.tab();

    expect(field).toHaveValue('0');
    expect(lastPatch()).toEqual({ retries: 0 });
  });
});
