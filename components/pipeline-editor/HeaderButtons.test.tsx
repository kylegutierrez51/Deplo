import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeaderButtons from '@/components/pipeline-editor/HeaderButtons';
import { usePipelineGraph } from '@/components/pipeline-editor/PipelineGraphProvider';
import { addPipelineRun, savePipelineDefinition, validatePipeline } from '@/lib/actions/pipelines';
import { useToast } from '@/components/ui/toast/ToastContext';

/*
 * The buttons only talk to the editor through the graph context and to the
 * server through the actions, so all of them are stubbed and the assertions
 * are about what the run reports to the user. Mounting the real provider would
 * drag in a ReactFlow canvas for no benefit, and mocking the actions module
 * keeps lib/prisma -- which opens a pg connection at module scope -- out of it.
 */
jest.mock('@/components/pipeline-editor/PipelineGraphProvider', () => ({
  usePipelineGraph: jest.fn(),
}));

jest.mock('@/lib/actions/pipelines', () => ({
  addPipelineRun: jest.fn(),
  savePipelineDefinition: jest.fn(),
  validatePipeline: jest.fn(),
}));

jest.mock('@/components/ui/toast/ToastContext', () => ({
  useToast: jest.fn(),
}));

const useGraph = usePipelineGraph as jest.MockedFunction<typeof usePipelineGraph>;
const runPipeline = addPipelineRun as jest.MockedFunction<typeof addPipelineRun>;
const validate = validatePipeline as jest.MockedFunction<typeof validatePipeline>;
const toast = useToast as jest.MockedFunction<typeof useToast>;

const showToast = jest.fn();
const dismissStickyToasts = jest.fn();

/*
 * The `link` of the most recent showToast call. It reads off the single props object
 * rather than a positional slot, and the difference is not cosmetic here: this file
 * mocks the whole ToastContext module, so `showToast` is a bare jest.fn() whose calls
 * TypeScript never checks. Nothing but this assertion notices if the shape drifts.
 */
const linkArg = () => showToast.mock.calls.at(-1)?.[0]?.link;

function setup() {
  useGraph.mockReturnValue({
    pipelineId: 'p1', selectedEnvironmentId: 'env-1', nodes: [], edges: [],
  } as never);
  toast.mockReturnValue({ showToast, dismissStickyToasts } as never);

  const user = userEvent.setup();
  render(<HeaderButtons />);
  return { user };
}

const clickRun = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /run pipeline/i }));
  await waitFor(() => expect(showToast).toHaveBeenCalled());
};

const clickValidate = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /validate pipeline/i }));
  await waitFor(() => expect(showToast).toHaveBeenCalled());
};

const lastToast = () => showToast.mock.calls.at(-1)?.[0];

beforeEach(() => { showToast.mockClear(); dismissStickyToasts.mockClear(); validate.mockReset(); });

describe('the run report', () => {
  it('links to the run it created', async () => {
    runPipeline.mockResolvedValue({ status: 'success', message: 'Pipeline Run Triggered!', runId: 'run-1' });
    const { user } = setup();

    await clickRun(user);

    expect(linkArg()).toBe('/runs/run-1');
  });

  /*
   * Every error path of addPipelineRun returns a message and no runId, so
   * interpolating it unconditionally aims the toast's link at /runs/undefined
   * and lands the user on the not-found page.
   */
  it('carries no link when no run was created', async () => {
    runPipeline.mockResolvedValue({ status: 'error', message: 'Save your current pipeline' });
    const { user } = setup();

    await clickRun(user);

    expect(linkArg()).toBeUndefined();
  });
});

describe('the validation report', () => {
  it('checks the graph in the editor against the selected environment', async () => {
    validate.mockResolvedValue({ status: 'success', message: 'Pipeline is valid' });
    const { user } = setup();

    await clickValidate(user);

    expect(validate).toHaveBeenCalledWith('env-1', [], []);
  });

  // Problems stay up while the user works through them; a clean result dismisses itself.
  it('pins a failed report until dismissed', async () => {
    validate.mockResolvedValue({ status: 'error', message: 'Cannot run pipeline:\n• a is missing a command' });
    const { user } = setup();

    await clickValidate(user);

    expect(lastToast()).toMatchObject({
      text: 'Cannot run pipeline:\n• a is missing a command',
      icon: 'close-circle-outline',
      options: { sticky: true },
    });
  });

  it('lets a clean report time out', async () => {
    validate.mockResolvedValue({ status: 'success', message: 'Pipeline is valid' });
    const { user } = setup();

    await clickValidate(user);

    expect(lastToast()).toMatchObject({
      text: 'Pipeline is valid',
      icon: 'checkmark-circle-outline',
      options: { sticky: false },
    });
  });

  // A re-check after fixing one problem must replace the old list, not stack a second one on it.
  it('clears the previous report before checking again', async () => {
    validate.mockResolvedValue({ status: 'success', message: 'Pipeline is valid' });
    const { user } = setup();

    await clickValidate(user);

    expect(dismissStickyToasts).toHaveBeenCalled();
  });

  it('starts no run and saves nothing', async () => {
    validate.mockResolvedValue({ status: 'success', message: 'Pipeline is valid' });
    runPipeline.mockClear();
    (savePipelineDefinition as jest.Mock).mockClear();
    const { user } = setup();

    await clickValidate(user);

    expect(runPipeline).not.toHaveBeenCalled();
    expect(savePipelineDefinition).not.toHaveBeenCalled();
  });
});
