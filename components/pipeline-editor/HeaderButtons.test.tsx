import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeaderButtons from '@/components/pipeline-editor/HeaderButtons';
import { usePipelineGraph } from '@/components/pipeline-editor/PipelineGraphProvider';
import { addPipelineRun } from '@/lib/actions/pipelines';
import { useToast } from '@/components/ui/toast/ToastContext';

/*
 * The buttons only talk to the editor through the graph context and to the
 * server through the two actions, so all three are stubbed and the assertions
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
}));

jest.mock('@/components/ui/toast/ToastContext', () => ({
  useToast: jest.fn(),
}));

const useGraph = usePipelineGraph as jest.MockedFunction<typeof usePipelineGraph>;
const runPipeline = addPipelineRun as jest.MockedFunction<typeof addPipelineRun>;
const toast = useToast as jest.MockedFunction<typeof useToast>;

const showToast = jest.fn();
const dismissStickyToasts = jest.fn();

/** The `link` argument of the most recent showToast call. */
const linkArg = () => showToast.mock.calls.at(-1)?.[2];

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

beforeEach(() => { showToast.mockClear(); dismissStickyToasts.mockClear(); });

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
