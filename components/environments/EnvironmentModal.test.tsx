import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EnvironmentModal from '@/components/environments/EnvironmentModal';
import { addEnvironment, deleteEnvironment, updateEnvironment } from '@/lib/actions/environments';

/*
 * The server actions are mocked because what is under test is the modal's own
 * behaviour; it is the same useActionState shape as SecretModal.
 */
jest.mock('@/lib/actions/environments', () => ({
  addEnvironment: jest.fn(async () => ({ status: 'idle', message: '' })),
  updateEnvironment: jest.fn(async () => ({ status: 'idle', message: '' })),
  deleteEnvironment: jest.fn(async () => ({ status: 'success', message: '' })),
}));

const add = addEnvironment as jest.MockedFunction<typeof addEnvironment>;
const update = updateEnvironment as jest.MockedFunction<typeof updateEnvironment>;
const remove = deleteEnvironment as jest.MockedFunction<typeof deleteEnvironment>;

type Props = React.ComponentProps<typeof EnvironmentModal>;

const setup = (over: Partial<Props> = {}) => {
  const props: Props = {
    mode: 'view',
    id: 'env-1',
    name: 'production',
    type: 'production',
    secrets: 3,
    requireApproval: false,
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
  render(<EnvironmentModal {...props} />);
  return props;
};

/*
 * The controller shows whatever text it is handed, so the modal decides a
 * toast's wording by forwarding its server action's message. SecretModal's suite
 * explains the shape of these cases.
 */
describe("reporting the server's message", () => {
  const submitForm = () => fireEvent.submit(document.getElementById('modal-form')!);

  it('hands a successful create its message', async () => {
    add.mockResolvedValueOnce({ status: 'success', message: 'Environment added' });
    const { onCreate } = setup({ mode: 'create' });

    submitForm();

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('Environment added'));
  });

  it('hands a successful edit its message', async () => {
    update.mockResolvedValueOnce({ status: 'success', message: 'Environment updated' });
    const { onSave } = setup({ mode: 'edit' });

    submitForm();

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Environment updated'));
  });

  /*
   * A failed edit reports the edit action's message. Reading createState here
   * instead reports the create form's untouched initial message — an empty toast.
   */
  it("reports a failed edit with the edit action's message", async () => {
    update.mockResolvedValueOnce({ status: 'error', message: 'An environment with this name already exists' });
    const { onError, onSave } = setup({ mode: 'edit' });

    submitForm();

    await waitFor(() => expect(onError).toHaveBeenCalledWith('An environment with this name already exists'));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  describe('deleting', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('hands a successful delete its message', async () => {
      remove.mockResolvedValueOnce({ status: 'success', message: 'Environment deleted' });
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { onDelete } = setup({ mode: 'view' });

      await user.click(screen.getByRole('button', { name: 'Delete' }));
      act(() => { jest.advanceTimersByTime(2000); });
      await user.click(screen.getAllByRole('button', { name: 'Delete' }).at(-1)!);

      await waitFor(() => expect(onDelete).toHaveBeenCalledWith('Environment deleted'));
      expect(remove).toHaveBeenCalledWith('env-1');
    });
  });
});
