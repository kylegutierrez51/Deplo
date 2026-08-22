import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmationModal from '@/components/ui/modals/ConfirmationModal';

/*
 * ConfirmationModal replaced DeleteConfirmationModal as the single confirm
 * dialog behind every destructive action (delete, cancel a run, regenerate a
 * secret, approve/reject a stage).
 *
 * Three behaviours carry the weight:
 *
 *  - The arming gate. For `timeoutMs` (default 3s) the confirm button is a
 *    look-alike with no handler, so a reflexive double-click on a row's delete
 *    icon cannot destroy a record.
 *  - The busy state. Once the action is in flight both buttons go inert and the
 *    backdrop stops closing, so the dialog cannot be dismissed mid-write.
 *  - The metadata row. Its guard is `(subMessage || pill) &&`, and the
 *    parenthesisation is load-bearing — see the regression case below.
 *
 * No preamble: the component imports React, its CSS module and ../Pill, and
 * nothing out of lib/, so none of the jest.mock slots apply. handleConfirmation
 * is injected as a prop, so no server action needs mocking either.
 */

const ARMING_DELAY = 3000;

function setup(over: Partial<Parameters<typeof ConfirmationModal>[0]> = {}) {
  const props = {
    message: 'Delete this secret?',
    action: 'Delete',
    handleConfirmation: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    onClose: jest.fn(),
    ...over,
  };
  // pointerEventsCheck is disabled because the unarmed button is styled, not
  // disabled, and jsdom has no layout to resolve pointer-events against.
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime, pointerEventsCheck: 0 });
  render(<ConfirmationModal {...props} />);
  return { ...props, user };
}

const arm = (ms: number = ARMING_DELAY) => act(() => { jest.advanceTimersByTime(ms); });

const overlay = () => document.querySelector('[class*="confirmation-overlay"]')!;
const metaRow = () => document.querySelector('[class*="message-meta"]');

/*
 * A confirmation whose promise this test controls, so the in-flight window can
 * be inspected rather than raced. The executor runs synchronously, so `release`
 * is assigned by the time the mock returns.
 */
function pendingConfirmation() {
  let release!: () => void;
  const handleConfirmation = jest.fn(() => new Promise<void>(resolve => { release = resolve; }));
  return { handleConfirmation, release: async () => { await act(async () => { release(); }); } };
}

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

describe('the arming gate', () => {
  it('does nothing when the confirm button is pressed too early', async () => {
    const { user, handleConfirmation } = setup();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(handleConfirmation).not.toHaveBeenCalled();
  });

  it('is still inert one millisecond before arming', async () => {
    const { user, handleConfirmation } = setup();

    arm(ARMING_DELAY - 1);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(handleConfirmation).not.toHaveBeenCalled();
  });

  it('runs the action once armed', async () => {
    const { user, handleConfirmation } = setup();

    arm();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(handleConfirmation).toHaveBeenCalledTimes(1);
  });

  // The two buttons differ by class, which is how the unarmed state is
  // communicated visually — the ghost is disabled, the live one is not.
  it('swaps the ghost button for the live one when it arms', () => {
    setup();
    const before = screen.getByRole('button', { name: 'Delete' });
    expect(before).toBeDisabled();
    const ghostClass = before.className;

    arm();

    const after = screen.getByRole('button', { name: 'Delete' });
    expect(after.className).not.toBe(ghostClass);
    expect(after).toBeEnabled();
  });

  it('honours a caller-supplied timeoutMs', async () => {
    const { user, handleConfirmation } = setup({ timeoutMs: 1500 });

    arm(1499);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(handleConfirmation).not.toHaveBeenCalled();

    arm(1);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(handleConfirmation).toHaveBeenCalledTimes(1);
  });
});

describe('the busy state', () => {
  it('makes both buttons inert while the action is in flight', async () => {
    const { handleConfirmation, release } = pendingConfirmation();
    const { user } = setup({ handleConfirmation });

    arm();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    await release();
  });

  // The overlay drops its onClick entirely while busy, so a stray backdrop
  // click cannot dismiss the dialog out from under a write in progress.
  it('ignores a backdrop click while the action is in flight', async () => {
    const { handleConfirmation, release } = pendingConfirmation();
    const { user, onClose } = setup({ handleConfirmation });

    arm();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(overlay());

    expect(onClose).not.toHaveBeenCalled();

    await release();
  });
});

describe('closing', () => {
  it('closes on Cancel, even before arming', async () => {
    const { user, onClose } = setup();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is clicked', async () => {
    const { user, onClose } = setup();

    await user.click(overlay());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // The container stops propagation so a click inside the dialog does not reach
  // the overlay's close handler.
  it('stays open when the dialog body is clicked', async () => {
    const { user, onClose } = setup();

    await user.click(screen.getByText('Delete this secret?'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('labels the cancel button from cancelAction when given', () => {
    setup({ cancelAction: 'Back' });

    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });
});

describe('the confirm variant', () => {
  it('styles the confirm button as danger by default', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('confirm-danger-ghost');

    arm();

    const armed = screen.getByRole('button', { name: 'Delete' }).className;
    expect(armed).toContain('confirm-danger');
    expect(armed).not.toContain('ghost');
  });

  it('styles the confirm button as success when asked', () => {
    setup({ variant: 'success', action: 'Approve' });
    expect(screen.getByRole('button', { name: 'Approve' }).className).toContain('confirm-success-ghost');

    arm();

    const armed = screen.getByRole('button', { name: 'Approve' }).className;
    expect(armed).toContain('confirm-success');
    expect(armed).not.toContain('ghost');
  });
});

describe('the message metadata row', () => {
  it('renders no row when there is neither a sub-message nor a pill', () => {
    setup();

    expect(metaRow()).toBeNull();
  });

  /*
   * Regression. Written without the parentheses, `subMessage || pill && (...)`
   * parses as `subMessage || (pill && ...)` because && binds tighter than ||.
   * A truthy subMessage then short-circuits the whole expression to itself, so
   * React renders it as a bare unstyled text node and the row — pill included —
   * never reaches the DOM at all.
   */
  it('keeps a lone sub-message inside the row', () => {
    setup({ subMessage: <span>Environment: prev</span> });

    expect(metaRow()).toHaveTextContent('Environment: prev');
  });

  it('renders a lone pill inside the row', () => {
    setup({ pill: { variant: 'preview', label: 'Preview' } });

    expect(metaRow()).toHaveTextContent('Preview');
  });

  it('renders a sub-message and a pill together in one row', () => {
    setup({
      subMessage: <span>Environment: prev</span>,
      pill: { variant: 'preview', label: 'Preview' },
    });

    expect(metaRow()).toHaveTextContent('Environment: prev');
    expect(metaRow()).toHaveTextContent('Preview');
  });
});

describe('copy', () => {
  /*
   * The run case carries cancelAction: 'Back' because its confirm button is
   * itself labelled "Cancel" — RunDetailActions passes it for that reason, and
   * without it both buttons answer to the same name.
   */
  it.each([
    { message: 'Delete this secret?', action: 'Delete' },
    { message: 'Cancel this run?', action: 'Cancel', cancelAction: 'Back' },
    { message: "Regenerate this webhook's secret?", action: 'Regenerate' },
    { message: 'Approve this stage?', action: 'Approve', variant: 'success' as const },
  ])('renders $message with its $action button', (props) => {
    setup(props);

    expect(screen.getByText(props.message)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: props.action })).toBeInTheDocument();
  });
});
