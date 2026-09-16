import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PipelineModal from '@/components/pipelines/PipelineModal';
import { addPipeline, deletePipeline, updatePipeline } from '@/lib/actions/pipelines';

/*
 * The modal is where a pipeline's optional repository is both shown and set, so
 * it carries the two halves of that change: the view drops the Repo URL block
 * when there is nothing to show, and the form no longer marks the field
 * `required`. The second is the load-bearing one — leaving `required` on would
 * make a repo-less pipeline unsaveable through the UI no matter what the schema
 * permits, and nothing in the data layer would report it.
 *
 * The server actions are mocked because what is under test is the modal's own
 * rendering; it is the same shape as SecretModal, whose suite covers the
 * useActionState lifecycle.
 */
jest.mock('@/lib/actions/pipelines', () => ({
  addPipeline: jest.fn(async () => ({ status: 'idle', message: '' })),
  updatePipeline: jest.fn(async () => ({ status: 'idle', message: '' })),
  deletePipeline: jest.fn(async () => ({ status: 'success', message: '' })),
}));

const add = addPipeline as jest.MockedFunction<typeof addPipeline>;
const update = updatePipeline as jest.MockedFunction<typeof updatePipeline>;
const remove = deletePipeline as jest.MockedFunction<typeof deletePipeline>;

type Props = React.ComponentProps<typeof PipelineModal>;

const setup = (over: Partial<Props> = {}) => {
  const props: Props = {
    mode: 'view',
    id: 'p1',
    name: 'CI',
    status: 'succeeded',
    lastRun: 'run-9',
    repoUrl: 'https://github.com/o/web-client',
    commitMessage: 'Fix the thing',
    description: null,
    createdBy: 'kyle',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    onClose: jest.fn(),
    onCreate: jest.fn(),
    onDelete: jest.fn(),
    onEdit: jest.fn(),
    onEditOrDeleteClose: jest.fn(),
    onSave: jest.fn(),
    onError: jest.fn(),
    ...over,
  };
  return { ...render(<PipelineModal {...props} />), ...props };
};

describe('view mode', () => {
  it('shows the repo url and its commit message', () => {
    setup();

    expect(screen.getByText('Repo URL')).toBeInTheDocument();
    expect(screen.getByText('https://github.com/o/web-client')).toBeInTheDocument();
    expect(screen.getByText('Fix the thing')).toBeInTheDocument();
  });

  /*
   * The modal names the link rather than showing it as a bare icon: unlike the
   * table cell, this is a standalone field under a label, where an icon alone
   * leaves the reader guessing what it opens.
   */
  it('links to the latest run instead of printing its id', () => {
    setup();

    const link = screen.getByRole('link', { name: /view run/i });

    expect(link).toHaveAttribute('href', '/runs/run-9');
    expect(screen.queryByText('run-9')).not.toBeInTheDocument();
  });

  it('omits the last run field for a pipeline that has never run', () => {
    setup({ lastRun: null });

    expect(screen.queryByText('Last Run')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view run/i })).not.toBeInTheDocument();
  });

  it('drops the whole repo url block when there is none', () => {
    setup({ repoUrl: null });

    expect(screen.queryByText('Repo URL')).not.toBeInTheDocument();
  });

  /*
   * The commit message lives inside that block, so it goes with it. Asserted with
   * a message deliberately still set, since the block is gated on the repo alone.
   */
  it('takes the commit message with it', () => {
    setup({ repoUrl: null });

    expect(screen.queryByText('Fix the thing')).not.toBeInTheDocument();
  });

  it('keeps the fields that are not repo-derived', () => {
    setup({ repoUrl: null, commitMessage: null });

    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.getByText('Succeeded')).toBeInTheDocument();
    expect(screen.getByText('kyle')).toBeInTheDocument();
  });
});

/*
 * A pipeline with no repository has to be creatable and editable, which means the
 * field the schema now allows to be null must not be blocked by the form.
 */
describe.each(['create', 'edit'] as const)('%s mode', (mode) => {
  it('does not require a repo url', () => {
    setup({ mode, repoUrl: null });

    expect(screen.getByLabelText(/repo url/i)).not.toBeRequired();
  });

  it('still requires a name', () => {
    setup({ mode, repoUrl: null });

    expect(screen.getByLabelText(/name/i)).toBeRequired();
  });

  it('renders an empty repo url field rather than the string "null"', () => {
    setup({ mode, repoUrl: null });

    expect(screen.getByLabelText(/repo url/i)).toHaveValue('');
  });
});

/*
 * The controller shows whatever text it is handed, so the modal decides a
 * toast's wording by forwarding its server action's message. SecretModal's suite
 * explains the shape of these cases.
 */
describe("reporting the server's message", () => {
  const submitForm = () => fireEvent.submit(document.getElementById('modal-form')!);

  it('hands a successful create its message', async () => {
    add.mockResolvedValueOnce({ status: 'success', message: 'Pipeline added' });
    const { onCreate } = setup({ mode: 'create' });

    submitForm();

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('Pipeline added'));
  });

  it('hands a successful edit its message', async () => {
    update.mockResolvedValueOnce({ status: 'success', message: 'Pipeline updated' });
    const { onSave } = setup({ mode: 'edit' });

    submitForm();

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Pipeline updated'));
  });

  /*
   * A failed edit reports the edit action's message. Reading createState here
   * instead reports the create form's untouched initial message — an empty toast.
   */
  it("reports a failed edit with the edit action's message", async () => {
    update.mockResolvedValueOnce({ status: 'error', message: 'A pipeline with this name already exists' });
    const { onError, onSave } = setup({ mode: 'edit' });

    submitForm();

    await waitFor(() => expect(onError).toHaveBeenCalledWith('A pipeline with this name already exists'));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  describe('deleting', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('hands a successful delete its message', async () => {
      remove.mockResolvedValueOnce({ status: 'success', message: 'Pipeline deleted' });
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { onDelete } = setup({ mode: 'view' });

      await user.click(screen.getByRole('button', { name: 'Delete' }));
      act(() => { jest.advanceTimersByTime(2000); });
      await user.click(screen.getAllByRole('button', { name: 'Delete' }).at(-1)!);

      await waitFor(() => expect(onDelete).toHaveBeenCalledWith('Pipeline deleted'));
      expect(remove).toHaveBeenCalledWith('p1');
    });
  });
});
