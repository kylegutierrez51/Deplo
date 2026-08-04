import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeleteConfirmationModal from '@/components/ui/modals/DeleteConfirmationModal';
import type { FormState } from '@/lib/types';

/*
 * The interesting behaviour is the three-second arming gate: for the first three
 * seconds the Delete button is a look-alike with no handler, so a reflexive
 * double-click on the row's delete icon cannot destroy a record.
 *
 * deleteRecord is injected as a prop, so no server action needs mocking.
 */

const ARMING_DELAY = 3000;

const success: FormState = { status: 'success', message: 'deleted' };

function setup(over: Partial<Parameters<typeof DeleteConfirmationModal>[0]> = {}) {
  const props = {
    id: 'rec-1',
    recordLabel: 'secret',
    onDelete: jest.fn(),
    onDeleteClose: jest.fn(),
    onError: jest.fn(),
    deleteRecord: jest.fn<Promise<FormState>, [string]>().mockResolvedValue(success),
    ...over,
  };
  // pointerEventsCheck is disabled because the unarmed button is styled, not
  // disabled, and jsdom has no layout to resolve pointer-events against.
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime, pointerEventsCheck: 0 });
  render(<DeleteConfirmationModal {...props} />);
  return { ...props, user };
}

const arm = () => act(() => { jest.advanceTimersByTime(ARMING_DELAY); });

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

describe('the arming gate', () => {
  it('does nothing when Delete is pressed too early', async () => {
    const { user, deleteRecord, onDelete } = setup();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(deleteRecord).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('is still inert one millisecond before arming', async () => {
    const { user, deleteRecord } = setup();

    act(() => { jest.advanceTimersByTime(ARMING_DELAY - 1); });
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(deleteRecord).not.toHaveBeenCalled();
  });

  it('deletes once armed', async () => {
    const { user, deleteRecord } = setup();

    arm();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(deleteRecord).toHaveBeenCalledWith('rec-1');
  });

  // The two buttons differ by class, which is how the disabled state is
  // communicated visually. Cancel must work throughout.
  it('swaps the ghost button for the live one when it arms', () => {
    setup();
    const before = screen.getByRole('button', { name: 'Delete' }).className;

    arm();

    expect(screen.getByRole('button', { name: 'Delete' }).className).not.toBe(before);
  });
});

describe('delete outcomes', () => {
  it('reports success to the caller', async () => {
    const { user, onDelete, onError } = setup();

    arm();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('forwards the action message on failure', async () => {
    const deleteRecord = jest.fn<Promise<FormState>, [string]>()
      .mockResolvedValue({ status: 'error', message: 'Still referenced by a run.' });
    const { user, onDelete, onError } = setup({ deleteRecord });

    arm();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onError).toHaveBeenCalledWith('Still referenced by a run.');
    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe('closing', () => {
  it('closes on Cancel, even before arming', async () => {
    const { user, onDeleteClose } = setup();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onDeleteClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is clicked', async () => {
    const { user, onDeleteClose } = setup();

    await user.click(document.querySelector('[class*="delete-overlay"]')!);

    expect(onDeleteClose).toHaveBeenCalledTimes(1);
  });

  // The container stops propagation so a click inside the dialog does not reach
  // the overlay's close handler.
  it('stays open when the dialog body is clicked', async () => {
    const { user, onDeleteClose } = setup();

    await user.click(screen.getByText('Delete this secret?'));

    expect(onDeleteClose).not.toHaveBeenCalled();
  });
});

describe('copy', () => {
  it.each(['secret', 'pipeline', 'environment', 'webhook'])(
    'names the %s being deleted', (recordLabel) => {
      setup({ recordLabel });

      expect(screen.getByText(`Delete this ${recordLabel}?`)).toBeInTheDocument();
    });
});
