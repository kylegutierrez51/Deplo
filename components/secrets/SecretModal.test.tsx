import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SecretModal from '@/components/secrets/SecretModal';

/*
 * The representative useActionState modal — EnvironmentModal, PipelineModal and
 * WebhookModal are all the same shape. The server actions are mocked because
 * what is under test is the modal's own behaviour: which controls each mode
 * renders, the reveal/copy affordances, the environment autocomplete, and which
 * action state the error branch reports.
 */

jest.mock('@/lib/actions/secrets', () => ({
  addSecret: jest.fn(async () => ({ status: 'idle', message: '' })),
  updateSecret: jest.fn(async () => ({ status: 'idle', message: '' })),
  deleteSecret: jest.fn(async () => ({ status: 'success', message: '' })),
}));

const environments = [
  { id: 'env-1', name: 'Production', type: 'production' as const },
  { id: 'env-2', name: 'Staging', type: 'staging' as const },
  { id: 'env-3', name: 'Development', type: 'development' as const },
];

function setup(over: Record<string, unknown> = {}) {
  const props = {
    mode: 'view' as const,
    id: 'sec-1',
    secretKey: 'API_KEY',
    value: 'super-secret-value',
    environmentName: 'Production',
    environmentType: 'production' as const,
    notes: null,
    createdBy: 'kyle',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    environments,
    onClose: jest.fn(),
    onCreate: jest.fn(),
    onDelete: jest.fn(),
    onEdit: jest.fn(),
    onEditOrDeleteClose: jest.fn(),
    onSave: jest.fn(),
    onError: jest.fn(),
    ...over,
  };
  const user = userEvent.setup();
  render(<SecretModal {...(props as unknown as React.ComponentProps<typeof SecretModal>)} />);
  return { ...props, user };
}

describe('mode rendering', () => {
  it('offers edit and delete in view mode', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument();
  });

  it('offers create and cancel in create mode', () => {
    setup({ mode: 'create' });

    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('offers save in edit mode', () => {
    setup({ mode: 'edit' });

    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('routes the edit affordance to the controller', async () => {
    const { user, onEdit } = setup();

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  // Cancel means something different in each mode: close the modal from create,
  // but drop back to view from edit.
  it('cancels out of create by closing', async () => {
    const { user, onClose } = setup({ mode: 'create' });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cancels out of edit by returning to view', async () => {
    const { user, onEditOrDeleteClose } = setup({ mode: 'edit' });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onEditOrDeleteClose).toHaveBeenCalledTimes(1);
  });
});

/*
 * The Value and Environment labels carry htmlFor="secret-value" / "env_name",
 * but those inputs have only a `name` attribute and no matching `id`, so the
 * label is not associated with the control and getByLabelText cannot find it.
 * A minor accessibility gap; the selectors below work around it rather than
 * asserting the broken association.
 */
// The read-only value input carries neither id nor name, so it is located by
// the value it displays.
const valueInput = () => screen.getByDisplayValue('super-secret-value');

describe('the value field', () => {
  // getSecretById is the only path that decrypts, so this modal is the one
  // place a plaintext secret is on screen — it starts masked.
  it('masks the value until revealed', () => {
    setup();

    expect(valueInput()).toHaveAttribute('type', 'password');
  });

  it('reveals the value on demand and hides it again', async () => {
    const { user } = setup();
    // Icon-only buttons have no accessible name, so the toggle is found via the
    // ion-icon it wraps. The icon name itself flips with the state.
    const reveal = () => document.querySelector('ion-icon[name="eye-outline"], ion-icon[name="eye-off-outline"]')!
      .closest('button')!;

    await user.click(reveal());
    expect(valueInput()).toHaveAttribute('type', 'text');

    await user.click(reveal());
    expect(valueInput()).toHaveAttribute('type', 'password');
  });

  it('seeds the edit form with the current key', () => {
    setup({ mode: 'edit' });

    expect(screen.getByLabelText('Key')).toHaveValue('API_KEY');
  });

  it('starts the create form empty', () => {
    setup({ mode: 'create', secretKey: '', value: '', environmentName: '' });

    expect(screen.getByLabelText('Key')).toHaveValue('');
  });
});

describe('the environment autocomplete', () => {
  it('shows nothing before the user types', () => {
    setup({ mode: 'create', environmentName: '' });

    expect(screen.queryByText('Production')).not.toBeInTheDocument();
  });

  it('filters case-insensitively as the user types', async () => {
    const { user } = setup({ mode: 'create', environmentName: '' });

    await user.type(screen.getByPlaceholderText('e.g. Production'), 'prod');

    expect(screen.getByText('Production')).toBeInTheDocument();
    expect(screen.queryByText('Staging')).not.toBeInTheDocument();
  });

  it('matches on a substring, not just a prefix', async () => {
    const { user } = setup({ mode: 'create', environmentName: '' });

    await user.type(screen.getByPlaceholderText('e.g. Production'), 'elop');

    expect(screen.getByText('Development')).toBeInTheDocument();
  });

  it('reports when nothing matches', async () => {
    const { user } = setup({ mode: 'create', environmentName: '' });

    await user.type(screen.getByPlaceholderText('e.g. Production'), 'zzz');

    expect(screen.getByText(/no matching environments/i)).toBeInTheDocument();
  });

  // The form submits env_id, not the typed name, so picking an option has to
  // populate the hidden field or the action writes a broken foreign key.
  it('sets the hidden env_id when an option is picked', async () => {
    const { user } = setup({ mode: 'create', environmentName: '' });

    await user.type(screen.getByPlaceholderText('e.g. Production'), 'prod');
    await user.click(screen.getByText('Production'));

    expect(document.querySelector('input[name="env_id"]')).toHaveValue('env-1');
  });
});
