import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WebhookModal from '@/components/webhooks/WebhookModal';
import { regenerateWebhookSecret, updateWebhook } from '@/lib/actions/webhooks';

jest.mock('@/lib/actions/webhooks', () => ({
  addWebhook: jest.fn(async () => ({ status: 'idle', message: '' })),
  updateWebhook: jest.fn(async () => ({ status: 'idle', message: '' })),
  deleteWebhook: jest.fn(async () => ({ status: 'success', message: '' })),
  regenerateWebhookSecret: jest.fn(async () => ({ status: 'idle', message: '' })),
}));

const update = updateWebhook as jest.MockedFunction<typeof updateWebhook>;
const regenerate = regenerateWebhookSecret as jest.MockedFunction<typeof regenerateWebhookSecret>;

type Props = React.ComponentProps<typeof WebhookModal>;

const setup = (over: Partial<Props> = {}) => {
  const props: Props = {
    mode: 'edit',
    id: 'wh-1',
    pipelineName: 'deploy-api',
    branchFilters: ['main', 'release/*', 'hotfix/*'],
    events: ['push'],
    createdBy: 'kyle',
    lastDelivery: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    pipelines: [],
    onClose: jest.fn(),
    onCreate: jest.fn(),
    onDelete: jest.fn(),
    onEdit: jest.fn(),
    onEditOrDeleteClose: jest.fn(),
    onSave: jest.fn(),
    onRegenerate: jest.fn(),
    onError: jest.fn(),
    ...over,
  };
  render(<WebhookModal {...props} />);
  return props;
};

/* What `updateWebhook` would receive if the form were submitted right now. */
const submittedFilters = () => {
  const form = document.getElementById('modal-form') as HTMLFormElement;
  return new FormData(form).getAll('branch_filters');
};

const removeButton = (filter: string) =>
  screen.getByRole('button', { name: `Remove branch filter ${filter}` });

beforeEach(() => {
  update.mockClear();
  regenerate.mockReset();
});

describe('removing a branch filter', () => {
  it('drops only the clicked filter and keeps the rest in order', async () => {
    const user = userEvent.setup();
    setup();

    expect(submittedFilters()).toEqual(['main', 'release/*', 'hotfix/*']);

    await user.click(removeButton('release/*'));

    expect(submittedFilters()).toEqual(['main', 'hotfix/*']);
    expect(screen.queryByText('release/*')).not.toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('hotfix/*')).toBeInTheDocument();
  });

  /*
   * Removal is by index, so identical filters are where that could go wrong:
   * `main` appearing twice must lose exactly one entry, not both and not none.
   */
  it('removes one of two identical filters', async () => {
    const user = userEvent.setup();
    setup({ branchFilters: ['main', 'main'] });

    await user.click(screen.getAllByRole('button', { name: 'Remove branch filter main' })[0]);

    expect(submittedFilters()).toEqual(['main']);
  });

  it('empties the field when every filter is removed', async () => {
    const user = userEvent.setup();
    setup({ branchFilters: ['main'] });

    await user.click(removeButton('main'));

    expect(submittedFilters()).toEqual([]);
    expect(screen.queryByRole('button', { name: /Remove branch filter/ })).not.toBeInTheDocument();
  });

  /* The typo path the affordance exists for: added by Enter, taken back again. */
  it('removes a filter that was just typed in', async () => {
    const user = userEvent.setup();
    setup({ branchFilters: [] });

    await user.type(screen.getByPlaceholderText(/press Enter to add/), 'relase/*{Enter}');
    expect(submittedFilters()).toEqual(['relase/*']);

    await user.click(removeButton('relase/*'));

    expect(submittedFilters()).toEqual([]);
  });

  /*
   * The pills sit inside `modal-form`, so a button without an explicit
   * type="button" would default to submit and save the webhook on every
   * removal. The Save Changes click is the positive control: without it a
   * "did not submit" assertion could pass because nothing submits in jsdom.
   */
  it('does not submit the form', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(removeButton('main'));
    expect(update).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('offers no remove buttons in view mode', () => {
    setup({ mode: 'view' });

    expect(screen.getByText('release/*')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove branch filter/ })).not.toBeInTheDocument();
  });
});


describe('regenerating the secret', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const REVEALED_HINT = /Copy this now/;

  /** Opens the ConfirmationModal, waits out its timer, and confirms. */
  const confirmRegenerate = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Regenerate secret' }));
    act(() => { jest.advanceTimersByTime(2000); });
    await user.click(screen.getByRole('button', { name: 'Regenerate' }));
  };

  const withFakeTimers = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

  it('reveals the new secret and reports the success message', async () => {
    const user = withFakeTimers();
    regenerate.mockResolvedValue({
      status: 'success',
      message: 'Saved regenerated secret!',
      secret: 'whsec_regenerated',
    });
    const { onRegenerate, onError } = setup();

    expect(screen.queryByText(REVEALED_HINT)).not.toBeInTheDocument();

    await confirmRegenerate(user);

    await waitFor(() => expect(onRegenerate).toHaveBeenCalledWith('Saved regenerated secret!'));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
    expect(regenerate).toHaveBeenCalledWith('wh-1');
    expect(onError).not.toHaveBeenCalled();
  });

  it('shows the revealed secret banner and dismisses the confirmation', async () => {
    const user = withFakeTimers();
    regenerate.mockResolvedValue({
      status: 'success',
      message: 'Saved regenerated secret!',
      secret: 'whsec_regenerated',
    });
    setup();

    await confirmRegenerate(user);

    const revealed = await screen.findByDisplayValue('whsec_regenerated');
    expect(revealed).toHaveAttribute('type', 'password');
    expect(screen.getByText(REVEALED_HINT)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Regenerate' })).not.toBeInTheDocument();
  });

  it('reports a failure through onError and reveals nothing', async () => {
    const user = withFakeTimers();
    regenerate.mockResolvedValue({
      status: 'error',
      message: 'This webhook no longer exists.',
    });
    const { onRegenerate, onError } = setup();

    await confirmRegenerate(user);

    await waitFor(() => expect(onError).toHaveBeenCalledWith('This webhook no longer exists.'));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onRegenerate).not.toHaveBeenCalled();
    expect(screen.queryByText(REVEALED_HINT)).not.toBeInTheDocument();
  });

  it('closes the confirmation modal after a failure', async () => {
    const user = withFakeTimers();
    regenerate.mockResolvedValue({
      status: 'error',
      message: 'This webhook no longer exists.',
    });
    const { onError } = setup();

    await confirmRegenerate(user);

    await waitFor(() => expect(onError).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Regenerate' })).not.toBeInTheDocument(),
    );
  });

  // when 'result.secret' is falsy
  it('closes the dialog even when neither branch reports anything', async () => {
    const user = withFakeTimers();
    regenerate.mockResolvedValue({ status: 'success', message: 'Saved regenerated secret!' });
    const { onRegenerate, onError } = setup();

    await confirmRegenerate(user);

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Regenerate' })).not.toBeInTheDocument(),
    );
    expect(onRegenerate).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(screen.queryByText(REVEALED_HINT)).not.toBeInTheDocument();
  });

  it('offers no regenerate affordance outside edit mode', () => {
    setup({ mode: 'view' });

    expect(screen.queryByRole('button', { name: 'Regenerate secret' })).not.toBeInTheDocument();
  });
});
