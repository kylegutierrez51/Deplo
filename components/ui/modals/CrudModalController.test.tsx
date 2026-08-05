import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CrudModalController from '@/components/ui/modals/CrudModalController';
import { ToastProvider, useToast } from '@/components/ui/toast/ToastContext';
/*
 * The spies are built inside the factory and read back out with
 * requireMock. Referencing an imported object from the factory instead — even
 * one aliased to a `mock`-prefixed name — throws a TDZ error, because jest.mock
 * is hoisted above the imports and the factory runs while CrudModalController's
 * own import of next/navigation is being resolved.
 */
jest.mock('next/navigation', () => {
  const routerSpies = {
    push: jest.fn(), replace: jest.fn(), refresh: jest.fn(),
    back: jest.fn(), forward: jest.fn(), prefetch: jest.fn(),
  };
  return {
    __router: routerSpies,
    useRouter: () => routerSpies,
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
  };
});

const { __router: router } = jest.requireMock('next/navigation') as {
  __router: Record<string, jest.Mock>;
};

const resetNavigation = () => Object.values(router).forEach(spy => spy.mockReset());

/*
 * This controller owns navigation and toasts for every CRUD resource, so what
 * matters is the exact URL each callback pushes and the icon each toast carries.
 * A spy modal stands in for the real one: it renders a button per callback and
 * reports the props it was handed.
 */

type Row = { id: string; name: string };

/** Renders one button per lifecycle callback so a test can fire any of them. */
function SpyModal(props: Row & { mode: string } & { [k: string]: unknown }) {
  const callbacks = ['onClose', 'onCreate', 'onDelete', 'onEdit', 'onEditOrDeleteClose', 'onSave'];
  return (
    <div>
      <span data-testid="mode">{props.mode}</span>
      <span data-testid="name">{props.name}</span>
      <span data-testid="extra">{String(props.extraValue ?? '')}</span>
      {callbacks.map(name => (
        <button key={name} onClick={() => (props[name] as () => void)()}>{name}</button>
      ))}
      <button onClick={() => (props.onError as (m: string) => void)('something broke')}>onError</button>
    </div>
  );
}

/** Surfaces the live toast list so assertions can read it. */
function ToastProbe() {
  const { toasts } = useToast();
  return <span data-testid="toasts">{toasts.map(t => `${t.text}|${t.icon}`).join(',')}</span>;
}

/*
 * Overrides are typed loosely on purpose: CrudModalController is generic, so
 * Parameters<typeof CrudModalController> resolves its type parameters to their
 * constraints and rejects a partial spread.
 */
type Overrides = {
  mode?: 'view' | 'create' | 'edit';
  record?: Row;
  basePath?: string;
  recordLabel?: string;
  extraProps?: object;
};

function setup(over: Overrides = {}) {
  const user = userEvent.setup();
  const props = {
    mode: 'view' as const,
    record: { id: 'rec-1', name: 'API_KEY' },
    basePath: '/secrets',
    recordLabel: 'secret',
    ...over,
  };
  render(
    <ToastProvider>
      <CrudModalController<Row, object>
        {...props}
        ModalComponent={SpyModal as never}
      />
      <ToastProbe />
    </ToastProvider>,
  );
  return { user };
}

const toasts = () => screen.getByTestId('toasts').textContent;

beforeEach(resetNavigation);

describe('prop wiring', () => {
  it('spreads the record onto the modal', () => {
    setup();

    expect(screen.getByTestId('name')).toHaveTextContent('API_KEY');
  });

  it('passes the mode straight through', () => {
    setup({ mode: 'edit' });

    expect(screen.getByTestId('mode')).toHaveTextContent('edit');
  });

  it('passes extraProps through', () => {
    setup({ extraProps: { extraValue: 'environments' } });

    expect(screen.getByTestId('extra')).toHaveTextContent('environments');
  });

  // The spread order is record then extraProps, so extraProps wins a collision.
  it('lets extraProps override a field of the same name on the record', () => {
    setup({ extraProps: { name: 'overridden' } });

    expect(screen.getByTestId('name')).toHaveTextContent('overridden');
  });

  it('renders in create mode with no record at all', () => {
    setup({ mode: 'create', record: undefined });

    expect(screen.getByTestId('mode')).toHaveTextContent('create');
  });
});

describe('navigation', () => {
  it('clears the query params on close', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'onClose' }));

    expect(router.push).toHaveBeenCalledWith('/secrets');
  });

  it('opens edit mode for the current record', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'onEdit' }));

    expect(router.push).toHaveBeenCalledWith('/secrets?id=rec-1&mode=edit');
  });

  // Backing out of edit or delete returns to view mode on the same record
  // rather than closing the modal entirely.
  it('drops back to view mode on the same record', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'onEditOrDeleteClose' }));

    expect(router.push).toHaveBeenCalledWith('/secrets?id=rec-1');
  });

  it('honours the basePath it was given', async () => {
    const { user } = setup({ basePath: '/environments' });

    await user.click(screen.getByRole('button', { name: 'onClose' }));

    expect(router.push).toHaveBeenCalledWith('/environments');
  });
});

describe('toasts', () => {
  it.each([
    ['onCreate', 'Created secret|checkmark-circle-outline'],
    ['onDelete', 'Deleted secret|trash-outline'],
  ])('%s raises the right toast and closes', async (callback, expected) => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: callback }));

    expect(toasts()).toBe(expected);
    expect(router.push).toHaveBeenCalledWith('/secrets');
  });

  it('names the resource in the toast', async () => {
    const { user } = setup({ recordLabel: 'webhook' });

    await user.click(screen.getByRole('button', { name: 'onCreate' }));

    expect(toasts()).toBe('Created webhook|checkmark-circle-outline');
  });

  it('surfaces an error message with the error icon', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'onError' }));

    expect(toasts()).toBe('something broke|close-circle-outline');
  });

  it('does not navigate on an error', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'onError' }));

    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('saving an edit', () => {
  // Saving an edit stays on the record in view mode, and refreshes so the
  // server component behind the modal re-renders with the new values.
  it('returns to view mode and refreshes the server component', async () => {
    const { user } = setup({ mode: 'edit' });

    await user.click(screen.getByRole('button', { name: 'onSave' }));

    expect(router.push).toHaveBeenCalledWith('/secrets?id=rec-1');
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(toasts()).toBe('Edited secret|create-outline');
  });

  // The key bump remounts the modal, which is what resets its internal edit
  // state back to view without the parent tracking it.
  it('remounts the modal so its internal state resets', async () => {
    const { user } = setup({ mode: 'edit' });
    const before = screen.getByTestId('mode');

    await user.click(screen.getByRole('button', { name: 'onSave' }));

    expect(screen.getByTestId('mode')).not.toBe(before);
  });

  // A create saves and closes instead — there is no record to return to.
  it('closes instead of refreshing when the mode is create', async () => {
    const { user } = setup({ mode: 'create', record: undefined });

    await user.click(screen.getByRole('button', { name: 'onSave' }));

    expect(router.push).toHaveBeenCalledWith('/secrets');
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('closes on save from view mode', async () => {
    const { user } = setup({ mode: 'view' });

    await user.click(screen.getByRole('button', { name: 'onSave' }));

    expect(router.push).toHaveBeenCalledWith('/secrets');
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
