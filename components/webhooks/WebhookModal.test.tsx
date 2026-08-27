import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WebhookModal from '@/components/webhooks/WebhookModal';
import { updateWebhook } from '@/lib/actions/webhooks';

jest.mock('@/lib/actions/webhooks', () => ({
  addWebhook: jest.fn(async () => ({ status: 'idle', message: '' })),
  updateWebhook: jest.fn(async () => ({ status: 'idle', message: '' })),
  deleteWebhook: jest.fn(async () => ({ status: 'success', message: '' })),
  regenerateWebhookSecret: jest.fn(async () => ({ status: 'idle', message: '' })),
}));

const update = updateWebhook as jest.MockedFunction<typeof updateWebhook>;

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
    onError: jest.fn(),
    ...over,
  };
  return render(<WebhookModal {...props} />);
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
